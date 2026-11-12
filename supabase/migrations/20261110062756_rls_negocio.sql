-- Políticas RLS de las 14 tablas de negocio, según la matriz de permisos
-- (L = select; E = insert, update y delete). Super admin: L + E en todo.
-- Todo rol de fraccionamiento queda limitado a fraccionamiento_actual(), que es
-- null para super admin, perfil inactivo o fraccionamiento inactivo.
-- Los update llevan using y with check: no se puede mover una fila a otro
-- fraccionamiento.

-- domicilios ---------------------------------------------------------------

create policy domicilios_select on public.domicilios
  for select to authenticated
  using (
    (select private.es_super_admin())
    or (fraccionamiento_id = (select private.fraccionamiento_actual())
        and (select private.tiene_rol(array['administrador', 'tesorero', 'comite', 'vigilancia']::public.rol_usuario[])))
  );

create policy domicilios_insert on public.domicilios
  for insert to authenticated
  with check (
    (select private.es_super_admin())
    or (fraccionamiento_id = (select private.fraccionamiento_actual())
        and (select private.tiene_rol(array['administrador']::public.rol_usuario[])))
  );

create policy domicilios_update on public.domicilios
  for update to authenticated
  using (
    (select private.es_super_admin())
    or (fraccionamiento_id = (select private.fraccionamiento_actual())
        and (select private.tiene_rol(array['administrador']::public.rol_usuario[])))
  )
  with check (
    (select private.es_super_admin())
    or (fraccionamiento_id = (select private.fraccionamiento_actual())
        and (select private.tiene_rol(array['administrador']::public.rol_usuario[])))
  );

create policy domicilios_delete on public.domicilios
  for delete to authenticated
  using (
    (select private.es_super_admin())
    or (fraccionamiento_id = (select private.fraccionamiento_actual())
        and (select private.tiene_rol(array['administrador']::public.rol_usuario[])))
  );

-- domicilio_concepto -------------------------------------------------------

create policy domicilio_concepto_select on public.domicilio_concepto
  for select to authenticated
  using (
    (select private.es_super_admin())
    or (fraccionamiento_id = (select private.fraccionamiento_actual())
        and (select private.tiene_rol(array['administrador', 'tesorero', 'comite', 'vigilancia']::public.rol_usuario[])))
  );

create policy domicilio_concepto_insert on public.domicilio_concepto
  for insert to authenticated
  with check (
    (select private.es_super_admin())
    or (fraccionamiento_id = (select private.fraccionamiento_actual())
        and (select private.tiene_rol(array['administrador']::public.rol_usuario[])))
  );

create policy domicilio_concepto_update on public.domicilio_concepto
  for update to authenticated
  using (
    (select private.es_super_admin())
    or (fraccionamiento_id = (select private.fraccionamiento_actual())
        and (select private.tiene_rol(array['administrador']::public.rol_usuario[])))
  )
  with check (
    (select private.es_super_admin())
    or (fraccionamiento_id = (select private.fraccionamiento_actual())
        and (select private.tiene_rol(array['administrador']::public.rol_usuario[])))
  );

create policy domicilio_concepto_delete on public.domicilio_concepto
  for delete to authenticated
  using (
    (select private.es_super_admin())
    or (fraccionamiento_id = (select private.fraccionamiento_actual())
        and (select private.tiene_rol(array['administrador']::public.rol_usuario[])))
  );

-- residentes ---------------------------------------------------------------

create policy residentes_select on public.residentes
  for select to authenticated
  using (
    (select private.es_super_admin())
    or (fraccionamiento_id = (select private.fraccionamiento_actual())
        and (select private.tiene_rol(array['administrador', 'tesorero', 'comite', 'vigilancia']::public.rol_usuario[])))
  );

create policy residentes_insert on public.residentes
  for insert to authenticated
  with check (
    (select private.es_super_admin())
    or (fraccionamiento_id = (select private.fraccionamiento_actual())
        and (select private.tiene_rol(array['administrador']::public.rol_usuario[])))
  );

create policy residentes_update on public.residentes
  for update to authenticated
  using (
    (select private.es_super_admin())
    or (fraccionamiento_id = (select private.fraccionamiento_actual())
        and (select private.tiene_rol(array['administrador']::public.rol_usuario[])))
  )
  with check (
    (select private.es_super_admin())
    or (fraccionamiento_id = (select private.fraccionamiento_actual())
        and (select private.tiene_rol(array['administrador']::public.rol_usuario[])))
  );

create policy residentes_delete on public.residentes
  for delete to authenticated
  using (
    (select private.es_super_admin())
    or (fraccionamiento_id = (select private.fraccionamiento_actual())
        and (select private.tiene_rol(array['administrador']::public.rol_usuario[])))
  );

-- telefonos_acceso ---------------------------------------------------------

create policy telefonos_acceso_select on public.telefonos_acceso
  for select to authenticated
  using (
    (select private.es_super_admin())
    or (fraccionamiento_id = (select private.fraccionamiento_actual())
        and (select private.tiene_rol(array['administrador', 'tesorero', 'comite', 'vigilancia']::public.rol_usuario[])))
  );

create policy telefonos_acceso_insert on public.telefonos_acceso
  for insert to authenticated
  with check (
    (select private.es_super_admin())
    or (fraccionamiento_id = (select private.fraccionamiento_actual())
        and (select private.tiene_rol(array['administrador']::public.rol_usuario[])))
  );

create policy telefonos_acceso_update on public.telefonos_acceso
  for update to authenticated
  using (
    (select private.es_super_admin())
    or (fraccionamiento_id = (select private.fraccionamiento_actual())
        and (select private.tiene_rol(array['administrador']::public.rol_usuario[])))
  )
  with check (
    (select private.es_super_admin())
    or (fraccionamiento_id = (select private.fraccionamiento_actual())
        and (select private.tiene_rol(array['administrador']::public.rol_usuario[])))
  );

create policy telefonos_acceso_delete on public.telefonos_acceso
  for delete to authenticated
  using (
    (select private.es_super_admin())
    or (fraccionamiento_id = (select private.fraccionamiento_actual())
        and (select private.tiene_rol(array['administrador']::public.rol_usuario[])))
  );

-- tarjetas_acceso ----------------------------------------------------------

create policy tarjetas_acceso_select on public.tarjetas_acceso
  for select to authenticated
  using (
    (select private.es_super_admin())
    or (fraccionamiento_id = (select private.fraccionamiento_actual())
        and (select private.tiene_rol(array['administrador', 'tesorero', 'comite', 'vigilancia']::public.rol_usuario[])))
  );

create policy tarjetas_acceso_insert on public.tarjetas_acceso
  for insert to authenticated
  with check (
    (select private.es_super_admin())
    or (fraccionamiento_id = (select private.fraccionamiento_actual())
        and (select private.tiene_rol(array['administrador']::public.rol_usuario[])))
  );

create policy tarjetas_acceso_update on public.tarjetas_acceso
  for update to authenticated
  using (
    (select private.es_super_admin())
    or (fraccionamiento_id = (select private.fraccionamiento_actual())
        and (select private.tiene_rol(array['administrador']::public.rol_usuario[])))
  )
  with check (
    (select private.es_super_admin())
    or (fraccionamiento_id = (select private.fraccionamiento_actual())
        and (select private.tiene_rol(array['administrador']::public.rol_usuario[])))
  );

create policy tarjetas_acceso_delete on public.tarjetas_acceso
  for delete to authenticated
  using (
    (select private.es_super_admin())
    or (fraccionamiento_id = (select private.fraccionamiento_actual())
        and (select private.tiene_rol(array['administrador']::public.rol_usuario[])))
  );

-- conceptos_pago -----------------------------------------------------------

create policy conceptos_pago_select on public.conceptos_pago
  for select to authenticated
  using (
    (select private.es_super_admin())
    or (fraccionamiento_id = (select private.fraccionamiento_actual())
        and (select private.tiene_rol(array['administrador', 'tesorero', 'comite', 'vigilancia']::public.rol_usuario[])))
  );

create policy conceptos_pago_insert on public.conceptos_pago
  for insert to authenticated
  with check (
    (select private.es_super_admin())
    or (fraccionamiento_id = (select private.fraccionamiento_actual())
        and (select private.tiene_rol(array['administrador']::public.rol_usuario[])))
  );

create policy conceptos_pago_update on public.conceptos_pago
  for update to authenticated
  using (
    (select private.es_super_admin())
    or (fraccionamiento_id = (select private.fraccionamiento_actual())
        and (select private.tiene_rol(array['administrador']::public.rol_usuario[])))
  )
  with check (
    (select private.es_super_admin())
    or (fraccionamiento_id = (select private.fraccionamiento_actual())
        and (select private.tiene_rol(array['administrador']::public.rol_usuario[])))
  );

create policy conceptos_pago_delete on public.conceptos_pago
  for delete to authenticated
  using (
    (select private.es_super_admin())
    or (fraccionamiento_id = (select private.fraccionamiento_actual())
        and (select private.tiene_rol(array['administrador']::public.rol_usuario[])))
  );

-- concepto_pago_acceso -----------------------------------------------------

create policy concepto_pago_acceso_select on public.concepto_pago_acceso
  for select to authenticated
  using (
    (select private.es_super_admin())
    or (fraccionamiento_id = (select private.fraccionamiento_actual())
        and (select private.tiene_rol(array['administrador', 'tesorero', 'comite', 'vigilancia']::public.rol_usuario[])))
  );

create policy concepto_pago_acceso_insert on public.concepto_pago_acceso
  for insert to authenticated
  with check (
    (select private.es_super_admin())
    or (fraccionamiento_id = (select private.fraccionamiento_actual())
        and (select private.tiene_rol(array['administrador']::public.rol_usuario[])))
  );

create policy concepto_pago_acceso_update on public.concepto_pago_acceso
  for update to authenticated
  using (
    (select private.es_super_admin())
    or (fraccionamiento_id = (select private.fraccionamiento_actual())
        and (select private.tiene_rol(array['administrador']::public.rol_usuario[])))
  )
  with check (
    (select private.es_super_admin())
    or (fraccionamiento_id = (select private.fraccionamiento_actual())
        and (select private.tiene_rol(array['administrador']::public.rol_usuario[])))
  );

create policy concepto_pago_acceso_delete on public.concepto_pago_acceso
  for delete to authenticated
  using (
    (select private.es_super_admin())
    or (fraccionamiento_id = (select private.fraccionamiento_actual())
        and (select private.tiene_rol(array['administrador']::public.rol_usuario[])))
  );

-- conceptos_descuento ------------------------------------------------------

create policy conceptos_descuento_select on public.conceptos_descuento
  for select to authenticated
  using (
    (select private.es_super_admin())
    or (fraccionamiento_id = (select private.fraccionamiento_actual())
        and (select private.tiene_rol(array['administrador', 'tesorero', 'comite']::public.rol_usuario[])))
  );

create policy conceptos_descuento_insert on public.conceptos_descuento
  for insert to authenticated
  with check (
    (select private.es_super_admin())
    or (fraccionamiento_id = (select private.fraccionamiento_actual())
        and (select private.tiene_rol(array['administrador']::public.rol_usuario[])))
  );

create policy conceptos_descuento_update on public.conceptos_descuento
  for update to authenticated
  using (
    (select private.es_super_admin())
    or (fraccionamiento_id = (select private.fraccionamiento_actual())
        and (select private.tiene_rol(array['administrador']::public.rol_usuario[])))
  )
  with check (
    (select private.es_super_admin())
    or (fraccionamiento_id = (select private.fraccionamiento_actual())
        and (select private.tiene_rol(array['administrador']::public.rol_usuario[])))
  );

create policy conceptos_descuento_delete on public.conceptos_descuento
  for delete to authenticated
  using (
    (select private.es_super_admin())
    or (fraccionamiento_id = (select private.fraccionamiento_actual())
        and (select private.tiene_rol(array['administrador']::public.rol_usuario[])))
  );

-- conceptos_recargo --------------------------------------------------------

create policy conceptos_recargo_select on public.conceptos_recargo
  for select to authenticated
  using (
    (select private.es_super_admin())
    or (fraccionamiento_id = (select private.fraccionamiento_actual())
        and (select private.tiene_rol(array['administrador', 'tesorero', 'comite']::public.rol_usuario[])))
  );

create policy conceptos_recargo_insert on public.conceptos_recargo
  for insert to authenticated
  with check (
    (select private.es_super_admin())
    or (fraccionamiento_id = (select private.fraccionamiento_actual())
        and (select private.tiene_rol(array['administrador']::public.rol_usuario[])))
  );

create policy conceptos_recargo_update on public.conceptos_recargo
  for update to authenticated
  using (
    (select private.es_super_admin())
    or (fraccionamiento_id = (select private.fraccionamiento_actual())
        and (select private.tiene_rol(array['administrador']::public.rol_usuario[])))
  )
  with check (
    (select private.es_super_admin())
    or (fraccionamiento_id = (select private.fraccionamiento_actual())
        and (select private.tiene_rol(array['administrador']::public.rol_usuario[])))
  );

create policy conceptos_recargo_delete on public.conceptos_recargo
  for delete to authenticated
  using (
    (select private.es_super_admin())
    or (fraccionamiento_id = (select private.fraccionamiento_actual())
        and (select private.tiene_rol(array['administrador']::public.rol_usuario[])))
  );

-- cuotas -------------------------------------------------------------------

create policy cuotas_select on public.cuotas
  for select to authenticated
  using (
    (select private.es_super_admin())
    or (fraccionamiento_id = (select private.fraccionamiento_actual())
        and (select private.tiene_rol(array['administrador', 'tesorero', 'comite', 'vigilancia']::public.rol_usuario[])))
  );

create policy cuotas_insert on public.cuotas
  for insert to authenticated
  with check (
    (select private.es_super_admin())
    or (fraccionamiento_id = (select private.fraccionamiento_actual())
        and (select private.tiene_rol(array['administrador', 'tesorero']::public.rol_usuario[])))
  );

create policy cuotas_update on public.cuotas
  for update to authenticated
  using (
    (select private.es_super_admin())
    or (fraccionamiento_id = (select private.fraccionamiento_actual())
        and (select private.tiene_rol(array['administrador', 'tesorero']::public.rol_usuario[])))
  )
  with check (
    (select private.es_super_admin())
    or (fraccionamiento_id = (select private.fraccionamiento_actual())
        and (select private.tiene_rol(array['administrador', 'tesorero']::public.rol_usuario[])))
  );

create policy cuotas_delete on public.cuotas
  for delete to authenticated
  using (
    (select private.es_super_admin())
    or (fraccionamiento_id = (select private.fraccionamiento_actual())
        and (select private.tiene_rol(array['administrador', 'tesorero']::public.rol_usuario[])))
  );

-- descuento_cuota ----------------------------------------------------------

create policy descuento_cuota_select on public.descuento_cuota
  for select to authenticated
  using (
    (select private.es_super_admin())
    or (fraccionamiento_id = (select private.fraccionamiento_actual())
        and (select private.tiene_rol(array['administrador', 'tesorero', 'comite']::public.rol_usuario[])))
  );

create policy descuento_cuota_insert on public.descuento_cuota
  for insert to authenticated
  with check (
    (select private.es_super_admin())
    or (fraccionamiento_id = (select private.fraccionamiento_actual())
        and (select private.tiene_rol(array['administrador', 'tesorero']::public.rol_usuario[])))
  );

create policy descuento_cuota_update on public.descuento_cuota
  for update to authenticated
  using (
    (select private.es_super_admin())
    or (fraccionamiento_id = (select private.fraccionamiento_actual())
        and (select private.tiene_rol(array['administrador', 'tesorero']::public.rol_usuario[])))
  )
  with check (
    (select private.es_super_admin())
    or (fraccionamiento_id = (select private.fraccionamiento_actual())
        and (select private.tiene_rol(array['administrador', 'tesorero']::public.rol_usuario[])))
  );

create policy descuento_cuota_delete on public.descuento_cuota
  for delete to authenticated
  using (
    (select private.es_super_admin())
    or (fraccionamiento_id = (select private.fraccionamiento_actual())
        and (select private.tiene_rol(array['administrador', 'tesorero']::public.rol_usuario[])))
  );

-- recargo_cuota ------------------------------------------------------------

create policy recargo_cuota_select on public.recargo_cuota
  for select to authenticated
  using (
    (select private.es_super_admin())
    or (fraccionamiento_id = (select private.fraccionamiento_actual())
        and (select private.tiene_rol(array['administrador', 'tesorero', 'comite']::public.rol_usuario[])))
  );

create policy recargo_cuota_insert on public.recargo_cuota
  for insert to authenticated
  with check (
    (select private.es_super_admin())
    or (fraccionamiento_id = (select private.fraccionamiento_actual())
        and (select private.tiene_rol(array['administrador', 'tesorero']::public.rol_usuario[])))
  );

create policy recargo_cuota_update on public.recargo_cuota
  for update to authenticated
  using (
    (select private.es_super_admin())
    or (fraccionamiento_id = (select private.fraccionamiento_actual())
        and (select private.tiene_rol(array['administrador', 'tesorero']::public.rol_usuario[])))
  )
  with check (
    (select private.es_super_admin())
    or (fraccionamiento_id = (select private.fraccionamiento_actual())
        and (select private.tiene_rol(array['administrador', 'tesorero']::public.rol_usuario[])))
  );

create policy recargo_cuota_delete on public.recargo_cuota
  for delete to authenticated
  using (
    (select private.es_super_admin())
    or (fraccionamiento_id = (select private.fraccionamiento_actual())
        and (select private.tiene_rol(array['administrador', 'tesorero']::public.rol_usuario[])))
  );

-- pagos --------------------------------------------------------------------

create policy pagos_select on public.pagos
  for select to authenticated
  using (
    (select private.es_super_admin())
    or (fraccionamiento_id = (select private.fraccionamiento_actual())
        and (select private.tiene_rol(array['administrador', 'tesorero', 'comite']::public.rol_usuario[])))
  );

create policy pagos_insert on public.pagos
  for insert to authenticated
  with check (
    (select private.es_super_admin())
    or (fraccionamiento_id = (select private.fraccionamiento_actual())
        and (select private.tiene_rol(array['administrador', 'tesorero']::public.rol_usuario[])))
  );

create policy pagos_update on public.pagos
  for update to authenticated
  using (
    (select private.es_super_admin())
    or (fraccionamiento_id = (select private.fraccionamiento_actual())
        and (select private.tiene_rol(array['administrador', 'tesorero']::public.rol_usuario[])))
  )
  with check (
    (select private.es_super_admin())
    or (fraccionamiento_id = (select private.fraccionamiento_actual())
        and (select private.tiene_rol(array['administrador', 'tesorero']::public.rol_usuario[])))
  );

create policy pagos_delete on public.pagos
  for delete to authenticated
  using (
    (select private.es_super_admin())
    or (fraccionamiento_id = (select private.fraccionamiento_actual())
        and (select private.tiene_rol(array['administrador', 'tesorero']::public.rol_usuario[])))
  );

-- movimientos_financieros --------------------------------------------------

create policy movimientos_financieros_select on public.movimientos_financieros
  for select to authenticated
  using (
    (select private.es_super_admin())
    or (fraccionamiento_id = (select private.fraccionamiento_actual())
        and (select private.tiene_rol(array['administrador', 'tesorero', 'comite']::public.rol_usuario[])))
  );

create policy movimientos_financieros_insert on public.movimientos_financieros
  for insert to authenticated
  with check (
    (select private.es_super_admin())
    or (fraccionamiento_id = (select private.fraccionamiento_actual())
        and (select private.tiene_rol(array['administrador', 'tesorero']::public.rol_usuario[])))
  );

create policy movimientos_financieros_update on public.movimientos_financieros
  for update to authenticated
  using (
    (select private.es_super_admin())
    or (fraccionamiento_id = (select private.fraccionamiento_actual())
        and (select private.tiene_rol(array['administrador', 'tesorero']::public.rol_usuario[])))
  )
  with check (
    (select private.es_super_admin())
    or (fraccionamiento_id = (select private.fraccionamiento_actual())
        and (select private.tiene_rol(array['administrador', 'tesorero']::public.rol_usuario[])))
  );

create policy movimientos_financieros_delete on public.movimientos_financieros
  for delete to authenticated
  using (
    (select private.es_super_admin())
    or (fraccionamiento_id = (select private.fraccionamiento_actual())
        and (select private.tiene_rol(array['administrador', 'tesorero']::public.rol_usuario[])))
  );
