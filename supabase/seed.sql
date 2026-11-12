-- Super admin local (solo desarrollo): superadmin@local.test / superadmin123
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated',
  'superadmin@local.test',
  extensions.crypt('superadmin123', extensions.gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  now(), now(),
  '', '', '', ''
);

insert into auth.identities (
  id, user_id, provider, provider_id, identity_data, last_sign_in_at, created_at, updated_at
) values (
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000001',
  'email',
  '00000000-0000-0000-0000-000000000001',
  '{"sub":"00000000-0000-0000-0000-000000000001","email":"superadmin@local.test"}',
  now(), now(), now()
);

insert into public.perfiles (id, fraccionamiento_id, rol, nombre, email, activo)
values ('00000000-0000-0000-0000-000000000001', null, 'super_admin', 'Super Admin', 'superadmin@local.test', true);
