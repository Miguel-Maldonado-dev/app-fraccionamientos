begin;
-- Recibos como JSON (spec 2026-11-10-recibos-design §1):
-- 2 columnas de pagos + 4 columnas de vistas + 3 tesorero.a (insert, pagos_info, reporte)
select plan(9);

select tests.crear_escenario();
select tests.crear_datos_negocio();

select has_column('public', 'pagos', 'recibo', 'pagos.recibo existe');
select hasnt_column('public', 'pagos', 'file_data', 'pagos.file_data ya no existe');

select has_column('public', 'pagos_info', 'tiene_recibo', 'pagos_info.tiene_recibo existe');
select hasnt_column('public', 'pagos_info', 'file_data', 'pagos_info sin file_data');
select has_column('public', 'reporte_pagos_detalle', 'tiene_recibo', 'reporte_pagos_detalle.tiene_recibo existe');
select hasnt_column('public', 'reporte_pagos_detalle', 'file_data', 'reporte_pagos_detalle sin file_data');

-- Domicilio de A, guardado antes de cambiar de rol.
select set_config('t.dom_a', (select id::text from public.domicilios where fraccionamiento_id = tests.fid('fracc-a')), false);

select tests.autenticar_como('tesorero.a@test.local');
select lives_ok(
  format($$insert into public.pagos (domicilio_id, fecha_pago, metodo_pago_id, user_id, importe, recibo)
           values (%L::bigint, date '2026-01-07', 1, %L::uuid, 150,
                   '{"v":1,"fraccionamiento":"Fraccionamiento A","direccion":"Calle A 1","residente":"Residente A","concepto":"Tarjeta","fechaPago":"07/01/2026","subtotal":150,"total":150}'::jsonb)$$,
         current_setting('t.dom_a'), tests.uid('tesorero.a@test.local')),
  'tesorero.a: inserta un pago con recibo');
select results_eq(
  'select tiene_recibo from public.pagos_info order by id',
  $$values (false), (true)$$,
  'tesorero.a: pagos_info marca tiene_recibo solo en el pago con recibo');
select results_eq(
  'select tiene_recibo from public.reporte_pagos_detalle order by id',
  $$values (false), (true)$$,
  'tesorero.a: reporte_pagos_detalle marca tiene_recibo solo en el pago con recibo');
reset role;

select * from finish();
rollback;
