begin;
select plan(21);

select tests.crear_escenario();
select tests.crear_datos_negocio();

-- Pago -> movimiento (tesorero.a) ------------------------------------------

select tests.autenticar_como('tesorero.a@test.local');
insert into public.pagos (fraccionamiento_id, domicilio_id, fecha_pago, metodo_pago_id, user_id, importe, referencia)
  values (tests.fid('fracc-a'),
          (select id from public.domicilios where direccion = 'Calle A 1'),
          date '2026-02-05', 1, tests.uid('tesorero.a@test.local'), 500,
          '00000000-0000-0000-0000-000000000500');
insert into public.pagos (fraccionamiento_id, domicilio_id, fecha_pago, metodo_pago_id, user_id, importe, referencia)
  values (tests.fid('fracc-a'),
          (select id from public.domicilios where direccion = 'Calle A 1'),
          date '2026-02-05', 1, tests.uid('tesorero.a@test.local'), 0,
          '00000000-0000-0000-0000-000000000000');
reset role;

select is(
  (select count(*) from public.movimientos_financieros
   where referencia = '00000000-0000-0000-0000-000000000500'
     and fraccionamiento_id = tests.fid('fracc-a')
     and tipo_id = 1 and importe = 500),
  1::bigint, 'un pago de 500 crea 1 movimiento de ingreso en A con la misma referencia');
select is(
  (select count(*) from public.movimientos_financieros
   where referencia = '00000000-0000-0000-0000-000000000500'),
  1::bigint, 'el pago de 500 crea un solo movimiento en total');
select is(
  (select count(*) from public.movimientos_financieros
   where referencia = '00000000-0000-0000-0000-000000000000'),
  0::bigint, 'un pago de 0 no crea movimiento');

-- Residente principal (admin.a) --------------------------------------------

select tests.autenticar_como('admin.a@test.local');
insert into public.domicilios (fraccionamiento_id, direccion, fecha_alta, created_by)
  values (tests.fid('fracc-a'), 'Calle A 9', date '2026-02-01', tests.uid('admin.a@test.local'));
insert into public.residentes (fraccionamiento_id, nombre, telefono, domicilio_id, es_principal)
  values (tests.fid('fracc-a'), 'Primero', '5552220001',
          (select id from public.domicilios where direccion = 'Calle A 9'), false);
select is((select es_principal from public.residentes where nombre = 'Primero'), true,
  'el primer residente de un domicilio queda como principal');
insert into public.residentes (fraccionamiento_id, nombre, telefono, domicilio_id, es_principal)
  values (tests.fid('fracc-a'), 'Segundo', '5552220002',
          (select id from public.domicilios where direccion = 'Calle A 9'), true);
select is((select es_principal from public.residentes where nombre = 'Segundo'), true,
  'el segundo residente insertado como principal queda principal');
select is((select es_principal from public.residentes where nombre = 'Primero'), false,
  'al insertar otro principal, el primero deja de serlo');

-- Cambio de concepto del domicilio (admin.a) -------------------------------

insert into public.conceptos_pago (fraccionamiento_id, nombre, importe, tipo_pago_id)
  values (tests.fid('fracc-a'), 'Mensual A2', 700, 1);
update public.domicilio_concepto
  set concepto_id = (select id from public.conceptos_pago where nombre = 'Mensual A2')
  where domicilio_id = (select id from public.domicilios where direccion = 'Calle A 1');
reset role;

select is(
  (select c.importe from public.cuotas c
   join public.domicilios d on d.id = c.domicilio_id
   where d.direccion = 'Calle A 1' and c.anio = 2026 and c.mes = 1),
  700::numeric, 'la cuota pendiente de A toma el importe del concepto nuevo');
select is(
  (select cp.nombre from public.cuotas c
   join public.domicilios d on d.id = c.domicilio_id
   join public.conceptos_pago cp on cp.id = c.concepto_id
   where d.direccion = 'Calle A 1' and c.anio = 2026 and c.mes = 1),
  'Mensual A2', 'la cuota pendiente de A toma el concepto nuevo');
select results_eq(
  $$select c.importe, cp.nombre from public.cuotas c
    join public.conceptos_pago cp on cp.id = c.concepto_id
    where c.fraccionamiento_id = tests.fid('fracc-b')$$,
  $$values (500::numeric, 'Mensual B'::text)$$,
  'las cuotas de B no cambian');

-- generar_cuotas -----------------------------------------------------------

select tests.autenticar_como('tesorero.a@test.local');
select lives_ok($$select public.generar_cuotas(2026, 2)$$, 'tesorero.a genera cuotas de 2026-02');
reset role;
select is(
  (select count(*) from public.cuotas where fraccionamiento_id = tests.fid('fracc-a') and anio = 2026 and mes = 2),
  1::bigint, 'generar_cuotas crea 1 cuota en A');
select is(
  (select count(*) from public.cuotas where fraccionamiento_id = tests.fid('fracc-b') and anio = 2026 and mes = 2),
  0::bigint, 'generar_cuotas no crea cuotas en B');
select is(
  (select fecha_vencimiento from public.cuotas where fraccionamiento_id = tests.fid('fracc-a') and anio = 2026 and mes = 2),
  date '2026-02-28', 'la cuota generada vence el último día del mes');

select tests.autenticar_como('tesorero.a@test.local');
select public.generar_cuotas(2026, 2);
reset role;
select is(
  (select count(*) from public.cuotas where fraccionamiento_id = tests.fid('fracc-a') and anio = 2026 and mes = 2),
  1::bigint, 'llamar generar_cuotas otra vez no crea cuotas nuevas');

select tests.autenticar_como('comite.a@test.local');
select throws_ok($$select public.generar_cuotas(2026, 3)$$,
  '42501', 'No tienes permiso para generar cuotas', 'comite.a no puede generar cuotas');
reset role;
select tests.autenticar_como('vigilancia.a@test.local');
select throws_ok($$select public.generar_cuotas(2026, 3)$$,
  '42501', 'No tienes permiso para generar cuotas', 'vigilancia.a no puede generar cuotas');
reset role;

-- procesar_reglas_cobro ----------------------------------------------------

select tests.autenticar_como('admin.a@test.local');
select throws_ok($$select public.procesar_reglas_cobro()$$,
  '42501', null, 'admin.a no puede ejecutar procesar_reglas_cobro');
reset role;
select set_config('request.jwt.claims', '', true);

select lives_ok($$select public.procesar_reglas_cobro()$$, 'postgres procesa reglas de cobro');
select is(
  (select estatus_id from public.cuotas where fraccionamiento_id = tests.fid('fracc-a') and anio = 2026 and mes = 1),
  3::bigint, 'la cuota 2026-01 de A sin pago queda vencida');
select is(
  (select estatus_id from public.cuotas where fraccionamiento_id = tests.fid('fracc-b') and anio = 2026 and mes = 1),
  3::bigint, 'la cuota 2026-01 de B sin pago queda vencida');

-- pg_cron ------------------------------------------------------------------

select isnt_empty(
  $$select 1 from cron.job where jobname = 'procesar-reglas-cobro' and schedule = '0 6 * * *'$$,
  'job de pg_cron procesar-reglas-cobro diario a las 06:00');

select * from finish();
rollback;
