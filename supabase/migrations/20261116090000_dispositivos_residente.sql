-- App móvil de residentes (plan 2026-11-14-app-movil-residentes, Task 1):
-- cada cuenta de residente queda ligada a un solo dispositivo.

create table public.dispositivos_residente (
  user_id uuid primary key references public.cuentas_residente (user_id) on delete cascade,
  device_id text not null,
  nombre text,
  ligado_en timestamptz not null default now(),
  constraint dispositivos_residente_device_id_check check (char_length(device_id) between 8 and 100),
  constraint dispositivos_residente_nombre_check check (nombre is null or char_length(nombre) <= 80)
);
alter table public.dispositivos_residente enable row level security;

-- Lectura: el propio residente; administrador/tesorero si la cuenta tiene un residente en su
-- fraccionamiento; super admin. Escritura solo con service-role (API y acción de desligar).
create policy dispositivos_residente_select on public.dispositivos_residente
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or (select private.es_super_admin())
    or (
      (select private.tiene_rol(array['administrador', 'tesorero']::public.rol_usuario[]))
      and exists (
        select 1 from public.residentes r
        where r.user_id = dispositivos_residente.user_id
          and r.fraccionamiento_id = (select private.fraccionamiento_actual())
      )
    )
  );

revoke all on public.dispositivos_residente from anon, authenticated;
grant select on public.dispositivos_residente to authenticated;
grant all on public.dispositivos_residente to service_role;
