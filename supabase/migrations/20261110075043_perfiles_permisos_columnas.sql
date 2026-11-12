-- Permisos de columna en perfiles.
-- El alta de usuarios pasa a hacerse en el servidor con service role, así que
-- authenticated ya no inserta perfiles. La política perfiles_insert queda sin
-- efecto para authenticated; se conserva para el super admin (fase 3, que
-- también usa service role). En update, authenticated solo puede cambiar
-- nombre, rol y activo: id y email (ligados a auth.users) y fraccionamiento_id
-- quedan fuera de su alcance.

revoke insert on public.perfiles from authenticated;
revoke update on public.perfiles from authenticated;
grant update (nombre, rol, activo) on public.perfiles to authenticated;
