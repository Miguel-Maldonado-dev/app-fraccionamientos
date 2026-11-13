-- Fraccionamiento de demostración local (solo desarrollo). Idempotente.
-- Uso: psql postgresql://postgres:postgres@127.0.0.1:55322/postgres -v ON_ERROR_STOP=1 -f supabase/scripts/demo-local.sql
-- `supabase db reset` borra la demo: hay que volver a correr este script.
-- Cuentas: admin.demo@local.test / admin12345, tesorero.demo@local.test / tesorero12345
-- Residente (app móvil, SOLO LOCAL): teléfono 3300000001 (3300000001@auth.internal) / residente123,
-- vinculado a dos domicilios demo.

begin;

-- Guarda: solo corre contra la base local de desarrollo (el super admin de seed.sql solo existe ahí).
do $$
begin
  if not exists (
    select 1 from auth.users
    where id = '00000000-0000-0000-0000-000000000001' and email = 'superadmin@local.test'
  ) then
    raise exception 'demo-local.sql solo puede ejecutarse en la base local de desarrollo (falta el super admin de seed.sql). Abortando.';
  end if;
end $$;

insert into public.fraccionamientos (nombre, slug)
values ('Fracc Demo', 'fracc-demo')
on conflict (slug) do nothing;

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'admin.demo@local.test',
   extensions.crypt('admin12345', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'tesorero.demo@local.test',
   extensions.crypt('tesorero12345', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '')
on conflict (id) do nothing;

insert into auth.identities (
  id, user_id, provider, provider_id, identity_data, last_sign_in_at, created_at, updated_at
)
select gen_random_uuid(), u.id, 'email', u.id::text,
  jsonb_build_object('sub', u.id::text, 'email', u.email),
  now(), now(), now()
from auth.users u
where u.id in ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000d2')
  and not exists (
    select 1 from auth.identities i where i.user_id = u.id and i.provider = 'email'
  );

insert into public.perfiles (id, fraccionamiento_id, rol, nombre, email, activo)
select '00000000-0000-0000-0000-0000000000d1'::uuid, f.id, 'administrador'::public.rol_usuario, 'Admin Demo', 'admin.demo@local.test', true
from public.fraccionamientos f where f.slug = 'fracc-demo'
union all
select '00000000-0000-0000-0000-0000000000d2'::uuid, f.id, 'tesorero'::public.rol_usuario, 'Tesorero Demo', 'tesorero.demo@local.test', true
from public.fraccionamientos f where f.slug = 'fracc-demo'
on conflict (id) do nothing;

insert into public.conceptos_pago (fraccionamiento_id, nombre, importe, tipo_pago_id)
select f.id, 'Mensual', 500, 1
from public.fraccionamientos f
where f.slug = 'fracc-demo'
on conflict (fraccionamiento_id, tipo_pago_id, lower(nombre)) do nothing;

insert into public.fraccionamiento_medios (fraccionamiento_id, medio)
select f.id, m.medio
from public.fraccionamientos f
cross join (values ('tarjeta'::public.medio_acceso), ('telefono'::public.medio_acceso)) as m(medio)
where f.slug = 'fracc-demo'
on conflict do nothing;

insert into public.concepto_pago_acceso (fraccionamiento_id, concepto_pago_id, medios)
select c.fraccionamiento_id, c.id, '{tarjeta,telefono}'
from public.conceptos_pago c
join public.fraccionamientos f on f.id = c.fraccionamiento_id
where f.slug = 'fracc-demo' and c.tipo_pago_id = 1 and lower(c.nombre) = 'mensual'
on conflict (concepto_pago_id, fraccionamiento_id) do nothing;

insert into public.conceptos_recargo (fraccionamiento_id, nombre, monto_recargo)
select f.id, 'Recargo por mora', 50
from public.fraccionamientos f
where f.slug = 'fracc-demo'
  and not exists (
    select 1 from public.conceptos_recargo r
    where r.fraccionamiento_id = f.id and lower(r.nombre) = 'recargo por mora'
  );

-- Reglas de cobro: genera el 25, sin día de vencimiento fijo, 5 días de gracia, moroso con 1 cuota vencida.
insert into public.reglas_cobro (fraccionamiento_id, dia_generacion, dia_vencimiento, dias_gracia, cuotas_para_moroso, concepto_recargo_id)
select f.id, 25, null, 5, 1,
  (select r.id from public.conceptos_recargo r where r.fraccionamiento_id = f.id and lower(r.nombre) = 'recargo por mora')
from public.fraccionamientos f
where f.slug = 'fracc-demo'
on conflict (fraccionamiento_id) do nothing;

-- Residente demo con acceso a la app (solo local): misma cuenta vinculada a dos domicilios.
update public.fraccionamientos set max_residentes_app = 5 where slug = 'fracc-demo';

insert into public.domicilios (fraccionamiento_id, direccion, fecha_alta, created_by)
select f.id, d.direccion, current_date, '00000000-0000-0000-0000-0000000000d1'
from public.fraccionamientos f
cross join (values ('Calle Demo 1'), ('Calle Demo 2')) as d(direccion)
where f.slug = 'fracc-demo'
on conflict (fraccionamiento_id, direccion) do nothing;

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', '3300000001@auth.internal',
   extensions.crypt('residente123', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '')
on conflict (id) do nothing;

insert into auth.identities (
  id, user_id, provider, provider_id, identity_data, last_sign_in_at, created_at, updated_at
)
select gen_random_uuid(), u.id, 'email', u.id::text,
  jsonb_build_object('sub', u.id::text, 'email', u.email),
  now(), now(), now()
from auth.users u
where u.id = '00000000-0000-0000-0000-0000000000e1'
  and not exists (
    select 1 from auth.identities i where i.user_id = u.id and i.provider = 'email'
  );

insert into public.cuentas_residente (user_id, telefono)
values ('00000000-0000-0000-0000-0000000000e1', '3300000001')
on conflict (user_id) do nothing;

insert into public.residentes (fraccionamiento_id, domicilio_id, nombre, telefono, es_principal, user_id)
select d.fraccionamiento_id, d.id, 'Residente Demo', '3300000001', true, '00000000-0000-0000-0000-0000000000e1'
from public.domicilios d
join public.fraccionamientos f on f.id = d.fraccionamiento_id
where f.slug = 'fracc-demo' and d.direccion in ('Calle Demo 1', 'Calle Demo 2')
  and not exists (
    select 1 from public.residentes r
    where r.domicilio_id = d.id and r.user_id = '00000000-0000-0000-0000-0000000000e1'
  );

-- Botones de la app móvil (el último queda sin salida: aparece deshabilitado).
insert into public.app_botones (fraccionamiento_id, orden, nombre, icono, ancho_completo, estilo, salida_id, salida_nombre)
select f.id, v.orden, v.nombre, v.icono, v.ancho_completo, v.estilo, v.salida_id, v.salida_nombre
from public.fraccionamientos f,
  (values
    (1::smallint, 'Puerta principal', 'puerta', true,  'azul_claro', '11111111-1111-4111-8111-111111111111'::uuid, 'Puerta principal'),
    (2::smallint, 'Pluma vehicular',  'pluma',  false, 'azul_claro', '22222222-2222-4222-8222-222222222222'::uuid, 'Pluma vehicular'),
    (3::smallint, 'Peatonal',         'peatonal', false, 'azul',     '33333333-3333-4333-8333-333333333333'::uuid, 'Peatonal'),
    (4::smallint, 'Alberca',          'alberca', false, 'azul_claro', null::uuid, null::text)
  ) as v(orden, nombre, icono, ancho_completo, estilo, salida_id, salida_nombre)
where f.slug = 'fracc-demo'
  and not exists (
    select 1 from public.app_botones b
    where b.fraccionamiento_id = f.id and b.orden = v.orden
  );

commit;
