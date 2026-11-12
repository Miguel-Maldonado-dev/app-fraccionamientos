-- Vistas de lectura (security_invoker: aplican la RLS del usuario que consulta).

create view public.domicilios_info with (security_invoker=on) as
 SELECT d.id,
    d.direccion,
    d.fecha_alta,
    d.observaciones,
    COALESCE(r.nombre, 'Sin información'::text) AS residente_principal,
    dc.concepto_id AS id_concepto,
    cp.nombre AS tipo_cuota,
    COALESCE(cpa.acceso_telefono, false) AS acceso_telefono,
    COALESCE(cpa.acceso_tarjeta, false) AS acceso_tarjeta,
        CASE
            WHEN (EXISTS ( SELECT 1
               FROM public.cuotas c
              WHERE c.domicilio_id = d.id AND c.estatus_id = 3)) THEN 'Moroso'::text
            ELSE 'Al corriente'::text
        END AS estatus
   FROM public.domicilios d
     LEFT JOIN public.residentes r ON r.domicilio_id = d.id AND r.es_principal = true
     LEFT JOIN public.domicilio_concepto dc ON dc.domicilio_id = d.id
     LEFT JOIN public.conceptos_pago cp ON cp.id = dc.concepto_id
     LEFT JOIN public.concepto_pago_acceso cpa ON cpa.concepto_pago_id = cp.id;

create view public.cuotas_info with (security_invoker=on) as
 SELECT c.id,
    c.domicilio_id,
    d.direccion,
    COALESCE(r.nombre, 'Sin información'::text) AS residente_principal,
    (
        CASE c.mes
            WHEN 1 THEN 'Ene'::text
            WHEN 2 THEN 'Feb'::text
            WHEN 3 THEN 'Mar'::text
            WHEN 4 THEN 'Abr'::text
            WHEN 5 THEN 'May'::text
            WHEN 6 THEN 'Jun'::text
            WHEN 7 THEN 'Jul'::text
            WHEN 8 THEN 'Ago'::text
            WHEN 9 THEN 'Sep'::text
            WHEN 10 THEN 'Oct'::text
            WHEN 11 THEN 'Nov'::text
            WHEN 12 THEN 'Dic'::text
            ELSE NULL::text
        END || '/'::text) || c.anio AS periodo,
    c.anio,
    c.mes,
    c.concepto_id,
    cp.nombre AS concepto,
    COALESCE(rg.total_recargo, 0::numeric) AS monto_recargo,
    COALESCE(ds.total_descuento, 0::numeric) AS monto_descuento,
    c.importe + COALESCE(rg.total_recargo, 0::numeric) - COALESCE(ds.total_descuento, 0::numeric) AS importe_cuota,
    cp.importe AS importe_base,
    c.fecha_vencimiento,
    to_char(c.fecha_vencimiento::timestamp with time zone, 'DD/MM/YYYY'::text) AS fecha_vencimiento_formated,
    e.name AS estatus,
        CASE
            WHEN lower(e.name) = 'pagado'::text THEN 'Pagado'::text
            WHEN c.fecha_vencimiento < CURRENT_DATE THEN 'Vencido'::text
            ELSE 'Pendiente'::text
        END AS estatus_calculado,
    c.created_at
   FROM public.cuotas c
     JOIN public.domicilios d ON d.id = c.domicilio_id
     LEFT JOIN public.residentes r ON r.domicilio_id = d.id AND r.es_principal = true
     JOIN public.conceptos_pago cp ON cp.id = c.concepto_id
     JOIN public.estatus e ON e.id = c.estatus_id
     LEFT JOIN ( SELECT rc.cuota_id,
            sum(cr.monto_recargo) AS total_recargo
           FROM public.recargo_cuota rc
             JOIN public.conceptos_recargo cr ON cr.id = rc.concepto_recargo_id
          GROUP BY rc.cuota_id) rg ON rg.cuota_id = c.id
     LEFT JOIN ( SELECT dc.cuota_id,
            sum(cd.monto_descuento) AS total_descuento
           FROM public.descuento_cuota dc
             JOIN public.conceptos_descuento cd ON cd.id = dc.concepto_descuento_id
          GROUP BY dc.cuota_id) ds ON ds.cuota_id = c.id;

create view public.pagos_info with (security_invoker=on) as
 SELECT p.id,
    p.created_at,
    p.domicilio_id,
    p.cuota_id,
    p.concepto_id,
    p.fecha_pago,
    p.metodo_pago_id,
    p.referencia,
    p.user_id,
    p.importe,
    p.file_data,
    d.direccion,
    cp.nombre AS concepto,
    mp.name AS metodo_pago,
    c.mes,
    c.anio,
    cp.tipo_pago_id
   FROM public.pagos p
     JOIN public.domicilios d ON d.id = p.domicilio_id
     LEFT JOIN public.conceptos_pago cp ON cp.id = p.concepto_id
     LEFT JOIN public.metodos_pago mp ON mp.id = p.metodo_pago_id
     LEFT JOIN public.cuotas c ON c.id = p.cuota_id;

create view public.residentes_info with (security_invoker=on) as
 SELECT r.id,
    r.created_at,
    r.nombre,
    r.telefono,
    r.domicilio_id,
    r.es_principal,
    d.direccion
   FROM public.residentes r
     JOIN public.domicilios d ON d.id = r.domicilio_id;

create view public.domicilio_concepto_info with (security_invoker=on) as
 SELECT dc.id,
    dc.domicilio_id,
    d.direccion,
    dc.concepto_id,
    cp.nombre AS concepto_nombre,
    cp.importe
   FROM public.domicilio_concepto dc
     JOIN public.conceptos_pago cp ON cp.id = dc.concepto_id
     JOIN public.domicilios d ON d.id = dc.domicilio_id;

create view public.movimientos_info with (security_invoker=on) as
 SELECT m.id,
    m.created_at,
    m.tipo_id,
    m.descripcion,
    m.importe,
    m.metodo_pago_id,
    m.referencia,
    m.user_id,
    m.fecha_movimiento,
    tm.name AS tipo_movimiento,
    mp.name AS metodo_pago
   FROM public.movimientos_financieros m
     JOIN public.tipos_movimientos tm ON tm.id = m.tipo_id
     JOIN public.metodos_pago mp ON mp.id = m.metodo_pago_id;

create view public.resumen_financiero_completo with (security_invoker=on) as
 SELECT sum(
        CASE
            WHEN tm.name = 'Ingreso'::text THEN mf.importe
            ELSE 0::numeric
        END) AS total_ingresos,
    sum(
        CASE
            WHEN tm.name = 'Egreso'::text THEN mf.importe
            ELSE 0::numeric
        END) AS total_egresos,
    sum(
        CASE
            WHEN tm.name = 'Ingreso'::text THEN mf.importe
            ELSE - mf.importe
        END) AS saldo_actual,
    sum(
        CASE
            WHEN tm.name = 'Ingreso'::text AND date_trunc('month'::text, mf.fecha_movimiento::timestamp with time zone) = date_trunc('month'::text, CURRENT_DATE::timestamp with time zone) THEN mf.importe
            ELSE 0::numeric
        END) AS ingresos_mes,
    sum(
        CASE
            WHEN tm.name = 'Egreso'::text AND date_trunc('month'::text, mf.fecha_movimiento::timestamp with time zone) = date_trunc('month'::text, CURRENT_DATE::timestamp with time zone) THEN mf.importe
            ELSE 0::numeric
        END) AS egresos_mes,
    sum(
        CASE
            WHEN tm.name = 'Ingreso'::text AND date_trunc('month'::text, mf.fecha_movimiento::timestamp with time zone) = date_trunc('month'::text, CURRENT_DATE - '1 mon'::interval) THEN mf.importe
            ELSE 0::numeric
        END) AS ingresos_mes_anterior,
    sum(
        CASE
            WHEN tm.name = 'Egreso'::text AND date_trunc('month'::text, mf.fecha_movimiento::timestamp with time zone) = date_trunc('month'::text, CURRENT_DATE - '1 mon'::interval) THEN mf.importe
            ELSE 0::numeric
        END) AS egresos_mes_anterior
   FROM public.movimientos_financieros mf
     JOIN public.tipos_movimientos tm ON tm.id = mf.tipo_id;

create view public.accesos_telefono_info with (security_invoker=on) as
 WITH telefonos_ordenados AS (
         SELECT ta.domicilio_id,
            ta.telefono,
            row_number() OVER (PARTITION BY ta.domicilio_id ORDER BY ta.id) AS rn
           FROM public.telefonos_acceso ta
        )
 SELECT c.id AS cuota_id,
    c.domicilio_id,
    d.direccion,
    c.anio,
    c.mes,
    c.estatus_id,
    c.concepto_id,
    max(
        CASE
            WHEN t.rn = 1 THEN t.telefono
            ELSE NULL::text
        END) AS telefono_1,
    max(
        CASE
            WHEN t.rn = 2 THEN t.telefono
            ELSE NULL::text
        END) AS telefono_2
   FROM public.cuotas c
     JOIN public.concepto_pago_acceso cpa ON cpa.concepto_pago_id = c.concepto_id
     JOIN public.domicilios d ON d.id = c.domicilio_id
     LEFT JOIN telefonos_ordenados t ON t.domicilio_id = c.domicilio_id
  WHERE c.estatus_id = 2 AND cpa.acceso_telefono = true
  GROUP BY c.id, c.domicilio_id, d.direccion, c.anio, c.mes, c.estatus_id, c.concepto_id;

create view public.accesos_tarjeta_info with (security_invoker=on) as
 WITH tarjetas_ordenadas AS (
         SELECT ta.domicilio_id,
            ta.numero,
            row_number() OVER (PARTITION BY ta.domicilio_id ORDER BY ta.id) AS rn
           FROM public.tarjetas_acceso ta
        )
 SELECT c.id AS cuota_id,
    c.domicilio_id,
    d.direccion,
    c.anio,
    c.mes,
    c.estatus_id,
    c.concepto_id,
    max(
        CASE
            WHEN t.rn = 1 THEN t.numero
            ELSE NULL::text
        END) AS tarjeta_1,
    max(
        CASE
            WHEN t.rn = 2 THEN t.numero
            ELSE NULL::text
        END) AS tarjeta_2,
    max(
        CASE
            WHEN t.rn = 3 THEN t.numero
            ELSE NULL::text
        END) AS tarjeta_3
   FROM public.cuotas c
     JOIN public.concepto_pago_acceso cpa ON cpa.concepto_pago_id = c.concepto_id
     JOIN public.domicilios d ON d.id = c.domicilio_id
     LEFT JOIN tarjetas_ordenadas t ON t.domicilio_id = c.domicilio_id
  WHERE c.estatus_id = 2 AND cpa.acceso_tarjeta = true
  GROUP BY c.id, c.domicilio_id, d.direccion, c.anio, c.mes, c.estatus_id, c.concepto_id;

create view public.users_info with (security_invoker=on) as
 select id, email, nombre as user_name, activo as is_active, created_at, rol, fraccionamiento_id
   from public.perfiles;

create view public.reporte_pagos_detalle with (security_invoker=on) as
 SELECT p.id,
    p.user_id,
    u.nombre AS nombre_usuario,
    u.email AS usuario,
    p.fecha_pago,
    p.importe,
    p.metodo_pago_id,
    mp.name AS metodo_pago_nombre,
    p.referencia,
    p.domicilio_id,
    p.file_data
   FROM public.pagos p
     JOIN public.perfiles u ON u.id = p.user_id
     JOIN public.metodos_pago mp ON mp.id = p.metodo_pago_id;

revoke all on public.users_info from anon, authenticated;
grant select on public.users_info to authenticated, service_role;
revoke all on public.domicilios_info from anon, authenticated;
grant select on public.domicilios_info to authenticated, service_role;
revoke all on public.cuotas_info from anon, authenticated;
grant select on public.cuotas_info to authenticated, service_role;
revoke all on public.pagos_info from anon, authenticated;
grant select on public.pagos_info to authenticated, service_role;
revoke all on public.residentes_info from anon, authenticated;
grant select on public.residentes_info to authenticated, service_role;
revoke all on public.domicilio_concepto_info from anon, authenticated;
grant select on public.domicilio_concepto_info to authenticated, service_role;
revoke all on public.movimientos_info from anon, authenticated;
grant select on public.movimientos_info to authenticated, service_role;
revoke all on public.reporte_pagos_detalle from anon, authenticated;
grant select on public.reporte_pagos_detalle to authenticated, service_role;
revoke all on public.resumen_financiero_completo from anon, authenticated;
grant select on public.resumen_financiero_completo to authenticated, service_role;
revoke all on public.accesos_telefono_info from anon, authenticated;
grant select on public.accesos_telefono_info to authenticated, service_role;
revoke all on public.accesos_tarjeta_info from anon, authenticated;
grant select on public.accesos_tarjeta_info to authenticated, service_role;
