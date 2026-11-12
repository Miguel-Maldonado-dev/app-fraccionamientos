-- Recibos sin PDF almacenado (spec 2026-11-10-recibos-design §1).
-- Cada pago guarda una foto JSON pequeña del recibo; el PDF se genera al abrirlo.
-- Las vistas dejan de exponer file_data y exponen tiene_recibo. Como cambia el
-- nombre y el tipo de una columna, `create or replace view` no sirve: se borran
-- y se vuelven a crear con las mismas columnas, security_invoker y permisos.

alter table public.pagos add column recibo jsonb;

drop view public.pagos_info;
drop view public.reporte_pagos_detalle;

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
    (p.recibo IS NOT NULL) AS tiene_recibo,
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
    (p.recibo IS NOT NULL) AS tiene_recibo
   FROM public.pagos p
     JOIN public.perfiles u ON u.id = p.user_id
     JOIN public.metodos_pago mp ON mp.id = p.metodo_pago_id;

revoke all on public.pagos_info from anon, authenticated;
grant select on public.pagos_info to authenticated, service_role;
revoke all on public.reporte_pagos_detalle from anon, authenticated;
grant select on public.reporte_pagos_detalle to authenticated, service_role;

alter table public.pagos drop column file_data;
