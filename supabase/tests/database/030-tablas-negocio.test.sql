begin;
select plan(35);

select tests.crear_escenario();
select tests.crear_datos_negocio();

-- Las 14 tablas existen, con fraccionamiento_id not null ---------------------

select has_table('public', t, t || ' existe')
from unnest(array[
  'domicilios', 'domicilio_concepto', 'residentes', 'telefonos_acceso', 'tarjetas_acceso',
  'conceptos_pago', 'concepto_pago_acceso', 'conceptos_descuento', 'conceptos_recargo',
  'cuotas', 'descuento_cuota', 'recargo_cuota', 'pagos', 'movimientos_financieros'
]) as t;

select col_not_null('public', t, 'fraccionamiento_id', t || '.fraccionamiento_id es not null')
from unnest(array[
  'domicilios', 'domicilio_concepto', 'residentes', 'telefonos_acceso', 'tarjetas_acceso',
  'conceptos_pago', 'concepto_pago_acceso', 'conceptos_descuento', 'conceptos_recargo',
  'cuotas', 'descuento_cuota', 'recargo_cuota', 'pagos', 'movimientos_financieros'
]) as t;

-- RLS habilitado en las 14 (sin probar filas visibles: la tarea 4 agrega políticas)

select is(
  (select count(*)::int from pg_class c
    where c.oid = any (array[
      'public.domicilios', 'public.domicilio_concepto', 'public.residentes',
      'public.telefonos_acceso', 'public.tarjetas_acceso', 'public.conceptos_pago',
      'public.concepto_pago_acceso', 'public.conceptos_descuento', 'public.conceptos_recargo',
      'public.cuotas', 'public.descuento_cuota', 'public.recargo_cuota', 'public.pagos',
      'public.movimientos_financieros']::regclass[])
      and c.relrowsecurity),
  14, 'RLS habilitado en las 14 tablas');

-- Integridad entre fraccionamientos ----------------------------------------

select throws_ok(
  format($q$insert into public.cuotas (fraccionamiento_id, domicilio_id, anio, mes, fecha_vencimiento, estatus_id, concepto_id, importe)
    values (%s, (select id from public.domicilios where direccion = 'Calle B 1'),
            2026, 2, date '2026-02-10', 1,
            (select id from public.conceptos_pago where nombre = 'Mensual A'), 500)$q$,
    tests.fid('fracc-a')),
  '23503', null, 'cuota en A con domicilio de B falla por FK compuesta');

select throws_ok(
  format($q$insert into public.domicilios (fraccionamiento_id, direccion, fecha_alta, created_by)
    values (%s, 'Calle A 1', date '2026-01-01', tests.uid('admin.a@test.local'))$q$,
    tests.fid('fracc-a')),
  '23505', null, 'direccion repetida en A falla');

select lives_ok(
  format($q$insert into public.domicilios (fraccionamiento_id, direccion, fecha_alta, created_by)
    values (%s, 'Calle A 1', date '2026-01-01', tests.uid('admin.b@test.local'))$q$,
    tests.fid('fracc-b')),
  'misma direccion en B es valida');

select throws_ok(
  format($q$insert into public.conceptos_pago (fraccionamiento_id, nombre, importe, tipo_pago_id)
    values (%s, 'mensual a', 100, 1)$q$, tests.fid('fracc-a')),
  '23505', null, 'concepto mensual a (tipo 1) duplica Mensual A');

select lives_ok(
  format($q$insert into public.conceptos_pago (fraccionamiento_id, nombre, importe, tipo_pago_id)
    values (%s, 'mensual a', 100, 2)$q$, tests.fid('fracc-a')),
  'mismo nombre con tipo_pago_id = 2 es valido');

select throws_ok(
  format($q$insert into public.cuotas (fraccionamiento_id, domicilio_id, anio, mes, fecha_vencimiento, estatus_id, concepto_id, importe)
    values (%s, (select id from public.domicilios where direccion = 'Calle A 1' and fraccionamiento_id = %s),
            2026, 1, date '2026-01-10', 1,
            (select id from public.conceptos_pago where nombre = 'Mensual A'), 500)$q$,
    tests.fid('fracc-a'), tests.fid('fracc-a')),
  '23505', null, 'cuota repetida (domicilio, concepto, anio, mes) falla');

select * from finish();
rollback;
