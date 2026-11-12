-- Medios de acceso e integración con access-core (spec 2026-11-11, §2 y §4.7).
-- Catálogo de medios por fraccionamiento, botones de los controles, controles
-- RF, PIN por domicilio y la cola de sincronización con access-core. Los
-- reportes de acceso (vistas accesos_*_info y reporte_accesos_admin) se
-- eliminan: su función la cubre la sincronización.

-- Catálogo de medios ---------------------------------------------------------

create type public.medio_acceso as enum ('tarjeta', 'control', 'pin', 'telefono', 'qr');

-- Medios que el super admin habilita en cada fraccionamiento.
create table public.fraccionamiento_medios (
  fraccionamiento_id bigint not null references public.fraccionamientos (id),
  medio public.medio_acceso not null,
  constraint fraccionamiento_medios_pkey primary key (fraccionamiento_id, medio)
);
alter table public.fraccionamiento_medios enable row level security;

-- Salida que abre cada botón de todos los controles del fraccionamiento.
create table public.fraccionamiento_botones (
  fraccionamiento_id bigint not null references public.fraccionamientos (id),
  boton int not null,
  panel_id uuid not null,
  panel_codigo text not null,
  salida int not null,
  salida_alias text,
  constraint fraccionamiento_botones_pkey primary key (fraccionamiento_id, boton),
  constraint fraccionamiento_botones_boton_check check (boton between 0 and 3),
  constraint fraccionamiento_botones_salida_check check (salida between 0 and 3)
);
alter table public.fraccionamiento_botones enable row level security;

-- Columnas nuevas --------------------------------------------------------------

-- Copia del nombre que da la API, para mostrarlo sin consultarla.
alter table public.fraccionamientos add column instalacion_nombre text;

-- titular_id: id del titular en access-core (nulo mientras no se sincroniza).
-- perfil_asignado_id: último permiso asignado con éxito en access-core.
alter table public.domicilios
  add column titular_id uuid,
  add column perfil_asignado_id uuid;

-- El número no se edita después de crear la tarjeta (la API no cambia
-- card_code) y debe caber en 32 bits.
alter table public.tarjetas_acceso
  add column tarjeta_id uuid,
  add column descripcion text,
  add constraint tarjetas_acceso_numero_check
    check (numero ~ '^\d+$' and numero::numeric <= 4294967295);

-- concepto_pago_acceso: de dos booleanos a un arreglo de medios --------------

alter table public.concepto_pago_acceso
  add column medios public.medio_acceso[] not null default '{}',
  add column perfil_corriente_id uuid,
  add column perfil_corriente_nombre text,
  add column perfil_moroso_id uuid,
  add column perfil_moroso_nombre text;

-- Migración de datos: acceso_tarjeta -> tarjeta, acceso_telefono -> telefono
-- (en ese orden).
update public.concepto_pago_acceso
  set medios = array_remove(
    array[
      case when acceso_tarjeta then 'tarjeta'::public.medio_acceso end,
      case when acceso_telefono then 'telefono'::public.medio_acceso end
    ],
    null);

-- Cada fraccionamiento habilita los medios que ya usan sus tipos de cuota.
insert into public.fraccionamiento_medios (fraccionamiento_id, medio)
select distinct cpa.fraccionamiento_id, m.medio
from public.concepto_pago_acceso cpa
cross join lateral unnest(cpa.medios) as m(medio)
on conflict do nothing;

-- Vistas que leen las columnas viejas.
drop view public.domicilios_info;
drop view public.accesos_telefono_info;
drop view public.accesos_tarjeta_info;

alter table public.concepto_pago_acceso
  drop column acceso_telefono,
  drop column acceso_tarjeta;

create view public.domicilios_info with (security_invoker=on) as
 SELECT d.id,
    d.direccion,
    d.fecha_alta,
    d.observaciones,
    COALESCE(r.nombre, 'Sin información'::text) AS residente_principal,
    dc.concepto_id AS id_concepto,
    cp.nombre AS tipo_cuota,
    COALESCE(cpa.medios, '{}'::public.medio_acceso[]) AS medios,
        CASE
            WHEN (EXISTS ( SELECT 1
               FROM public.cuotas c
              WHERE c.domicilio_id = d.id AND c.estatus_id = 3)) THEN 'Moroso'::text
            ELSE 'Al corriente'::text
        END AS estatus
   FROM public.domicilios d
     LEFT JOIN public.residentes r ON r.domicilio_id = d.id AND r.es_principal = true
     LEFT JOIN public.domicilio_concepto dc ON dc.domicilio_id = d.id
     LEFT JOIN public.conceptos_pago cp ON cp.id = dc.concepto_id
     LEFT JOIN public.concepto_pago_acceso cpa ON cpa.concepto_pago_id = cp.id;

revoke all on public.domicilios_info from anon, authenticated;
grant select on public.domicilios_info to authenticated, service_role;

-- controles_acceso (mismo patrón que tarjetas_acceso) -------------------------

-- botones: [{ boton: 0..3, rf_code: entero de 32 bits, boton_id: uuid | null }],
-- de 1 a 4 elementos con boton distinto.
create function private.botones_control_validos(botones jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(botones) = 'array'
    and jsonb_array_length(botones) between 1 and 4
    and not exists (
      select 1
      from jsonb_array_elements(botones) as e(b)
      where not (
        jsonb_typeof(e.b) = 'object'
        and jsonb_typeof(e.b -> 'boton') = 'number'
        and (e.b ->> 'boton') ~ '^[0-3]$'
        and jsonb_typeof(e.b -> 'rf_code') = 'number'
        and (e.b ->> 'rf_code') ~ '^\d{1,10}$'
        and (e.b ->> 'rf_code')::numeric <= 4294967295
        and (
          e.b -> 'boton_id' is null
          or jsonb_typeof(e.b -> 'boton_id') = 'null'
          or (jsonb_typeof(e.b -> 'boton_id') = 'string'
              and (e.b ->> 'boton_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
        )
      )
    )
    and (select count(distinct e.b ->> 'boton') from jsonb_array_elements(botones) as e(b))
      = jsonb_array_length(botones);
$$;

revoke execute on function private.botones_control_validos(jsonb) from public, anon;
grant execute on function private.botones_control_validos(jsonb) to authenticated, service_role;

create table public.controles_acceso (
  id bigint generated by default as identity primary key,
  created_at timestamptz not null default now(),
  fraccionamiento_id bigint not null default private.fraccionamiento_actual() references public.fraccionamientos (id),
  domicilio_id bigint not null,
  control_id uuid,
  descripcion text,
  botones jsonb not null,
  constraint controles_acceso_id_fraccionamiento_key unique (id, fraccionamiento_id),
  constraint controles_acceso_domicilio_id_fkey foreign key (domicilio_id, fraccionamiento_id) references public.domicilios (id, fraccionamiento_id) on update cascade on delete cascade,
  constraint controles_acceso_botones_check check (private.botones_control_validos(botones))
);
alter table public.controles_acceso enable row level security;
create index controles_acceso_fraccionamiento_id_idx on public.controles_acceso (fraccionamiento_id);
create index controles_acceso_domicilio_id_idx on public.controles_acceso (domicilio_id);

-- pines_acceso: tabla aparte para restringirla por rol con RLS -----------------

create table public.pines_acceso (
  domicilio_id bigint primary key,
  fraccionamiento_id bigint not null default private.fraccionamiento_actual() references public.fraccionamientos (id),
  pin text not null,
  actualizado_at timestamptz not null default now(),
  constraint pines_acceso_domicilio_id_fkey foreign key (domicilio_id, fraccionamiento_id) references public.domicilios (id, fraccionamiento_id) on update cascade on delete cascade,
  constraint pines_acceso_pin_check check (pin ~ '^\d{4,6}$')
);
alter table public.pines_acceso enable row level security;
create index pines_acceso_fraccionamiento_id_idx on public.pines_acceso (fraccionamiento_id);

-- sincronizaciones_acceso: la cola ---------------------------------------------
-- id también es la Idempotency-Key. domicilio_id sin FK para sobrevivir al
-- borrado del domicilio. carga nunca contiene el PIN.

create table public.sincronizaciones_acceso (
  id uuid primary key default gen_random_uuid(),
  fraccionamiento_id bigint not null default private.fraccionamiento_actual() references public.fraccionamientos (id),
  domicilio_id bigint,
  entidad text not null,
  entidad_id bigint,
  operacion text not null,
  carga jsonb not null default '{}',
  estado text not null default 'pendiente',
  intentos int not null default 0,
  ultimo_error text,
  proximo_intento_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sincronizaciones_acceso_entidad_check check (entidad in ('domicilio', 'tarjeta', 'control', 'pin')),
  constraint sincronizaciones_acceso_operacion_check
    check (operacion in ('crear', 'actualizar', 'borrar', 'asignar', 'reconciliar', 'fijar', 'quitar')),
  constraint sincronizaciones_acceso_estado_check check (estado in ('pendiente', 'ok', 'error'))
);
alter table public.sincronizaciones_acceso enable row level security;
create index sincronizaciones_acceso_fracc_estado_proximo_idx
  on public.sincronizaciones_acceso (fraccionamiento_id, estado, proximo_intento_at);
create index sincronizaciones_acceso_domicilio_id_idx on public.sincronizaciones_acceso (domicilio_id);

-- Triggers -----------------------------------------------------------------------
-- security definer: la comprobación no debe depender de qué filas deja ver la
-- RLS a quien escribe.

-- Un tipo de cuota solo usa medios habilitados en su fraccionamiento.
create function private.fn_validar_medios_concepto()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_medio public.medio_acceso;
begin
  select m.medio into v_medio
  from unnest(new.medios) as m(medio)
  where not exists (
    select 1 from public.fraccionamiento_medios fm
    where fm.fraccionamiento_id = new.fraccionamiento_id
      and fm.medio = m.medio
  )
  limit 1;

  if v_medio is not null then
    raise exception 'El medio % no está habilitado para este fraccionamiento', v_medio
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger trg_validar_medios_concepto
  before insert or update on public.concepto_pago_acceso
  for each row execute function private.fn_validar_medios_concepto();

-- No se quita (ni se cambia) un medio que usa algún tipo de cuota.
create function private.fn_proteger_medio_en_uso()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
     and new.fraccionamiento_id = old.fraccionamiento_id
     and new.medio = old.medio then
    return new;
  end if;

  if exists (
    select 1 from public.concepto_pago_acceso cpa
    where cpa.fraccionamiento_id = old.fraccionamiento_id
      and old.medio = any (cpa.medios)
  ) then
    raise exception 'Hay tipos de cuota que usan este medio' using errcode = '23503';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger trg_proteger_medio_en_uso
  before update or delete on public.fraccionamiento_medios
  for each row execute function private.fn_proteger_medio_en_uso();

revoke execute on function
  private.fn_validar_medios_concepto(),
  private.fn_proteger_medio_en_uso()
from public, anon, authenticated;

-- Funciones ----------------------------------------------------------------------

-- Permiso de access-core que le toca al domicilio según su tipo de cuota.
-- Moroso = alguna cuota vencida sin pagar (estatus 3), el mismo criterio de
-- domicilios_info.estatus. El proyecto 2 solo cambia esta función.
create function public.perfil_deseado(p_domicilio_id bigint)
returns uuid
language sql
stable
security invoker
set search_path = ''
as $$
  select case
           when exists (
             select 1 from public.cuotas c
             where c.domicilio_id = p_domicilio_id and c.estatus_id = 3
           ) then cpa.perfil_moroso_id
           else cpa.perfil_corriente_id
         end
  from public.domicilio_concepto dc
  join public.concepto_pago_acceso cpa on cpa.concepto_pago_id = dc.concepto_id
  where dc.domicilio_id = p_domicilio_id;
$$;

-- Encola una tarea 'asignar' por cada domicilio sincronizado cuyo permiso
-- deseado difiere del asignado y que no tenga ya una pendiente. Devuelve
-- cuántas insertó. Con null recorre todos los fraccionamientos (solo el cron o
-- service_role, sin usuario); con id, exige que sea el fraccionamiento del
-- usuario o super admin.
create function public.recalcular_permisos_acceso(p_fraccionamiento_id bigint default null)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_insertadas int;
begin
  if p_fraccionamiento_id is null then
    if (select auth.uid()) is not null then
      raise exception 'No autorizado' using errcode = '42501';
    end if;
  elsif not (select private.es_super_admin())
        and p_fraccionamiento_id is distinct from (select private.fraccionamiento_actual())
        and (select auth.uid()) is not null then
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  insert into public.sincronizaciones_acceso (fraccionamiento_id, domicilio_id, entidad, entidad_id, operacion)
  select d.fraccionamiento_id, d.id, 'domicilio', d.id, 'asignar'
  from public.domicilios d
  where (p_fraccionamiento_id is null or d.fraccionamiento_id = p_fraccionamiento_id)
    and d.titular_id is not null
    and public.perfil_deseado(d.id) is distinct from d.perfil_asignado_id
    and not exists (
      select 1 from public.sincronizaciones_acceso s
      where s.domicilio_id = d.id
        and s.entidad = 'domicilio'
        and s.operacion = 'asignar'
        and s.estado = 'pendiente'
    );

  get diagnostics v_insertadas = row_count;
  return v_insertadas;
end;
$$;

-- Borra las tareas de sincronización que no terminaron (pendiente o error) de un
-- fraccionamiento: al cambiar su instalación dejarían de tener sentido y una
-- 'domicilio crear' sin terminar bloquea el resto de las tareas del domicilio.
-- Falla con P0001 ('sincronización en curso') si hay un lease vigente.
-- Solo el super admin (o service_role, sin usuario). Devuelve cuántas borró.
create function public.cancelar_sincronizaciones(p_fraccionamiento_id bigint)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_borradas int;
begin
  if (select auth.uid()) is not null and not (select private.es_super_admin()) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  -- Un trabajador con el lease vigente podría guardar ids de la instalación
  -- anterior después de cancelar: se rechaza hasta que termine o venza.
  -- (`sincronizacion_leases` se crea más abajo; plpgsql la resuelve al ejecutar.)
  if exists (
    select 1 from public.sincronizacion_leases
    where fraccionamiento_id = p_fraccionamiento_id and hasta > now()
  ) then
    raise exception 'sincronización en curso' using errcode = 'P0001';
  end if;

  delete from public.sincronizaciones_acceso
  where fraccionamiento_id = p_fraccionamiento_id
    and estado <> 'ok';

  get diagnostics v_borradas = row_count;
  return v_borradas;
end;
$$;

revoke execute on function public.cancelar_sincronizaciones(bigint) from public, anon;
grant execute on function public.cancelar_sincronizaciones(bigint) to authenticated, service_role;

-- Lease por fraccionamiento para que no corran dos trabajadores a la vez sobre
-- la misma instalación. Cada llamada RPC de PostgREST es su propia transacción,
-- así que un advisory lock de transacción no serviría: el trabajador toma el
-- lease con un token, lo renueva mientras procesa y lo libera al terminar. Si
-- el trabajador muere, el lease vence solo (`hasta`).
create table public.sincronizacion_leases (
  fraccionamiento_id bigint primary key references public.fraccionamientos (id) on delete cascade,
  token uuid not null,
  hasta timestamptz not null
);

alter table public.sincronizacion_leases enable row level security;
revoke all on public.sincronizacion_leases from public, anon, authenticated;
grant all on public.sincronizacion_leases to service_role;

-- Toma (o renueva, con el mismo token) el lease; devuelve si este token lo tiene.
create function public.adquirir_sincronizacion(
  p_fraccionamiento_id bigint,
  p_token uuid,
  p_segundos int default 300
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token uuid;
begin
  insert into public.sincronizacion_leases as l (fraccionamiento_id, token, hasta)
  values (p_fraccionamiento_id, p_token, now() + make_interval(secs => p_segundos))
  on conflict (fraccionamiento_id) do update
    set token = excluded.token, hasta = excluded.hasta
    where l.hasta < now() or l.token = excluded.token
  returning l.token into v_token;
  return v_token is not null;
end;
$$;

-- Libera el lease solo si lo tiene este token.
create function public.liberar_sincronizacion(p_fraccionamiento_id bigint, p_token uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.sincronizacion_leases
  where fraccionamiento_id = p_fraccionamiento_id and token = p_token;
$$;

revoke execute on function
  public.perfil_deseado(bigint),
  public.recalcular_permisos_acceso(bigint),
  public.adquirir_sincronizacion(bigint, uuid, int),
  public.liberar_sincronizacion(bigint, uuid)
from public, anon, authenticated;

grant execute on function
  public.perfil_deseado(bigint),
  public.recalcular_permisos_acceso(bigint)
to authenticated, service_role;

grant execute on function
  public.adquirir_sincronizacion(bigint, uuid, int),
  public.liberar_sincronizacion(bigint, uuid)
to service_role;

-- marcar_cuotas_vencidas recalcula los permisos al final -------------------------

create or replace function public.marcar_cuotas_vencidas()
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.cuotas c
  set estatus_id = 3
  where c.fecha_vencimiento < current_date
    and c.estatus_id != 3 -- evita reprocesar
    and not exists (
      select 1
      from public.pagos p
      where p.cuota_id = c.id
    );

  perform public.recalcular_permisos_acceso();
end;
$$;

-- Reporte de accesos del super admin: lo sustituye la sincronización.
drop function public.reporte_accesos_admin(bigint, int, int, text);

-- Una tarea solo puede apuntar a filas de su propio fraccionamiento. domicilio_id
-- no tiene FK (sobrevive al borrado), así que sin esto un usuario de A podría
-- encolar una tarea con un domicilio, tarjeta o control de B, y el trabajador
-- (service_role, sin RLS) leería y mandaría esos datos a la instalación de A.
--   domicilio_id: nulo o un domicilio del fraccionamiento.
--   entidad 'domicilio': entidad_id nulo o igual a domicilio_id.
--   entidad 'tarjeta' / 'control': entidad_id de una fila de ese fraccionamiento
--     (y del domicilio, si viene).
--   entidad 'pin': entidad_id nulo (va por domicilio).
-- Las tareas 'borrar' deben encolarse antes de borrar la fila local.
-- security definer: la comprobación no depende de lo que la RLS deja ver.
create function private.tarea_sincronizacion_valida(
  p_fraccionamiento_id bigint,
  p_domicilio_id bigint,
  p_entidad text,
  p_entidad_id bigint
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (p_domicilio_id is null or exists (
      select 1 from public.domicilios d
      where d.id = p_domicilio_id and d.fraccionamiento_id = p_fraccionamiento_id))
    and case p_entidad
      when 'domicilio' then p_entidad_id is null or p_entidad_id = p_domicilio_id
      when 'tarjeta' then exists (
        select 1 from public.tarjetas_acceso t
        where t.id = p_entidad_id
          and t.fraccionamiento_id = p_fraccionamiento_id
          and (p_domicilio_id is null or t.domicilio_id = p_domicilio_id))
      when 'control' then exists (
        select 1 from public.controles_acceso c
        where c.id = p_entidad_id
          and c.fraccionamiento_id = p_fraccionamiento_id
          and (p_domicilio_id is null or c.domicilio_id = p_domicilio_id))
      when 'pin' then p_entidad_id is null
      else false
    end;
$$;

revoke execute on function private.tarea_sincronizacion_valida(bigint, bigint, text, bigint) from public, anon;
grant execute on function private.tarea_sincronizacion_valida(bigint, bigint, text, bigint) to authenticated, service_role;

-- Políticas ----------------------------------------------------------------------

-- fraccionamiento_medios: leen los roles del fraccionamiento; escribe el super admin.

create policy fraccionamiento_medios_select on public.fraccionamiento_medios
  for select to authenticated
  using (
    (select private.es_super_admin())
    or (fraccionamiento_id = (select private.fraccionamiento_actual())
        and (select private.tiene_rol(array['administrador', 'tesorero', 'comite', 'vigilancia']::public.rol_usuario[])))
  );

create policy fraccionamiento_medios_insert on public.fraccionamiento_medios
  for insert to authenticated
  with check ((select private.es_super_admin()));

create policy fraccionamiento_medios_update on public.fraccionamiento_medios
  for update to authenticated
  using ((select private.es_super_admin()))
  with check ((select private.es_super_admin()));

create policy fraccionamiento_medios_delete on public.fraccionamiento_medios
  for delete to authenticated
  using ((select private.es_super_admin()));

-- fraccionamiento_botones: igual que fraccionamiento_medios.

create policy fraccionamiento_botones_select on public.fraccionamiento_botones
  for select to authenticated
  using (
    (select private.es_super_admin())
    or (fraccionamiento_id = (select private.fraccionamiento_actual())
        and (select private.tiene_rol(array['administrador', 'tesorero', 'comite', 'vigilancia']::public.rol_usuario[])))
  );

create policy fraccionamiento_botones_insert on public.fraccionamiento_botones
  for insert to authenticated
  with check ((select private.es_super_admin()));

create policy fraccionamiento_botones_update on public.fraccionamiento_botones
  for update to authenticated
  using ((select private.es_super_admin()))
  with check ((select private.es_super_admin()));

create policy fraccionamiento_botones_delete on public.fraccionamiento_botones
  for delete to authenticated
  using ((select private.es_super_admin()));

-- controles_acceso: como tarjetas_acceso.

create policy controles_acceso_select on public.controles_acceso
  for select to authenticated
  using (
    (select private.es_super_admin())
    or (fraccionamiento_id = (select private.fraccionamiento_actual())
        and (select private.tiene_rol(array['administrador', 'tesorero', 'comite', 'vigilancia']::public.rol_usuario[])))
  );

create policy controles_acceso_insert on public.controles_acceso
  for insert to authenticated
  with check (
    (select private.es_super_admin())
    or (fraccionamiento_id = (select private.fraccionamiento_actual())
        and (select private.tiene_rol(array['administrador']::public.rol_usuario[])))
  );

create policy controles_acceso_update on public.controles_acceso
  for update to authenticated
  using (
    (select private.es_super_admin())
    or (fraccionamiento_id = (select private.fraccionamiento_actual())
        and (select private.tiene_rol(array['administrador']::public.rol_usuario[])))
  )
  with check (
    (select private.es_super_admin())
    or (fraccionamiento_id = (select private.fraccionamiento_actual())
        and (select private.tiene_rol(array['administrador']::public.rol_usuario[])))
  );

create policy controles_acceso_delete on public.controles_acceso
  for delete to authenticated
  using (
    (select private.es_super_admin())
    or (fraccionamiento_id = (select private.fraccionamiento_actual())
        and (select private.tiene_rol(array['administrador']::public.rol_usuario[])))
  );

-- pines_acceso: solo administrador, tesorero y super admin (comité y vigilancia
-- no la ven).

create policy pines_acceso_select on public.pines_acceso
  for select to authenticated
  using (
    (select private.es_super_admin())
    or (fraccionamiento_id = (select private.fraccionamiento_actual())
        and (select private.tiene_rol(array['administrador', 'tesorero']::public.rol_usuario[])))
  );

create policy pines_acceso_insert on public.pines_acceso
  for insert to authenticated
  with check (
    (select private.es_super_admin())
    or (fraccionamiento_id = (select private.fraccionamiento_actual())
        and (select private.tiene_rol(array['administrador', 'tesorero']::public.rol_usuario[])))
  );

create policy pines_acceso_update on public.pines_acceso
  for update to authenticated
  using (
    (select private.es_super_admin())
    or (fraccionamiento_id = (select private.fraccionamiento_actual())
        and (select private.tiene_rol(array['administrador', 'tesorero']::public.rol_usuario[])))
  )
  with check (
    (select private.es_super_admin())
    or (fraccionamiento_id = (select private.fraccionamiento_actual())
        and (select private.tiene_rol(array['administrador', 'tesorero']::public.rol_usuario[])))
  );

create policy pines_acceso_delete on public.pines_acceso
  for delete to authenticated
  using (
    (select private.es_super_admin())
    or (fraccionamiento_id = (select private.fraccionamiento_actual())
        and (select private.tiene_rol(array['administrador', 'tesorero']::public.rol_usuario[])))
  );

-- sincronizaciones_acceso: leen los roles del fraccionamiento y el super admin;
-- encolan administrador, tesorero y super admin. Sin políticas de update ni
-- delete: solo service_role (el trabajador) los hace.

create policy sincronizaciones_acceso_select on public.sincronizaciones_acceso
  for select to authenticated
  using (
    (select private.es_super_admin())
    or (fraccionamiento_id = (select private.fraccionamiento_actual())
        and (select private.tiene_rol(array['administrador', 'tesorero', 'comite', 'vigilancia']::public.rol_usuario[])))
  );

create policy sincronizaciones_acceso_insert on public.sincronizaciones_acceso
  for insert to authenticated
  with check (
    ((select private.es_super_admin())
     or (fraccionamiento_id = (select private.fraccionamiento_actual())
         and (select private.tiene_rol(array['administrador', 'tesorero']::public.rol_usuario[]))))
    and private.tarea_sincronizacion_valida(fraccionamiento_id, domicilio_id, entidad, entidad_id)
  );

-- Grants -------------------------------------------------------------------------

revoke all on public.fraccionamiento_medios from anon, authenticated;
grant select, insert, update, delete on public.fraccionamiento_medios to authenticated;
grant all on public.fraccionamiento_medios to service_role;
revoke all on public.fraccionamiento_botones from anon, authenticated;
grant select, insert, update, delete on public.fraccionamiento_botones to authenticated;
grant all on public.fraccionamiento_botones to service_role;
revoke all on public.controles_acceso from anon, authenticated;
grant select, insert, update, delete on public.controles_acceso to authenticated;
grant all on public.controles_acceso to service_role;
revoke all on sequence public.controles_acceso_id_seq from anon, authenticated;
grant usage, select on sequence public.controles_acceso_id_seq to service_role;
revoke all on public.pines_acceso from anon, authenticated;
grant select, insert, update, delete on public.pines_acceso to authenticated;
grant all on public.pines_acceso to service_role;
revoke all on public.sincronizaciones_acceso from anon, authenticated;
grant select, insert, update, delete on public.sincronizaciones_acceso to authenticated;
grant all on public.sincronizaciones_acceso to service_role;
