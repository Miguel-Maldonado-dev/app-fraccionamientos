-- Reglas de cobro y morosidad por fraccionamiento
-- (spec 2026-11-12-reglas-cobro-morosidad). Sección 1: esquema, fechas y
-- generación de cuotas. Sin fila en reglas_cobro = comportamiento anterior.

-- Fecha de hoy ---------------------------------------------------------------
-- Zona America/Mexico_City. Las pruebas pueden fijarla con
-- set_config('app.hoy', 'AAAA-MM-DD', ...).

create function private.hoy()
returns date
language sql
stable
set search_path = ''
as $$
  select coalesce(
    nullif(current_setting('app.hoy', true), '')::date,
    (now() at time zone 'America/Mexico_City')::date
  );
$$;

-- reglas_cobro -------------------------------------------------------------------

create table public.reglas_cobro (
  fraccionamiento_id bigint primary key references public.fraccionamientos (id) on delete cascade,
  dia_generacion smallint,
  dia_vencimiento smallint,
  dias_gracia smallint not null default 0,
  cuotas_para_moroso smallint not null default 1,
  concepto_recargo_id bigint,
  recargo_desde date,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid(),
  constraint reglas_cobro_dia_generacion_check check (dia_generacion between 1 and 28),
  constraint reglas_cobro_dia_vencimiento_check check (dia_vencimiento between 1 and 31),
  constraint reglas_cobro_dias_gracia_check check (dias_gracia between 0 and 60),
  constraint reglas_cobro_cuotas_para_moroso_check check (cuotas_para_moroso between 1 and 12),
  constraint reglas_cobro_concepto_recargo_id_fkey
    foreign key (concepto_recargo_id, fraccionamiento_id)
    references public.conceptos_recargo (id, fraccionamiento_id)
    on delete set null (concepto_recargo_id)
);
alter table public.reglas_cobro enable row level security;
create index reglas_cobro_concepto_recargo_id_idx on public.reglas_cobro (concepto_recargo_id);

-- recargo_desde sigue a concepto_recargo_id: fecha en que se activó el recargo
-- (para no cobrar retroactivo) o nulo si no hay recargo. También registra
-- quién y cuándo editó. El set null de la FK dispara este trigger, así que
-- borrar el concepto también limpia recargo_desde.
create function private.fn_reglas_cobro_antes()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.concepto_recargo_id is null then
    new.recargo_desde := null;
  elsif tg_op = 'INSERT' or old.concepto_recargo_id is distinct from new.concepto_recargo_id then
    new.recargo_desde := private.hoy();
  else
    new.recargo_desde := old.recargo_desde;
  end if;
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  return new;
end;
$$;

create trigger trg_reglas_cobro_antes
  before insert or update on public.reglas_cobro
  for each row execute function private.fn_reglas_cobro_antes();

create policy reglas_cobro_select on public.reglas_cobro
  for select to authenticated
  using (
    (select private.es_super_admin())
    or fraccionamiento_id = (select private.fraccionamiento_actual())
  );

create policy reglas_cobro_insert on public.reglas_cobro
  for insert to authenticated
  with check (
    (select private.es_super_admin())
    or (fraccionamiento_id = (select private.fraccionamiento_actual())
        and (select private.tiene_rol(array['administrador']::public.rol_usuario[])))
  );

create policy reglas_cobro_update on public.reglas_cobro
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

-- Sin política de delete: se desactivan las reglas con valores nulos.
revoke all on public.reglas_cobro from anon, authenticated;
grant select, insert, update on public.reglas_cobro to authenticated;
grant all on public.reglas_cobro to service_role;

-- Ajuste manual de acceso en domicilios ------------------------------------------
-- Solo se escribe vía la RPC forzar_acceso (sección 2): authenticated pierde
-- el update directo de estas columnas.

alter table public.domicilios
  add column acceso_forzado text,
  add column acceso_forzado_por uuid,
  add column acceso_forzado_en timestamptz,
  add constraint domicilios_acceso_forzado_check check (acceso_forzado in ('activo', 'inactivo'));

revoke update on public.domicilios from authenticated;
grant update (
  id, created_at, fraccionamiento_id, direccion, fecha_alta, observaciones,
  created_by, titular_id, perfil_asignado_id
) on public.domicilios to authenticated;

-- Reglas efectivas y fechas ---------------------------------------------------------
-- security definer: la regla aplica igual sin importar qué deja ver la RLS.

create function private.reglas_de(p_fraccionamiento_id bigint)
returns table (
  dia_generacion smallint,
  dia_vencimiento smallint,
  dias_gracia smallint,
  cuotas_para_moroso smallint,
  concepto_recargo_id bigint,
  recargo_desde date
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.dia_generacion, r.dia_vencimiento,
         coalesce(r.dias_gracia, 0::smallint), coalesce(r.cuotas_para_moroso, 1::smallint),
         r.concepto_recargo_id, r.recargo_desde
  from (select 1) as uno
  left join public.reglas_cobro r on r.fraccionamiento_id = p_fraccionamiento_id;
$$;

-- Vence el dia_vencimiento (nulo o mayor al último día => último día). Si
-- dia_vencimiento < dia_generacion, vence en el mes siguiente ("mes vencido").
create function private.fecha_vencimiento(p_fraccionamiento_id bigint, p_anio integer, p_mes integer)
returns date
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_reglas record;
  v_mes date := make_date(p_anio, p_mes, 1);
  v_ultimo integer;
begin
  select * into v_reglas from private.reglas_de(p_fraccionamiento_id);

  if v_reglas.dia_vencimiento is not null
     and v_reglas.dia_generacion is not null
     and v_reglas.dia_vencimiento < v_reglas.dia_generacion then
    v_mes := (v_mes + interval '1 month')::date;
  end if;

  v_ultimo := extract(day from (v_mes + interval '1 month - 1 day'))::integer;
  return v_mes + (least(coalesce(v_reglas.dia_vencimiento, v_ultimo), v_ultimo) - 1);
end;
$$;

-- Generación ---------------------------------------------------------------------------
-- Sin chequeo de rol: lo hacen las RPC públicas; el proceso diario la llama
-- como postgres. security invoker: con un usuario aplica la RLS de cuotas.

create function private.generar_cuotas_de(p_fraccionamiento_id bigint, p_anio integer, p_mes integer)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_n integer;
begin
  insert into public.cuotas (
    fraccionamiento_id, domicilio_id, anio, mes, fecha_vencimiento, estatus_id, concepto_id, importe
  )
  select
    dc.fraccionamiento_id,
    dc.domicilio_id,
    p_anio,
    p_mes,
    private.fecha_vencimiento(p_fraccionamiento_id, p_anio, p_mes),
    1,
    dc.concepto_id,
    cp.importe
  from public.domicilio_concepto dc
  join public.conceptos_pago cp on cp.id = dc.concepto_id
  where dc.fraccionamiento_id = p_fraccionamiento_id
    and not exists (
      select 1
      from public.cuotas c
      where c.domicilio_id = dc.domicilio_id
        and c.concepto_id = dc.concepto_id
        and c.anio = p_anio
        and c.mes = p_mes
    );
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

create or replace function public.generar_cuotas(p_anio integer, p_mes integer)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not (select private.tiene_rol(array['administrador', 'tesorero']::public.rol_usuario[])) then
    raise exception 'No tienes permiso para generar cuotas' using errcode = '42501';
  end if;

  perform private.generar_cuotas_de((select private.fraccionamiento_actual()), p_anio, p_mes);
end;
$$;

-- Cuota individual (incluye meses futuros para pagos adelantados).
create function public.generar_cuota_domicilio(p_domicilio_id bigint, p_anio integer, p_mes integer)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_fid bigint := (select private.fraccionamiento_actual());
  v_concepto_id bigint;
  v_importe numeric;
begin
  if not (select private.tiene_rol(array['administrador', 'tesorero']::public.rol_usuario[])) then
    raise exception 'No tienes permiso para generar cuotas' using errcode = '42501';
  end if;

  select dc.concepto_id, cp.importe into v_concepto_id, v_importe
  from public.domicilio_concepto dc
  join public.conceptos_pago cp on cp.id = dc.concepto_id
  where dc.domicilio_id = p_domicilio_id
    and dc.fraccionamiento_id = v_fid;

  if v_concepto_id is null or v_importe is null then
    raise exception 'El domicilio no tiene tipo de cuota' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.cuotas c
    where c.domicilio_id = p_domicilio_id and c.concepto_id = v_concepto_id
      and c.anio = p_anio and c.mes = p_mes
  ) then
    raise exception 'La cuota ya existe' using errcode = 'P0001';
  end if;

  insert into public.cuotas (
    fraccionamiento_id, domicilio_id, anio, mes, fecha_vencimiento, estatus_id, concepto_id, importe
  ) values (
    v_fid, p_domicilio_id, p_anio, p_mes,
    private.fecha_vencimiento(v_fid, p_anio, p_mes), 1, v_concepto_id, v_importe
  );
end;
$$;

-- Permisos de ejecución ------------------------------------------------------------------

revoke execute on function
  private.hoy(),
  private.reglas_de(bigint),
  private.fecha_vencimiento(bigint, integer, integer),
  private.generar_cuotas_de(bigint, integer, integer),
  private.fn_reglas_cobro_antes(),
  public.generar_cuota_domicilio(bigint, integer, integer)
from public, anon;

grant execute on function
  private.hoy(),
  private.reglas_de(bigint),
  private.fecha_vencimiento(bigint, integer, integer),
  private.generar_cuotas_de(bigint, integer, integer),
  private.fn_reglas_cobro_antes(),
  public.generar_cuota_domicilio(bigint, integer, integer)
to authenticated, service_role;

-- =====================================================================================
-- Sección 2: morosidad, ajuste manual de acceso y proceso diario.
-- =====================================================================================

-- Insert de domicilios: authenticated tampoco fija acceso_forzado* al crear.
revoke insert on public.domicilios from authenticated;
grant insert (
  id, created_at, fraccionamiento_id, direccion, fecha_alta, observaciones,
  created_by, titular_id, perfil_asignado_id
) on public.domicilios to authenticated;

-- Moroso = cuotas vencidas (estatus 3) >= cuotas_para_moroso del fraccionamiento.
-- security invoker: con un usuario aplica la RLS de cuotas.
create function private.es_moroso(p_domicilio_id bigint)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select count(c.id) >= coalesce((select r.cuotas_para_moroso from private.reglas_de(d.fraccionamiento_id) r), 1)
  from public.domicilios d
  left join public.cuotas c on c.domicilio_id = d.id and c.estatus_id = 3
  where d.id = p_domicilio_id
  group by d.id, d.fraccionamiento_id;
$$;

create or replace function public.perfil_deseado(p_domicilio_id bigint)
returns uuid
language sql
stable
security invoker
set search_path = ''
as $$
  select case
           when d.acceso_forzado = 'activo' then cpa.perfil_corriente_id
           when d.acceso_forzado = 'inactivo' then cpa.perfil_moroso_id
           when coalesce(private.es_moroso(d.id), false) then cpa.perfil_moroso_id
           else cpa.perfil_corriente_id
         end
  from public.domicilios d
  join public.domicilio_concepto dc on dc.domicilio_id = d.id
  join public.concepto_pago_acceso cpa on cpa.concepto_pago_id = dc.concepto_id
  where d.id = p_domicilio_id;
$$;

-- Quita el ajuste manual cuando ya coincide con el estado real.
create function private.limpiar_accesos_forzados(p_fraccionamiento_id bigint default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_n integer;
begin
  update public.domicilios d
  set acceso_forzado = null, acceso_forzado_por = null, acceso_forzado_en = null
  where d.acceso_forzado is not null
    and (p_fraccionamiento_id is null or d.fraccionamiento_id = p_fraccionamiento_id)
    and ((d.acceso_forzado = 'activo' and not coalesce(private.es_moroso(d.id), false))
      or (d.acceso_forzado = 'inactivo' and coalesce(private.es_moroso(d.id), false)));
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

create or replace function public.recalcular_permisos_acceso(p_fraccionamiento_id bigint default null)
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

  perform private.limpiar_accesos_forzados(p_fraccionamiento_id);

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

-- Ajuste manual: solo administrador del fraccionamiento del domicilio.
create function public.forzar_acceso(p_domicilio_id bigint, p_valor text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fid bigint;
  v_moroso boolean;
begin
  select d.fraccionamiento_id into v_fid from public.domicilios d where d.id = p_domicilio_id;

  if v_fid is null
     or (select private.es_super_admin())
     or not (select private.tiene_rol(array['administrador']::public.rol_usuario[]))
     or v_fid is distinct from (select private.fraccionamiento_actual()) then
    raise exception 'No tienes permiso para ajustar el acceso' using errcode = '42501';
  end if;

  if p_valor is not null and p_valor not in ('activo', 'inactivo') then
    raise exception 'Valor de acceso inválido' using errcode = '22023';
  end if;

  v_moroso := coalesce(private.es_moroso(p_domicilio_id), false);
  if (p_valor = 'activo' and not v_moroso) or (p_valor = 'inactivo' and v_moroso) then
    raise exception 'El acceso ya está en ese estado' using errcode = 'P0001';
  end if;

  update public.domicilios
  set acceso_forzado = p_valor,
      acceso_forzado_por = case when p_valor is null then null else (select auth.uid()) end,
      acceso_forzado_en = case when p_valor is null then null else now() end
  where id = p_domicilio_id;

  perform public.recalcular_permisos_acceso(v_fid);
end;
$$;

-- Estado de acceso para la ficha del domicilio (administrador / tesorero).
create function public.estado_acceso_domicilio(p_domicilio_id bigint)
returns table (es_moroso boolean, acceso_forzado text, forzado_por_nombre text, forzado_en timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_fid bigint;
begin
  select d.fraccionamiento_id into v_fid from public.domicilios d where d.id = p_domicilio_id;

  if v_fid is null
     or (select private.es_super_admin())
     or not (select private.tiene_rol(array['administrador', 'tesorero']::public.rol_usuario[]))
     or v_fid is distinct from (select private.fraccionamiento_actual()) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  return query
  select coalesce(private.es_moroso(d.id), false), d.acceso_forzado, p.nombre, d.acceso_forzado_en
  from public.domicilios d
  left join public.perfiles p on p.id = d.acceso_forzado_por
  where d.id = p_domicilio_id;
end;
$$;

-- Estatus de cuotas según días de gracia (3 = vencida sin pago; 1 = pendiente).
create function private.actualizar_estatus_cuotas(p_fraccionamiento_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hoy date := private.hoy();
  v_gracia integer := (select r.dias_gracia from private.reglas_de(p_fraccionamiento_id) r);
begin
  update public.cuotas c
  set estatus_id = 3
  where c.fraccionamiento_id = p_fraccionamiento_id
    and c.estatus_id = 1
    and c.fecha_vencimiento + v_gracia < v_hoy
    and not exists (select 1 from public.pagos p where p.cuota_id = c.id);

  update public.cuotas c
  set estatus_id = 1
  where c.fraccionamiento_id = p_fraccionamiento_id
    and c.estatus_id = 3
    and c.fecha_vencimiento + v_gracia >= v_hoy
    and not exists (select 1 from public.pagos p where p.cuota_id = c.id);
end;
$$;

create function private.fn_reglas_cobro_despues()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.actualizar_estatus_cuotas(new.fraccionamiento_id);
  return null;
end;
$$;

create trigger trg_reglas_cobro_despues
  after insert or update on public.reglas_cobro
  for each row execute function private.fn_reglas_cobro_despues();

-- Proceso diario (pg_cron 06:00): generación, recargos, estatus y permisos.
create function public.procesar_reglas_cobro()
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_hoy date := private.hoy();
  v_f record;
  v_r record;
begin
  for v_f in select f.id from public.fraccionamientos f order by f.id loop
    select * into v_r from private.reglas_de(v_f.id);

    -- (1) Generación del mes en curso.
    if v_r.dia_generacion is not null and extract(day from v_hoy) >= v_r.dia_generacion then
      perform private.generar_cuotas_de(
        v_f.id, extract(year from v_hoy)::integer, extract(month from v_hoy)::integer);
    end if;

    -- (2) Recargo a cuotas vencidas sin pago, no retroactivo.
    if v_r.concepto_recargo_id is not null then
      insert into public.recargo_cuota (fraccionamiento_id, cuota_id, concepto_recargo_id)
      select c.fraccionamiento_id, c.id, v_r.concepto_recargo_id
      from public.cuotas c
      where c.fraccionamiento_id = v_f.id
        and c.estatus_id in (1, 3)
        and c.fecha_vencimiento < v_hoy
        and c.fecha_vencimiento >= v_r.recargo_desde
        and not exists (select 1 from public.pagos p where p.cuota_id = c.id)
        and not exists (select 1 from public.recargo_cuota rc where rc.cuota_id = c.id);
    end if;

    -- (3) Estatus según días de gracia.
    perform private.actualizar_estatus_cuotas(v_f.id);
  end loop;

  -- (4) Permisos de acceso de todos los fraccionamientos.
  perform public.recalcular_permisos_acceso();
end;
$$;

-- Sustituye a marcar_cuotas_vencidas.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'marcar-cuotas-vencidas') then
    perform cron.unschedule('marcar-cuotas-vencidas');
  end if;
end;
$$;
drop function public.marcar_cuotas_vencidas();

select cron.schedule('procesar-reglas-cobro', '0 6 * * *', 'select public.procesar_reglas_cobro()');

-- cuotas_info: 'En gracia' (vencida en fecha, aún sin marcar) y 'Vencido' por estatus.
create or replace view public.cuotas_info with (security_invoker=on) as
 SELECT c.id,
    c.domicilio_id,
    d.direccion,
    COALESCE(r.nombre, 'Sin información'::text) AS residente_principal,
    (
        CASE c.mes
            WHEN 1 THEN 'Ene'::text
            WHEN 2 THEN 'Feb'::text
            WHEN 3 THEN 'Mar'::text
            WHEN 4 THEN 'Abr'::text
            WHEN 5 THEN 'May'::text
            WHEN 6 THEN 'Jun'::text
            WHEN 7 THEN 'Jul'::text
            WHEN 8 THEN 'Ago'::text
            WHEN 9 THEN 'Sep'::text
            WHEN 10 THEN 'Oct'::text
            WHEN 11 THEN 'Nov'::text
            WHEN 12 THEN 'Dic'::text
            ELSE NULL::text
        END || '/'::text) || c.anio AS periodo,
    c.anio,
    c.mes,
    c.concepto_id,
    cp.nombre AS concepto,
    COALESCE(rg.total_recargo, 0::numeric) AS monto_recargo,
    COALESCE(ds.total_descuento, 0::numeric) AS monto_descuento,
    c.importe + COALESCE(rg.total_recargo, 0::numeric) - COALESCE(ds.total_descuento, 0::numeric) AS importe_cuota,
    cp.importe AS importe_base,
    c.fecha_vencimiento,
    to_char(c.fecha_vencimiento::timestamp with time zone, 'DD/MM/YYYY'::text) AS fecha_vencimiento_formated,
    e.name AS estatus,
        CASE
            WHEN lower(e.name) = 'pagado'::text THEN 'Pagado'::text
            WHEN c.estatus_id = 3 THEN 'Vencido'::text
            WHEN c.estatus_id = 1 AND c.fecha_vencimiento < private.hoy() THEN 'En gracia'::text
            ELSE 'Pendiente'::text
        END AS estatus_calculado,
    c.created_at
   FROM public.cuotas c
     JOIN public.domicilios d ON d.id = c.domicilio_id
     LEFT JOIN public.residentes r ON r.domicilio_id = d.id AND r.es_principal = true
     JOIN public.conceptos_pago cp ON cp.id = c.concepto_id
     JOIN public.estatus e ON e.id = c.estatus_id
     LEFT JOIN ( SELECT rc.cuota_id,
            sum(cr.monto_recargo) AS total_recargo
           FROM public.recargo_cuota rc
             JOIN public.conceptos_recargo cr ON cr.id = rc.concepto_recargo_id
          GROUP BY rc.cuota_id) rg ON rg.cuota_id = c.id
     LEFT JOIN ( SELECT dc.cuota_id,
            sum(cd.monto_descuento) AS total_descuento
           FROM public.descuento_cuota dc
             JOIN public.conceptos_descuento cd ON cd.id = dc.concepto_descuento_id
          GROUP BY dc.cuota_id) ds ON ds.cuota_id = c.id;

-- Permisos de ejecución (sección 2) -----------------------------------------------------

revoke execute on function
  private.es_moroso(bigint),
  private.limpiar_accesos_forzados(bigint),
  public.forzar_acceso(bigint, text),
  public.estado_acceso_domicilio(bigint),
  public.procesar_reglas_cobro(),
  private.actualizar_estatus_cuotas(bigint),
  private.fn_reglas_cobro_despues()
from public, anon, authenticated;

grant execute on function private.es_moroso(bigint) to authenticated, service_role;
grant execute on function private.limpiar_accesos_forzados(bigint) to service_role;
grant execute on function
  public.forzar_acceso(bigint, text),
  public.estado_acceso_domicilio(bigint)
to authenticated, service_role;
grant execute on function public.procesar_reglas_cobro() to service_role;
grant execute on function private.actualizar_estatus_cuotas(bigint) to service_role;
