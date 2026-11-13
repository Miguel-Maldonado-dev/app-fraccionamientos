begin;
select plan(9);

select tests.crear_escenario();
select tests.crear_datos_negocio();

select set_config('t.a1', (select id::text from public.domicilios where fraccionamiento_id = tests.fid('fracc-a') order by id limit 1), false);

-- Residente R (3300000901) en A1.
insert into auth.users (id, email, aud, role) values
  (gen_random_uuid(), '3300000901@auth.internal', 'authenticated', 'authenticated');
insert into public.cuentas_residente (user_id, telefono) values
  (tests.uid('3300000901@auth.internal'), '3300000901');
update public.residentes set user_id = tests.uid('3300000901@auth.internal')
  where domicilio_id = current_setting('t.a1')::bigint;
insert into public.dispositivos_residente (user_id, device_id, nombre) values
  (tests.uid('3300000901@auth.internal'), 'dispositivo-1', 'iPhone 15');

-- Vistas de cuotas y pagos ------------------------------------------------------------

select ok(
  (select count(*) from public.cuotas where domicilio_id = current_setting('t.a1')::bigint) > 0
  and (select count(*) from public.pagos where domicilio_id = current_setting('t.a1')::bigint) > 0,
  'control: A1 tiene cuotas y pagos');
select is(
  tests.probar('3300000901@auth.internal', format(
    $q$select (select count(*) from public.cuotas_info where domicilio_id = %1$s)::text || '/' ||
       (select count(*) from public.cuotas_info where domicilio_id <> %1$s)::text$q$, current_setting('t.a1'))),
  (select count(*) from public.cuotas where domicilio_id = current_setting('t.a1')::bigint)::text || '/0',
  'residente lee sus cuotas_info y ninguna ajena');
select is(
  tests.probar('3300000901@auth.internal', format(
    $q$select (select count(*) from public.pagos_info where domicilio_id = %1$s)::text || '/' ||
       (select count(*) from public.pagos_info where domicilio_id <> %1$s)::text$q$, current_setting('t.a1'))),
  (select count(*) from public.pagos where domicilio_id = current_setting('t.a1')::bigint)::text || '/0',
  'residente lee sus pagos_info y ninguno ajeno');

-- dispositivos_residente ----------------------------------------------------------------

select throws_ok(
  $q$insert into public.dispositivos_residente (user_id, device_id) values (gen_random_uuid(), 'corto')$q$,
  '23514', null, 'device_id menor a 8 -> 23514');
select is(
  tests.probar('3300000901@auth.internal', 'select count(*)::text from public.dispositivos_residente'),
  '1', 'residente ve su dispositivo');
select is(
  tests.probar('3300000901@auth.internal',
    format($q$insert into public.dispositivos_residente (user_id, device_id) values (%L, 'otro-dispositivo')$q$,
      tests.uid('3300000901@auth.internal'))) || '/' ||
  tests.probar('3300000901@auth.internal', $q$update public.dispositivos_residente set device_id = 'otro-dispositivo'$q$) || '/' ||
  tests.probar('3300000901@auth.internal', 'delete from public.dispositivos_residente'),
  '42501/42501/42501', 'residente no escribe dispositivos_residente');
select is(
  tests.probar('admin.a@test.local', 'select count(*)::text from public.dispositivos_residente'),
  '1', 'administrador del fraccionamiento ve el dispositivo');
select is(
  tests.probar('admin.b@test.local', 'select count(*)::text from public.dispositivos_residente'),
  '0', 'administrador de otro fraccionamiento no ve el dispositivo');

delete from public.cuentas_residente where user_id = tests.uid('3300000901@auth.internal');
select is((select count(*) from public.dispositivos_residente)::int, 0, 'borrar la cuenta borra el dispositivo');

select * from finish();
rollback;
