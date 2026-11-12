begin;
-- 19 tablas: 133 lecturas + 456 escrituras por rol de A + 114 de super
-- + 16 casos puntuales
select plan(719);

select tests.crear_escenario();
select tests.crear_datos_negocio();

-- Matriz de permisos (context.md). L = lectores, E = escritores (insert),
-- M = modificadores (update y delete); salvo en la cola, M = E.
create temp table matriz (tabla text, lectores text[], escritores text[], modificadores text[]) on commit drop;
insert into matriz values
  ('domicilios',              '{administrador,tesorero,comite,vigilancia}', '{administrador}',          '{administrador}'),
  ('domicilio_concepto',      '{administrador,tesorero,comite,vigilancia}', '{administrador}',          '{administrador}'),
  ('residentes',              '{administrador,tesorero,comite,vigilancia}', '{administrador}',          '{administrador}'),
  ('telefonos_acceso',        '{administrador,tesorero,comite,vigilancia}', '{administrador}',          '{administrador}'),
  ('tarjetas_acceso',         '{administrador,tesorero,comite,vigilancia}', '{administrador}',          '{administrador}'),
  ('controles_acceso',        '{administrador,tesorero,comite,vigilancia}', '{administrador}',          '{administrador}'),
  ('pines_acceso',            '{administrador,tesorero}',                   '{administrador,tesorero}', '{administrador,tesorero}'),
  ('fraccionamiento_medios',  '{administrador,tesorero,comite,vigilancia}', '{}',                       '{}'),
  ('fraccionamiento_botones', '{administrador,tesorero,comite,vigilancia}', '{}',                       '{}'),
  ('sincronizaciones_acceso', '{administrador,tesorero,comite,vigilancia}', '{administrador,tesorero}', '{}'),
  ('conceptos_pago',          '{administrador,tesorero,comite,vigilancia}', '{administrador}',          '{administrador}'),
  ('concepto_pago_acceso',    '{administrador,tesorero,comite,vigilancia}', '{administrador}',          '{administrador}'),
  ('conceptos_descuento',     '{administrador,tesorero,comite}',            '{administrador}',          '{administrador}'),
  ('conceptos_recargo',       '{administrador,tesorero,comite}',            '{administrador}',          '{administrador}'),
  ('cuotas',                  '{administrador,tesorero,comite,vigilancia}', '{administrador,tesorero}', '{administrador,tesorero}'),
  ('descuento_cuota',         '{administrador,tesorero,comite}',            '{administrador,tesorero}', '{administrador,tesorero}'),
  ('recargo_cuota',           '{administrador,tesorero,comite}',            '{administrador,tesorero}', '{administrador,tesorero}'),
  ('pagos',                   '{administrador,tesorero,comite}',            '{administrador,tesorero}', '{administrador,tesorero}'),
  ('movimientos_financieros', '{administrador,tesorero,comite}',            '{administrador,tesorero}', '{administrador,tesorero}');

-- Permisos del super admin (spec consola v2 §1): sin finanzas ni catálogos de
-- descuento/recargo; conceptos de pago solo lectura; domicilio_concepto sin
-- update ni delete (no cambia el tipo de cuota); domicilios sin delete.
-- Medios de acceso (spec 2026-11-11 §2): completo en controles, PINes, medios
-- y botones; en la cola solo lee y encola.
create temp table super_permisos (tabla text, leer boolean, insertar boolean, actualizar boolean, borrar boolean) on commit drop;
insert into super_permisos values
  ('domicilios',              true,  true,  true,  false),
  ('domicilio_concepto',      true,  true,  false, false),
  ('residentes',              true,  true,  true,  true),
  ('telefonos_acceso',        true,  true,  true,  true),
  ('tarjetas_acceso',         true,  true,  true,  true),
  ('controles_acceso',        true,  true,  true,  true),
  ('pines_acceso',            true,  true,  true,  true),
  ('fraccionamiento_medios',  true,  true,  true,  true),
  ('fraccionamiento_botones', true,  true,  true,  true),
  ('sincronizaciones_acceso', true,  true,  false, false),
  ('conceptos_pago',          true,  false, false, false),
  ('concepto_pago_acceso',    true,  false, false, false),
  ('conceptos_descuento',     false, false, false, false),
  ('conceptos_recargo',       false, false, false, false),
  ('cuotas',                  false, false, false, false),
  ('descuento_cuota',         false, false, false, false),
  ('recargo_cuota',           false, false, false, false),
  ('pagos',                   false, false, false, false),
  ('movimientos_financieros', false, false, false, false);

create temp table usuarios (email text, rol text) on commit drop;
insert into usuarios values
  ('admin.a@test.local', 'administrador'),
  ('tesorero.a@test.local', 'tesorero'),
  ('comite.a@test.local', 'comite'),
  ('vigilancia.a@test.local', 'vigilancia');

-- Lecturas (con los datos de crear_datos_negocio: filas de A y B en cada tabla) --
-- Se cuentan fraccionamientos distintos: fraccionamiento_medios tiene dos
-- filas por fraccionamiento.

-- 76: cada rol de A ve solo las filas de A si tiene L, nada si no.
select is(
  tests.probar(u.email, format('select count(distinct fraccionamiento_id) from public.%I', m.tabla)),
  case when u.rol = any (m.lectores) then '1' else '0' end,
  format('%s: %s lee %s fila(s)', m.tabla, u.email,
         case when u.rol = any (m.lectores) then '1' else '0' end))
from matriz m cross join usuarios u
order by m.tabla, u.email;

-- 19: super ve las filas de A y B donde tiene lectura; 0 donde no.
select is(
  tests.probar('super@test.local',
    format('select count(distinct fraccionamiento_id) from public.%I where fraccionamiento_id in (%L, %L)', m.tabla,
           tests.fid('fracc-a'), tests.fid('fracc-b'))),
  case when s.leer then '2' else '0' end,
  format('%s: super lee %s filas', m.tabla, case when s.leer then '2' else '0' end))
from matriz m join super_permisos s on s.tabla = m.tabla order by m.tabla;

-- 38: perfil inactivo y fraccionamiento inactivo no ven nada.
select is(
  tests.probar(e.email, format('select count(*) from public.%I', m.tabla)),
  '0', format('%s: %s lee 0 filas', m.tabla, e.email))
from matriz m
cross join (values ('inactivo.a@test.local'), ('admin.c@test.local')) as e(email)
order by m.tabla, e.email;

-- Plantillas de escritura --------------------------------------------------
-- Por tabla y fraccionamiento: condición que ubica la fila original
-- (crear_datos_negocio), un insert válido (sin returning), la columna bigint
-- que devuelve ese insert (clave) y la condición para borrarlo con $1
-- (borrar). Las tablas con unique en el padre usan padres nuevos: domicilio 2
-- (domicilio_concepto, pines_acceso), concepto 2 (concepto_pago_acceso) y
-- cuota 2 (descuento_cuota, recargo_cuota). Las tablas sin id bigint usan su
-- llave natural.

create temp table plantillas (
  tabla text, letra text, donde text, insertar text,
  clave text default 'id', borrar text default 'id = $1'
) on commit drop;

do $$
declare
  l text;
  v_f bigint;
  v_dom bigint;
  v_con bigint;
  v_dto bigint;
  v_rec bigint;
  v_dom2 bigint;
  v_con2 bigint;
  v_cuota2 bigint;
  v_admin uuid;
  v_tes uuid;
  t text;
begin
  foreach l in array array['a', 'b'] loop
    v_f := tests.fid('fracc-' || l);
    v_admin := tests.uid('admin.' || l || '@test.local');
    v_tes := tests.uid('tesorero.' || l || '@test.local');

    -- Ids de las filas originales (antes de crear padres nuevos).
    foreach t in array array[
      'domicilios', 'domicilio_concepto', 'residentes', 'telefonos_acceso', 'tarjetas_acceso',
      'controles_acceso', 'conceptos_pago', 'concepto_pago_acceso', 'conceptos_descuento',
      'conceptos_recargo', 'cuotas', 'descuento_cuota', 'recargo_cuota', 'pagos',
      'movimientos_financieros'] loop
      execute format('insert into plantillas (tabla, letra, donde)
                      select %L, %L, %L || min(id) from public.%I where fraccionamiento_id = %s',
                     t, l, 'id = ', t, v_f);
    end loop;
    insert into plantillas (tabla, letra, donde, clave, borrar) values
      ('pines_acceso', l,
       format('domicilio_id = %s', (select domicilio_id from public.pines_acceso where fraccionamiento_id = v_f)),
       'domicilio_id', 'domicilio_id = $1'),
      ('fraccionamiento_medios', l,
       format($q$fraccionamiento_id = %s and medio = 'tarjeta'$q$, v_f),
       'fraccionamiento_id', $q$fraccionamiento_id = $1 and medio = 'control'$q$),
      ('fraccionamiento_botones', l,
       format('fraccionamiento_id = %s and boton = 0', v_f),
       'fraccionamiento_id', 'fraccionamiento_id = $1 and boton = 1'),
      ('sincronizaciones_acceso', l,
       format('id = %L', (select id from public.sincronizaciones_acceso where fraccionamiento_id = v_f)),
       'entidad_id', $q$entidad_id = $1 and operacion = 'actualizar'$q$);

    select id into v_dom from public.domicilios where fraccionamiento_id = v_f;
    select id into v_con from public.conceptos_pago where fraccionamiento_id = v_f;
    select id into v_dto from public.conceptos_descuento where fraccionamiento_id = v_f;
    select id into v_rec from public.conceptos_recargo where fraccionamiento_id = v_f;

    insert into public.domicilios (fraccionamiento_id, direccion, fecha_alta, created_by)
      values (v_f, 'Calle ' || l || ' 2', date '2026-01-01', v_admin) returning id into v_dom2;
    insert into public.conceptos_pago (fraccionamiento_id, nombre, importe, tipo_pago_id)
      values (v_f, 'Extra ' || l || ' 2', 200, 2) returning id into v_con2;
    insert into public.cuotas (fraccionamiento_id, domicilio_id, anio, mes, fecha_vencimiento, estatus_id, concepto_id, importe)
      values (v_f, v_dom, 2026, 2, date '2026-02-10', 1, v_con, 500) returning id into v_cuota2;

    update plantillas p set insertar = x.sql
    from (values
      ('domicilios', format($q$insert into public.domicilios (fraccionamiento_id, direccion, fecha_alta, created_by) values (%s, 'Calle nueva', date '2026-03-01', %L)$q$, v_f, v_admin)),
      ('domicilio_concepto', format($q$insert into public.domicilio_concepto (fraccionamiento_id, domicilio_id, concepto_id) values (%s, %s, %s)$q$, v_f, v_dom2, v_con)),
      ('residentes', format($q$insert into public.residentes (fraccionamiento_id, nombre, telefono, domicilio_id, es_principal) values (%s, 'Residente nuevo', '5551110000', %s, false)$q$, v_f, v_dom)),
      ('telefonos_acceso', format($q$insert into public.telefonos_acceso (fraccionamiento_id, domicilio_id, telefono) values (%s, %s, '5551110001')$q$, v_f, v_dom)),
      ('tarjetas_acceso', format($q$insert into public.tarjetas_acceso (fraccionamiento_id, domicilio_id, numero) values (%s, %s, '9999')$q$, v_f, v_dom)),
      ('controles_acceso', format($q$insert into public.controles_acceso (fraccionamiento_id, domicilio_id, botones) values (%s, %s, '[{"boton":1,"rf_code":7,"boton_id":null}]')$q$, v_f, v_dom)),
      ('pines_acceso', format($q$insert into public.pines_acceso (fraccionamiento_id, domicilio_id, pin) values (%s, %s, '5678')$q$, v_f, v_dom2)),
      ('fraccionamiento_medios', format($q$insert into public.fraccionamiento_medios (fraccionamiento_id, medio) values (%s, 'control')$q$, v_f)),
      ('fraccionamiento_botones', format($q$insert into public.fraccionamiento_botones (fraccionamiento_id, boton, panel_id, panel_codigo, salida) values (%s, 1, gen_random_uuid(), 'P1', 1)$q$, v_f)),
      ('sincronizaciones_acceso', format($q$insert into public.sincronizaciones_acceso (fraccionamiento_id, domicilio_id, entidad, entidad_id, operacion) values (%s, %s, 'domicilio', %s, 'actualizar')$q$, v_f, v_dom, v_dom)),
      ('conceptos_pago', format($q$insert into public.conceptos_pago (fraccionamiento_id, nombre, importe, tipo_pago_id) values (%s, 'Concepto nuevo', 100, 2)$q$, v_f)),
      ('concepto_pago_acceso', format($q$insert into public.concepto_pago_acceso (fraccionamiento_id, concepto_pago_id, medios) values (%s, %s, '{telefono}')$q$, v_f, v_con2)),
      ('conceptos_descuento', format($q$insert into public.conceptos_descuento (fraccionamiento_id, nombre, monto_descuento) values (%s, 'Descuento nuevo', 10)$q$, v_f)),
      ('conceptos_recargo', format($q$insert into public.conceptos_recargo (fraccionamiento_id, nombre, monto_recargo) values (%s, 'Recargo nuevo', 10)$q$, v_f)),
      ('cuotas', format($q$insert into public.cuotas (fraccionamiento_id, domicilio_id, anio, mes, fecha_vencimiento, estatus_id, concepto_id, importe) values (%s, %s, 2026, 3, date '2026-03-10', 1, %s, 500)$q$, v_f, v_dom, v_con)),
      ('descuento_cuota', format($q$insert into public.descuento_cuota (fraccionamiento_id, cuota_id, concepto_descuento_id) values (%s, %s, %s)$q$, v_f, v_cuota2, v_dto)),
      ('recargo_cuota', format($q$insert into public.recargo_cuota (fraccionamiento_id, cuota_id, concepto_recargo_id) values (%s, %s, %s)$q$, v_f, v_cuota2, v_rec)),
      ('pagos', format($q$insert into public.pagos (fraccionamiento_id, domicilio_id, fecha_pago, metodo_pago_id, user_id, importe) values (%s, %s, date '2026-03-05', 1, %L, 100)$q$, v_f, v_dom, v_tes)),
      ('movimientos_financieros', format($q$insert into public.movimientos_financieros (fraccionamiento_id, tipo_id, descripcion, importe, metodo_pago_id, user_id, fecha_movimiento) values (%s, 2, 'Movimiento nuevo', 50, 1, %L, date '2026-03-05')$q$, v_f, v_tes))
    ) as x(tabla, sql)
    where p.tabla = x.tabla and p.letra = l;
  end loop;
end;
$$;

-- Escrituras de cada rol de A (6 por tabla y rol = 456) ----------------------
-- insert en A: '1' con E, '42501' sin E. insert en B: siempre '42501'.
-- update/delete de la fila de A: 1 fila con M, 0 sin M. De la fila de B: 0.
-- delete borra una fila recién creada (sin hijos) para no chocar con FKs.

select is(tests.probar(u.email, pa.insertar),
  case when u.rol = any (m.escritores) then '1' else '42501' end,
  format('%s: %s inserta en A -> %s', m.tabla, u.email,
         case when u.rol = any (m.escritores) then 'ok' else '42501' end))
from matriz m cross join usuarios u
join plantillas pa on pa.tabla = m.tabla and pa.letra = 'a'
order by m.tabla, u.email;

select is(tests.probar(u.email, pb.insertar), '42501',
  format('%s: %s inserta con fraccionamiento_id de B -> 42501', m.tabla, u.email))
from matriz m cross join usuarios u
join plantillas pb on pb.tabla = m.tabla and pb.letra = 'b'
order by m.tabla, u.email;

select is(
  tests.probar(u.email, format('update public.%I set fraccionamiento_id = fraccionamiento_id where %s', m.tabla, pa.donde)),
  case when u.rol = any (m.modificadores) then '1' else '0' end,
  format('%s: %s update de la fila de A afecta %s fila(s)', m.tabla, u.email,
         case when u.rol = any (m.modificadores) then '1' else '0' end))
from matriz m cross join usuarios u
join plantillas pa on pa.tabla = m.tabla and pa.letra = 'a'
order by m.tabla, u.email;

select is(
  tests.probar(u.email, format('update public.%I set fraccionamiento_id = fraccionamiento_id where %s', m.tabla, pb.donde)),
  '0', format('%s: %s update de la fila de B afecta 0 filas', m.tabla, u.email))
from matriz m cross join usuarios u
join plantillas pb on pb.tabla = m.tabla and pb.letra = 'b'
order by m.tabla, u.email;

select is(
  tests.probar(u.email, format('delete from public.%I where %s', m.tabla, pa.borrar), pa.insertar || ' returning ' || pa.clave),
  case when u.rol = any (m.modificadores) then '1' else '0' end,
  format('%s: %s delete de una fila de A afecta %s fila(s)', m.tabla, u.email,
         case when u.rol = any (m.modificadores) then '1' else '0' end))
from matriz m cross join usuarios u
join plantillas pa on pa.tabla = m.tabla and pa.letra = 'a'
order by m.tabla, u.email;

select is(
  tests.probar(u.email, format('delete from public.%I where %s', m.tabla, pb.borrar), pb.insertar || ' returning ' || pb.clave),
  '0', format('%s: %s delete de una fila de B afecta 0 filas', m.tabla, u.email))
from matriz m cross join usuarios u
join plantillas pb on pb.tabla = m.tabla and pb.letra = 'b'
order by m.tabla, u.email;

-- Escrituras de super en A y B (6 por tabla = 114) ---------------------------
-- Según super_permisos: insert '1' o '42501'; update/delete 1 fila o 0.
-- domicilio_concepto: el update de super afecta 0 filas (no hay rama de super
-- en la política de update, así que la fila no es visible para actualizar).

select is(tests.probar('super@test.local', p.insertar),
  case when s.insertar then '1' else '42501' end,
  format('%s: super inserta en %s -> %s', m.tabla, upper(p.letra),
         case when s.insertar then 'ok' else '42501' end))
from matriz m join plantillas p on p.tabla = m.tabla
join super_permisos s on s.tabla = m.tabla
order by m.tabla, p.letra;

select is(
  tests.probar('super@test.local', format('update public.%I set fraccionamiento_id = fraccionamiento_id where %s', m.tabla, p.donde)),
  case when s.actualizar then '1' else '0' end,
  format('%s: super update de la fila de %s afecta %s fila(s)', m.tabla, upper(p.letra),
         case when s.actualizar then '1' else '0' end))
from matriz m join plantillas p on p.tabla = m.tabla
join super_permisos s on s.tabla = m.tabla
order by m.tabla, p.letra;

select is(
  tests.probar('super@test.local', format('delete from public.%I where %s', m.tabla, p.borrar), p.insertar || ' returning ' || p.clave),
  case when s.borrar then '1' else '0' end,
  format('%s: super delete de una fila de %s afecta %s fila(s)', m.tabla, upper(p.letra),
         case when s.borrar then '1' else '0' end))
from matriz m join plantillas p on p.tabla = m.tabla
join super_permisos s on s.tabla = m.tabla
order by m.tabla, p.letra;

-- Casos puntuales ----------------------------------------------------------

-- Review Focus 4: no se puede mover una fila a otro fraccionamiento.
select is(
  tests.probar('admin.a@test.local',
    format('update public.domicilios set fraccionamiento_id = %s where id = %s',
           tests.fid('fracc-b'),
           (select substr(donde, 6) from plantillas where tabla = 'domicilios' and letra = 'a'))),
  '42501', 'domicilios: admin.a mueve su fila a B -> 42501');

-- El default llena fraccionamiento_id con el del usuario.
select is(
  tests.probar('admin.a@test.local',
    format($q$insert into public.domicilios (direccion, fecha_alta, created_by)
      values ('Calle sin fracc', date '2026-03-01', %L) returning fraccionamiento_id$q$,
      tests.uid('admin.a@test.local'))),
  tests.fid('fracc-a')::text,
  'domicilios: admin.a inserta sin fraccionamiento_id -> queda en A');

-- Review Focus 1: super debe indicar el fraccionamiento.
select is(
  tests.probar('super@test.local',
    format($q$insert into public.domicilios (direccion, fecha_alta, created_by)
      values ('Calle super', date '2026-03-01', %L)$q$, tests.uid('super@test.local'))),
  '23502', 'domicilios: super inserta sin fraccionamiento_id -> 23502');

select is(
  tests.probar('super@test.local',
    format($q$insert into public.domicilios (fraccionamiento_id, direccion, fecha_alta, created_by)
      values (%s, 'Calle super', date '2026-03-01', %L)$q$,
      tests.fid('fracc-b'), tests.uid('super@test.local'))),
  '1', 'domicilios: super inserta con fraccionamiento_id de B -> ok');

-- Catálogos iniciales: super ya no los crea (42501); se crean como postgres y
-- admin.a los edita, tesorero.a no.
select is(
  tests.probar('super@test.local',
    format($q$insert into public.conceptos_pago (fraccionamiento_id, nombre, importe, tipo_pago_id)
      values (%s, 'Cuota inicial', 300, 1)$q$, tests.fid('fracc-a'))),
  '42501', 'conceptos_pago: super crea Cuota inicial en A -> 42501');
select is(
  tests.probar('super@test.local',
    format($q$insert into public.conceptos_descuento (fraccionamiento_id, nombre, monto_descuento)
      values (%s, 'Descuento inicial', 30)$q$, tests.fid('fracc-a'))),
  '42501', 'conceptos_descuento: super crea Descuento inicial en A -> 42501');
select is(
  tests.probar('super@test.local',
    format($q$insert into public.conceptos_recargo (fraccionamiento_id, nombre, monto_recargo)
      values (%s, 'Recargo inicial', 30)$q$, tests.fid('fracc-a'))),
  '42501', 'conceptos_recargo: super crea Recargo inicial en A -> 42501');

insert into public.conceptos_pago (fraccionamiento_id, nombre, importe, tipo_pago_id)
  values (tests.fid('fracc-a'), 'Cuota inicial', 300, 1);
insert into public.conceptos_descuento (fraccionamiento_id, nombre, monto_descuento)
  values (tests.fid('fracc-a'), 'Descuento inicial', 30);
insert into public.conceptos_recargo (fraccionamiento_id, nombre, monto_recargo)
  values (tests.fid('fracc-a'), 'Recargo inicial', 30);

select is(
  tests.probar(u.email,
    format('update public.%I set %I = 999, nombre = nombre || %L where nombre = %L',
           c.tabla, c.columna, ' editado', c.nombre)),
  case when u.email like 'admin.%' then '1' else '0' end,
  format('%s: %s edita %s y nombre de %s -> %s fila(s)', c.tabla, u.email, c.columna, c.nombre,
         case when u.email like 'admin.%' then '1' else '0' end))
from (values
  ('conceptos_pago', 'importe', 'Cuota inicial'),
  ('conceptos_descuento', 'monto_descuento', 'Descuento inicial'),
  ('conceptos_recargo', 'monto_recargo', 'Recargo inicial')
) as c(tabla, columna, nombre)
cross join (values ('admin.a@test.local'), ('tesorero.a@test.local')) as u(email)
order by c.tabla, u.email;

-- Sin oráculo de existencia entre fraccionamientos: referenciar una fila de B
-- falla por la FK compuesta (23503), no por un único de una sola columna (23505).
select is(
  tests.probar('admin.a@test.local',
    'insert into public.domicilio_concepto (domicilio_id, concepto_id) values ($1, (select min(id) from public.conceptos_pago))',
    format('select min(id) from public.domicilios where fraccionamiento_id = %s', tests.fid('fracc-b'))),
  '23503', 'domicilio_concepto: admin.a con domicilio de B falla por FK (23503), no 23505');
select is(
  tests.probar('admin.a@test.local',
    'insert into public.concepto_pago_acceso (concepto_pago_id) values ($1)',
    format('select id from public.conceptos_pago where fraccionamiento_id = %s and nombre = %L', tests.fid('fracc-b'), 'Mensual B')),
  '23503', 'concepto_pago_acceso: admin.a con concepto de B falla por FK (23503), no 23505');

-- Review Focus 2: con el fraccionamiento desactivado, admin.a no ve nada.
update public.fraccionamientos set activo = false where slug = 'fracc-a';
select is(tests.probar('admin.a@test.local', 'select count(*) from public.domicilios'),
  '0', 'domicilios: admin.a con fracc-a desactivado lee 0 filas');

select * from finish();
rollback;
