-- Permisos de columna en perfiles: authenticated no inserta perfiles (el alta
-- usa service role) y solo actualiza nombre, rol y activo.
begin;
select plan(9);

select tests.crear_escenario();

select is(has_table_privilege('authenticated', 'public.perfiles', 'insert'), false,
  'authenticated no tiene insert en perfiles');
select is(has_column_privilege('authenticated', 'public.perfiles', 'id', 'update'), false,
  'authenticated no actualiza perfiles.id');
select is(has_column_privilege('authenticated', 'public.perfiles', 'email', 'update'), false,
  'authenticated no actualiza perfiles.email');

select is(
  tests.probar('admin.a@test.local',
    $$insert into public.perfiles (id, fraccionamiento_id, rol, nombre, email)
      values (gen_random_uuid(), tests.fid('fracc-a'), 'tesorero', 'x', 'x@test.local')$$),
  '42501', 'admin.a no puede insertar perfiles en su fraccionamiento');
select is(
  tests.probar('admin.a@test.local',
    $$update public.perfiles set id = gen_random_uuid() where id = tests.uid('tesorero.a@test.local')$$),
  '42501', 'admin.a no puede cambiar el id de un perfil');
select is(
  tests.probar('admin.a@test.local',
    $$update public.perfiles set email = 'otro@test.local' where id = tests.uid('tesorero.a@test.local')$$),
  '42501', 'admin.a no puede cambiar el email de un perfil');
select is(
  tests.probar('admin.a@test.local',
    $$update public.perfiles set nombre = 'X' where id = tests.uid('tesorero.a@test.local')$$),
  '1', 'admin.a actualiza el nombre de tesorero.a');
select is(
  tests.probar('admin.a@test.local',
    $$update public.perfiles set rol = 'comite' where id = tests.uid('tesorero.a@test.local')$$),
  '1', 'admin.a actualiza el rol de tesorero.a');
select is(
  tests.probar('admin.a@test.local',
    $$update public.perfiles set activo = false where id = tests.uid('tesorero.a@test.local')$$),
  '1', 'admin.a actualiza activo de tesorero.a');

select * from finish();
rollback;
