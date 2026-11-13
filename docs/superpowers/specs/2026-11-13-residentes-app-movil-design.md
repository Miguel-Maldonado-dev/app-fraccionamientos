# Residentes como usuarios y servicios para la app móvil — Diseño

Estado: aprobado (2026-11-13).

## 1. Intención

WEADMI necesita una app móvil para residentes: inicio con hasta 8 botones de apertura remota, su PIN
y estatus; secciones (pestañas) con datos del domicilio, recibos, medios de acceso y, después, pagos
con Stripe. Si el domicilio es moroso, los botones se desactivan. Este proyecto deja todo lo
necesario del lado del servidor para que la app móvil solo construya pantallas: residentes como
usuarios, permisos seguros, constructor de botones y endpoints para abrir accesos y gestionar
residentes. La app en sí, los QR de invitación y Stripe son proyectos posteriores.

## 2. Metas, no metas, anti-metas

Metas
- Rol residente. Cuenta = usuario de Supabase Auth con correo sintético `<telefono>@auth.internal`
  (teléfono normalizado a 10 dígitos). Una cuenta puede pertenecer a varios domicilios, de uno o
  varios fraccionamientos (opción B del usuario).
- Alta al crear un residente en el detalle del domicilio: se capturan teléfono y contraseña. Si el
  teléfono ya tiene cuenta, se vincula sin pedir contraseña.
- El primer residente del domicilio es el principal (como hoy). El principal puede crear residentes
  de su domicilio (desde la app, vía endpoint).
- Máximo de residentes con acceso a la app por domicilio, configurable por el administrador en
  Configuración (por omisión 5).
- Si el tipo de cuota del domicilio habilita el medio `telefono`, el teléfono del residente se
  registra también como medio de acceso (`telefonos_acceso`), local, sin sincronizar (access-core no
  tiene API de teléfonos).
- Constructor visual de botones de la app en la consola (super admin), por fraccionamiento: nombre,
  ícono, orden, salida de la instalación (lista de access-core `GET /installations/{id}/outputs`),
  casilla "Ancho completo". Máximo 8. Vista previa de teléfono en vivo con "Ver como moroso".
- Endpoints para la app: abrir una salida (`POST /installations/{id}/outputs/{outputId}/open`),
  bloqueado si el domicilio es moroso (según `perfil_deseado`/`es_moroso`, respetando ajuste
  manual); gestión de residentes del principal; cambio de contraseña.

No metas
- La app móvil, QR de invitación, Stripe, notificaciones push.
- Sincronizar teléfonos con access-core.

Anti-metas
- Un residente nunca debe ver datos de otros domicilios ni del fraccionamiento (pagos, residentes,
  reportes). Fallar esto es peor que no entregar.
- Las pantallas y permisos actuales del personal no deben cambiar.

## 3. Enfoques

- **1 (elegido): mixto.** La app lee directo de Supabase con RLS para residentes (domicilio, cuotas,
  recibos, medios, estatus, botones); lo que requiere secretos o reglas especiales va por Route
  Handlers de Next.js (abrir salida, crear residentes/cuentas, restablecer contraseña). Igual que la
  web; Supabase tiene SDK para React Native.
- 2: API REST propia para todo — descartado: duplica lógica y multiplica endpoints.

## 4. Diseño

Modelo
- `public.cuentas_residente(user_id uuid pk → auth.users, telefono text unique, activo bool, created_at)`.
  Los residentes NO tienen fila en `perfiles`: así `private.fraccionamiento_actual()` y
  `private.tiene_rol()` devuelven nulo/falso para ellos y todas las políticas del personal los
  rechazan por omisión (seguro por defecto).
- `residentes.user_id uuid null → cuentas_residente`; único por (domicilio_id, user_id).
  `residentes.telefono` pasa a obligatorio y normalizado para residentes con acceso a la app.
  Residentes existentes sin teléfono siguen válidos, sin cuenta.
- `reglas_cobro` no; nueva columna en configuración del fraccionamiento:
  `fraccionamientos.max_residentes_app smallint not null default 5` (1–20), editable por administrador.
- `private.domicilios_del_residente() returns setof bigint` (domicilios del `auth.uid()` vía
  `residentes.user_id`, solo fraccionamientos activos y cuenta activa).
- Políticas RLS adicionales de solo lectura para residentes: `domicilios`, `cuotas`/vista de cuotas,
  `pagos` y recibos, `residentes` (los de su domicilio), `tarjetas_acceso`, `controles_acceso`,
  `pines_acceso`, `telefonos_acceso`, `app_botones` del fraccionamiento de su domicilio,
  `fraccionamientos` (solo nombre/marca). Las vistas existentes deben revisarse (security_invoker).
- `public.app_botones(id, fraccionamiento_id, orden smallint 1–8, nombre text, icono text,
  ancho_completo bool default false, salida_id text, salida_nombre text)`; único (fraccionamiento_id,
  orden); máximo 8. Escritura solo super admin.
- `public.estado_app_domicilio(p_domicilio_id)` RPC para el inicio de la app: es_moroso efectivo
  (con ajuste manual), PIN, botones habilitados (bool), nombre del domicilio.

Endpoints (Route Handlers, autenticados con el JWT de Supabase del residente, `Authorization: Bearer`)
- `POST /api/app/domicilios/{id}/aperturas` `{ botonId }` → verifica pertenencia, no moroso,
  instalación ligada; llama access-core open. Registra en `aperturas_remotas` (auditoría: usuario,
  domicilio, botón, resultado, fecha).
- `POST /api/app/domicilios/{id}/residentes` (solo principal) `{ nombre, telefono, password? }` →
  respeta el máximo; crea o vincula cuenta.
- `DELETE /api/app/domicilios/{id}/residentes/{residenteId}` (solo principal; no a sí mismo).
- Cambio de contraseña: directo con el SDK de Supabase Auth (no requiere endpoint).

Web (personal)
- Detalle del domicilio, sección Residentes: alta con teléfono + contraseña (o vínculo si ya existe),
  indicador "Con acceso a la app", contador "3 de 5", restablecer contraseña, quitar acceso, cambiar
  principal. Administrador y tesorero.
- Configuración: campo "Residentes con acceso a la app por domicilio".
- Consola, detalle del fraccionamiento: pestaña "App de residentes" con el constructor (opción A:
  lista arrastrable a la izquierda + teléfono en vivo a la derecha; cuadrícula de 2 columnas; el
  último impar ocupa todo el ancho; casilla "Ancho completo" por botón; "Ver como moroso").

## 5. Decisiones del usuario

- Usuario = teléfono, formato `numero@auth.internal`; se crea al registrar el residente con
  teléfono y contraseña.
- El principal crea residentes de su domicilio; máximo configurable por el administrador.
- Teléfono del residente = medio de acceso por teléfono si está habilitado.
- Una cuenta con varios domicilios (B).
- Botones de la app por fraccionamiento, configurados por el super admin con constructor visual
  (opción A de layout + casilla "Ancho completo", opción B de impares). QR fuera por ahora.
- Enfoque 1 (mixto). Dos entregas: (1) residentes como usuarios; (2) servicios para la app y
  constructor de botones.

## 6. Decisiones mías (corregibles)

- Teléfono normalizado a 10 dígitos (México); se rechaza otro formato.
- Si el teléfono ya tiene cuenta, se vincula sin contraseña nueva; la contraseña existente no cambia.
- Quitar a un residente le quita ese domicilio; la cuenta se desactiva solo si no le queda ninguno.
- Administrador puede cambiar el principal y restablecer contraseñas; tesorero también da de alta.
- Máximo por omisión 5, rango 1–20; residentes sin cuenta no cuentan para el máximo.
- Auditoría de aperturas remotas en tabla propia.
- Botón deshabilitado si: moroso efectivo, fraccionamiento sin instalación o botón sin salida.
- Residentes no tienen fila en `perfiles` (aislamiento por omisión).

- Apertura: sin reintentos automáticos (una puerta que abre tarde es peor). Respuestas: 200 ok;
  409 "Tu domicilio tiene adeudos" (moroso); 422 botón sin salida/sin instalación; 429 si el residente
  excede 10 aperturas por minuto (límite propio) o access-core devuelve 429; 502 "No se pudo abrir,
  intenta de nuevo" si access-core falla. `aperturas_remotas` guarda resultado y código de error.
- Autenticación de `/api/app/*`: `Authorization: Bearer <access_token>`; el handler crea un cliente
  Supabase con ese token (RLS del residente aplica) y verifica pertenencia con
  `private.domicilios_del_residente()`; solo usa service-role para llamar a Auth admin y a
  access-core, después de validar. Nunca acepta un domicilio que no le pertenezca (404).
- Moroso efectivo = `perfil_deseado` con ajuste manual (misma lógica que access-core), expuesto por
  `estado_app_domicilio` (security definer, valida pertenencia). El PIN lo ven todos los residentes
  con cuenta del domicilio (el usuario pidió "su PIN" en el inicio).
- Datos existentes: no se migran cuentas. Residentes actuales quedan sin cuenta; el personal puede
  "Dar acceso a la app" capturando teléfono y contraseña. La normalización/unicidad del teléfono
  aplica solo a cuentas (`cuentas_residente.telefono`), no a `residentes.telefono` histórico.
- Vincular una cuenta existente sin contraseña: riesgo aceptado; lo hace personal (de confianza) o
  el principal de su propio domicilio, y solo da acceso a ESE domicilio. Sin verificación por SMS en
  esta fase (posible mejora con OTP más adelante).
- Altas y restablecimiento por el personal: Server Actions que validan rol (administrador/tesorero)
  y fraccionamiento del domicilio, y luego usan service-role (patrón de
  `src/features/usuarios/alta.ts`). Al restablecer, el personal captura la contraseña nueva.
- Si cambia la instalación del fraccionamiento, los `app_botones` conservan nombre/orden pero se
  limpia `salida_id` (quedan "sin salida" y deshabilitados hasta reasignar). Al abrir, si access-core
  responde 404 por la salida, se responde 422 y se registra.
- Quitar al residente de su último domicilio: la cuenta se desactiva (`activo=false`) y se banea en
  Auth (`ban_duration`) y se cierran sus sesiones; con más domicilios, RLS corta el acceso al quitado.
- Residentes no tienen política directa sobre `fraccionamientos`; obtienen nombre/marca solo vía
  `estado_app_domicilio` (nunca `instalacion_id` ni datos internos).
- Límite: cuenta residentes del domicilio con `user_id`; bajar el máximo no quita a nadie, solo
  impide nuevas altas.

## 7. Para el constructor

Nombres de columnas/rutas internas, catálogo de íconos (lucide, ~8 opciones), drag-and-drop
(dnd-kit si ya está o equivalente ligero), formato exacto de respuestas JSON, distribución de pruebas.
