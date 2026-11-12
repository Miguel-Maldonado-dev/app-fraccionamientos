begin;
-- 4 fecha_vencimiento + 1 hoy + 2 checks + 3 RLS + 1 recargo_desde + 1 borrar concepto
-- + 2 generar_cuota_domicilio + 1 generar_cuotas + 1 acceso_forzado
-- Sección 2: 2 es_moroso + 2 perfil_deseado + 5 forzar_acceso + 1 limpiar + 1 insert
-- + 3 estado_acceso + 6 procesar + 2 gracia/vista + 2 cron
select plan(43);

select tests.crear_escenario();
select tests.crear_datos_negocio();

select set_config('t.fa', tests.fid('fracc-a')::text, false);
select set_config('t.fb', tests.fid('fracc-b')::text, false);
select set_config('t.dom_a', (select id::text from public.domicilios where fraccionamiento_id = tests.fid('fracc-a')), false);
select set_config('t.rec_a', (select id::text from public.conceptos_recargo where fraccionamiento_id = tests.fid('fracc-a')), false);

-- fecha_vencimiento ------------------------------------------------------------

select is(private.fecha_vencimiento(tests.fid('fracc-a'), 2026, 2), date '2026-02-28',
  'fecha_vencimiento: sin reglas vence el último día');

insert into public.reglas_cobro (fraccionamiento_id, dia_vencimiento) values (tests.fid('fracc-a'), 31);
select is(private.fecha_vencimiento(tests.fid('fracc-a'), 2028, 2), date '2028-02-29',
  'fecha_vencimiento: día 31 en febrero bisiesto -> 29');

update public.reglas_cobro set dia_generacion = 20, dia_vencimiento = 10 where fraccionamiento_id = tests.fid('fracc-a');
select is(private.fecha_vencimiento(tests.fid('fracc-a'), 2026, 12), date '2027-01-10',
  'fecha_vencimiento: gen 20 / venc 10 en diciembre -> 10 de enero');

update public.reglas_cobro set dia_generacion = 25, dia_vencimiento = null where fraccionamiento_id = tests.fid('fracc-a');
select is(private.fecha_vencimiento(tests.fid('fracc-a'), 2026, 4), date '2026-04-30',
  'fecha_vencimiento: gen 25 / venc nulo -> fin del mismo mes');

select set_config('app.hoy', '2026-03-15', true);
select is(private.hoy(), date '2026-03-15', 'hoy: respeta app.hoy');

-- checks ---------------------------------------------------------------------------

select throws_ok(
  format('update public.reglas_cobro set dia_generacion = 29 where fraccionamiento_id = %s', current_setting('t.fa')),
  '23514', null, 'checks: dia_generacion 29 -> 23514');
select throws_ok(
  format('update public.reglas_cobro set dias_gracia = 61 where fraccionamiento_id = %s', current_setting('t.fa')),
  '23514', null, 'checks: dias_gracia 61 -> 23514');

-- RLS ------------------------------------------------------------------------------

select is(
  tests.probar('tesorero.a@test.local', 'update public.reglas_cobro set dias_gracia = 5'),
  '0', 'RLS: tesorero.a no actualiza reglas');
select is(
  tests.probar('admin.a@test.local', 'update public.reglas_cobro set dias_gracia = 5'),
  '1', 'RLS: admin.a actualiza reglas');
select is(
  tests.probar('admin.b@test.local', 'select count(*) from public.reglas_cobro'),
  '0', 'RLS: admin.b no ve las reglas de A');

-- recargo_desde ----------------------------------------------------------------------

update public.reglas_cobro set concepto_recargo_id = current_setting('t.rec_a')::bigint
  where fraccionamiento_id = tests.fid('fracc-a');
select is((select recargo_desde from public.reglas_cobro where fraccionamiento_id = tests.fid('fracc-a')),
  date '2026-03-15', 'recargo_desde: se fija a hoy al elegir concepto');

delete from public.recargo_cuota where concepto_recargo_id = current_setting('t.rec_a')::bigint;
delete from public.conceptos_recargo where id = current_setting('t.rec_a')::bigint;
select is(
  (select row(concepto_recargo_id, recargo_desde)::text from public.reglas_cobro where fraccionamiento_id = tests.fid('fracc-a')),
  '(,)', 'borrar el concepto deja concepto_recargo_id y recargo_desde nulos');

-- generar_cuota_domicilio --------------------------------------------------------------

select is(
  tests.probar('tesorero.a@test.local',
    format('select public.generar_cuota_domicilio(%s, 2026, 1)', current_setting('t.dom_a'))),
  'P0001', 'generar_cuota_domicilio: duplicada -> P0001');
select is(
  tests.probar('comite.a@test.local',
    format('select public.generar_cuota_domicilio(%s, 2026, 5)', current_setting('t.dom_a'))),
  '42501', 'generar_cuota_domicilio: comite -> 42501');

-- generar_cuotas usa fecha_vencimiento (gen 25 / venc 10 => mes siguiente)
update public.reglas_cobro set dia_vencimiento = 10 where fraccionamiento_id = tests.fid('fracc-a');
select tests.autenticar_como('admin.a@test.local');
select public.generar_cuotas(2026, 6);
select public.generar_cuota_domicilio(current_setting('t.dom_a')::bigint, 2026, 8);
reset role;
select is(
  (select fecha_vencimiento from public.cuotas where fraccionamiento_id = tests.fid('fracc-a') and anio = 2026 and mes = 6),
  date '2026-07-10', 'generar_cuotas: vence el 10 del mes siguiente');
select is(
  (select fecha_vencimiento from public.cuotas where fraccionamiento_id = tests.fid('fracc-a') and anio = 2026 and mes = 8),
  date '2026-09-10', 'generar_cuota_domicilio: usa fecha_vencimiento');

-- acceso_forzado ------------------------------------------------------------------------

select is(
  tests.probar('admin.a@test.local', $q$update public.domicilios set acceso_forzado = 'activo'$q$),
  '42501', 'domicilios: authenticated no actualiza acceso_forzado -> 42501');

-- =====================================================================================
-- Sección 2
-- =====================================================================================

reset role;
select set_config('request.jwt.claims', '', true);
select set_config('t.con_a', (select concepto_id::text from public.domicilio_concepto where domicilio_id = current_setting('t.dom_a')::bigint), false);
delete from public.cuotas where domicilio_id = current_setting('t.dom_a')::bigint and mes in (6, 8);
update public.reglas_cobro set dia_generacion = null, dia_vencimiento = null, cuotas_para_moroso = 2
  where fraccionamiento_id = tests.fid('fracc-a');
update public.concepto_pago_acceso
  set perfil_corriente_id = 'aaaaaaaa-0000-0000-0000-000000000001',
      perfil_moroso_id = 'aaaaaaaa-0000-0000-0000-000000000002'
  where concepto_pago_id = current_setting('t.con_a')::bigint;

-- es_moroso ------------------------------------------------------------------------------

update public.cuotas set estatus_id = 3 where domicilio_id = current_setting('t.dom_a')::bigint and anio = 2026 and mes = 1;
select is(private.es_moroso(current_setting('t.dom_a')::bigint), false, 'es_moroso: umbral 2 con una vencida -> false');
insert into public.cuotas (fraccionamiento_id, domicilio_id, anio, mes, fecha_vencimiento, estatus_id, concepto_id, importe)
  values (tests.fid('fracc-a'), current_setting('t.dom_a')::bigint, 2026, 2, date '2026-02-28', 3, current_setting('t.con_a')::bigint, 500);
select is(private.es_moroso(current_setting('t.dom_a')::bigint), true, 'es_moroso: umbral 2 con dos vencidas -> true');

-- perfil_deseado respeta el ajuste manual ------------------------------------------------

update public.domicilios set acceso_forzado = 'activo' where id = current_setting('t.dom_a')::bigint;
select is(public.perfil_deseado(current_setting('t.dom_a')::bigint), 'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
  'perfil_deseado: moroso con activo -> corriente');
update public.reglas_cobro set cuotas_para_moroso = 3 where fraccionamiento_id = tests.fid('fracc-a');
update public.domicilios set acceso_forzado = 'inactivo' where id = current_setting('t.dom_a')::bigint;
select is(public.perfil_deseado(current_setting('t.dom_a')::bigint), 'aaaaaaaa-0000-0000-0000-000000000002'::uuid,
  'perfil_deseado: al corriente con inactivo -> moroso');
update public.domicilios set acceso_forzado = null where id = current_setting('t.dom_a')::bigint;
update public.reglas_cobro set cuotas_para_moroso = 2 where fraccionamiento_id = tests.fid('fracc-a');

-- forzar_acceso ----------------------------------------------------------------------------

select is(tests.probar('tesorero.a@test.local',
  format($q$select public.forzar_acceso(%s, 'activo')$q$, current_setting('t.dom_a'))),
  '42501', 'forzar_acceso: tesorero -> 42501');
select is(tests.probar('super@test.local',
  format($q$select public.forzar_acceso(%s, 'activo')$q$, current_setting('t.dom_a'))),
  '42501', 'forzar_acceso: super admin -> 42501');
select is(tests.probar('admin.a@test.local',
  format($q$select public.forzar_acceso(%s, 'inactivo')$q$, current_setting('t.dom_a'))),
  'P0001', 'forzar_acceso: inactivo sobre moroso -> P0001');

update public.domicilios
  set titular_id = 'bbbbbbbb-0000-0000-0000-000000000001',
      perfil_asignado_id = 'aaaaaaaa-0000-0000-0000-000000000002'
  where id = current_setting('t.dom_a')::bigint;
select tests.autenticar_como('admin.a@test.local');
select public.forzar_acceso(current_setting('t.dom_a')::bigint, 'activo');
reset role;
select is(
  (select row(acceso_forzado, acceso_forzado_por = tests.uid('admin.a@test.local'), acceso_forzado_en is not null)::text
   from public.domicilios where id = current_setting('t.dom_a')::bigint),
  '(activo,t,t)', 'forzar_acceso: activo sobre moroso graba _por y _en');
select is(
  (select count(*) from public.sincronizaciones_acceso
   where domicilio_id = current_setting('t.dom_a')::bigint and operacion = 'asignar' and estado = 'pendiente'),
  1::bigint, 'forzar_acceso: encola asignar');
select is(tests.probar('admin.b@test.local',
  format($q$select public.forzar_acceso(%s, null)$q$, current_setting('t.dom_a'))),
  '42501', 'forzar_acceso: admin de otro fraccionamiento -> 42501');

-- estado_acceso_domicilio --------------------------------------------------------------------

select is(tests.probar('tesorero.a@test.local',
  format('select row(es_moroso, acceso_forzado, forzado_por_nombre is not null)::text from public.estado_acceso_domicilio(%s)', current_setting('t.dom_a'))),
  '(t,activo,t)', 'estado_acceso_domicilio: tesorero ve el estado');
select is(tests.probar('super@test.local',
  format('select public.estado_acceso_domicilio(%s)', current_setting('t.dom_a'))),
  '42501', 'estado_acceso_domicilio: super admin -> 42501');
select is(tests.probar('comite.a@test.local',
  format('select public.estado_acceso_domicilio(%s)', current_setting('t.dom_a'))),
  '42501', 'estado_acceso_domicilio: comite -> 42501');

-- Pago limpia el ajuste --------------------------------------------------------------------

insert into public.pagos (fraccionamiento_id, domicilio_id, cuota_id, fecha_pago, metodo_pago_id, user_id, importe)
  select fraccionamiento_id, domicilio_id, id, date '2026-03-15', 1, tests.uid('tesorero.a@test.local'), 500
  from public.cuotas where domicilio_id = current_setting('t.dom_a')::bigint and anio = 2026 and mes = 2;
update public.cuotas set estatus_id = 2 where domicilio_id = current_setting('t.dom_a')::bigint and anio = 2026 and mes = 2;
select public.recalcular_permisos_acceso(current_setting('t.fa')::bigint);
select is((select acceso_forzado from public.domicilios where id = current_setting('t.dom_a')::bigint), null,
  'recalcular_permisos_acceso: tras el pago limpia el activo');

select is(tests.probar('admin.a@test.local',
  format($q$insert into public.domicilios (fraccionamiento_id, direccion, fecha_alta, acceso_forzado) values (%s, 'X', date '2026-01-01', 'activo')$q$, current_setting('t.fa'))),
  '42501', 'domicilios: authenticated no inserta acceso_forzado -> 42501');

-- procesar_reglas_cobro ----------------------------------------------------------------------

-- Cuota 2026-01 queda pagada; cuota 2025-12 vencida antes de recargo_desde.
insert into public.pagos (fraccionamiento_id, domicilio_id, cuota_id, fecha_pago, metodo_pago_id, user_id, importe)
  select fraccionamiento_id, domicilio_id, id, date '2026-03-15', 1, tests.uid('tesorero.a@test.local'), 500
  from public.cuotas where domicilio_id = current_setting('t.dom_a')::bigint and anio = 2026 and mes = 1;
update public.cuotas set estatus_id = 2 where domicilio_id = current_setting('t.dom_a')::bigint and anio = 2026 and mes = 1;
insert into public.cuotas (fraccionamiento_id, domicilio_id, anio, mes, fecha_vencimiento, estatus_id, concepto_id, importe)
  values (tests.fid('fracc-a'), current_setting('t.dom_a')::bigint, 2025, 12, date '2026-02-20', 1, current_setting('t.con_a')::bigint, 500);
insert into public.conceptos_recargo (fraccionamiento_id, nombre, monto_recargo) values (tests.fid('fracc-a'), 'Recargo nuevo', 30);
select set_config('t.rec_n', (select id::text from public.conceptos_recargo where nombre = 'Recargo nuevo'), false);
select set_config('app.hoy', '2026-03-01', true);
update public.reglas_cobro
  set dia_generacion = 5, dia_vencimiento = 10, dias_gracia = 3, concepto_recargo_id = current_setting('t.rec_n')::bigint
  where fraccionamiento_id = tests.fid('fracc-a');
select set_config('app.hoy', '2026-03-20', true);

reset role;
select set_config('request.jwt.claims', '', true);
select public.procesar_reglas_cobro();
select public.procesar_reglas_cobro();

select is((select count(*) from public.cuotas where fraccionamiento_id = tests.fid('fracc-a') and anio = 2026 and mes = 3),
  1::bigint, 'procesar: dos corridas generan N cuotas (no 2N)');
select is((select count(*) from public.recargo_cuota where concepto_recargo_id = current_setting('t.rec_n')::bigint),
  1::bigint, 'procesar: dos corridas generan N recargos (no 2N)');
select is((select count(*) from public.recargo_cuota rc join public.cuotas c on c.id = rc.cuota_id
           where c.domicilio_id = current_setting('t.dom_a')::bigint and c.anio = 2025 and c.mes = 12),
  0::bigint, 'procesar: sin recargo antes de recargo_desde');
select is((select estatus_id from public.cuotas where domicilio_id = current_setting('t.dom_a')::bigint and anio = 2026 and mes = 3),
  3::bigint, 'procesar: vencida tras la gracia -> estatus 3');
select is((select estatus_id from public.cuotas where domicilio_id = current_setting('t.dom_a')::bigint and anio = 2026 and mes = 1),
  2::bigint, 'procesar: cuota pagada no cambia de estatus');
select is((select estatus_id from public.cuotas where fraccionamiento_id = tests.fid('fracc-b') and anio = 2026 and mes = 1),
  3::bigint, 'procesar: sin reglas (B) marca vencida como antes');

update public.reglas_cobro set dias_gracia = 15 where fraccionamiento_id = tests.fid('fracc-a');
select is((select estatus_id from public.cuotas where domicilio_id = current_setting('t.dom_a')::bigint and anio = 2026 and mes = 3),
  1::bigint, 'trigger: subir dias_gracia regresa 3 -> 1 de inmediato');
select set_config('request.jwt.claims', '', true);
select public.procesar_reglas_cobro();
select is((select estatus_id from public.cuotas where domicilio_id = current_setting('t.dom_a')::bigint and anio = 2026 and mes = 3),
  1::bigint, 'procesar: subir dias_gracia regresa 3 -> 1');
select is(tests.probar('admin.a@test.local',
  'select estatus_calculado from public.cuotas_info where anio = 2026 and mes = 3'),
  'En gracia', 'cuotas_info: En gracia');

-- cron -------------------------------------------------------------------------------------

select isnt_empty($$select 1 from cron.job where jobname = 'procesar-reglas-cobro' and schedule = '0 6 * * *'$$,
  'cron: procesar-reglas-cobro existe');
select is_empty($$select 1 from cron.job where jobname = 'marcar-cuotas-vencidas'$$,
  'cron: marcar-cuotas-vencidas ya no existe');

select * from finish();
rollback;
