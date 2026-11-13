begin;
select plan(29);

select tests.crear_escenario();

-- Funciones de apoyo -------------------------------------------------------

select tests.autenticar_como('admin.a@test.local');
select is((select private.fraccionamiento_actual()), tests.fid('fracc-a'),
  'fraccionamiento_actual() de admin.a es fracc-a');
select is((select private.es_super_admin()), false, 'es_super_admin() de admin.a es false');

select tests.autenticar_como('super@test.local');
select is((select private.fraccionamiento_actual()), null::bigint,
  'fraccionamiento_actual() de super es null');
select is((select private.es_super_admin()), true, 'es_super_admin() de super es true');

select tests.autenticar_como('inactivo.a@test.local');
select is((select private.fraccionamiento_actual()), null::bigint,
  'fraccionamiento_actual() de un perfil inactivo es null');

select tests.autenticar_como('admin.c@test.local');
select is((select private.fraccionamiento_actual()), null::bigint,
  'fraccionamiento_actual() en un fraccionamiento inactivo es null');

select tests.autenticar_como('tesorero.b@test.local');
select is((select private.rol_actual()), 'tesorero'::public.rol_usuario,
  'rol_actual() de tesorero.b es tesorero');
select is((select private.tiene_rol(array['tesorero', 'comite']::public.rol_usuario[])), true,
  'tiene_rol() acepta un rol de la lista');
select is((select private.tiene_rol(array['administrador']::public.rol_usuario[])), false,
  'tiene_rol() rechaza un rol fuera de la lista');

-- Perfiles -----------------------------------------------------------------

select tests.autenticar_como('admin.a@test.local');
select is((select count(*)::int from public.perfiles), 5,
  'admin.a ve los 5 perfiles de A (incluye inactivo.a), ninguno de B ni super');

select tests.autenticar_como('comite.a@test.local');
select is((select count(*)::int from public.perfiles), 5,
  'comite.a ve los 5 perfiles de A');
select is_empty(
  $$select 1 from public.perfiles where fraccionamiento_id is distinct from tests.fid('fracc-a')$$,
  'comite.a no ve perfiles de B ni al super admin');

select tests.autenticar_como('inactivo.a@test.local');
select results_eq('select id from public.perfiles',
  $$select tests.uid('inactivo.a@test.local')$$, 'inactivo.a solo ve su propio perfil');

select tests.autenticar_como('admin.c@test.local');
select results_eq('select id from public.perfiles',
  $$select tests.uid('admin.c@test.local')$$,
  'admin.c (fraccionamiento inactivo) solo ve su propio perfil');

select tests.autenticar_como('admin.a@test.local');
select throws_ok(
  $$update public.perfiles set rol = 'super_admin' where id = tests.uid('tesorero.a@test.local')$$,
  '42501', null, 'admin.a no puede promover a super_admin');
select throws_ok(
  $$update public.perfiles set fraccionamiento_id = tests.fid('fracc-b') where id = tests.uid('tesorero.a@test.local')$$,
  '42501', null, 'admin.a no puede mover un perfil a otro fraccionamiento');
select throws_ok(
  $$insert into public.perfiles (id, fraccionamiento_id, rol, nombre, email)
    values (gen_random_uuid(), null, 'super_admin', 'x', 'x@test.local')$$,
  '42501', null, 'admin.a no puede crear un super_admin');

-- Fraccionamientos ---------------------------------------------------------

select results_eq('select slug from public.fraccionamientos',
  $$values ('fracc-a')$$, 'admin.a solo ve fracc-a');
-- Desde 20261114090000 el administrador puede actualizar solo
-- max_residentes_app; cualquier otra columna -> 42501 (trigger).
select throws_ok($$update public.fraccionamientos set nombre = 'Cambiado'$$,
  '42501', null, 'admin.a no actualiza fraccionamientos');
select throws_ok($$update public.fraccionamientos set instalacion_id = gen_random_uuid()
           where slug = 'fracc-a'$$,
  '42501', null, 'admin.a no asigna instalacion_id');

select tests.autenticar_como('super@test.local');
select is((select count(*)::int from public.fraccionamientos where slug in ('fracc-a','fracc-b','fracc-c')), 3, 'super ve los 3 fraccionamientos');
select lives_ok(
  $$insert into public.fraccionamientos (nombre, slug) values ('Fraccionamiento D', 'fracc-d')$$,
  'super crea un fraccionamiento');
with u as (update public.fraccionamientos set instalacion_id = gen_random_uuid()
           where slug = 'fracc-a' returning 1)
select is((select count(*)::int from u), 1, 'super asigna instalacion_id a fracc-a');
select throws_ok(
  $$update public.fraccionamientos
    set instalacion_id = (select instalacion_id from public.fraccionamientos where slug = 'fracc-a')
    where slug = 'fracc-b'$$,
  '23505', null, 'instalacion_id es única');

-- Restricciones (como postgres) --------------------------------------------

reset role;
select throws_ok(
  $$insert into public.perfiles (id, fraccionamiento_id, rol, nombre, email)
    values (tests.uid('admin.a@test.local'), null, 'administrador', 'x', 'x@test.local')$$,
  '23514', null, 'un administrador requiere fraccionamiento_id');
select throws_ok(
  $$insert into public.fraccionamientos (nombre, slug) values ('Malo', 'Slug Malo')$$,
  '23514', null, 'el slug debe ser kebab-case en minúsculas');

-- Fraccionamiento desactivado ----------------------------------------------

update public.fraccionamientos set activo = false where slug = 'fracc-a';

select tests.autenticar_como('admin.a@test.local');
select is((select private.fraccionamiento_actual()), null::bigint,
  'con fracc-a inactivo, fraccionamiento_actual() de admin.a es null');
select results_eq('select id from public.perfiles',
  $$select tests.uid('admin.a@test.local')$$,
  'con fracc-a inactivo, admin.a solo ve su propio perfil');
select is_empty('select 1 from public.fraccionamientos',
  'con fracc-a inactivo, admin.a no ve fraccionamientos');

reset role;
select * from finish();
rollback;
