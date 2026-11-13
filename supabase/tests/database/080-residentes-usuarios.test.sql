begin;
select plan(47);

select tests.crear_escenario();
select tests.crear_datos_negocio();

-- Fixtures: A1 y B1 (de crear_datos_negocio), A2 nuevo con cuota y pago.
-- Residente R (3300000801) vinculado a A1 y B1; residente S (3300000802) en A2.
select set_config('t.a1', (select id::text from public.domicilios where fraccionamiento_id = tests.fid('fracc-a')), false);
select set_config('t.b1', (select id::text from public.domicilios where fraccionamiento_id = tests.fid('fracc-b')), false);

with d as (
  insert into public.domicilios (fraccionamiento_id, direccion, fecha_alta, created_by)
  values (tests.fid('fracc-a'), 'Calle A 2', date '2026-01-01', tests.uid('admin.a@test.local')) returning id
)
select set_config('t.a2', (select id::text from d), false);

insert into public.domicilio_concepto (fraccionamiento_id, domicilio_id, concepto_id)
  select tests.fid('fracc-a'), current_setting('t.a2')::bigint, id
  from public.conceptos_pago where fraccionamiento_id = tests.fid('fracc-a');
insert into public.cuotas (fraccionamiento_id, domicilio_id, anio, mes, fecha_vencimiento, estatus_id, concepto_id, importe)
  select tests.fid('fracc-a'), current_setting('t.a2')::bigint, 2026, 1, date '2026-01-10', 1, id, 500
  from public.conceptos_pago where fraccionamiento_id = tests.fid('fracc-a');
insert into public.pagos (fraccionamiento_id, domicilio_id, cuota_id, fecha_pago, metodo_pago_id, user_id, importe)
  values (tests.fid('fracc-a'), current_setting('t.a2')::bigint, null, date '2026-01-05', 1,
          tests.uid('tesorero.a@test.local'), 0);
insert into public.pines_acceso (fraccionamiento_id, domicilio_id, pin)
  values (tests.fid('fracc-a'), current_setting('t.a2')::bigint, '9999');

insert into auth.users (id, email, aud, role) values
  (gen_random_uuid(), '3300000801@auth.internal', 'authenticated', 'authenticated'),
  (gen_random_uuid(), '3300000802@auth.internal', 'authenticated', 'authenticated');
insert into public.cuentas_residente (user_id, telefono) values
  (tests.uid('3300000801@auth.internal'), '3300000801'),
  (tests.uid('3300000802@auth.internal'), '3300000802');

-- R ya existe como residente principal de A1 y B1 (crear_datos_negocio).
update public.residentes set user_id = tests.uid('3300000801@auth.internal')
  where domicilio_id in (current_setting('t.a1')::bigint, current_setting('t.b1')::bigint);
insert into public.residentes (fraccionamiento_id, nombre, telefono, domicilio_id, user_id)
  values (tests.fid('fracc-a'), 'Residente S', '3300000802', current_setting('t.a2')::bigint,
          tests.uid('3300000802@auth.internal'));

-- Lecturas propias -----------------------------------------------------------------

select is(
  tests.probar('3300000801@auth.internal',
    'select string_agg(id::text, '','' order by id) from public.domicilios'),
  current_setting('t.a1') || ',' || current_setting('t.b1'),
  'R ve exactamente A1 y B1 en domicilios');
select is(
  tests.probar('3300000801@auth.internal', 'select count(*) from public.cuotas'),
  '2', 'R ve las cuotas de A1 y B1');
select is(
  tests.probar('3300000801@auth.internal',
    format('select count(*) from public.cuotas where domicilio_id = %s', current_setting('t.a2'))),
  '0', 'R no ve cuotas de A2');
select is(
  tests.probar('3300000801@auth.internal', 'select count(*) from public.pagos'),
  '2', 'R ve los pagos de A1 y B1');
select is(
  tests.probar('3300000801@auth.internal',
    format('select count(*) from public.pagos where domicilio_id = %s', current_setting('t.a2'))),
  '0', 'R no ve pagos de A2');
select is(
  tests.probar('3300000801@auth.internal', 'select count(*) from public.residentes'),
  '2', 'R ve los residentes de A1 y B1');
select is(
  tests.probar('3300000801@auth.internal',
    $q$select count(*) from public.residentes where nombre = 'Residente S'$q$),
  '0', 'R no ve a S');
select is(
  tests.probar('3300000801@auth.internal', 'select count(*) from public.pines_acceso'),
  '2', 'R ve los PIN de A1 y B1 (no el de A2)');
select is(
  tests.probar('3300000801@auth.internal',
    'select count(*) from public.tarjetas_acceso') || '/' ||
  tests.probar('3300000801@auth.internal',
    'select count(*) from public.controles_acceso') || '/' ||
  tests.probar('3300000801@auth.internal',
    'select count(*) from public.telefonos_acceso') || '/' ||
  tests.probar('3300000801@auth.internal',
    'select count(*) from public.domicilio_concepto') || '/' ||
  tests.probar('3300000801@auth.internal',
    'select count(*) from public.conceptos_pago') || '/' ||
  tests.probar('3300000801@auth.internal',
    'select count(*) from public.recargo_cuota') || '/' ||
  tests.probar('3300000801@auth.internal',
    'select count(*) from public.descuento_cuota'),
  '2/2/2/2/2/2/2', 'R ve medios, conceptos, recargos y descuentos solo de A1 y B1');
select is(
  tests.probar('3300000801@auth.internal', 'select count(*) from public.cuentas_residente'),
  '1', 'R solo ve su propia cuenta');

-- Tablas sin acceso ------------------------------------------------------------------

select is(tests.probar('3300000801@auth.internal', 'select count(*) from public.perfiles'), '0', 'R: 0 perfiles');
select is(tests.probar('3300000801@auth.internal', 'select count(*) from public.movimientos_financieros'), '0', 'R: 0 movimientos');
select is(tests.probar('3300000801@auth.internal', 'select count(*) from public.fraccionamientos'), '0', 'R: 0 fraccionamientos');
select is(tests.probar('3300000801@auth.internal', 'select count(*) from public.reglas_cobro'), '0', 'R: 0 reglas_cobro');
select is(tests.probar('3300000801@auth.internal', 'select count(*) from public.sincronizaciones_acceso'), '0', 'R: 0 sincronizaciones_acceso');
select is(tests.probar('3300000801@auth.internal', 'select count(*) from public.fraccionamiento_medios'), '0', 'R: 0 fraccionamiento_medios');

-- Vistas ------------------------------------------------------------------------------

select is(
  (select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind in ('v', 'm')
     and has_table_privilege('authenticated', c.oid, 'select')
     and not coalesce(c.reloptions @> array['security_invoker=on'], false)),
  0, 'toda vista de public legible por authenticated es security_invoker');

select is(tests.probar('3300000801@auth.internal',
  format('select count(*) from public.domicilios_info where id = %s', current_setting('t.a2'))), '0', 'vista domicilios_info: 0 de A2');
select is(tests.probar('3300000801@auth.internal', 'select count(*) from public.domicilios_info'), '2', 'vista domicilios_info: A1 y B1');
select is(tests.probar('3300000801@auth.internal',
  format('select count(*) from public.cuotas_info where domicilio_id = %s', current_setting('t.a2'))), '0', 'vista cuotas_info: 0 de A2');
select is(tests.probar('3300000801@auth.internal',
  format('select count(*) from public.pagos_info where domicilio_id = %s', current_setting('t.a2'))), '0', 'vista pagos_info: 0 de A2');
select is(tests.probar('3300000801@auth.internal',
  format('select count(*) from public.domicilio_concepto_info where domicilio_id = %s', current_setting('t.a2'))), '0', 'vista domicilio_concepto_info: 0 de A2');
select is(tests.probar('3300000801@auth.internal',
  format('select count(*) from public.residentes_info where domicilio_id = %s', current_setting('t.a2'))), '0', 'vista residentes_info: 0 de A2');
select is(tests.probar('3300000801@auth.internal',
  format('select count(*) from public.reporte_pagos_detalle where domicilio_id = %s', current_setting('t.a2'))), '0', 'vista reporte_pagos_detalle: 0 de A2 (join a perfiles)');
select is(
  tests.probar('3300000801@auth.internal', 'select count(*) from public.movimientos_info') || '/' ||
  tests.probar('3300000801@auth.internal', 'select count(total_ingresos) from public.resumen_financiero_completo') || '/' ||
  tests.probar('3300000801@auth.internal', 'select count(*) from public.users_info'),
  '0/0/0', 'vistas movimientos_info, resumen_financiero_completo, users_info: sin datos');

-- Escrituras ----------------------------------------------------------------------------

select ok(
  tests.probar('3300000801@auth.internal',
    format($q$insert into public.residentes (fraccionamiento_id, nombre, domicilio_id) values (%s, 'X', %s)$q$,
           tests.fid('fracc-a'), current_setting('t.a1'))) in ('42501', '0'),
  'R no inserta residentes');
select ok(
  tests.probar('3300000801@auth.internal', $q$update public.residentes set nombre = 'X'$q$) in ('42501', '0'),
  'R no actualiza residentes');
select ok(
  tests.probar('3300000801@auth.internal', 'delete from public.residentes') in ('42501', '0'),
  'R no borra residentes');
select ok(
  tests.probar('3300000801@auth.internal', 'update public.cuotas set importe = 1') in ('42501', '0'),
  'R no actualiza cuotas');
select ok(
  tests.probar('3300000801@auth.internal', 'delete from public.cuotas') in ('42501', '0'),
  'R no borra cuotas');
select ok(
  tests.probar('3300000801@auth.internal',
    format($q$insert into public.pagos (fraccionamiento_id, domicilio_id, fecha_pago, metodo_pago_id, importe) values (%s, %s, date '2026-01-05', 1, 0)$q$,
           tests.fid('fracc-a'), current_setting('t.a1'))) in ('42501', '0'),
  'R no inserta pagos');
select ok(
  tests.probar('3300000801@auth.internal', 'delete from public.pagos') in ('42501', '0'),
  'R no borra pagos');
select is(
  tests.probar('3300000801@auth.internal',
    $q$insert into public.cuentas_residente (user_id, telefono) values (gen_random_uuid(), '3300000009')$q$),
  '42501', 'authenticated no inserta en cuentas_residente');
select is(
  tests.probar('admin.a@test.local',
    format('update public.residentes set user_id = %L', tests.uid('3300000802@auth.internal'))),
  '42501', 'authenticated no escribe residentes.user_id');

-- Cuenta inactiva / fraccionamiento inactivo ---------------------------------------------

select is(
  tests.probar('3300000801@auth.internal', 'select count(*) from public.domicilios',
    $q$update public.cuentas_residente set activo = false where telefono = '3300000801' returning 1::bigint$q$),
  '0', 'cuenta inactiva: R ve 0 domicilios');
select is(
  tests.probar('3300000801@auth.internal', 'select string_agg(id::text, '','') from public.domicilios',
    format('update public.fraccionamientos set activo = false where id = %s returning id', tests.fid('fracc-b'))),
  current_setting('t.a1'), 'fraccionamiento B inactivo: R solo ve A1');

-- Personal ---------------------------------------------------------------------------------

select is(
  tests.probar('tesorero.b@test.local',
    $q$select count(*) from public.cuentas_residente where telefono = '3300000802'$q$),
  '0', 'tesorero de B no ve la cuenta de S');
select is(
  tests.probar('tesorero.a@test.local', 'select count(*) from public.cuentas_residente'),
  '2', 'tesorero de A ve las cuentas con residentes en A');
select is(
  tests.probar('admin.a@test.local',
    format('select public.residentes_con_cuenta(%s)', current_setting('t.a1'))),
  '1', 'residentes_con_cuenta: personal');
select is(
  tests.probar('admin.b@test.local',
    format('select public.residentes_con_cuenta(%s)', current_setting('t.a2'))),
  '0', 'residentes_con_cuenta: otro fraccionamiento -> 0');

select throws_ok(
  format('update public.fraccionamientos set max_residentes_app = 0 where id = %s', tests.fid('fracc-a')),
  '23514', null, 'max_residentes_app 0 -> 23514');
select throws_ok(
  format('update public.fraccionamientos set max_residentes_app = 21 where id = %s', tests.fid('fracc-a')),
  '23514', null, 'max_residentes_app 21 -> 23514');
select is(
  tests.probar('admin.a@test.local', 'update public.fraccionamientos set max_residentes_app = 8') || '/' ||
  tests.probar('admin.a@test.local', $q$update public.fraccionamientos set nombre = 'X'$q$),
  '1/42501', 'administrador actualiza max_residentes_app y nada más');
select is(
  tests.probar('tesorero.a@test.local', 'update public.fraccionamientos set max_residentes_app = 8'),
  '0', 'tesorero no actualiza max_residentes_app');
select is(
  tests.probar('admin.a@test.local', 'select count(*) from public.domicilios') || '/' ||
  tests.probar('tesorero.a@test.local', 'select count(*) from public.residentes') || '/' ||
  tests.probar('tesorero.a@test.local', 'select count(*) from public.cuotas'),
  '2/2/2', 'regresión: el personal sigue viendo todo su fraccionamiento');

select has_column('public', 'telefonos_acceso', 'residente_id', 'telefonos_acceso.residente_id existe');
select fk_ok('public', 'telefonos_acceso', array['residente_id', 'fraccionamiento_id'],
             'public', 'residentes', array['id', 'fraccionamiento_id'],
             'telefonos_acceso.residente_id referencia a residentes');

select * from finish();
rollback;
