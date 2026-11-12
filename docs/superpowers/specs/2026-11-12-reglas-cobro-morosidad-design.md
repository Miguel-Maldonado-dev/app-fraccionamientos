# Reglas de cobro y morosidad por fraccionamiento — Diseño

Estado: aprobado (2026-11-12). Proyecto 2 de 3 tras "medios de acceso + access-core".

## 1. Intención

Hoy todos los fraccionamientos comparten una sola regla: las cuotas se generan a mano, vencen el
último día del mes, y una cuota vencida sin pago vuelve moroso al domicilio, que recibe el permiso
"moroso" de access-core. El usuario quiere que cada fraccionamiento tenga sus reglas: cuándo se
generan las cuotas solas, cuándo vencen, cuánta gracia hay, si se cobra recargo y cuántas cuotas
vencidas hacen falta para restringir el acceso. Además, el administrador necesita poder forzar el
acceso de un domicilio (activarlo o desactivarlo) sin esperar a la regla.

## 2. Metas, no metas, anti-metas

Metas
- Configuración por fraccionamiento (valores por omisión = comportamiento actual):
  - `dia_generacion` (1–28, nulo = sin generación automática; por omisión nulo).
  - `dia_vencimiento` (1–31, nulo = último día del mes; por omisión nulo). Si el mes es más corto, se usa su último día.
  - `dias_gracia` (0–60, por omisión 0).
  - `cuotas_para_moroso` (1–12, por omisión 1).
  - `concepto_recargo_id` (opcional; de `conceptos_recargo` del mismo fraccionamiento).
- Generación automática diaria: el día `dia_generacion` se generan las cuotas del mes en curso para
  ese fraccionamiento; nunca duplica (misma regla de existencia que `generar_cuotas`).
- Se conservan el botón "Generar cuotas" y la generación individual por domicilio (incluye meses
  futuros para pagos adelantados). Ambos usan el nuevo `dia_vencimiento`.
- Recargo automático: el día siguiente al vencimiento, cada cuota sin pago recibe el recargo del
  concepto configurado, si no tiene ya un recargo (manual o previo). Un recargo por cuota, como hoy.
- Cuota vencida (estatus 3) = sin pago y `fecha_vencimiento + dias_gracia < hoy`.
- Moroso = número de cuotas con estatus 3 ≥ `cuotas_para_moroso`.
- Ajuste manual de acceso (solo rol administrador del fraccionamiento):
  - "Activar": permiso "al corriente" aunque sea moroso.
  - "Desactivar": permiso "moroso" aunque esté al corriente.
  - Se guarda en el domicilio con quién y cuándo; la UI lo muestra claramente.
  - Dura hasta que cambia la situación real (opción B del usuario): un "activar" se quita solo cuando el
    domicilio deja de ser moroso; un "desactivar" se quita solo cuando el domicilio pasa a moroso.
    El administrador también puede quitarlo a mano.
- Configuración editable por administrador (pantalla Configuración) y por super admin (consola).

No metas
- Recargos porcentuales, escalonados o acumulativos por mes.
- Generación automática de meses futuros (eso sigue siendo manual por domicilio).
- Cambios a medios, cola o trabajador de sincronización.

Anti-metas
- La consola del super admin no debe revelar estado de pago ni morosidad (regla de consola v2): el
  super admin ve y edita la configuración, pero no el ajuste manual ni el estado moroso.
- Con la configuración por omisión nada debe cambiar respecto a hoy.

## 3. Enfoques

- **A (elegido): todo en la tarea diaria de la base.** `marcar_cuotas_vencidas` (pg_cron, 06:00 UTC)
  se reemplaza por un proceso diario que, por fraccionamiento y en orden: genera cuotas si toca,
  aplica recargos, marca vencidas, limpia ajustes manuales superados y recalcula permisos.
- B: hacerlo desde la app con el cron de `/api/sincronizacion/procesar` — descartado: requiere
  permisos amplios en la app y duplica lógica que ya vive en la base.
- C: tareas pg_cron separadas por paso — descartado: el orden entre pasos podría desfasarse.

## 4. Diseño

Datos
- Tabla `reglas_cobro` (PK `fraccionamiento_id`, FK compuesta al concepto de recargo del mismo
  fraccionamiento, checks de rangos). Sin fila = valores por omisión. RLS: lectura para roles del
  fraccionamiento y super admin; escritura administrador del fraccionamiento y super admin.
- En `domicilios`: `acceso_forzado` (nulo | 'activo' | 'inactivo'), `acceso_forzado_por` (uuid),
  `acceso_forzado_en` (timestamptz). Solo modificable vía RPC `forzar_acceso(domicilio, valor)` que
  exige rol administrador (super admin no).

Funciones
- `private.fecha_vencimiento(fraccionamiento, anio, mes) → date` usada por `generar_cuotas`, la
  generación individual y la automática.
- `private.es_moroso(domicilio) → bool` (cuenta estatus 3 vs `cuotas_para_moroso`).
- `perfil_deseado`: si `acceso_forzado` = 'activo' → perfil corriente; 'inactivo' → perfil moroso;
  si no, según `es_moroso`.
- `procesar_reglas_cobro()` (solo cron/service_role), idempotente, pasos en orden de §3-A; termina con
  `recalcular_permisos_acceso()`. Reemplaza el job `marcar-cuotas-vencidas` (mismo horario).
- La limpieza del ajuste manual también ocurre al registrar un pago (ya se recalculan permisos ahí)
  para que el efecto sea inmediato.

UI
- Configuración (administrador): sección "Reglas de cobro" con los cinco campos y explicación del
  ejemplo (vence 31, gracia 5 → recargo día 1, moroso día 6).
- Consola, detalle del fraccionamiento: la misma sección, sin datos de pagos.
- Detalle del domicilio (administrador): botón "Activar acceso"/"Desactivar acceso" con confirmación,
  insignia "Acceso forzado por X el …" y "Quitar ajuste". Tesorero lo ve, no lo cambia.

## 5. Decisiones del usuario

- Generación automática con día configurable; se conservan botón general e individual.
- Ajuste manual solo administrador; dura hasta que cambia la situación real (opción B).
- Recargo opcional desde la lista del fraccionamiento, aplicado al día siguiente del vencimiento;
  la gracia solo retrasa el cambio de permiso.
- Enfoque A.
- Si `dia_vencimiento` < `dia_generacion`, la cuota del mes M vence ese día del mes M+1 ("mes
  vencido"); si no, vence en el mismo mes. `private.fecha_vencimiento` aplica esta regla en todas las
  generaciones (automática, botón e individual).
- El usuario aprobó las decisiones de §6 (2026-11-12). Estado: aprobado.

## 6. Decisiones mías (corregibles)

- Recargo automático no reemplaza uno existente.
- La generación automática solo genera el mes en curso.
- `dia_generacion` limitado a 1–28 para que exista en todos los meses.
- Fechas evaluadas en zona `America/Mexico_City` (el job corre 06:00 UTC = medianoche local).
- Cambiar las reglas no reescribe fechas de vencimiento de cuotas ya generadas.

- Estatus 3 (Vencido) = pasada la gracia. Entre vencimiento y fin de gracia la cuota sigue en 1 y la UI
  la muestra como "En gracia" (con recargo si aplica). El proceso diario recalcula el estatus de las
  cuotas sin pago en ambos sentidos (1↔3), así que cambiar `dias_gracia` corrige las ya marcadas.
- Guardar reglas, `forzar_acceso` y "Quitar ajuste" llaman a `recalcular_permisos_acceso` del
  fraccionamiento (efecto inmediato, vía la cola existente). Domicilios sin `titular_id` solo cambian local.
- Recuperación: si hoy ≥ `dia_generacion` y faltan cuotas del mes, se generan (cubre cron fallido o
  regla configurada tarde). El recargo se aplica a toda cuota sin pago, en estatus 1 o 3, vencida, sin
  recargo, cuya `fecha_vencimiento` ≥ la fecha en que se configuró el concepto de recargo
  (`recargo_desde`), para no cobrar retroactivo al activarlo.
- Recargo: se suma aunque haya descuento; "sin pago" = ninguna fila en `pagos` (criterio actual);
  se aplica aunque el domicilio tenga acceso forzado (cobro y acceso son independientes).
- Ajuste manual: "Activar" solo se permite si el domicilio es moroso y "Desactivar" solo si está al
  corriente; así la limpieza automática (el estado real ya coincide con el forzado) no borra un ajuste
  recién puesto.
- Borrar el concepto de recargo configurado → `on delete set null` en `reglas_cobro`; recargos ya
  aplicados no cambian.
- Super admin ve y edita toda `reglas_cobro`, incluido el nombre del concepto de recargo.

## 7. Para el constructor

Nombres exactos de columnas, mensajes, layout de formularios, distribución de pruebas pgTAP/vitest.
