-- Residentes como usuarios (spec 2026-11-13-residentes-app-movil-design).
-- Cuenta = usuario de Auth con correo sintético <telefono>@auth.internal.
-- Los residentes NO tienen fila en perfiles: fraccionamiento_actual(),
-- tiene_rol() y es_super_admin() devuelven null/false para ellos, así que
-- las políticas del personal los niegan por omisión. Aquí solo se agregan
-- políticas de SELECT limitadas a sus propios domicilios.

-- cuentas_residente -------------------------------------------------------------

create table public.cuentas_residente (
  user_id uuid primary key references auth.users (id) on delete cascade,
  telefono text not null,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  constraint cuentas_residente_telefono_key unique (telefono),
  constraint cuentas_residente_telefono_check check (telefono ~ '^[0-9]{10}$')
);
alter table public.cuentas_residente enable row level security;

-- residentes.user_id ------------------------------------------------------------

alter table public.residentes
  add column user_id uuid references public.cuentas_residente (user_id) on delete set null,
  add constraint residentes_domicilio_id_user_id_key unique (domicilio_id, user_id);
create index residentes_user_id_idx on public.residentes (user_id);

-- fraccionamientos.max_residentes_app --------------------------------------------

alter table public.fraccionamientos
  add column max_residentes_app smallint not null default 5,
  add constraint fraccionamientos_max_residentes_app_check check (max_residentes_app between 1 and 20);

-- El administrador puede actualizar solo max_residentes_app de su
-- fraccionamiento. La política abre el update; el trigger impide que toque
-- cualquier otra columna (super admin y service-role sin restricción).
create policy fraccionamientos_update_admin on public.fraccionamientos
  for update to authenticated
  using (
    id = (select private.fraccionamiento_actual())
    and (select private.tiene_rol(array['administrador']::public.rol_usuario[]))
  )
  with check (
    id = (select private.fraccionamiento_actual())
    and (select private.tiene_rol(array['administrador']::public.rol_usuario[]))
  );

create function private.fn_fraccionamientos_solo_max()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null
     and not (select private.es_super_admin())
     and (to_jsonb(new) - 'max_residentes_app') is distinct from (to_jsonb(old) - 'max_residentes_app') then
    raise exception 'Solo puedes cambiar el máximo de residentes con acceso a la app'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger trg_fraccionamientos_solo_max
  before update on public.fraccionamientos
  for each row execute function private.fn_fraccionamientos_solo_max();

-- Helpers del residente ------------------------------------------------------------

create function private.domicilios_del_residente()
returns setof bigint
language sql
stable
security definer
set search_path = ''
as $$
  select r.domicilio_id
  from public.residentes r
  join public.cuentas_residente c on c.user_id = r.user_id
  join public.fraccionamientos f on f.id = r.fraccionamiento_id
  where r.user_id = (select auth.uid())
    and c.activo
    and f.activo;
$$;

create function private.es_residente_de(p_domicilio_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from private.domicilios_del_residente() d where d = p_domicilio_id
  );
$$;

revoke execute on function
  private.domicilios_del_residente(),
  private.es_residente_de(bigint)
from public, anon;
grant execute on function
  private.domicilios_del_residente(),
  private.es_residente_de(bigint)
to authenticated, service_role;

-- RLS: cuentas_residente ------------------------------------------------------------

create policy cuentas_residente_select on public.cuentas_residente
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or (select private.es_super_admin())
    or (
      (select private.tiene_rol(array['administrador', 'tesorero']::public.rol_usuario[]))
      and exists (
        select 1 from public.residentes r
        where r.user_id = cuentas_residente.user_id
          and r.fraccionamiento_id = (select private.fraccionamiento_actual())
      )
    )
  );

revoke all on public.cuentas_residente from anon, authenticated;
grant select on public.cuentas_residente to authenticated;
grant all on public.cuentas_residente to service_role;

-- Políticas de solo lectura del residente ---------------------------------------------

create policy domicilios_residente_select on public.domicilios
  for select to authenticated
  using (id in (select private.domicilios_del_residente()));

create policy cuotas_residente_select on public.cuotas
  for select to authenticated
  using (domicilio_id in (select private.domicilios_del_residente()));

create policy pagos_residente_select on public.pagos
  for select to authenticated
  using (domicilio_id in (select private.domicilios_del_residente()));

create policy recargo_cuota_residente_select on public.recargo_cuota
  for select to authenticated
  using (cuota_id in (
    select c.id from public.cuotas c
    where c.domicilio_id in (select private.domicilios_del_residente())
  ));

create policy descuento_cuota_residente_select on public.descuento_cuota
  for select to authenticated
  using (cuota_id in (
    select c.id from public.cuotas c
    where c.domicilio_id in (select private.domicilios_del_residente())
  ));

create policy residentes_residente_select on public.residentes
  for select to authenticated
  using (domicilio_id in (select private.domicilios_del_residente()));

create policy tarjetas_acceso_residente_select on public.tarjetas_acceso
  for select to authenticated
  using (domicilio_id in (select private.domicilios_del_residente()));

create policy controles_acceso_residente_select on public.controles_acceso
  for select to authenticated
  using (domicilio_id in (select private.domicilios_del_residente()));

create policy pines_acceso_residente_select on public.pines_acceso
  for select to authenticated
  using (domicilio_id in (select private.domicilios_del_residente()));

create policy telefonos_acceso_residente_select on public.telefonos_acceso
  for select to authenticated
  using (domicilio_id in (select private.domicilios_del_residente()));

create policy domicilio_concepto_residente_select on public.domicilio_concepto
  for select to authenticated
  using (domicilio_id in (select private.domicilios_del_residente()));

-- Conceptos asignados a sus domicilios o usados en sus cuotas (para que
-- cuotas_info/pagos_info muestren el nombre de cuotas históricas).
create policy conceptos_pago_residente_select on public.conceptos_pago
  for select to authenticated
  using (
    id in (select dc.concepto_id from public.domicilio_concepto dc
           where dc.domicilio_id in (select private.domicilios_del_residente()))
    or id in (select c.concepto_id from public.cuotas c
              where c.domicilio_id in (select private.domicilios_del_residente()))
  );

-- Las vistas security_invoker (domicilios_info, cuotas_info) hacen join con
-- estos catálogos: el residente solo ve las filas ligadas a sus domicilios.
create policy concepto_pago_acceso_residente_select on public.concepto_pago_acceso
  for select to authenticated
  using (concepto_pago_id in (
    select dc.concepto_id from public.domicilio_concepto dc
    where dc.domicilio_id in (select private.domicilios_del_residente())
  ));

create policy conceptos_recargo_residente_select on public.conceptos_recargo
  for select to authenticated
  using (id in (
    select rc.concepto_recargo_id
    from public.recargo_cuota rc
    join public.cuotas c on c.id = rc.cuota_id
    where c.domicilio_id in (select private.domicilios_del_residente())
  ));

create policy conceptos_descuento_residente_select on public.conceptos_descuento
  for select to authenticated
  using (id in (
    select dc.concepto_descuento_id
    from public.descuento_cuota dc
    join public.cuotas c on c.id = dc.cuota_id
    where c.domicilio_id in (select private.domicilios_del_residente())
  ));

-- residentes_con_cuenta ------------------------------------------------------------------
-- Security invoker: el RLS de residentes limita el conteo al personal del
-- fraccionamiento o al propio residente; cualquier otro obtiene 0.

create function public.residentes_con_cuenta(p_domicilio_id bigint)
returns int
language sql
stable
set search_path = ''
as $$
  select count(*)::int
  from public.residentes r
  where r.domicilio_id = p_domicilio_id
    and r.user_id is not null;
$$;

revoke execute on function public.residentes_con_cuenta(bigint) from public, anon;
grant execute on function public.residentes_con_cuenta(bigint) to authenticated, service_role;

-- residentes.user_id solo lo escribe service-role (alta de cuentas en el
-- servidor). authenticated conserva insert/update en las demás columnas.
revoke insert, update on public.residentes from authenticated;
grant insert (fraccionamiento_id, nombre, telefono, domicilio_id, es_principal)
  on public.residentes to authenticated;
grant update (fraccionamiento_id, nombre, telefono, domicilio_id, es_principal)
  on public.residentes to authenticated;

-- telefonos_acceso.residente_id --------------------------------------------------------
-- Marca los teléfonos que se registraron automáticamente al dar acceso a la app, para no
-- borrar al quitarlo uno que el administrador registró a mano.
alter table public.telefonos_acceso add column residente_id bigint;
alter table public.telefonos_acceso
  add constraint telefonos_acceso_residente_id_fkey
  foreign key (residente_id, fraccionamiento_id) references public.residentes (id, fraccionamiento_id)
  on delete set null (residente_id);
create index telefonos_acceso_residente_id_idx on public.telefonos_acceso (residente_id);
