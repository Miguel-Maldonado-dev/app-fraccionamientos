begin;
select plan(39);

select tests.crear_escenario();
select tests.crear_datos_negocio();

-- Escenario: dom_a (fracc A) con ene/feb/mar vencidas, abr pendiente y may pagada;
-- umbral de morosidad 3; recargo activo desde 2026-01-01.
select set_config('app.hoy', '2026-01-01', false);
select set_config('t.fa', tests.fid('fracc-a')::text, false);
select set_config('t.dom_a', (select id::text from public.domicilios where fraccionamiento_id = tests.fid('fracc-a')), false);
select set_config('t.con_a', (select concepto_id::text from public.domicilio_concepto where domicilio_id = current_setting('t.dom_a')::bigint), false);
select set_config('t.rec_a', (select id::text from public.conceptos_recargo where fraccionamiento_id = tests.fid('fracc-a')), false);
select set_config('t.cuota_b', (select id::text from public.cuotas where fraccionamiento_id = tests.fid('fracc-b')), false);

insert into public.reglas_cobro (fraccionamiento_id, cuotas_para_moroso, concepto_recargo_id)
  values (tests.fid('fracc-a'), 3, current_setting('t.rec_a')::bigint);
select set_config('app.hoy', '2026-06-15', false);

update public.concepto_pago_acceso
  set perfil_corriente_id = 'aaaaaaaa-0000-0000-0000-000000000001',
      perfil_moroso_id = 'aaaaaaaa-0000-0000-0000-000000000002'
  where concepto_pago_id = current_setting('t.con_a')::bigint;
update public.domicilios
  set titular_id = 'bbbbbbbb-0000-0000-0000-000000000001',
      perfil_asignado_id = 'aaaaaaaa-0000-0000-0000-000000000002'
  where id = current_setting('t.dom_a')::bigint;
delete from public.sincronizaciones_acceso where domicilio_id = current_setting('t.dom_a')::bigint;

update public.cuotas set estatus_id = 3 where domicilio_id = current_setting('t.dom_a')::bigint and anio = 2026 and mes = 1;
insert into public.cuotas (fraccionamiento_id, domicilio_id, anio, mes, fecha_vencimiento, estatus_id, concepto_id, importe)
select tests.fid('fracc-a'), current_setting('t.dom_a')::bigint, 2026, m, v, e, current_setting('t.con_a')::bigint, 500
from (values (2, date '2026-02-28', 3), (3, date '2026-03-31', 3), (4, date '2026-07-10', 1),
             (5, date '2026-05-31', 2), (9, date '2026-10-10', 1)) as x(m, v, e);
insert into public.pagos (fraccionamiento_id, domicilio_id, cuota_id, fecha_pago, metodo_pago_id, user_id, importe)
select tests.fid('fracc-a'), c.domicilio_id, c.id, date '2026-05-20', 1, tests.uid('tesorero.a@test.local'), 500
from public.cuotas c where c.domicilio_id = current_setting('t.dom_a')::bigint and c.mes = 5;

create temp table q as
select mes, id from public.cuotas where domicilio_id = current_setting('t.dom_a')::bigint;
grant select on q to authenticated;
select set_config('t.c1', (select id::text from q where mes = 1), false);
select set_config('t.c2', (select id::text from q where mes = 2), false);
select set_config('t.c3', (select id::text from q where mes = 3), false);
select set_config('t.c4', (select id::text from q where mes = 4), false);
select set_config('t.c5', (select id::text from q where mes = 5), false);
select set_config('t.c9', (select id::text from q where mes = 9), false);

-- Otro domicilio del mismo fraccionamiento con una cuota.
with d as (
  insert into public.domicilios (fraccionamiento_id, direccion, fecha_alta, created_by)
  values (tests.fid('fracc-a'), 'Calle A 2', date '2026-01-01', tests.uid('admin.a@test.local')) returning id
)
insert into public.cuotas (fraccionamiento_id, domicilio_id, anio, mes, fecha_vencimiento, estatus_id, concepto_id, importe)
select tests.fid('fracc-a'), d.id, 2026, 1, date '2026-01-31', 3, current_setting('t.con_a')::bigint, 500 from d;
select set_config('t.otro_dom', (select c.id::text from public.cuotas c join public.domicilios d on d.id = c.domicilio_id
  where d.direccion = 'Calle A 2'), false);

-- Catálogo y check ---------------------------------------------------------------------

select is((select name from public.estatus where id = 4), 'Cancelado', 'estatus 4 Cancelado existe');
select throws_ok(
  format('update public.cuotas set estatus_id = 4 where id = %s', current_setting('t.c1')),
  '23514', null, 'check: estatus 4 sin datos de cancelación -> 23514');
select throws_ok(
  format($q$update public.cuotas set motivo_cancelacion = 'x' where id = %s$q$, current_setting('t.c4')),
  '23514', null, 'check: motivo sin estatus 4 -> 23514');

-- Antes de cancelar ----------------------------------------------------------------------

select is(private.es_moroso(current_setting('t.dom_a')::bigint), true, 'antes: 3 vencidas con umbral 3 -> moroso');
select is(public.perfil_deseado(current_setting('t.dom_a')::bigint), 'aaaaaaaa-0000-0000-0000-000000000002'::uuid,
  'antes: perfil_deseado moroso');

-- Validaciones (todo o nada) -------------------------------------------------------------

select is(tests.probar('admin.a@test.local',
  format($q$select public.cancelar_cuotas(array[%s]::bigint[], 'ab')$q$, current_setting('t.c1'))),
  '22023', 'motivo de 2 caracteres -> 22023');
select is(tests.probar('admin.a@test.local',
  format($q$select public.cancelar_cuotas(array[%s]::bigint[], '   ')$q$, current_setting('t.c1'))),
  '22023', 'motivo vacío -> 22023');
select is(tests.probar('admin.a@test.local',
  format($q$select public.cancelar_cuotas(array[%s]::bigint[], repeat('x', 501))$q$, current_setting('t.c1'))),
  '22023', 'motivo de 501 caracteres -> 22023');
select is(tests.probar('tesorero.a@test.local',
  format($q$select public.cancelar_cuotas(array[%s]::bigint[], 'Motivo')$q$, current_setting('t.c1'))),
  '42501', 'tesorero no cancela -> 42501');
select is(tests.probar('super@test.local',
  format($q$select public.cancelar_cuotas(array[%s]::bigint[], 'Motivo')$q$, current_setting('t.c1'))),
  '42501', 'super admin no cancela -> 42501');

select tests.autenticar_como('admin.a@test.local');
select throws_ok(
  format($q$select public.cancelar_cuotas(array[%s, %s]::bigint[], 'Motivo')$q$, current_setting('t.c1'), current_setting('t.c5')),
  'P0001', null, 'cuota con pago en el arreglo -> P0001');
select throws_ok(
  format($q$select public.cancelar_cuotas(array[%s, %s]::bigint[], 'Motivo')$q$, current_setting('t.c1'), current_setting('t.otro_dom')),
  'P0001', null, 'cuota de otro domicilio en el arreglo -> P0001');
select throws_ok(
  format($q$select public.cancelar_cuotas(array[%s, %s]::bigint[], 'Motivo')$q$, current_setting('t.c1'), current_setting('t.cuota_b')),
  'P0001', null, 'cuota de otro fraccionamiento en el arreglo -> P0001');
reset role;
select set_config('request.jwt.claims', '', false);
select is((select count(*) from public.cuotas where estatus_id = 4), 0::bigint, 'tras los errores ninguna cuota cambió');

-- Cancelar ene y feb ----------------------------------------------------------------------

select tests.autenticar_como('admin.a@test.local');
select is(public.cancelar_cuotas(array[current_setting('t.c1')::bigint, current_setting('t.c2')::bigint], '  Acuerdo de asamblea  '),
  2, 'admin cancela 2 -> 2');
select throws_ok(
  format($q$select public.cancelar_cuotas(array[%s]::bigint[], 'Otra vez')$q$, current_setting('t.c1')),
  'P0001', null, 'cancelar una ya cancelada -> P0001');
select public.cancelar_cuotas(array[current_setting('t.c9')::bigint], 'Futura');
reset role;
select set_config('request.jwt.claims', '', false);

select is(
  (select array_agg(row(estatus_id, motivo_cancelacion, cancelada_por = tests.uid('admin.a@test.local'), cancelada_en is not null)::text order by mes)
   from public.cuotas where id in (current_setting('t.c1')::bigint, current_setting('t.c2')::bigint)),
  array['(4,"Acuerdo de asamblea",t,t)', '(4,"Acuerdo de asamblea",t,t)'], 'canceladas: estatus 4 y datos de cancelación');
select is(
  (select count(*) from public.cuotas_cancelaciones
   where cuota_id in (current_setting('t.c1')::bigint, current_setting('t.c2')::bigint)
     and accion = 'cancelar' and motivo = 'Acuerdo de asamblea' and usuario_id = tests.uid('admin.a@test.local')),
  2::bigint, 'historial: 2 filas cancelar');
select is(private.es_moroso(current_setting('t.dom_a')::bigint), false, 'después: 1 vencida -> no moroso');
select is(public.perfil_deseado(current_setting('t.dom_a')::bigint), 'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
  'después: perfil_deseado corriente');
select is(
  (select count(*) from public.sincronizaciones_acceso
   where domicilio_id = current_setting('t.dom_a')::bigint and operacion = 'asignar' and estado = 'pendiente'),
  1::bigint, 'cancelar encola la resincronización del domicilio');
select is(
  (select count(*) from public.recargo_cuota where cuota_id = current_setting('t.c1')::bigint)
  + (select count(*) from public.descuento_cuota where cuota_id = current_setting('t.c1')::bigint),
  2::bigint, 'cancelar no borra recargos ni descuentos');
select is((select estatus_calculado from public.cuotas_info where id = current_setting('t.c1')::bigint),
  'Cancelada', 'cuotas_info: estatus_calculado Cancelada');
select is((select cancelada_por_nombre from public.cuotas_info where id = current_setting('t.c1')::bigint),
  (select nombre from public.perfiles where id = tests.uid('admin.a@test.local')), 'cuotas_info: cancelada_por_nombre');

-- Escrituras directas y pagos -------------------------------------------------------------

select is(tests.probar('tesorero.a@test.local',
  format('insert into public.pagos (domicilio_id, cuota_id, fecha_pago, metodo_pago_id, user_id, importe) values (%s, %s, %L, 1, %L, 500)',
    current_setting('t.dom_a'), current_setting('t.c1'), '2026-06-15', tests.uid('tesorero.a@test.local'))),
  'P0001', 'pagar una cuota cancelada -> P0001');
select is(tests.probar('admin.a@test.local',
  format('update public.cuotas set estatus_id = 2 where id = %s', current_setting('t.c1'))),
  '23514', 'marcar pagada una cancelada directamente -> 23514');
select is(tests.probar('admin.a@test.local',
  format($q$update public.cuotas set motivo_cancelacion = 'x' where id = %s$q$, current_setting('t.c1'))),
  '42501', 'authenticated no escribe columnas de cancelación -> 42501');

-- Proceso diario ------------------------------------------------------------------------------

select set_config('app.hoy', '2026-08-15', false);
select public.procesar_reglas_cobro();
select is((select estatus_id from public.cuotas where id = current_setting('t.c2')::bigint), 4::bigint,
  'proceso diario: la cancelada sigue cancelada');
select is((select count(*) from public.recargo_cuota where cuota_id = current_setting('t.c2')::bigint), 0::bigint,
  'proceso diario: sin recargo a la cancelada');
select is((select count(*) from public.recargo_cuota where cuota_id = current_setting('t.c3')::bigint), 1::bigint,
  'proceso diario: control, la vencida no cancelada sí recibe recargo');

-- Reactivar ----------------------------------------------------------------------------------

select is(tests.probar('tesorero.a@test.local',
  format('select public.reactivar_cuota(%s)', current_setting('t.c2'))),
  '42501', 'tesorero no reactiva -> 42501');
select is(tests.probar('admin.a@test.local',
  format('select public.reactivar_cuota(%s)', current_setting('t.c4'))),
  'P0001', 'reactivar una no cancelada -> P0001');

select tests.autenticar_como('admin.a@test.local');
select is(public.reactivar_cuota(current_setting('t.c2')::bigint), 3::smallint, 'reactivar vencida -> 3');
select is(public.reactivar_cuota(current_setting('t.c9')::bigint), 1::smallint, 'reactivar no vencida -> 1');
reset role;
select set_config('request.jwt.claims', '', false);
select is(
  (select row(c.estatus_id, c.cancelada_en, c.motivo_cancelacion,
     (select count(*) from public.cuotas_cancelaciones h where h.cuota_id = c.id and h.accion = 'reactivar'))::text
   from public.cuotas c where c.id = current_setting('t.c2')::bigint),
  '(3,,,1)', 'reactivar limpia la cancelación y registra historial');

-- RLS del historial ------------------------------------------------------------------------------

select is(tests.probar('tesorero.a@test.local', 'select count(*) from public.cuotas_cancelaciones'),
  '5', 'RLS: tesorero.a lee el historial de A');
select is(tests.probar('admin.b@test.local', 'select count(*) from public.cuotas_cancelaciones'),
  '0', 'RLS: admin.b no ve el historial de A');
select is(tests.probar('admin.a@test.local',
  format($q$insert into public.cuotas_cancelaciones (fraccionamiento_id, cuota_id, accion) values (%s, %s, 'cancelar')$q$,
    current_setting('t.fa'), current_setting('t.c3'))),
  '42501', 'RLS: nadie inserta directo en el historial');

-- Fraccionamiento sin reglas_cobro: días de gracia 0.
select tests.autenticar_como('admin.b@test.local');
select public.cancelar_cuotas(array[current_setting('t.cuota_b')::bigint], 'Sin reglas');
select is(public.reactivar_cuota(current_setting('t.cuota_b')::bigint), 3::smallint,
  'reactivar sin reglas_cobro (gracia 0) vencida -> 3');
reset role;

select * from finish();
rollback;
