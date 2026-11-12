begin;
-- 9 has_view + 9 security_invoker + 6 admin.a + 1 resumen + 1 users_info
-- + 1 medios admin.a + 1 vigilancia.a + 6 aislamiento comite.a
-- + 1 control positivo comite.a + 4 reporte_pagos_detalle/users_info tesorero.a y comite.a
select plan(39);

select tests.crear_escenario();
select tests.crear_datos_negocio();

create temp table vistas (nombre text) on commit drop;
insert into vistas values
  ('users_info'), ('domicilios_info'), ('cuotas_info'), ('pagos_info'),
  ('residentes_info'), ('domicilio_concepto_info'), ('movimientos_info'),
  ('reporte_pagos_detalle'), ('resumen_financiero_completo');
grant select on vistas to authenticated;

-- Id del domicilio de B, guardado antes de cambiar de rol.
select set_config('t.dom_b', (select id::text from public.domicilios where fraccionamiento_id = tests.fid('fracc-b')), false);

select has_view('public', v.nombre, 'vista ' || v.nombre) from vistas v order by v.nombre;

select ok(
  coalesce((select c.reloptions from pg_class c join pg_namespace n on n.oid = c.relnamespace
            where n.nspname = 'public' and c.relname = v.nombre), '{}') @> array['security_invoker=on'],
  v.nombre || ' es security_invoker')
from vistas v order by v.nombre;

select tests.autenticar_como('admin.a@test.local');
select is((select count(*) from public.domicilios_info), 1::bigint, 'admin.a: domicilios_info 1 fila');
select is((select direccion from public.domicilios_info), 'Calle A 1', 'admin.a: domicilios_info direccion');
select is((select count(*) from public.cuotas_info), 1::bigint, 'admin.a: cuotas_info 1 fila');
select is((select direccion from public.cuotas_info), 'Calle A 1', 'admin.a: cuotas_info direccion');
select is((select count(*) from public.pagos_info), 1::bigint, 'admin.a: pagos_info 1 fila');
select is((select direccion from public.pagos_info), 'Calle A 1', 'admin.a: pagos_info direccion');
select is((select total_ingresos from public.resumen_financiero_completo), 1000::numeric, 'admin.a: total_ingresos solo de A');
select is((select count(*) from public.users_info), 5::bigint, 'admin.a: users_info 5 perfiles de A');
select is((select medios from public.domicilios_info), '{tarjeta,telefono}'::public.medio_acceso[],
  'admin.a: domicilios_info.medios del tipo de cuota');
reset role;

select tests.autenticar_como('vigilancia.a@test.local');
select is_empty($$select * from public.pagos_info$$, 'vigilancia.a: pagos_info vacía');
reset role;

select tests.autenticar_como('comite.a@test.local');
select cmp_ok((select count(*) from public.cuotas_info), '>=', 1::bigint, 'comite.a: cuotas_info ve filas de A');
select is_empty(
  format('select * from public.%I where domicilio_id = %L::bigint', v.nombre, current_setting('t.dom_b')),
  'comite.a: ' || v.nombre || ' sin filas de B')
from (values ('cuotas_info'), ('pagos_info'), ('residentes_info'), ('domicilio_concepto_info'),
             ('reporte_pagos_detalle')) as v(nombre)
order by v.nombre;
select is_empty(
  format('select * from public.domicilios_info where id = %L::bigint', current_setting('t.dom_b')),
  'comite.a: domicilios_info sin filas de B');
reset role;

-- reporte_pagos_detalle: pagos registrados por distintos perfiles de A -----
-- Segundo pago en A registrado por admin.a (el primero es de tesorero.a).
insert into public.pagos (fraccionamiento_id, domicilio_id, cuota_id, fecha_pago, metodo_pago_id, user_id, importe)
select fraccionamiento_id, id, null, date '2026-01-06', 1, tests.uid('admin.a@test.local'), 0
  from public.domicilios where fraccionamiento_id = tests.fid('fracc-a');

select tests.autenticar_como('tesorero.a@test.local');
select results_eq(
  'select usuario from public.reporte_pagos_detalle order by usuario',
  $$values ('admin.a@test.local'), ('tesorero.a@test.local')$$,
  'tesorero.a: reporte_pagos_detalle incluye los 2 pagos de A de distintos perfiles');
select is((select count(*) from public.users_info), 5::bigint, 'tesorero.a: users_info 5 perfiles de A');
reset role;

select tests.autenticar_como('comite.a@test.local');
select results_eq(
  'select usuario from public.reporte_pagos_detalle order by usuario',
  $$values ('admin.a@test.local'), ('tesorero.a@test.local')$$,
  'comite.a: reporte_pagos_detalle incluye los 2 pagos de A de distintos perfiles');
select is((select count(*) from public.users_info), 5::bigint, 'comite.a: users_info 5 perfiles de A');
reset role;

select * from finish();
rollback;
