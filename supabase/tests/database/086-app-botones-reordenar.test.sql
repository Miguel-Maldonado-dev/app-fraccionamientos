begin;
select plan(4);

select tests.crear_escenario();

insert into public.app_botones (fraccionamiento_id, orden, nombre)
  select tests.fid('fracc-a'), g, 'B' || g from generate_series(1, 8) g;

select set_config('t.ids', (select string_agg(id::text, ',' order by orden desc)
  from public.app_botones where fraccionamiento_id = tests.fid('fracc-a')), false);

select tests.autenticar_como('super@test.local');
select lives_ok(
  format($q$select public.reordenar_app_botones(%s, string_to_array(%L, ',')::bigint[])$q$,
    tests.fid('fracc-a'), current_setting('t.ids')),
  'con 8 botones invierte el orden sin violar el único');
reset role;

select is(
  (select string_agg(nombre, ',' order by orden) from public.app_botones where fraccionamiento_id = tests.fid('fracc-a')),
  'B8,B7,B6,B5,B4,B3,B2,B1', 'reordenar asigna orden 1..n según la lista');

select is(
  tests.probar('admin.a@test.local', format(
    $q$select public.reordenar_app_botones(%1$s, string_to_array(%2$L, ',')::bigint[])::text$q$,
    tests.fid('fracc-a'), current_setting('t.ids'))),
  '42501', 'el personal no puede reordenar');

select is(
  tests.probar('super@test.local', format(
    $q$select public.reordenar_app_botones(%1$s, array[1]::bigint[])::text$q$, tests.fid('fracc-a'))),
  '22023', 'lista incompleta -> 22023');

select * from finish();
rollback;
