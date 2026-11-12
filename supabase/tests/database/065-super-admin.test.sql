begin;
-- 3 sin finanzas + 1 domicilio_concepto
select plan(4);

select tests.crear_escenario();
select tests.crear_datos_negocio();

-- Review Focus 2: super no ve finanzas -------------------------------------

select is(tests.probar('super@test.local', 'select count(*) from public.pagos'),
  '0', 'super: select count(*) from pagos = 0');
select is(tests.probar('super@test.local', 'select count(*) from public.cuotas'),
  '0', 'super: select count(*) from cuotas = 0');
select is(tests.probar('super@test.local', 'select count(*) from public.movimientos_financieros'),
  '0', 'super: select count(*) from movimientos_financieros = 0');

-- Super no cambia el tipo de cuota de un domicilio: el update afecta 0 filas.
select is(
  tests.probar('super@test.local',
    format('update public.domicilio_concepto set concepto_id = concepto_id where fraccionamiento_id = %s',
           tests.fid('fracc-a'))),
  '0', 'domicilio_concepto: super update afecta 0 filas');

select * from finish();
rollback;
