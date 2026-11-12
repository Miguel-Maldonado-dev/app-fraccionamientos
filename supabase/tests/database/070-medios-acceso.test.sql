begin;
-- 4 fraccionamiento_medios + 2 trigger de concepto + 2 trigger de medios
-- + 6 pines_acceso + 3 controles_acceso + 5 sincronizaciones_acceso
-- + 6 aislamiento de la cola
-- + 3 perfil_deseado + 5 recalcular_permisos_acceso + 9 lease de sincronización
-- + 1 domicilios_info.medios + 3 objetos eliminados + 2 cron
-- + 6 cancelar_sincronizaciones
select plan(57);

select tests.crear_escenario();
select tests.crear_datos_negocio();

-- Ids guardados antes de cambiar de rol.
select set_config('t.fa', tests.fid('fracc-a')::text, false);
select set_config('t.dom_a', (select id::text from public.domicilios where fraccionamiento_id = tests.fid('fracc-a')), false);
select set_config('t.con_a', (select id::text from public.conceptos_pago where fraccionamiento_id = tests.fid('fracc-a')), false);

-- Segundo domicilio de A sin PIN ni tipo de cuota.
insert into public.domicilios (fraccionamiento_id, direccion, fecha_alta, created_by)
  values (tests.fid('fracc-a'), 'Calle A 2', date '2026-01-01', tests.uid('admin.a@test.local'));
select set_config('t.dom_a2', (select id::text from public.domicilios where direccion = 'Calle A 2'), false);

-- fraccionamiento_medios ---------------------------------------------------

select is(
  tests.probar('super@test.local',
    format($q$insert into public.fraccionamiento_medios (fraccionamiento_id, medio) values (%s, 'control')$q$, current_setting('t.fa'))),
  '1', 'fraccionamiento_medios: super habilita control en A');
select is(
  tests.probar('admin.a@test.local',
    format($q$insert into public.fraccionamiento_medios (fraccionamiento_id, medio) values (%s, 'control')$q$, current_setting('t.fa'))),
  '42501', 'fraccionamiento_medios: admin.a no habilita medios -> 42501');
select is(
  tests.probar('comite.a@test.local', $q$select count(*) from public.fraccionamiento_medios where medio = 'tarjeta'$q$),
  '1', 'fraccionamiento_medios: comite.a lee la tarjeta de A');
select is(
  tests.probar('admin.b@test.local',
    format('select count(*) from public.fraccionamiento_medios where fraccionamiento_id = %s', current_setting('t.fa'))),
  '0', 'fraccionamiento_medios: admin.b no lee los medios de A');

-- Trigger de concepto_pago_acceso: solo medios habilitados -------------------

select is(
  tests.probar('admin.a@test.local',
    format($q$update public.concepto_pago_acceso set medios = '{control}' where concepto_pago_id = %s$q$, current_setting('t.con_a'))),
  '23514', 'concepto_pago_acceso: control sin habilitar en A -> 23514');
select is(
  tests.probar('admin.a@test.local',
    format($q$update public.concepto_pago_acceso set medios = '{control}' where concepto_pago_id = %s$q$, current_setting('t.con_a')),
    format($q$insert into public.fraccionamiento_medios (fraccionamiento_id, medio) values (%s, 'control') returning fraccionamiento_id$q$, current_setting('t.fa'))),
  '1', 'concepto_pago_acceso: control habilitado en A -> 1 fila');

-- Trigger de fraccionamiento_medios: no se quita un medio en uso -------------

select is(
  tests.probar('super@test.local',
    format($q$delete from public.fraccionamiento_medios where fraccionamiento_id = %s and medio = 'tarjeta'$q$, current_setting('t.fa'))),
  '23503', 'fraccionamiento_medios: quitar tarjeta en uso -> 23503');
select is(
  tests.probar('super@test.local',
    format($q$delete from public.fraccionamiento_medios where fraccionamiento_id = %s and medio = 'tarjeta'$q$, current_setting('t.fa')),
    format($q$update public.concepto_pago_acceso set medios = '{telefono}' where concepto_pago_id = %s returning id$q$, current_setting('t.con_a'))),
  '1', 'fraccionamiento_medios: tarjeta sin uso se quita');

-- pines_acceso: solo administrador, tesorero y super --------------------------

select is(
  tests.probar('admin.a@test.local',
    format($q$insert into public.pines_acceso (fraccionamiento_id, domicilio_id, pin) values (%s, %s, '1234')$q$,
           current_setting('t.fa'), current_setting('t.dom_a2'))),
  '1', 'pines_acceso: admin.a fija un PIN');
select is(
  tests.probar('tesorero.a@test.local', 'select count(*) from public.pines_acceso'),
  '1', 'pines_acceso: tesorero.a lee el PIN de A');
select is(
  tests.probar('comite.a@test.local', 'select count(*) from public.pines_acceso'),
  '0', 'pines_acceso: comite.a no lee PINes');
select is(
  tests.probar('vigilancia.a@test.local', 'select count(*) from public.pines_acceso'),
  '0', 'pines_acceso: vigilancia.a no lee PINes');
select is(
  tests.probar('admin.b@test.local',
    format('select count(*) from public.pines_acceso where fraccionamiento_id = %s', current_setting('t.fa'))),
  '0', 'pines_acceso: admin.b no lee el PIN de A');
select is(
  tests.probar('admin.a@test.local',
    format($q$insert into public.pines_acceso (fraccionamiento_id, domicilio_id, pin) values (%s, %s, '12')$q$,
           current_setting('t.fa'), current_setting('t.dom_a2'))),
  '23514', 'pines_acceso: PIN de 2 dígitos -> 23514');

-- controles_acceso: forma de botones ------------------------------------------

select is(
  tests.probar('admin.a@test.local',
    format($q$insert into public.controles_acceso (fraccionamiento_id, domicilio_id, botones)
      values (%s, %s, '[{"boton":0,"rf_code":5,"boton_id":null}]')$q$, current_setting('t.fa'), current_setting('t.dom_a'))),
  '1', 'controles_acceso: admin.a crea un control de 1 botón');
select is(
  tests.probar('admin.a@test.local',
    format($q$insert into public.controles_acceso (fraccionamiento_id, domicilio_id, botones)
      values (%s, %s, '[]')$q$, current_setting('t.fa'), current_setting('t.dom_a'))),
  '23514', 'controles_acceso: sin botones -> 23514');
select is(
  tests.probar('admin.a@test.local',
    format($q$insert into public.controles_acceso (fraccionamiento_id, domicilio_id, botones)
      values (%s, %s, '[{"boton":4,"rf_code":5,"boton_id":null}]')$q$, current_setting('t.fa'), current_setting('t.dom_a'))),
  '23514', 'controles_acceso: botón 4 -> 23514');

-- sincronizaciones_acceso ----------------------------------------------------

select is(
  tests.probar('admin.a@test.local',
    format($q$insert into public.sincronizaciones_acceso (fraccionamiento_id, domicilio_id, entidad, entidad_id, operacion)
      values (%s, %s, 'domicilio', %s, 'actualizar')$q$, current_setting('t.fa'), current_setting('t.dom_a'), current_setting('t.dom_a'))),
  '1', 'sincronizaciones_acceso: admin.a encola una tarea');
select is(
  tests.probar('admin.a@test.local', $q$update public.sincronizaciones_acceso set estado = 'ok'$q$),
  '0', 'sincronizaciones_acceso: admin.a no actualiza tareas');
select is(
  tests.probar('vigilancia.a@test.local', 'select count(*) from public.sincronizaciones_acceso'),
  '1', 'sincronizaciones_acceso: vigilancia.a lee la tarea de A');
select is(
  tests.probar('admin.b@test.local',
    format('select count(*) from public.sincronizaciones_acceso where fraccionamiento_id = %s', current_setting('t.fa'))),
  '0', 'sincronizaciones_acceso: admin.b no lee las tareas de A');
select is(
  tests.probar('admin.a@test.local',
    format($q$insert into public.sincronizaciones_acceso (fraccionamiento_id, domicilio_id, entidad, entidad_id, operacion, estado)
      values (%s, %s, 'domicilio', %s, 'actualizar', 'x')$q$, current_setting('t.fa'), current_setting('t.dom_a'), current_setting('t.dom_a'))),
  '23514', 'sincronizaciones_acceso: estado x -> 23514');

-- Aislamiento de la cola: la tarea solo apunta a filas de su fraccionamiento ------

select set_config('t.dom_b', (select id::text from public.domicilios where fraccionamiento_id = tests.fid('fracc-b')), false);
select set_config('t.tar_a', (select id::text from public.tarjetas_acceso where fraccionamiento_id = tests.fid('fracc-a')), false);
select set_config('t.tar_b', (select id::text from public.tarjetas_acceso where fraccionamiento_id = tests.fid('fracc-b')), false);
select set_config('t.ctl_b', (select id::text from public.controles_acceso where fraccionamiento_id = tests.fid('fracc-b')), false);

select is(
  tests.probar('admin.a@test.local',
    format($q$insert into public.sincronizaciones_acceso (fraccionamiento_id, domicilio_id, entidad, entidad_id, operacion)
      values (%s, %s, 'domicilio', %s, 'actualizar')$q$, current_setting('t.fa'), current_setting('t.dom_b'), current_setting('t.dom_b'))),
  '42501', 'sincronizaciones_acceso: admin.a con el domicilio de B -> 42501');
select is(
  tests.probar('admin.a@test.local',
    format($q$insert into public.sincronizaciones_acceso (fraccionamiento_id, domicilio_id, entidad, entidad_id, operacion)
      values (%s, null, 'tarjeta', %s, 'actualizar')$q$, current_setting('t.fa'), current_setting('t.tar_b'))),
  '42501', 'sincronizaciones_acceso: admin.a con la tarjeta de B -> 42501');
select is(
  tests.probar('tesorero.a@test.local',
    format($q$insert into public.sincronizaciones_acceso (fraccionamiento_id, domicilio_id, entidad, entidad_id, operacion)
      values (%s, %s, 'control', %s, 'borrar')$q$, current_setting('t.fa'), current_setting('t.dom_a'), current_setting('t.ctl_b'))),
  '42501', 'sincronizaciones_acceso: tesorero.a con el control de B -> 42501');
select is(
  tests.probar('super@test.local',
    format($q$insert into public.sincronizaciones_acceso (fraccionamiento_id, domicilio_id, entidad, entidad_id, operacion)
      values (%s, %s, 'domicilio', %s, 'actualizar')$q$, current_setting('t.fa'), current_setting('t.dom_b'), current_setting('t.dom_b'))),
  '42501', 'sincronizaciones_acceso: super con fraccionamiento A y domicilio de B -> 42501');
select is(
  tests.probar('admin.a@test.local',
    format($q$insert into public.sincronizaciones_acceso (fraccionamiento_id, domicilio_id, entidad, entidad_id, operacion)
      values (%s, %s, 'tarjeta', %s, 'crear')$q$, current_setting('t.fa'), current_setting('t.dom_a'), current_setting('t.tar_a'))),
  '1', 'sincronizaciones_acceso: admin.a con su domicilio y su tarjeta -> ok');
select is(
  tests.probar('admin.a@test.local',
    format($q$insert into public.sincronizaciones_acceso (fraccionamiento_id, domicilio_id, entidad, entidad_id, operacion)
      values (%s, %s, 'pin', %s, 'fijar')$q$, current_setting('t.fa'), current_setting('t.dom_a'), current_setting('t.dom_a'))),
  '42501', 'sincronizaciones_acceso: pin con entidad_id -> 42501');

-- perfil_deseado ---------------------------------------------------------------

update public.concepto_pago_acceso
  set perfil_corriente_id = 'aaaaaaaa-0000-0000-0000-000000000001',
      perfil_moroso_id = 'aaaaaaaa-0000-0000-0000-000000000002'
  where concepto_pago_id = current_setting('t.con_a')::bigint;

select is(public.perfil_deseado(current_setting('t.dom_a')::bigint),
  'aaaaaaaa-0000-0000-0000-000000000001'::uuid, 'perfil_deseado: sin cuotas vencidas -> al corriente');
select is(
  tests.probar('admin.a@test.local',
    format('select public.perfil_deseado(%s)', current_setting('t.dom_a')),
    format('update public.cuotas set estatus_id = 3 where domicilio_id = %s returning id', current_setting('t.dom_a'))),
  'aaaaaaaa-0000-0000-0000-000000000002', 'perfil_deseado: con cuota vencida -> moroso');
select is(
  tests.probar('admin.a@test.local',
    format('select coalesce(public.perfil_deseado(%s)::text, %L)', current_setting('t.dom_a'), 'nulo'),
    format('update public.concepto_pago_acceso set perfil_corriente_id = null, perfil_moroso_id = null where concepto_pago_id = %s returning id', current_setting('t.con_a'))),
  'nulo', 'perfil_deseado: tipo de cuota sin permisos -> nulo');

-- recalcular_permisos_acceso -------------------------------------------------

select is(
  tests.probar('admin.a@test.local',
    format('select public.recalcular_permisos_acceso(%s)', current_setting('t.fa'))),
  '0', 'recalcular_permisos_acceso: domicilio sin titular_id -> 0');

update public.domicilios
  set titular_id = 'bbbbbbbb-0000-0000-0000-000000000001',
      perfil_asignado_id = 'aaaaaaaa-0000-0000-0000-000000000002'
  where id = current_setting('t.dom_a')::bigint;

select is(
  tests.probar('admin.b@test.local',
    format('select public.recalcular_permisos_acceso(%s)', current_setting('t.fa'))),
  '42501', 'recalcular_permisos_acceso: admin.b con el fraccionamiento de A -> 42501');

select tests.autenticar_como('admin.a@test.local');
select is(public.recalcular_permisos_acceso(current_setting('t.fa')::bigint), 1,
  'recalcular_permisos_acceso: domicilio desfasado -> 1 tarea');
select is(public.recalcular_permisos_acceso(current_setting('t.fa')::bigint), 0,
  'recalcular_permisos_acceso: con la tarea pendiente -> 0');
reset role;
select set_config('request.jwt.claims', '', true);

select is(
  (select count(*) from public.sincronizaciones_acceso
   where domicilio_id = current_setting('t.dom_a')::bigint and entidad = 'domicilio'
     and operacion = 'asignar' and estado = 'pendiente'),
  1::bigint, 'recalcular_permisos_acceso: una sola tarea asignar pendiente');

-- Lease de sincronización: solo service_role ------------------------------------

select set_config('t.tok1', '11111111-1111-1111-1111-111111111111', false);
select set_config('t.tok2', '22222222-2222-2222-2222-222222222222', false);

set local role service_role;
select is(public.adquirir_sincronizacion(current_setting('t.fa')::bigint, current_setting('t.tok1')::uuid), true,
  'adquirir_sincronizacion: sin lease -> true');
select is(public.adquirir_sincronizacion(current_setting('t.fa')::bigint, current_setting('t.tok2')::uuid), false,
  'adquirir_sincronizacion: otro token con el lease vigente -> false');
update public.sincronizacion_leases set hasta = now() - interval '1 second'
  where fraccionamiento_id = current_setting('t.fa')::bigint;
select is(public.adquirir_sincronizacion(current_setting('t.fa')::bigint, current_setting('t.tok2')::uuid), true,
  'adquirir_sincronizacion: otro token con el lease vencido -> true');
select public.liberar_sincronizacion(current_setting('t.fa')::bigint, current_setting('t.tok1')::uuid);
select is(
  (select token from public.sincronizacion_leases where fraccionamiento_id = current_setting('t.fa')::bigint),
  current_setting('t.tok2')::uuid, 'liberar_sincronizacion: con otro token conserva el lease');
select public.liberar_sincronizacion(current_setting('t.fa')::bigint, current_setting('t.tok2')::uuid);
select is_empty(
  format('select 1 from public.sincronizacion_leases where fraccionamiento_id = %s', current_setting('t.fa')),
  'liberar_sincronizacion: con su token borra el lease');
reset role;

select is(
  tests.probar('admin.a@test.local',
    format('select public.adquirir_sincronizacion(%s, %L)::text', current_setting('t.fa'), current_setting('t.tok1'))),
  '42501', 'adquirir_sincronizacion: authenticated -> 42501');
select is(
  tests.probar('admin.a@test.local',
    format('select public.liberar_sincronizacion(%s, %L)::text', current_setting('t.fa'), current_setting('t.tok1'))),
  '42501', 'liberar_sincronizacion: authenticated -> 42501');
select is(tests.probar('admin.a@test.local', 'select count(*)::text from public.sincronizacion_leases'),
  '42501', 'sincronizacion_leases: administrador no la lee');
select is(tests.probar('super@test.local', 'select count(*)::text from public.sincronizacion_leases'),
  '42501', 'sincronizacion_leases: super admin no la lee');

-- domicilios_info.medios --------------------------------------------------------

select is(
  tests.probar('admin.a@test.local',
    format('select medios::text from public.domicilios_info where id = %s', current_setting('t.dom_a'))),
  '{tarjeta,telefono}', 'domicilios_info.medios del domicilio de A');

-- Reportes de acceso eliminados ------------------------------------------------

select hasnt_function('public', 'reporte_accesos_admin', 'reporte_accesos_admin ya no existe');
select hasnt_view('public', 'accesos_telefono_info', 'accesos_telefono_info ya no existe');
select hasnt_view('public', 'accesos_tarjeta_info', 'accesos_tarjeta_info ya no existe');

-- cancelar_sincronizaciones ------------------------------------------------------

select is(
  tests.probar('super@test.local',
    format('select public.cancelar_sincronizaciones(%s)', current_setting('t.fa'))),
  (select count(*)::text from public.sincronizaciones_acceso
    where fraccionamiento_id = tests.fid('fracc-a') and estado <> 'ok'),
  'cancelar_sincronizaciones: super admin cancela las no terminadas de A');
select cmp_ok(
  (select count(*) from public.sincronizaciones_acceso where fraccionamiento_id = tests.fid('fracc-a') and estado <> 'ok'),
  '>', 0::bigint, 'cancelar_sincronizaciones: (precondición) A tiene tareas sin terminar');
select is(
  tests.probar('admin.a@test.local',
    format('select public.cancelar_sincronizaciones(%s)', current_setting('t.fa'))),
  '42501', 'cancelar_sincronizaciones: admin.a -> 42501');

insert into public.sincronizaciones_acceso (fraccionamiento_id, domicilio_id, entidad, entidad_id, operacion, estado)
  values (tests.fid('fracc-a'), current_setting('t.dom_a')::bigint, 'domicilio', current_setting('t.dom_a')::bigint, 'actualizar', 'ok');
select public.cancelar_sincronizaciones(tests.fid('fracc-a'));
select is(
  (select string_agg(distinct estado, ',') from public.sincronizaciones_acceso where fraccionamiento_id = tests.fid('fracc-a')),
  'ok', 'cancelar_sincronizaciones: borra las filas no terminadas y conserva las ok');

-- Con un lease vigente (trabajador corriendo) no se cancela; con uno vencido sí.
insert into public.sincronizacion_leases (fraccionamiento_id, token, hasta)
  values (tests.fid('fracc-a'), gen_random_uuid(), now() + interval '5 minutes');
select is(
  tests.probar('super@test.local',
    format('select public.cancelar_sincronizaciones(%s)', current_setting('t.fa'))),
  'P0001', 'cancelar_sincronizaciones: con lease vigente -> P0001 (sincronización en curso)');
update public.sincronizacion_leases set hasta = now() - interval '1 second'
  where fraccionamiento_id = tests.fid('fracc-a');
select is(
  tests.probar('super@test.local',
    format('select public.cancelar_sincronizaciones(%s)', current_setting('t.fa'))),
  '0', 'cancelar_sincronizaciones: con lease vencido sí cancela');
delete from public.sincronizacion_leases where fraccionamiento_id = tests.fid('fracc-a');

-- Cron: procesar-reglas-cobro recalcula los permisos al final ------------------

select isnt_empty(
  $$select 1 from cron.job where jobname = 'procesar-reglas-cobro' and command like '%procesar_reglas_cobro%'$$,
  'el job procesar-reglas-cobro llama a procesar_reglas_cobro');
select ok(
  pg_get_functiondef('public.procesar_reglas_cobro()'::regprocedure) like '%recalcular_permisos_acceso()%',
  'procesar_reglas_cobro llama a recalcular_permisos_acceso()');

select * from finish();
rollback;
