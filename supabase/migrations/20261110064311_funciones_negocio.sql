-- Funciones de negocio, triggers y cron.
-- Misma lógica que el esquema de referencia (sección 4, 5 y 8), adaptada a
-- multi-tenant. Todas son security invoker: los triggers corren con el RLS de
-- quien hace la operación (tesorero puede insertar movimientos, administrador
-- puede actualizar cuotas y residentes).

-- residentes: primer residente principal; un solo principal por domicilio ---

create function public.fn_residente_principal()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  total_residentes integer;
begin
  -- Normalizar NULL a false
  if new.es_principal is null then
    new.es_principal := false;
  end if;

  -- Corrección respecto a la referencia: el update de abajo vuelve a disparar
  -- este trigger sobre los demás residentes. En esa llamada anidada el
  -- residente nuevo aún no existe, así que el conteo da 0 y se volvía a marcar
  -- como principal al anterior. La llamada anidada solo debe aplicar el false.
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  -- Contar residentes existentes del domicilio
  select count(*) into total_residentes
  from public.residentes r
  where r.domicilio_id = new.domicilio_id
    and (tg_op = 'INSERT' or r.id <> new.id);

  -- Primer residente: automáticamente principal
  if total_residentes = 0 then
    new.es_principal := true;
    return new;
  end if;

  -- Si viene como principal: quitar a los demás
  if new.es_principal = true then
    update public.residentes r
    set es_principal = false
    where r.domicilio_id = new.domicilio_id
      and r.id <> coalesce(new.id, -1);
  end if;

  return new;
end;
$$;

create trigger trg_residente_principal
  before insert or update on public.residentes
  for each row execute function public.fn_residente_principal();

-- domicilio_concepto: al cambiar el concepto, actualizar cuotas pendientes ---

create function public.fn_actualizar_cuotas_concepto()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_importe numeric;
begin
  -- Importe del nuevo concepto
  select cp.importe
  into v_importe
  from public.conceptos_pago cp
  where cp.id = new.concepto_id
    and cp.fraccionamiento_id = new.fraccionamiento_id;

  -- Actualizar cuotas pendientes del domicilio
  update public.cuotas c
  set
    concepto_id = new.concepto_id,
    importe = v_importe
  where c.domicilio_id = new.domicilio_id
    and c.fraccionamiento_id = new.fraccionamiento_id
    and c.estatus_id = 1;

  return new;
end;
$$;

create trigger trg_actualizar_cuotas_concepto
  after update of concepto_id on public.domicilio_concepto
  for each row execute function public.fn_actualizar_cuotas_concepto();

-- pagos: cada pago con importe distinto de 0 genera un ingreso ---------------

create function public.fn_pago_to_movimiento()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- No crear movimiento si el importe es 0
  if coalesce(new.importe, 0) = 0 then
    return new;
  end if;

  insert into public.movimientos_financieros (
    fraccionamiento_id,
    tipo_id,
    descripcion,
    importe,
    metodo_pago_id,
    referencia,
    user_id,
    fecha_movimiento
  )
  values (
    new.fraccionamiento_id,
    1,
    'Pago referencia:  ' || new.referencia,
    new.importe,
    new.metodo_pago_id,
    new.referencia,
    new.user_id,
    new.fecha_pago
  );

  return new;
end;
$$;

create trigger trg_pagos_to_movimientos
  after insert on public.pagos
  for each row execute function public.fn_pago_to_movimiento();

-- generar_cuotas: cuotas del mes para el fraccionamiento del usuario --------

create function public.generar_cuotas(p_anio integer, p_mes integer)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not (select private.tiene_rol(array['administrador', 'tesorero']::public.rol_usuario[])) then
    raise exception 'No tienes permiso para generar cuotas' using errcode = '42501';
  end if;

  insert into public.cuotas (
    fraccionamiento_id,
    domicilio_id,
    anio,
    mes,
    fecha_vencimiento,
    estatus_id,
    concepto_id,
    importe
  )
  select
    dc.fraccionamiento_id,
    dc.domicilio_id,
    p_anio,
    p_mes,
    (make_date(p_anio, p_mes, 1) + interval '1 month - 1 day')::date,
    1,
    dc.concepto_id,
    cp.importe
  from public.domicilio_concepto dc
  join public.conceptos_pago cp on cp.id = dc.concepto_id
  where dc.fraccionamiento_id = (select private.fraccionamiento_actual())
    and not exists (
      select 1
      from public.cuotas c
      where c.domicilio_id = dc.domicilio_id
        and c.concepto_id = dc.concepto_id
        and c.anio = p_anio
        and c.mes = p_mes
    );
end;
$$;

-- marcar_cuotas_vencidas: para todos los fraccionamientos (solo pg_cron) ----

create function public.marcar_cuotas_vencidas()
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
end;
$$;

-- Privilegios ---------------------------------------------------------------

revoke execute on function
  public.fn_residente_principal(),
  public.fn_actualizar_cuotas_concepto(),
  public.fn_pago_to_movimiento(),
  public.generar_cuotas(integer, integer),
  public.marcar_cuotas_vencidas()
from public, anon, authenticated;

grant execute on function public.generar_cuotas(integer, integer) to authenticated;

-- pg_cron -------------------------------------------------------------------
-- cron.schedule con nombre hace upsert: correrlo de nuevo no duplica el job.

create extension if not exists pg_cron;

select cron.schedule(
  'marcar-cuotas-vencidas',
  '0 6 * * *',
  'select public.marcar_cuotas_vencidas()'
);
