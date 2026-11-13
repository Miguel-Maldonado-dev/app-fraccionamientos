begin;
select plan(22);

select tests.crear_escenario();
select tests.crear_datos_negocio();

select set_config('t.a1', (select id::text from public.domicilios where fraccionamiento_id = tests.fid('fracc-a')), false);
select set_config('t.b1', (select id::text from public.domicilios where fraccionamiento_id = tests.fid('fracc-b')), false);

-- Residente R (3300000851) en A1.
insert into auth.users (id, email, aud, role) values
  (gen_random_uuid(), '3300000851@auth.internal', 'authenticated', 'authenticated');
insert into public.cuentas_residente (user_id, telefono) values
  (tests.uid('3300000851@auth.internal'), '3300000851');
update public.residentes set user_id = tests.uid('3300000851@auth.internal')
  where domicilio_id = current_setting('t.a1')::bigint;

-- A con instalación y A1 con titular.
update public.fraccionamientos set instalacion_id = gen_random_uuid() where id = tests.fid('fracc-a');
update public.domicilios set titular_id = gen_random_uuid() where id = current_setting('t.a1')::bigint;

-- Botones: A tiene 3 (el 3.º sin salida), B tiene 1.
insert into public.app_botones (fraccionamiento_id, orden, nombre, icono, salida_id, salida_nombre) values
  (tests.fid('fracc-a'), 1, 'Pluma', 'pluma', gen_random_uuid(), 'Salida 1'),
  (tests.fid('fracc-a'), 2, 'Peatonal', 'peatonal', gen_random_uuid(), 'Salida 2'),
  (tests.fid('fracc-a'), 3, 'Alberca', 'alberca', null, null),
  (tests.fid('fracc-b'), 1, 'Pluma B', 'pluma', gen_random_uuid(), 'Salida B');

-- Restricciones ----------------------------------------------------------------------

select throws_ok(
  format($q$insert into public.app_botones (fraccionamiento_id, orden, nombre) values (%s, 1, 'Dup')$q$, tests.fid('fracc-a')),
  '23505', null, 'orden duplicado -> 23505');

select throws_ok(
  format($q$insert into public.app_botones (fraccionamiento_id, orden, nombre) values (%s, 9, 'X')$q$, tests.fid('fracc-a')),
  '23514', null, 'orden 9 -> 23514');

select throws_ok(
  format($q$insert into public.app_botones (fraccionamiento_id, orden, nombre, icono) values (%s, 4, 'X', 'cohete')$q$, tests.fid('fracc-a')),
  '23514', null, 'icono inválido -> 23514');

select is(
  tests.probar('super@test.local', format(
    $q$with x as (insert into public.app_botones (fraccionamiento_id, orden, nombre)
       select %1$s, g, 'B' || g from generate_series(4, 8) g returning 1)
       select (select count(*) from x)::text || '/' ||
         (select count(*) from public.app_botones where fraccionamiento_id = %1$s)::text$q$,
    tests.fid('fracc-a'))),
  '5/3', 'super admin inserta hasta completar 8');

-- 9.º botón: con 8 ya existentes el trigger rechaza aunque se mueva desde otro fraccionamiento.
select is(
  tests.probar('super@test.local', format(
    $q$with x as (insert into public.app_botones (fraccionamiento_id, orden, nombre)
       select %1$s, g, 'B' || g from generate_series(4, 8) g returning 1)
       select count(*) from x$q$, tests.fid('fracc-a'))) ,
  '5', 'control: 5 inserciones válidas');
insert into public.app_botones (fraccionamiento_id, orden, nombre)
  select tests.fid('fracc-a'), g, 'B' || g from generate_series(4, 8) g;
select throws_ok(
  format($q$update public.app_botones set fraccionamiento_id = %s, orden = 2 where fraccionamiento_id = %s$q$,
    tests.fid('fracc-a'), tests.fid('fracc-b')),
  '23514', null, '9.º botón -> 23514');
delete from public.app_botones where fraccionamiento_id = tests.fid('fracc-a') and orden > 3;

-- RLS ------------------------------------------------------------------------------------

select is(
  tests.probar('admin.a@test.local',
    format($q$insert into public.app_botones (fraccionamiento_id, orden, nombre) values (%s, 5, 'X')$q$, tests.fid('fracc-a'))),
  '42501', 'administrador no inserta botones');
select is(
  tests.probar('admin.a@test.local', $q$update public.app_botones set nombre = 'X'$q$) || '/' ||
  tests.probar('admin.a@test.local', 'delete from public.app_botones'),
  '0/0', 'administrador no actualiza ni borra botones');
select is(
  tests.probar('vigilancia.a@test.local', 'select count(*) from public.app_botones'),
  '3', 'personal ve los botones de su fraccionamiento');
select is(
  tests.probar('super@test.local', format(
    'select count(*) from public.app_botones where fraccionamiento_id in (%s, %s)',
    tests.fid('fracc-a'), tests.fid('fracc-b'))),
  '4', 'super admin ve todos');
select is(
  tests.probar('3300000851@auth.internal', 'select string_agg(nombre, '','' order by orden) from public.app_botones'),
  'Pluma,Peatonal,Alberca', 'residente ve solo los botones de su fraccionamiento');
select is(
  tests.probar('3300000851@auth.internal', $q$insert into public.app_botones (fraccionamiento_id, orden, nombre) select fraccionamiento_id, 6, 'X' from public.app_botones limit 1$q$),
  '42501', 'residente no inserta botones');

-- estado_app_domicilio ---------------------------------------------------------------------

select is(
  tests.probar('3300000851@auth.internal', format('select public.estado_app_domicilio(%s)::text', current_setting('t.b1'))),
  '42501', 'estado de domicilio ajeno -> 42501');
select is(
  tests.probar('admin.a@test.local', format('select public.estado_app_domicilio(%s)::text', current_setting('t.a1'))),
  '42501', 'personal (no residente) -> 42501');

select is(
  tests.probar('3300000851@auth.internal', format(
    $q$select e->>'moroso' || '|' || (e->>'pin') || '|' || (e->'domicilio'->>'direccion') || '|' ||
       (e->'fraccionamiento'->>'nombre') || '|' ||
       (select string_agg((b->>'orden') || ':' || (b->>'habilitado'), ',') from jsonb_array_elements(e->'botones') b)
     from public.estado_app_domicilio(%s) e$q$, current_setting('t.a1'))),
  'false|1234|Calle A 1|Fraccionamiento A|1:true,2:true,3:false',
  'estado al corriente: PIN, orden y botón sin salida deshabilitado');

update public.cuotas set estatus_id = 3 where domicilio_id = current_setting('t.a1')::bigint;

select is(
  tests.probar('3300000851@auth.internal', format(
    $q$select e->>'moroso' || '|' ||
       (select string_agg(b->>'habilitado', ',') from jsonb_array_elements(e->'botones') b)
     from public.estado_app_domicilio(%s) e$q$, current_setting('t.a1'))),
  'true|false,false,false', 'moroso -> todos deshabilitados');

update public.domicilios set acceso_forzado = 'activo' where id = current_setting('t.a1')::bigint;
select is(
  tests.probar('3300000851@auth.internal', format(
    $q$select e->>'moroso' || '|' ||
       (select string_agg(b->>'habilitado', ',') from jsonb_array_elements(e->'botones') b)
     from public.estado_app_domicilio(%s) e$q$, current_setting('t.a1'))),
  'false|true,true,false', 'moroso con acceso_forzado activo -> moroso=false');

update public.domicilios set acceso_forzado = 'inactivo' where id = current_setting('t.a1')::bigint;
update public.cuotas set estatus_id = 1 where domicilio_id = current_setting('t.a1')::bigint;
select is(
  tests.probar('3300000851@auth.internal', format(
    $q$select e->>'moroso' from public.estado_app_domicilio(%s) e$q$, current_setting('t.a1'))),
  'true', 'al corriente con acceso_forzado inactivo -> moroso=true');
update public.domicilios set acceso_forzado = null where id = current_setting('t.a1')::bigint;

update public.domicilios set titular_id = null where id = current_setting('t.a1')::bigint;
select is(
  tests.probar('3300000851@auth.internal', format(
    $q$select (select string_agg(b->>'habilitado', ',') from jsonb_array_elements(e->'botones') b)
     from public.estado_app_domicilio(%s) e$q$, current_setting('t.a1'))),
  'false,false,false', 'sin titular_id -> deshabilitados');
update public.domicilios set titular_id = gen_random_uuid() where id = current_setting('t.a1')::bigint;

-- Cambio de instalación ------------------------------------------------------------------

update public.fraccionamientos set instalacion_id = gen_random_uuid() where id = tests.fid('fracc-a');
select is(
  (select count(*)::int from public.app_botones
   where fraccionamiento_id = tests.fid('fracc-a') and (salida_id is not null or salida_nombre is not null))
  || '/' ||
  (select count(*)::int from public.app_botones
   where fraccionamiento_id = tests.fid('fracc-b') and salida_id is not null),
  '0/1', 'cambio de instalación limpia salidas solo de ese fraccionamiento');

-- aperturas_remotas ---------------------------------------------------------------------

insert into public.aperturas_remotas (fraccionamiento_id, domicilio_id, user_id, resultado)
  values (tests.fid('fracc-a'), current_setting('t.a1')::bigint, tests.uid('3300000851@auth.internal'), 'opened'),
         (tests.fid('fracc-a'), current_setting('t.a1')::bigint, tests.uid('3300000851@auth.internal'), 'denied');

select is(
  tests.probar('3300000851@auth.internal', 'select count(*) from public.aperturas_remotas') || '/' ||
  tests.probar('tesorero.a@test.local', 'select count(*) from public.aperturas_remotas') || '/' ||
  tests.probar('admin.b@test.local', 'select count(*) from public.aperturas_remotas') || '/' ||
  tests.probar('admin.a@test.local', 'select count(*) from public.aperturas_remotas') || '/' ||
  tests.probar('super@test.local', 'select count(*) from public.aperturas_remotas') || '/' ||
  tests.probar('admin.a@test.local',
    format($q$insert into public.aperturas_remotas (fraccionamiento_id, domicilio_id, user_id, resultado)
      values (%s, 1, gen_random_uuid(), 'opened')$q$, tests.fid('fracc-a'))),
  '0/0/0/2/2/42501', 'aperturas_remotas: lee administrador y super; nadie autenticado inserta');

select is(
  private.aperturas_recientes(tests.uid('3300000851@auth.internal'), 60) || '/' ||
  private.aperturas_recientes(gen_random_uuid(), 60),
  '2/0', 'aperturas_recientes cuenta las del usuario');

select * from finish();
rollback;
