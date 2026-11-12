-- Permisos del super admin (spec consola super admin v2, §1).
-- El super admin gestiona domicilios, residentes y medios de acceso de cualquier
-- fraccionamiento, pero no ve ni toca finanzas ni catálogos, y no cambia el
-- tipo de cuota de un domicilio:
--   domicilios                                          L, insert, update
--   domicilio_concepto                                  L, insert
--   residentes, telefonos_acceso, tarjetas_acceso       L, insert, update, delete
--   conceptos_pago, concepto_pago_acceso                L
--   conceptos_descuento, conceptos_recargo, cuotas,
--   descuento_cuota, recargo_cuota, pagos,
--   movimientos_financieros                             sin acceso
-- Las políticas que cambian se borran y se crean de nuevo con el mismo nombre,
-- sin la rama (select private.es_super_admin()). La rama de los roles del
-- fraccionamiento queda idéntica a 20261110062756_rls_negocio.sql.
-- Como el super admin no puede actualizar domicilio_concepto, el trigger
-- trg_actualizar_cuotas_concepto nunca se dispara desde la consola.

-- domicilios ---------------------------------------------------------------

drop policy domicilios_delete on public.domicilios;
create policy domicilios_delete on public.domicilios
  for delete to authenticated
  using (
    fraccionamiento_id = (select private.fraccionamiento_actual())
    and (select private.tiene_rol(array['administrador']::public.rol_usuario[]))
  );

-- domicilio_concepto -------------------------------------------------------

drop policy domicilio_concepto_update on public.domicilio_concepto;
create policy domicilio_concepto_update on public.domicilio_concepto
  for update to authenticated
  using (
    fraccionamiento_id = (select private.fraccionamiento_actual())
    and (select private.tiene_rol(array['administrador']::public.rol_usuario[]))
  )
  with check (
    fraccionamiento_id = (select private.fraccionamiento_actual())
    and (select private.tiene_rol(array['administrador']::public.rol_usuario[]))
  );

drop policy domicilio_concepto_delete on public.domicilio_concepto;
create policy domicilio_concepto_delete on public.domicilio_concepto
  for delete to authenticated
  using (
    fraccionamiento_id = (select private.fraccionamiento_actual())
    and (select private.tiene_rol(array['administrador']::public.rol_usuario[]))
  );

-- conceptos_pago -----------------------------------------------------------

drop policy conceptos_pago_insert on public.conceptos_pago;
create policy conceptos_pago_insert on public.conceptos_pago
  for insert to authenticated
  with check (
    fraccionamiento_id = (select private.fraccionamiento_actual())
    and (select private.tiene_rol(array['administrador']::public.rol_usuario[]))
  );

drop policy conceptos_pago_update on public.conceptos_pago;
create policy conceptos_pago_update on public.conceptos_pago
  for update to authenticated
  using (
    fraccionamiento_id = (select private.fraccionamiento_actual())
    and (select private.tiene_rol(array['administrador']::public.rol_usuario[]))
  )
  with check (
    fraccionamiento_id = (select private.fraccionamiento_actual())
    and (select private.tiene_rol(array['administrador']::public.rol_usuario[]))
  );

drop policy conceptos_pago_delete on public.conceptos_pago;
create policy conceptos_pago_delete on public.conceptos_pago
  for delete to authenticated
  using (
    fraccionamiento_id = (select private.fraccionamiento_actual())
    and (select private.tiene_rol(array['administrador']::public.rol_usuario[]))
  );

-- concepto_pago_acceso -----------------------------------------------------

drop policy concepto_pago_acceso_insert on public.concepto_pago_acceso;
create policy concepto_pago_acceso_insert on public.concepto_pago_acceso
  for insert to authenticated
  with check (
    fraccionamiento_id = (select private.fraccionamiento_actual())
    and (select private.tiene_rol(array['administrador']::public.rol_usuario[]))
  );

drop policy concepto_pago_acceso_update on public.concepto_pago_acceso;
create policy concepto_pago_acceso_update on public.concepto_pago_acceso
  for update to authenticated
  using (
    fraccionamiento_id = (select private.fraccionamiento_actual())
    and (select private.tiene_rol(array['administrador']::public.rol_usuario[]))
  )
  with check (
    fraccionamiento_id = (select private.fraccionamiento_actual())
    and (select private.tiene_rol(array['administrador']::public.rol_usuario[]))
  );

drop policy concepto_pago_acceso_delete on public.concepto_pago_acceso;
create policy concepto_pago_acceso_delete on public.concepto_pago_acceso
  for delete to authenticated
  using (
    fraccionamiento_id = (select private.fraccionamiento_actual())
    and (select private.tiene_rol(array['administrador']::public.rol_usuario[]))
  );

-- conceptos_descuento ------------------------------------------------------

drop policy conceptos_descuento_select on public.conceptos_descuento;
create policy conceptos_descuento_select on public.conceptos_descuento
  for select to authenticated
  using (
    fraccionamiento_id = (select private.fraccionamiento_actual())
    and (select private.tiene_rol(array['administrador', 'tesorero', 'comite']::public.rol_usuario[]))
  );

drop policy conceptos_descuento_insert on public.conceptos_descuento;
create policy conceptos_descuento_insert on public.conceptos_descuento
  for insert to authenticated
  with check (
    fraccionamiento_id = (select private.fraccionamiento_actual())
    and (select private.tiene_rol(array['administrador']::public.rol_usuario[]))
  );

drop policy conceptos_descuento_update on public.conceptos_descuento;
create policy conceptos_descuento_update on public.conceptos_descuento
  for update to authenticated
  using (
    fraccionamiento_id = (select private.fraccionamiento_actual())
    and (select private.tiene_rol(array['administrador']::public.rol_usuario[]))
  )
  with check (
    fraccionamiento_id = (select private.fraccionamiento_actual())
    and (select private.tiene_rol(array['administrador']::public.rol_usuario[]))
  );

drop policy conceptos_descuento_delete on public.conceptos_descuento;
create policy conceptos_descuento_delete on public.conceptos_descuento
  for delete to authenticated
  using (
    fraccionamiento_id = (select private.fraccionamiento_actual())
    and (select private.tiene_rol(array['administrador']::public.rol_usuario[]))
  );

-- conceptos_recargo --------------------------------------------------------

drop policy conceptos_recargo_select on public.conceptos_recargo;
create policy conceptos_recargo_select on public.conceptos_recargo
  for select to authenticated
  using (
    fraccionamiento_id = (select private.fraccionamiento_actual())
    and (select private.tiene_rol(array['administrador', 'tesorero', 'comite']::public.rol_usuario[]))
  );

drop policy conceptos_recargo_insert on public.conceptos_recargo;
create policy conceptos_recargo_insert on public.conceptos_recargo
  for insert to authenticated
  with check (
    fraccionamiento_id = (select private.fraccionamiento_actual())
    and (select private.tiene_rol(array['administrador']::public.rol_usuario[]))
  );

drop policy conceptos_recargo_update on public.conceptos_recargo;
create policy conceptos_recargo_update on public.conceptos_recargo
  for update to authenticated
  using (
    fraccionamiento_id = (select private.fraccionamiento_actual())
    and (select private.tiene_rol(array['administrador']::public.rol_usuario[]))
  )
  with check (
    fraccionamiento_id = (select private.fraccionamiento_actual())
    and (select private.tiene_rol(array['administrador']::public.rol_usuario[]))
  );

drop policy conceptos_recargo_delete on public.conceptos_recargo;
create policy conceptos_recargo_delete on public.conceptos_recargo
  for delete to authenticated
  using (
    fraccionamiento_id = (select private.fraccionamiento_actual())
    and (select private.tiene_rol(array['administrador']::public.rol_usuario[]))
  );

-- cuotas -------------------------------------------------------------------

drop policy cuotas_select on public.cuotas;
create policy cuotas_select on public.cuotas
  for select to authenticated
  using (
    fraccionamiento_id = (select private.fraccionamiento_actual())
    and (select private.tiene_rol(array['administrador', 'tesorero', 'comite', 'vigilancia']::public.rol_usuario[]))
  );

drop policy cuotas_insert on public.cuotas;
create policy cuotas_insert on public.cuotas
  for insert to authenticated
  with check (
    fraccionamiento_id = (select private.fraccionamiento_actual())
    and (select private.tiene_rol(array['administrador', 'tesorero']::public.rol_usuario[]))
  );

drop policy cuotas_update on public.cuotas;
create policy cuotas_update on public.cuotas
  for update to authenticated
  using (
    fraccionamiento_id = (select private.fraccionamiento_actual())
    and (select private.tiene_rol(array['administrador', 'tesorero']::public.rol_usuario[]))
  )
  with check (
    fraccionamiento_id = (select private.fraccionamiento_actual())
    and (select private.tiene_rol(array['administrador', 'tesorero']::public.rol_usuario[]))
  );

drop policy cuotas_delete on public.cuotas;
create policy cuotas_delete on public.cuotas
  for delete to authenticated
  using (
    fraccionamiento_id = (select private.fraccionamiento_actual())
    and (select private.tiene_rol(array['administrador', 'tesorero']::public.rol_usuario[]))
  );

-- descuento_cuota ----------------------------------------------------------

drop policy descuento_cuota_select on public.descuento_cuota;
create policy descuento_cuota_select on public.descuento_cuota
  for select to authenticated
  using (
    fraccionamiento_id = (select private.fraccionamiento_actual())
    and (select private.tiene_rol(array['administrador', 'tesorero', 'comite']::public.rol_usuario[]))
  );

drop policy descuento_cuota_insert on public.descuento_cuota;
create policy descuento_cuota_insert on public.descuento_cuota
  for insert to authenticated
  with check (
    fraccionamiento_id = (select private.fraccionamiento_actual())
    and (select private.tiene_rol(array['administrador', 'tesorero']::public.rol_usuario[]))
  );

drop policy descuento_cuota_update on public.descuento_cuota;
create policy descuento_cuota_update on public.descuento_cuota
  for update to authenticated
  using (
    fraccionamiento_id = (select private.fraccionamiento_actual())
    and (select private.tiene_rol(array['administrador', 'tesorero']::public.rol_usuario[]))
  )
  with check (
    fraccionamiento_id = (select private.fraccionamiento_actual())
    and (select private.tiene_rol(array['administrador', 'tesorero']::public.rol_usuario[]))
  );

drop policy descuento_cuota_delete on public.descuento_cuota;
create policy descuento_cuota_delete on public.descuento_cuota
  for delete to authenticated
  using (
    fraccionamiento_id = (select private.fraccionamiento_actual())
    and (select private.tiene_rol(array['administrador', 'tesorero']::public.rol_usuario[]))
  );

-- recargo_cuota ------------------------------------------------------------

drop policy recargo_cuota_select on public.recargo_cuota;
create policy recargo_cuota_select on public.recargo_cuota
  for select to authenticated
  using (
    fraccionamiento_id = (select private.fraccionamiento_actual())
    and (select private.tiene_rol(array['administrador', 'tesorero', 'comite']::public.rol_usuario[]))
  );

drop policy recargo_cuota_insert on public.recargo_cuota;
create policy recargo_cuota_insert on public.recargo_cuota
  for insert to authenticated
  with check (
    fraccionamiento_id = (select private.fraccionamiento_actual())
    and (select private.tiene_rol(array['administrador', 'tesorero']::public.rol_usuario[]))
  );

drop policy recargo_cuota_update on public.recargo_cuota;
create policy recargo_cuota_update on public.recargo_cuota
  for update to authenticated
  using (
    fraccionamiento_id = (select private.fraccionamiento_actual())
    and (select private.tiene_rol(array['administrador', 'tesorero']::public.rol_usuario[]))
  )
  with check (
    fraccionamiento_id = (select private.fraccionamiento_actual())
    and (select private.tiene_rol(array['administrador', 'tesorero']::public.rol_usuario[]))
  );

drop policy recargo_cuota_delete on public.recargo_cuota;
create policy recargo_cuota_delete on public.recargo_cuota
  for delete to authenticated
  using (
    fraccionamiento_id = (select private.fraccionamiento_actual())
    and (select private.tiene_rol(array['administrador', 'tesorero']::public.rol_usuario[]))
  );

-- pagos --------------------------------------------------------------------

drop policy pagos_select on public.pagos;
create policy pagos_select on public.pagos
  for select to authenticated
  using (
    fraccionamiento_id = (select private.fraccionamiento_actual())
    and (select private.tiene_rol(array['administrador', 'tesorero', 'comite']::public.rol_usuario[]))
  );

drop policy pagos_insert on public.pagos;
create policy pagos_insert on public.pagos
  for insert to authenticated
  with check (
    fraccionamiento_id = (select private.fraccionamiento_actual())
    and (select private.tiene_rol(array['administrador', 'tesorero']::public.rol_usuario[]))
  );

drop policy pagos_update on public.pagos;
create policy pagos_update on public.pagos
  for update to authenticated
  using (
    fraccionamiento_id = (select private.fraccionamiento_actual())
    and (select private.tiene_rol(array['administrador', 'tesorero']::public.rol_usuario[]))
  )
  with check (
    fraccionamiento_id = (select private.fraccionamiento_actual())
    and (select private.tiene_rol(array['administrador', 'tesorero']::public.rol_usuario[]))
  );

drop policy pagos_delete on public.pagos;
create policy pagos_delete on public.pagos
  for delete to authenticated
  using (
    fraccionamiento_id = (select private.fraccionamiento_actual())
    and (select private.tiene_rol(array['administrador', 'tesorero']::public.rol_usuario[]))
  );

-- movimientos_financieros --------------------------------------------------

drop policy movimientos_financieros_select on public.movimientos_financieros;
create policy movimientos_financieros_select on public.movimientos_financieros
  for select to authenticated
  using (
    fraccionamiento_id = (select private.fraccionamiento_actual())
    and (select private.tiene_rol(array['administrador', 'tesorero', 'comite']::public.rol_usuario[]))
  );

drop policy movimientos_financieros_insert on public.movimientos_financieros;
create policy movimientos_financieros_insert on public.movimientos_financieros
  for insert to authenticated
  with check (
    fraccionamiento_id = (select private.fraccionamiento_actual())
    and (select private.tiene_rol(array['administrador', 'tesorero']::public.rol_usuario[]))
  );

drop policy movimientos_financieros_update on public.movimientos_financieros;
create policy movimientos_financieros_update on public.movimientos_financieros
  for update to authenticated
  using (
    fraccionamiento_id = (select private.fraccionamiento_actual())
    and (select private.tiene_rol(array['administrador', 'tesorero']::public.rol_usuario[]))
  )
  with check (
    fraccionamiento_id = (select private.fraccionamiento_actual())
    and (select private.tiene_rol(array['administrador', 'tesorero']::public.rol_usuario[]))
  );

drop policy movimientos_financieros_delete on public.movimientos_financieros;
create policy movimientos_financieros_delete on public.movimientos_financieros
  for delete to authenticated
  using (
    fraccionamiento_id = (select private.fraccionamiento_actual())
    and (select private.tiene_rol(array['administrador', 'tesorero']::public.rol_usuario[]))
  );

-- Reporte de accesos para el super admin -----------------------------------
-- Las vistas accesos_telefono_info y accesos_tarjeta_info son security_invoker
-- y leen cuotas, que el super admin ya no ve. Esta función reproduce su lógica
-- (solo cuotas pagadas, estatus 2, de conceptos con el acceso habilitado) para
-- un fraccionamiento y periodo, sin montos. Es security definer solo por eso, y
-- lo primero que hace es exigir super admin.
--   p_tipo = 'telefono': valor_1, valor_2 = telefono_1, telefono_2; valor_3 null.
--   p_tipo = 'tarjeta':  valor_1..3 = tarjeta_1..3.

create function public.reporte_accesos_admin(
  p_fraccionamiento_id bigint,
  p_anio int,
  p_mes int,
  p_tipo text
)
returns table (
  cuota_id bigint,
  domicilio_id bigint,
  direccion text,
  anio bigint,
  mes bigint,
  valor_1 text,
  valor_2 text,
  valor_3 text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (select private.es_super_admin()) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  if p_tipo = 'telefono' then
    return query
      with telefonos_ordenados as (
        select ta.domicilio_id,
               ta.telefono,
               row_number() over (partition by ta.domicilio_id order by ta.id) as rn
        from public.telefonos_acceso ta
        where ta.fraccionamiento_id = p_fraccionamiento_id
      )
      select c.id,
             c.domicilio_id,
             d.direccion,
             c.anio,
             c.mes,
             max(case when t.rn = 1 then t.telefono else null::text end),
             max(case when t.rn = 2 then t.telefono else null::text end),
             null::text
      from public.cuotas c
      join public.concepto_pago_acceso cpa on cpa.concepto_pago_id = c.concepto_id
      join public.domicilios d on d.id = c.domicilio_id
      left join telefonos_ordenados t on t.domicilio_id = c.domicilio_id
      where c.estatus_id = 2
        and cpa.acceso_telefono = true
        and c.fraccionamiento_id = p_fraccionamiento_id
        and c.anio = p_anio
        and c.mes = p_mes
      group by c.id, c.domicilio_id, d.direccion, c.anio, c.mes
      order by d.direccion, c.id;
  elsif p_tipo = 'tarjeta' then
    return query
      with tarjetas_ordenadas as (
        select ta.domicilio_id,
               ta.numero,
               row_number() over (partition by ta.domicilio_id order by ta.id) as rn
        from public.tarjetas_acceso ta
        where ta.fraccionamiento_id = p_fraccionamiento_id
      )
      select c.id,
             c.domicilio_id,
             d.direccion,
             c.anio,
             c.mes,
             max(case when t.rn = 1 then t.numero else null::text end),
             max(case when t.rn = 2 then t.numero else null::text end),
             max(case when t.rn = 3 then t.numero else null::text end)
      from public.cuotas c
      join public.concepto_pago_acceso cpa on cpa.concepto_pago_id = c.concepto_id
      join public.domicilios d on d.id = c.domicilio_id
      left join tarjetas_ordenadas t on t.domicilio_id = c.domicilio_id
      where c.estatus_id = 2
        and cpa.acceso_tarjeta = true
        and c.fraccionamiento_id = p_fraccionamiento_id
        and c.anio = p_anio
        and c.mes = p_mes
      group by c.id, c.domicilio_id, d.direccion, c.anio, c.mes
      order by d.direccion, c.id;
  else
    raise exception 'Tipo de reporte no válido: %', p_tipo using errcode = '22023';
  end if;
end;
$$;

revoke execute on function public.reporte_accesos_admin(bigint, int, int, text) from public, anon;
grant execute on function public.reporte_accesos_admin(bigint, int, int, text) to authenticated, service_role;
