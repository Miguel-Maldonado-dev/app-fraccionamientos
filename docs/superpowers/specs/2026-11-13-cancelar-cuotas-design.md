# Cancelar (condonar) cuotas — Diseño

Estado: borrador para aprobación (2026-11-13).

## 1. Intención
Hay adeudos que el fraccionamiento **no va a cobrar**: el domicilio se vendió y la deuda era del dueño
anterior, cambió el inquilino de una renta, u otros casos extraordinarios. Hoy esas cuotas siguen
"Vencidas", el domicilio queda moroso y se le desactivan los accesos. Se necesita **cancelar** esas
cuotas para que dejen de contar, sin perder el historial.

## 2. Metas / no metas / anti-metas
- Metas: estatus nuevo **Cancelada**; cancelar una o varias cuotas de un domicilio con **motivo
  obligatorio**; registro de quién y cuándo; poder **reactivar**; las canceladas no cuentan para
  morosidad, pendientes, saldos ni reportes de adeudo; los accesos se reactivan solos.
- No metas: eliminar cuotas; cancelar cuotas pagadas; condonar parcialmente (importe parcial);
  cancelación masiva entre varios domicilios; cambios en la app móvil más allá de mostrar el estatus.
- Anti-metas: una cuota cancelada nunca vuelve a "Vencida" por el proceso automático; una cuota con
  pago nunca se cancela; nadie fuera del fraccionamiento ni sin rol administrador puede cancelar.

## 3. Enfoques (elegido A)
- **A (elegido por el usuario):** estatus "Cancelada" con motivo y auditoría; reversible.
- B: eliminar cuotas — descartado: se pierde el historial del adeudo.
- C: descuento del 100 % — descartado: aparecerían como "Pagado" y se mezclan con ingresos reales.

## 4. Diseño

### 4.1 Datos
- `estatus`: nuevo registro `(4, 'Cancelado')` (el catálogo es global; etiqueta en UI "Cancelada").
- `cuotas`: columnas `cancelada_en timestamptz null`, `cancelada_por uuid null` (auth.users),
  `motivo_cancelacion text null`; check: `estatus_id = 4` ⇔ las tres no nulas; motivo 3–500 caracteres.
- Tabla `cuotas_cancelaciones` (historial): `id`, `fraccionamiento_id`, `cuota_id`, `accion`
  (`'cancelar' | 'reactivar'`), `motivo text null`, `usuario_id uuid`, `created_at`. RLS: lectura para
  administrador y tesorero del fraccionamiento (y super admin); escritura solo por las funciones.
- RPC `cancelar_cuotas(p_cuota_ids bigint[], p_motivo text)` (security definer en `private`, wrapper
  público): valida rol **administrador** del fraccionamiento de las cuotas, todas del mismo domicilio,
  ninguna con pago ni ya cancelada (si alguna no cumple ⇒ error y no cambia nada), motivo válido;
  pone estatus 4 + columnas; inserta historial.
- RPC `reactivar_cuota(p_cuota_id bigint)`: solo administrador; limpia columnas y recalcula su estatus
  (Pendiente o Vencida según vencimiento y días de gracia, misma regla que
  `private.actualizar_estatus_cuotas`); inserta historial.
- `private.actualizar_estatus_cuotas` ya solo toca estatus 1↔3: verificar con prueba que no toca 4.
- Vistas (`cuotas_info`/`estatus_calculado`) devuelven "Cancelada" para estatus 4; recargos
  automáticos nunca se generan sobre canceladas; `es_moroso` cuenta solo estatus 3 (sin cambio, con
  prueba). Tras cancelar o reactivar se encola la resincronización de accesos del domicilio igual que
  cuando cambia su morosidad por un pago (reusar el mecanismo existente).

### 4.2 Web (detalle del domicilio, tarjeta Cuotas)
- Casillas de selección en cuotas Pendiente/Vencida/En gracia sin pago (solo administrador); botón
  "Cancelar cuotas (N)" que abre diálogo: lista de cuotas seleccionadas con total, campo **Motivo**
  (obligatorio) y aviso "Las cuotas canceladas no se cobrarán ni contarán para la morosidad. Puedes
  reactivarlas después." Confirmar ⇒ toast "N cuotas canceladas".
- Cuota cancelada: badge gris "Cancelada", fila atenuada, tooltip/línea con motivo, quién y fecha;
  acción "Reactivar" (ícono, con confirmación) solo administrador. Sin Pagar/Editar.
- Chips: Pendientes no cuenta canceladas; se agrega chip neutro "N Canceladas" si hay.
- Listado general de Cuotas y filtros: "Cancelada" como estatus filtrable; totales de pendiente/vencido
  la excluyen.
- Reportes/dashboard (estado de cuotas, adeudos): excluyen canceladas.

### 4.3 App móvil
- La lista de cuotas muestra "Cancelada" (lee `estatus_calculado`); el estatus del domicilio ya sale del
  servidor.

## 5. Decisiones del usuario
- Las cuotas se perdonan (venta del domicilio, rentas, casos incobrables) y no deben afectar morosidad.
- Enfoque A.

## 6. Decisiones mías (corregibles)
- Solo **administrador** cancela y reactiva (no tesorero; super admin no desde la consola en esta versión).
- Motivo obligatorio (3–500), cancelación todo-o-nada, solo cuotas sin pago, de un solo domicilio a la vez.
- Historial en tabla aparte para conservar cancelaciones y reactivaciones.

## 7. Para el constructor
Nombres internos, estructura de migración y pruebas pgTAP/vitest, diseño exacto del diálogo y la fila.

## 8. Respuestas a la revisión del constructor (decisiones mías)
- **Recargos/descuentos:** cancelar no borra `recargo_cuota` ni `descuento_cuota`; mientras la cuota está
  cancelada no cuentan en ningún total. Reactivar la deja como estaba (con lo que tenía) y desde ahí aplica
  la regla normal: el proceso diario solo agrega recargo si no tenía uno.
- **Pagar una cancelada:** prohibido también en el servidor: la creación de pagos (y cualquier RPC/acción de
  pago) rechaza cuotas con estatus 4, con prueba pgTAP/vitest.
- **Pagos anulados:** no existe la anulación de pagos hoy; "sin pago" = no hay fila en `pagos`.
- **Estatus 4 en clientes:** regenerar tipos y revisar uniones/switch de estatus en web y móvil; donde no
  se reconozca, mostrar el nombre del catálogo.
- **Resincronización:** encolar siempre tras cancelar o reactivar (la cola es idempotente); si el mecanismo
  existente es por cambio de morosidad, basta con recalcular el perfil deseado del domicilio.
- **Reportes/dashboard:** el constructor localiza dónde se calculan los adeudos (vistas o cliente) y
  excluye estatus 4 ahí.
