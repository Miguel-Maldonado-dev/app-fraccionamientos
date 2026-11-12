-- Utilidades de prueba compartidas. Corre primero (orden alfabético) y SIN
-- transacción para que el esquema `tests` persista para los demás archivos.
-- Idempotente: se puede correr varias veces sin error. Solo local; no va en
-- migraciones.

create schema if not exists tests;

-- Id de un fraccionamiento por slug. security definer para poder llamarla
-- después de `tests.autenticar_como(...)` (como authenticated, RLS ocultaría
-- fraccionamientos ajenos).
create or replace function tests.fid(slug text)
returns bigint
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return (select f.id from public.fraccionamientos f where f.slug = fid.slug);
end;
$$;

-- Id de un usuario por email. security definer porque authenticated no lee
-- auth.users.
create or replace function tests.uid(email text)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return (select u.id from auth.users u where u.email = uid.email);
end;
$$;

-- Cambia la sesión al rol authenticated con el JWT del usuario indicado.
-- Vale hasta el fin de la transacción; para volver a postgres: `reset role;`.
create or replace function tests.autenticar_como(email text)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_uid uuid := tests.uid(email);
begin
  if v_uid is null then
    raise exception 'tests.autenticar_como: no existe el usuario %', email;
  end if;
  perform set_config('role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_uid, 'role', 'authenticated')::text,
    true
  );
end;
$$;

-- Escenario base: fracc-a y fracc-b activos, fracc-c inactivo; usuarios
-- <rol>.<a|b>@test.local para los 4 roles en A y B, admin.c en C,
-- inactivo.a (administrador de A con activo = false) y super (super_admin).
-- Se llama dentro de la transacción de cada archivo de prueba como postgres.
create or replace function tests.crear_escenario()
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_fa bigint;
  v_fb bigint;
  v_fc bigint;
  v_id uuid;
  r record;
begin
  insert into public.fraccionamientos (nombre, slug, activo)
    values ('Fraccionamiento A', 'fracc-a', true) returning id into v_fa;
  insert into public.fraccionamientos (nombre, slug, activo)
    values ('Fraccionamiento B', 'fracc-b', true) returning id into v_fb;
  insert into public.fraccionamientos (nombre, slug, activo)
    values ('Fraccionamiento C', 'fracc-c', false) returning id into v_fc;

  for r in
    select x.email, x.rol, x.fid, x.activo
    from (
      select
        (case rol.nombre when 'administrador' then 'admin' else rol.nombre end)
          || '.' || f.letra || '@test.local' as email,
        rol.nombre as rol,
        f.fid,
        true as activo
      from (values ('administrador'), ('tesorero'), ('comite'), ('vigilancia')) as rol(nombre)
      cross join (values ('a', v_fa), ('b', v_fb)) as f(letra, fid)
      union all select 'admin.c@test.local', 'administrador', v_fc, true
      union all select 'inactivo.a@test.local', 'administrador', v_fa, false
      union all select 'super@test.local', 'super_admin', null::bigint, true
    ) as x
  loop
    v_id := gen_random_uuid();
    insert into auth.users (id, email, aud, role)
      values (v_id, r.email, 'authenticated', 'authenticated');
    insert into public.perfiles (id, fraccionamiento_id, rol, nombre, email, activo)
      values (v_id, r.fid, r.rol::public.rol_usuario, split_part(r.email, '@', 1), r.email, r.activo);
  end loop;
end;
$$;

-- Datos de negocio: para A y B, como postgres, una fila en cada una de las 19
-- tablas de negocio con fraccionamiento_id explícito (fraccionamiento_medios
-- tiene dos: tarjeta y telefono, los medios del tipo de cuota). Requiere crear_escenario().
create or replace function tests.crear_datos_negocio()
returns void
language plpgsql
set search_path = ''
as $$
declare
  r record;
  v_dom bigint;
  v_con bigint;
  v_cuota bigint;
  v_dto bigint;
  v_rec bigint;
  v_tes uuid;
begin
  for r in select * from (values ('fracc-a', 'A'), ('fracc-b', 'B')) as t(slug, letra) loop
    insert into public.domicilios (fraccionamiento_id, direccion, fecha_alta, created_by)
      values (tests.fid(r.slug), 'Calle ' || r.letra || ' 1', date '2026-01-01',
              tests.uid('admin.' || lower(r.letra) || '@test.local'))
      returning id into v_dom;
    insert into public.conceptos_pago (fraccionamiento_id, nombre, importe, tipo_pago_id)
      values (tests.fid(r.slug), 'Mensual ' || r.letra, 500, 1) returning id into v_con;
    insert into public.fraccionamiento_medios (fraccionamiento_id, medio)
      values (tests.fid(r.slug), 'tarjeta'), (tests.fid(r.slug), 'telefono');
    insert into public.concepto_pago_acceso (fraccionamiento_id, concepto_pago_id, medios)
      values (tests.fid(r.slug), v_con, '{tarjeta,telefono}');
    insert into public.domicilio_concepto (fraccionamiento_id, domicilio_id, concepto_id)
      values (tests.fid(r.slug), v_dom, v_con);
    insert into public.residentes (fraccionamiento_id, nombre, telefono, domicilio_id, es_principal)
      values (tests.fid(r.slug), 'Residente ' || r.letra, '5550000000', v_dom, true);
    insert into public.telefonos_acceso (fraccionamiento_id, domicilio_id, telefono)
      values (tests.fid(r.slug), v_dom, '5550000001');
    insert into public.tarjetas_acceso (fraccionamiento_id, domicilio_id, numero)
      values (tests.fid(r.slug), v_dom, case r.letra when 'A' then '1001' else '2001' end);
    insert into public.fraccionamiento_botones (fraccionamiento_id, boton, panel_id, panel_codigo, salida, salida_alias)
      values (tests.fid(r.slug), 0, gen_random_uuid(), 'P1', 0, 'Pluma ' || r.letra);
    insert into public.controles_acceso (fraccionamiento_id, domicilio_id, botones)
      values (tests.fid(r.slug), v_dom, '[{"boton":0,"rf_code":1,"boton_id":null}]');
    insert into public.pines_acceso (fraccionamiento_id, domicilio_id, pin)
      values (tests.fid(r.slug), v_dom, '1234');
    insert into public.sincronizaciones_acceso (fraccionamiento_id, domicilio_id, entidad, entidad_id, operacion)
      values (tests.fid(r.slug), v_dom, 'domicilio', v_dom, 'crear');
    insert into public.conceptos_descuento (fraccionamiento_id, nombre, monto_descuento)
      values (tests.fid(r.slug), 'Descuento ' || r.letra, 50) returning id into v_dto;
    insert into public.conceptos_recargo (fraccionamiento_id, nombre, monto_recargo)
      values (tests.fid(r.slug), 'Recargo ' || r.letra, 25) returning id into v_rec;
    insert into public.cuotas (fraccionamiento_id, domicilio_id, anio, mes, fecha_vencimiento, estatus_id, concepto_id, importe)
      values (tests.fid(r.slug), v_dom, 2026, 1, date '2026-01-10', 1, v_con, 500)
      returning id into v_cuota;
    insert into public.descuento_cuota (fraccionamiento_id, cuota_id, concepto_descuento_id)
      values (tests.fid(r.slug), v_cuota, v_dto);
    insert into public.recargo_cuota (fraccionamiento_id, cuota_id, concepto_recargo_id)
      values (tests.fid(r.slug), v_cuota, v_rec);
    v_tes := tests.uid('tesorero.' || lower(r.letra) || '@test.local');
    -- Pago extra de importe 0, no ligado a la cuota 2026-01.
    insert into public.pagos (fraccionamiento_id, domicilio_id, cuota_id, fecha_pago, metodo_pago_id, user_id, importe)
      values (tests.fid(r.slug), v_dom, null, date '2026-01-05', 1, v_tes, 0);
    insert into public.movimientos_financieros (fraccionamiento_id, tipo_id, descripcion, importe, metodo_pago_id, user_id, fecha_movimiento)
      values (tests.fid(r.slug), 1, 'Movimiento ' || r.letra, 1000, 1, v_tes, date '2026-01-05');
  end loop;
end;
$$;

-- Ejecuta `consulta` como el usuario `email` dentro de una subtransacción que
-- siempre se revierte (datos y cambio de rol), y devuelve:
--   * el valor de la primera columna si la consulta es un select o tiene returning;
--   * si no, el número de filas afectadas como texto ('0', '1', ...);
--   * si falla, el SQLSTATE ('42501', '23502', ...).
-- `preparar` (opcional) corre antes como postgres, debe devolver un id con
-- returning, y ese id llega a `consulta` como $1. Se llama como postgres.
create or replace function tests.probar(email text, consulta text, preparar text default null)
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_param bigint;
  v_res text;
  v_n bigint;
begin
  begin
    if preparar is not null then
      execute preparar into strict v_param;
    end if;
    perform tests.autenticar_como(email);
    if consulta ~* '^\s*select\M' or consulta ~* '\mreturning\M' then
      execute consulta into v_res using v_param;
    else
      execute consulta using v_param;
      get diagnostics v_n = row_count;
      v_res := v_n::text;
    end if;
    raise exception using errcode = 'TS000', message = 'tests.probar: revertir';
  exception
    when sqlstate 'TS000' then null;
    when others then v_res := sqlstate;
  end;
  return v_res;
end;
$$;

grant usage on schema tests to authenticated;
grant execute on function tests.fid(text), tests.uid(text), tests.autenticar_como(text), tests.crear_escenario(), tests.crear_datos_negocio() to authenticated;

select plan(1);
select pass('utilidades listas');
select * from finish();
