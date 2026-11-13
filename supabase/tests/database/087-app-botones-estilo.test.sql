begin;
select plan(4);

select tests.crear_escenario();
select tests.crear_datos_negocio();

select set_config('t.a1', (select id::text from public.domicilios where fraccionamiento_id = tests.fid('fracc-a')), false);

insert into auth.users (id, email, aud, role) values
  (gen_random_uuid(), '3300000871@auth.internal', 'authenticated', 'authenticated');
insert into public.cuentas_residente (user_id, telefono) values
  (tests.uid('3300000871@auth.internal'), '3300000871');
update public.residentes set user_id = tests.uid('3300000871@auth.internal')
  where domicilio_id = current_setting('t.a1')::bigint;

update public.fraccionamientos set instalacion_id = gen_random_uuid() where id = tests.fid('fracc-a');
update public.domicilios set titular_id = gen_random_uuid() where id = current_setting('t.a1')::bigint;

insert into public.app_botones (fraccionamiento_id, orden, nombre, icono, salida_id, salida_nombre) values
  (tests.fid('fracc-a'), 1, 'Pluma', 'pluma', gen_random_uuid(), 'Salida 1');

select col_default_is('public', 'app_botones', 'estilo', 'azul_claro', 'estilo es azul_claro por omisión');

select is(
  tests.probar('super@test.local', format(
    $q$insert into public.app_botones (fraccionamiento_id, orden, nombre, estilo) values (%s, 2, 'X', 'rojo')$q$,
    tests.fid('fracc-a'))),
  '23514', 'estilo inválido -> 23514');

select is(
  tests.probar('3300000871@auth.internal', format(
    $q$select (e->'botones'->0->>'estilo') from public.estado_app_domicilio(%s) e$q$, current_setting('t.a1'))),
  'azul_claro', 'estado_app_domicilio incluye estilo');

update public.app_botones set estilo = 'navy' where fraccionamiento_id = tests.fid('fracc-a');
select is(
  tests.probar('3300000871@auth.internal', format(
    $q$select (e->'botones'->0->>'estilo') from public.estado_app_domicilio(%s) e$q$, current_setting('t.a1'))),
  'navy', 'estado refleja el estilo guardado');

select * from finish();
rollback;
