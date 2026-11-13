# App móvil de residentes WEADMI — Diseño

Estado: aprobado (2026-11-14), con el ligado a dispositivo agregado por el usuario.

## 1. Intención

Primera versión de la app de residentes, solo para pruebas (no tiendas todavía): un residente
inicia sesión con su teléfono y contraseña, abre accesos a distancia, ve su PIN y estatus, consulta
su domicilio (cuotas, recibos, residentes), sus medios de acceso y administra su cuenta. El
residente principal agrega y quita residentes. El servidor ya existe (`/api/app/*`, RLS de
residentes; contrato en `docs/integraciones/api-app-movil.md`); este proyecto construye el cliente.

## 2. Metas, no metas, anti-metas

Metas
- App en `mobile/` del mismo repositorio (la web se queda en la raíz).
- Instalable para pruebas con Expo Go (QR) en iOS y Android; con un camino directo a tiendas después.
- Pantallas (bocetos aprobados): Login, Inicio, Inicio moroso, Domicilio, Accesos, Cuenta.
- Navegación inferior con íconos de línea + etiqueta corta: Inicio, Domicilio, Accesos, Cuenta.
- Marca WEADMI (`docs/marca/`): colores `#087BE8` primario, `#071F49` navy, fondo `#F5F8FC`,
  superficie `#FFFFFF`, borde `#E8EEF4`, texto `#172536`, secundario `#496985`; logo y fuentes de la marca.

No metas
- Publicación en tiendas, notificaciones push, QR de invitación, pagos con Stripe, modo oscuro.
- Edición de medios de acceso desde la app (solo lectura).

Anti-metas
- Nunca guardar la contraseña; la sesión vive en almacenamiento seguro del dispositivo.
- La app no debe mostrar datos que el servidor no le dé: toda regla (moroso, límites, permisos) la
  decide el servidor; la app solo refleja.

## 3. Enfoques

- **A (elegido): React Native + Expo** en `mobile/`. Nativa, pruebas con Expo Go sin tiendas, mismo
  código para publicar después, TypeScript como la web.
- B: PWA dentro de la web — descartado: mezcla app de residentes con la del personal y limita en iOS.
- C: PWA independiente (Vite) — descartado: mismas limitaciones y no llega a tiendas.
- Repositorio: se queda la web en la raíz y se agrega `mobile/` (mover la web a `web/` tocaría todas
  las rutas y mezclaría con mucho trabajo aún sin commit).

## 4. Diseño

Proyecto
- Expo (última SDK estable), Expo Router con pestañas, TypeScript estricto. Dependencias con versión
  exacta. Íconos `lucide-react-native` (mismo estilo que la web).
- Configuración por `mobile/.env` (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`,
  `EXPO_PUBLIC_API_URL`); la llave anónima es pública por diseño; nada secreto en la app.
- Sesión: `@supabase/supabase-js` con almacenamiento en `expo-secure-store`; login con
  `signInWithPassword({ email: '<10 dígitos>@auth.internal', password })` usando la misma
  normalización de teléfono que la web (copiar la función y sus pruebas). Renovación automática del
  token; si falla → pantalla de login.
- Cliente API: `fetch` con `Authorization: Bearer <access_token>`; mapea los errores `{ error }` del
  contrato a mensajes en pantalla.

Pantallas
- **Login:** logo, Teléfono (10 dígitos), Contraseña, "Entrar"; error "Teléfono o contraseña
  incorrectos".
- **Encabezado común:** "Hola, <nombre>" y domicilio; si hay más de uno, selector (se recuerda el último).
- **Inicio:** `GET /api/app/domicilios/{id}/estado`. Botones en 2 columnas (`ancho_completo` o último
  impar ⇒ ancho completo); botón deshabilitado en gris si `habilitado=false`. Al tocar: estado
  "Abriendo…", luego "Abierto ✓" (opened), "No se pudo abrir" (denied/failed/timeout) o el mensaje del
  servidor (409/422/429/502); vibración corta al abrir. Tarjeta PIN oculto (•••• con 👁 para mostrar)
  y estatus "Al corriente"/"Con adeudo". Moroso: aviso "Tu domicilio tiene adeudos. Los accesos
  remotos se reactivan al ponerte al corriente." Jalar para actualizar.
- **Domicilio:** cuotas (lectura directa con RLS de la vista de cuotas: periodo, importe, estatus),
  recibos (pagos con recibo; al tocar, pantalla de recibo que muestra el JSON del recibo con formato,
  y botón "Compartir PDF" que descarga el PDF por el endpoint nuevo y abre la hoja de compartir),
  residentes (`GET /api/app/domicilios/{id}/residentes`, "N de M"; el principal ve "+ Agregar
  residente" — nombre, teléfono, contraseña opcional si ya tiene cuenta — y "Quitar" con confirmación).
- **Accesos:** lectura directa (RLS) de tarjetas, controles, PIN (oculto), teléfonos. Solo lectura.
- **Cuenta:** mis domicilios, cambiar contraseña (`supabase.auth.updateUser`, mínimo 8 caracteres),
  acerca de (versión), cerrar sesión.

Servidor (cambio pequeño)
- `GET /api/app/pagos/{id}/recibo` (Bearer, residente; 404 si el pago no es de sus domicilios):
  devuelve el PDF de 58 mm reutilizando `generarReciboPdf`. Documentarlo en el contrato.

Pruebas
- `jest-expo` + React Native Testing Library para: normalización, cliente API (mapeo de errores),
  distribución de botones, estados del botón de apertura, Inicio moroso, gating del principal.
- Manual con Expo Go contra el stack local (README de `mobile/` explica usar la IP de la red local en
  las variables, porque el teléfono no ve `localhost`).

## 5. Decisiones del usuario

- App en carpeta `mobile/` (posible repo aparte después); web en la raíz.
- Solo para pruebas; Expo (A).
- Navegación con íconos + etiqueta.
- Pantallas según bocetos.

## 6. Decisiones mías (corregibles)

- Recibo: vista en pantalla + "Compartir PDF" vía endpoint nuevo.
- PIN oculto por omisión.
- Se recuerda el último domicilio elegido.
- Vibración al abrir; sin sonido.
- Sin modo offline: sin conexión se muestra "Sin conexión, intenta de nuevo".

- Cuotas y recibos se leen de las vistas `cuotas_info` y `pagos_info` (security_invoker, RLS de
  residente), usando `estatus_calculado` del servidor; la app no calcula estatus. La primera tarea
  verifica que el residente pueda leerlas (grants) y, si no, agrega una RPC de solo lectura. Se
  actualiza el contrato `api-app-movil.md` con las tablas/vistas legibles.
- `GET /api/app/pagos/{id}/recibo` usa el cliente con el token del residente (RLS) para leer el pago;
  si no es suyo o no tiene recibo ⇒ 404. En la lista, los pagos sin recibo aparecen sin "Ver".
  Compartir usa `expo-file-system` + `expo-sharing`.
- La tarjeta de estatus usa solo `moroso` de `/estado` (incluye el ajuste manual del administrador);
  la lista de cuotas muestra el estatus de cada cuota tal cual, aunque no coincida.
- 401 después de iniciar sesión (cuenta desactivada o sin acceso) ⇒ cerrar sesión y mostrar "Tu cuenta
  no tiene acceso a la app. Contacta a la administración." (distinto de contraseña incorrecta).
- Todas las consultas se filtran por el domicilio seleccionado.
- Fuentes Sora (títulos) e Inter (texto) con `@expo-google-fonts/sora` y `@expo-google-fonts/inter`.
- Pruebas locales: `next dev -H 0.0.0.0`, IP de la red en `mobile/.env`; usuario demo `3300000001` /
  `residente123` (ya existe en `demo-local.sql`).
- Alta por el principal: se muestra el texto de error del servidor tal cual; tras éxito, "Se vinculó la
  cuenta existente" si `cuentaCreada=false`, si no "Residente agregado".

## 6b. Cuenta ligada a un dispositivo (pedido del usuario al aprobar)

- Cada cuenta de residente queda ligada a un solo dispositivo. Si cambia de teléfono, el
  administrador la desliga desde la web y el siguiente dispositivo que entre queda ligado.
- Identificador: al instalar, la app genera un UUID aleatorio y lo guarda en `expo-secure-store`
  (iOS no da un id de hardware estable; reinstalar la app cuenta como dispositivo nuevo y requiere
  desligar). Se manda en cada llamada como header `X-Device-Id`.
- Servidor: tabla `dispositivos_residente(user_id pk → cuentas_residente, device_id text, nombre text
  null (modelo, p. ej. "iPhone 15"), ligado_en timestamptz)`. El primer `/api/app/*` sin dispositivo
  ligado lo liga; con otro `device_id` ⇒ 403 `{ error: 'Esta cuenta está ligada a otro dispositivo.
  Pide a la administración que la desligue.', codigo: 'otro_dispositivo' }`. Falta el header ⇒ 400.
- La app, al recibir `otro_dispositivo` justo después del login, cierra la sesión y muestra ese mensaje.
- Alcance de la protección: se aplica a todos los endpoints `/api/app/*` (aperturas, estado, residentes,
  recibo). Las lecturas directas con RLS (cuotas, accesos) no pueden verificar el dispositivo; por eso
  la app obtiene el estado y abre puertas siempre por la API, y la pantalla de inicio no carga si el
  dispositivo no está ligado. Riesgo aceptado: otra instalación podría leer datos propios de la cuenta
  vía RLS, pero no abrir accesos ni gestionar residentes.
- Web (detalle del domicilio, residentes con cuenta): insignia "Dispositivo: iPhone 15 · ligado el …"
  o "Sin dispositivo", y acción "Desligar dispositivo" (confirmación) para administrador. Al desligar
  se borra la fila. Un administrador puede desligar si la cuenta tiene algún domicilio en su
  fraccionamiento (validación con su cliente RLS, luego service-role).
- Cambiar de dispositivo no cambia la contraseña ni la cuenta.

## 7. Para el constructor

Versión exacta de la SDK, estructura interna de carpetas, librería de fuentes, estilos (StyleSheet o
equivalente), textos secundarios.
