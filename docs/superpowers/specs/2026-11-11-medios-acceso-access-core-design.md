# Medios de acceso e integración con access-core-cloud: diseño

Fecha: 2026-11-11 · Estado: aprobado (2026-11-11) · Proyecto 1 de 3 (le siguen "Reglas de cobro y morosidad por fraccionamiento" y "Cambio automático de permiso en access-core").

## Objetivo

WEADMI pasa a ser el frente de captura del control de acceso. Hoy la app guarda dos medios (teléfonos "vehiculares" y tarjetas "peatonales") y los reportes de acceso existían para exportarlos a mano a los controladores ZKTeco/Eldesgate. Con la plataforma access-core-cloud esa carga manual desaparece: todo lo que se capture aquí se crea en la instalación del fraccionamiento mediante su API.

**Éxito:**

- Cinco medios de acceso: tarjeta, control RF, PIN por domicilio, teléfono y código QR. Teléfono y QR quedan preparados en el modelo, pero no se sincronizan porque access-core aún no los soporta.
- El super admin elige qué medios puede usar cada fraccionamiento, vincula cada fraccionamiento con una instalación de access-core elegida de la lista que da la API (una instalación, un fraccionamiento) y configura qué salida abre cada botón de los controles.
- Cada tipo de cuota define qué medios tienen sus domicilios (entre los habilitados) y a qué permisos de access-core se ligan: uno "al corriente" y uno "moroso".
- Cada domicilio, tarjeta y control creado, editado o borrado aquí se refleja en access-core. Si la API falla, el dato se guarda aquí marcado "pendiente de sincronizar" y se reintenta solo.
- Cada domicilio queda en el permiso "al corriente" o "moroso" de su tipo de cuota según el criterio de morosidad actual (cualquier cuota vencida sin pagar), reevaluado al pagar y cada día.
- El PIN se fija o se genera a través de la API y se guarda aquí para consultarlo.
- La llave de la API es una sola para toda la plataforma y vive en el servidor.

## No objetivos y anti-objetivos

- **Fuera de alcance (proyectos 2 y 3):** que cada fraccionamiento elija su criterio de morosidad y su calendario de cobro. Este proyecto aplica el criterio actual en un solo lugar (§4.7) para que el proyecto 2 solo tenga que cambiar ese cálculo.
- **Fuera de alcance:** sincronizar teléfonos y códigos QR (access-core no los tiene); mandar residentes a access-core como titulares "persona"; configurar reglas de los permisos, paneles o salidas en access-core; apertura remota y lectura de logs; app móvil para residentes; adoptar datos que ya existan en una instalación (se asume que llega limpia; ver §4.1).
- **Anti-objetivos:**
  - Que una falla de access-core impida guardar un dato aquí (salvo fijar, generar o quitar el PIN desde el detalle, §4.5).
  - Que la llave de la API llegue al navegador o a una tabla que lea un fraccionamiento.
  - Que un domicilio de un fraccionamiento acabe en la instalación de otro.
  - Que un reintento duplique titulares, tarjetas o controles en access-core.
  - Que un domicilio que pierde un medio conserve credenciales activas en access-core.

## Decisiones del usuario (2026-11-11)

- Orden de los tres proyectos: medios e integración → reglas de cobro y morosidad → cambio automático de permiso.
- Falla de la API: guardar aquí con estado "pendiente de sincronizar" y reintentar solo.
- PIN: se puede fijar (4 a 6 dígitos; access-core valida que no se repita) o generar con la API; se guarda aquí porque el administrador lo consultará para entregarlo y una app móvil futura lo mostrará al domicilio.
- Los reportes de acceso vehicular y peatonal desaparecen; su función la cubre la sincronización.
- Llave de la API en variable de entorno del servidor.
- Enfoque A (abajo).
- Tras la revisión del constructor:
  - **Botones de los controles:** el super admin configura por fraccionamiento la salida que abre cada botón; la app la manda siempre (opción b).
  - **Morosidad desde ahora:** se adelanta la regla mínima (criterio actual) para que los morosos reciban el permiso "moroso" desde este proyecto.
  - **Instalaciones limpias:** se asume que una instalación llega vacía; no se adoptan datos previos.
  - **Perder un medio:** los registros se conservan en la app pero se ocultan en el detalle del domicilio; se borran de access-core y se vuelven a registrar si el medio regresa. La restricción de uso se apoya además en el permiso de access-core.

## Enfoques considerados

- **A. Cola en la base, lógica en la app (elegido).** Las Server Actions guardan el dato y una tarea de sincronización, y enseguida intentan procesarla con un cliente TypeScript de la API. Los reintentos los dispara una ruta protegida que llama el cron del hosting. Mismo lenguaje, mismas pruebas, llave en el entorno.
- **B. Todo en Postgres** con `pg_net` y `pg_cron` y la llave en Vault: lógica en SQL, difícil de probar en local, errores de la API a ciegas, llave en la base.
- **C. Edge Function de Supabase** como trabajador: otro runtime y otro despliegue; la app ya no usa Edge Functions.

## Diseño

### 1. Cliente de la API (`src/lib/access-core/`)

- `server-only`. Lee `ACCESS_CORE_API_URL` (por defecto `https://access-core-cloud.vercel.app/api/v1`) y `ACCESS_CORE_API_KEY` al momento de usarlas, nunca al cargar el módulo. Sin llave, cada llamada lanza `AccessCoreNoConfigurado`; la interfaz lo muestra como "access-core no está configurado" y las tareas se quedan pendientes.
- Un módulo por recurso, con tipos derivados de `docs/integraciones/access-core-openapi.json`: `instalaciones` (listar, obtener, listar paneles, listar salidas), `perfiles` (listar, asignar titulares), `titulares` (crear, editar, borrar, fijar PIN, generar PIN, quitar PIN), `tarjetas` (crear, editar, borrar) y `controles` (crear, reemplazar, borrar).
- `AccessCoreError { status, code, message, retryAfter? }` con el `message` en español de la API. Reintentable: errores de red, 429, 500 y 502. No reintentable: 400, 401, 404, 409, 422.
- Cada escritura encolada manda `Idempotency-Key` igual al id de la tarea (uuid), así un reintento tras un timeout no duplica nada. Las operaciones de PIN no la mandan (la API la rechaza).
- Timeout de 10 s por llamada.

### 2. Base de datos (migración nueva)

**Catálogo de medios.** Enum `public.medio_acceso` con `tarjeta`, `control`, `pin`, `telefono` y `qr`. Etiquetas y estado en `src/lib/constants.ts`:

| Medio | Captura | Sincroniza con access-core | Lo puede habilitar el super admin |
|---|---|---|---|
| tarjeta | sí (como hoy) | sí | sí |
| control | nueva | sí | sí |
| pin | nueva | sí | sí |
| telefono | sí (como hoy) | no, "se sincronizará cuando access-core lo soporte" | sí (mi decisión: hoy ya se captura y funciona) |
| qr | no | no | no, aparece como "Próximamente" |

**`fraccionamiento_medios`** (`fraccionamiento_id`, `medio medio_acceso`, único por pareja). Solo el super admin inserta y borra; los usuarios del fraccionamiento la leen. Un trigger `before delete` lo impide si algún tipo de cuota del fraccionamiento usa el medio (`23503`, "Hay tipos de cuota que usan este medio").

**`fraccionamiento_botones`** (`fraccionamiento_id`, `boton int` 0..3, `panel_id uuid`, `panel_codigo text`, `salida int` 0..3, `salida_alias text`; único por `(fraccionamiento_id, boton)`). Qué salida abre cada botón de todos los controles del fraccionamiento (mi decisión: una sola salida por botón; la API admite varias, pero no hace falta hoy). Solo el super admin escribe; los usuarios del fraccionamiento leen.

**`fraccionamientos`:** se agrega `instalacion_nombre text` (copia del nombre que da la API, para mostrarlo sin consultar).

**`concepto_pago_acceso`:** se quitan `acceso_telefono` y `acceso_tarjeta`; se agregan `medios medio_acceso[] not null default '{}'`, `perfil_corriente_id uuid`, `perfil_corriente_nombre text`, `perfil_moroso_id uuid` y `perfil_moroso_nombre text`. Migración de datos: `acceso_tarjeta` → `tarjeta`, `acceso_telefono` → `telefono`, y para cada fraccionamiento con algún tipo de cuota que use un medio se insertan esas filas en `fraccionamiento_medios`. Un trigger `before insert or update` rechaza (`23514`) un medio que el fraccionamiento no tenga habilitado; el trigger de `fraccionamiento_medios` cubre el borrado.

**`domicilios`:** se agregan `titular_id uuid` (id del titular en access-core, nulo mientras no se sincroniza) y `perfil_asignado_id uuid` (el último permiso que se asignó con éxito en access-core).

**`tarjetas_acceso`:** se agregan `tarjeta_id uuid` y `descripcion text`. `numero` sigue siendo texto de dígitos y **no se edita después de crearla** (la API no permite cambiar `card_code`; para cambiar el número se borra y se crea otra). Se agrega un `check` de que cabe en 32 bits (`numero::numeric <= 4294967295`).

**`controles_acceso`** (nueva, mismo patrón que `tarjetas_acceso`): `id`, `created_at`, `fraccionamiento_id`, `domicilio_id` (FK compuesta), `control_id uuid`, `descripcion text`, `botones jsonb not null` con `[{ boton: 0..3, rf_code: entero decimal 32 bits, boton_id: uuid|null }]`, de 1 a 4 elementos con `boton` distinto; un `check` valida la forma.

**`pines_acceso`** (nueva): `domicilio_id` (único, FK compuesta), `fraccionamiento_id`, `pin text` (`^\d{4,6}$`), `actualizado_at`. Políticas: solo `administrador`, `tesorero` y super admin la leen y escriben; `comite` y `vigilancia` no la ven. Es una tabla aparte y no una columna de `domicilios` precisamente para poder restringirla por rol con RLS.

**`sincronizaciones_acceso`** (nueva, la cola):

| Columna | Detalle |
|---|---|
| `id uuid` | `gen_random_uuid()`; también es la `Idempotency-Key` |
| `fraccionamiento_id` | FK |
| `domicilio_id bigint` | nulo en tareas que no son de un domicilio; sin FK, para sobrevivir al borrado |
| `entidad text` | `domicilio`, `tarjeta`, `control`, `pin` |
| `entidad_id bigint` | id local; nulo en `pin` (va por domicilio) |
| `operacion text` | `crear`, `actualizar`, `borrar`, `asignar` (permiso del domicilio), `reconciliar` (medios del domicilio), `fijar`, `quitar` (solo `pin`) |
| `carga jsonb` | lo que se manda y los ids externos necesarios (p. ej. `titular_id` para borrar). **Nunca contiene el PIN**; el trabajador lo lee de `pines_acceso` al procesar |
| `estado text` | `pendiente`, `ok`, `error`; `check` |
| `intentos int`, `ultimo_error text`, `proximo_intento_at timestamptz`, `created_at`, `updated_at` | |

Políticas: los usuarios del fraccionamiento y el super admin leen; `authenticated` con fraccionamiento y el super admin insertan; solo `service_role` actualiza y borra (el trabajador usa `createAdminClient()`). Índice en `(fraccionamiento_id, estado, proximo_intento_at)`.

**Funciones:**

- `public.perfil_deseado(domicilio_id) returns uuid` (`stable`, `security invoker`): `perfil_moroso_id` si el domicilio es moroso, si no `perfil_corriente_id`, del tipo de cuota del domicilio; nulo si no tiene tipo o el tipo no tiene permiso. **Moroso** = existe una cuota del domicilio con `estatus_id = 3` (el mismo criterio de `domicilios_info.estatus`). El proyecto 2 solo cambia esta función.
- `public.recalcular_permisos_acceso(p_fraccionamiento_id bigint default null)` (`security definer`, `search_path = ''`): para cada domicilio sincronizado (`titular_id` no nulo) cuyo `perfil_deseado` difiere de `perfil_asignado_id` y que no tenga ya una tarea `asignar` pendiente, inserta una tarea `asignar`. Con nulo recorre todos los fraccionamientos (solo la llama el cron); con id, solo ese, y exige que sea el fraccionamiento del usuario o que sea super admin (42501). `grant execute` a `authenticated` y `service_role`.
- El cron `marcar-cuotas-vencidas` llama después a `recalcular_permisos_acceso()`.

**Vistas:** `domicilios_info` cambia `acceso_telefono`/`acceso_tarjeta` por `medios medio_acceso[]` (del tipo de cuota, `'{}'` si no tiene). Se eliminan `accesos_telefono_info`, `accesos_tarjeta_info` y `reporte_accesos_admin`. Las políticas del super admin sobre `controles_acceso` son las mismas que sobre `tarjetas_acceso`; sobre `pines_acceso`, completas; sobre `concepto_pago_acceso`, solo lectura (como hoy).

**pgTAP:** la matriz de `040` suma las tablas nuevas; pruebas de los dos triggers; `pines_acceso` invisible para comité y vigilancia; `sincronizaciones_acceso` no actualizable por `authenticated`; `domicilios_info.medios`; `perfil_deseado` con y sin cuota vencida; `recalcular_permisos_acceso` inserta una sola tarea por domicilio desfasado y 42501 para otro fraccionamiento; las pruebas de `reporte_accesos_admin` y de las vistas de accesos se eliminan.

### 3. Cola y trabajador (`src/features/sincronizacion/`)

- **Encolar** (`encolar(supabase, tarea)`): lo llaman las mutaciones de domicilios, tarjetas y controles, en la misma Server Action que guarda el dato, solo si el fraccionamiento tiene `instalacion_id`. Sin instalación no se encola nada; al vincularla después se encola todo (ver §4.1).
- **Procesar** (`procesarSincronizaciones({ fraccionamientoId?, limite = 50 })`): con `createAdminClient()`.
  - Toma por fraccionamiento las tareas `pendiente` con `proximo_intento_at <= now()`, en orden de `created_at`, y antes toma un lease del fraccionamiento (`sincronizacion_leases`, con `adquirir_sincronizacion(fid, token)` y `liberar_sincronizacion(fid, token)`, solo `service_role`; vence a los 5 min y se renueva cada 10 tareas) para que no corran dos trabajadores a la vez sobre la misma instalación. Un advisory lock de transacción no sirve: cada RPC de PostgREST es su propia transacción. Si otro trabajador tiene el lease, el fraccionamiento se omite.
  - **Orden por domicilio:** una tarea con `domicilio_id` se salta (sin contar intento) mientras la tarea `domicilio crear` de ese domicilio no esté en `ok`. Ninguna otra tarea bloquea a las demás: una tarjeta repetida en `error` no detiene al resto del domicilio.
  - Al terminar bien: guarda el id externo en la fila local (`titular_id`, `tarjeta_id`, `control_id`, `boton_id` de cada botón, `perfil_asignado_id`) y marca `ok`.
  - Al fallar: `intentos + 1`, `ultimo_error` con el mensaje de la API. Si es reintentable, `proximo_intento_at` = ahora + 1 min, 5 min, 15 min, 1 h y luego cada 6 h; tras 20 intentos pasa a `error`. Si no es reintentable, pasa a `error` de inmediato. Con 429 se detiene la corrida y respeta `Retry-After`.
  - "Reintentar" en la interfaz pone la tarea en `pendiente` con `intentos = 0`.
- **Operaciones:**
  - `domicilio crear | actualizar | borrar`: titular `kind: 'domicilio'`. Borrar: primero borra en access-core las tarjetas y los controles con id externo y luego el titular (el borrado del titular es lógico y no se asume que arrastre sus credenciales).
  - `tarjeta crear | actualizar | borrar` y `control crear | actualizar | borrar`: `holder_id` se resuelve al procesar desde `domicilios.titular_id`. `control crear` manda, por cada botón, `rf_code` y `outputs: { [panel_id]: salida }` según `fraccionamiento_botones`; `control actualizar` es `PUT` con los `boton_id` conocidos.
  - `domicilio asignar`: el trabajador lee los perfiles de la instalación (incluyen `holder_ids`), agrega el titular al `perfil_deseado` actual (lo recalcula al procesar, por si cambió) y lo quita de cualquier otro perfil donde aparezca, con un `PUT …/holders` por perfil tocado; luego guarda `perfil_asignado_id`. Si el deseado es nulo, solo lo quita de donde esté. Es leer-modificar-escribir sobre listas completas; el bloqueo por fraccionamiento evita pisarse entre tareas nuestras, no contra cambios simultáneos en el software de access-core (ventana de milisegundos, aceptada).
  - `domicilio reconciliar`: compara los medios del tipo de cuota del domicilio con lo que hay en access-core: tarjetas y controles sin id externo de un medio permitido → crear; con id externo de un medio ya no permitido → borrar en access-core y poner el id externo en nulo (la fila local se conserva); PIN guardado y medio `pin` permitido y titular sin PIN → fijar el guardado; medio `pin` no permitido y titular con PIN → quitar en access-core (el local se conserva).
  - `pin fijar | quitar`: solo las genera `reconciliar` (desde el detalle son síncronas, §4.5).
- **Quién lo dispara:**
  1. La propia acción, justo después de guardar, con `after()` de `next/server`, para ese fraccionamiento.
  2. `POST /api/sincronizacion/procesar` con `Authorization: Bearer <CRON_SECRET>`, para todos los fraccionamientos, que llamará el cron del hosting (en Vercel, `vercel.json`; se decide al desplegar).
  3. El botón "Procesar ahora" de la pantalla de sincronización (acción de servidor, roles administrador y tesorero; en la consola, el super admin).

### 4. Flujos

#### 4.1 Fraccionamiento (consola del super admin)

- El diálogo de fraccionamiento cambia el campo de texto `instalacionId` por un `Select` con las instalaciones de la API que no estén ya vinculadas a otro fraccionamiento, más "Sin instalación". Si la API no responde, el campo se deshabilita con el aviso "No se pudo consultar access-core" y conserva el valor actual.
- Se guarda `instalacion_id` e `instalacion_nombre`.
- **Vincular** una instalación a un fraccionamiento con domicilios encola, por cada domicilio y en este orden, `domicilio crear`, `domicilio reconciliar` y `domicilio asignar`. Se asume que la instalación está vacía; si access-core responde 409 porque algo ya existe, la tarea queda en `error` con ese mensaje y se resuelve a mano.
- **Cambiar o quitar** la instalación solo se permite si ningún domicilio tiene `titular_id` (mensaje: "Este fraccionamiento ya tiene domicilios sincronizados con su instalación"). Mover una instalación entre fraccionamientos queda fuera de alcance.
- Pestaña **Accesos** del detalle (sustituye a los reportes), con tres bloques:
  - **Medios habilitados:** casillas de los medios (QR deshabilitada con "Próximamente"), guardadas con una acción `runSuperAdminAction`.
  - **Botones de los controles:** cuatro filas (Botón 1 a 4), cada una con un `Select` de las salidas de la instalación (`GET …/outputs`, etiqueta "`panel_code` · `alias`") o "Ninguna". Sin instalación o sin respuesta de la API, deshabilitado con aviso. Al cambiar una salida se encola `control actualizar` para cada control del fraccionamiento que use ese botón.
  - **Sincronización:** el panel de §4.6.

#### 4.2 Tipo de cuota (Configuración del fraccionamiento)

- El diálogo cambia las dos casillas por una por cada medio habilitado en el fraccionamiento (si no hay ninguno: "El super admin aún no habilita medios de acceso para este fraccionamiento").
- Dos `Select`, "Permiso al corriente" y "Permiso moroso", con los perfiles de la instalación (`GET …/profiles`), opcionales. Sin instalación o sin respuesta de la API, se deshabilitan con un aviso. Se guardan id y nombre.
- Al guardar: si cambiaron los medios, encola `domicilio reconciliar` para cada domicilio del tipo; si cambió algún permiso, llama a `recalcular_permisos_acceso(fid)`.

#### 4.3 Domicilio (fraccionamiento y consola)

- Crear: tras insertar `domicilios` y `domicilio_concepto`, encola `domicilio crear` con `{ kind: 'domicilio', name: dirección, address: dirección, notes: observaciones }` y luego `domicilio asignar`.
- Editar dirección u observaciones: `domicilio actualizar`. Cambiar el tipo de cuota (solo el fraccionamiento): `domicilio reconciliar` y `domicilio asignar`. Si el cambio quita medios con registros, el diálogo avisa antes: "Se ocultarán 2 tarjetas y 1 control y se darán de baja en access-core".
- Borrar (solo el fraccionamiento): `domicilio borrar` con `carga = { titular_id, tarjetas: [tarjeta_id…], controles: [control_id…] }`. Aquí el `on delete cascade` borra las filas locales, y las demás tareas pendientes de ese domicilio se marcan `ok` con `ultimo_error = 'El domicilio se borró'`.
- Registrar un pago de cuota (o eliminarlo, si existe esa acción) llama a `recalcular_permisos_acceso(fid)` al terminar.

#### 4.4 Tarjetas y controles (detalle del domicilio)

- `AccesosSection` muestra una tarjeta por cada medio del tipo de cuota del domicilio (`domicilios_info.medios`); si el domicilio no tiene tipo de cuota, muestra el aviso "Asigna un tipo de cuota para habilitar los medios de acceso". Los registros de medios que el domicilio no tiene **no se muestran** (se conservan en la base y se ocultan).
- **Tarjetas:** máximo 3, como hoy, con `descripcion` opcional. Al crear se captura el número; al editar solo la descripción (el número se muestra fijo). Crear, editar y borrar encolan su tarea (`card_code = Number(numero)`).
- **Controles:** máximo 2 por domicilio (mi decisión; `LIMITES.CONTROLES`). Diálogo con descripción opcional y de 1 a 4 botones, cada uno con su código RF (dígitos, 32 bits). Solo se ofrecen los botones que tienen salida configurada en `fraccionamiento_botones`; sin ninguna, el botón "Agregar control" se deshabilita con "El super admin debe configurar las salidas de los botones". Editar reemplaza el control (`PUT`).
- **Teléfonos:** como hoy (máximo 2), sin tarea; la tarjeta muestra "Se sincronizará cuando access-core lo soporte".
- Cada elemento sincronizable muestra su estado: "Sincronizado", "Pendiente" o "Error" (con el `ultimo_error` como tooltip y botón "Reintentar"). El estado sale de la última tarea de esa entidad.
- El encabezado de la sección muestra el permiso actual del domicilio ("Permiso: Residentes" o "Permiso: Morosos", por `perfil_asignado_id`, y "Pendiente" si difiere del deseado).

#### 4.5 PIN (detalle del domicilio)

- Tarjeta "PIN" cuando el tipo de cuota incluye `pin`. Para `administrador`, `tesorero` y super admin muestra el PIN; para `comite` y `vigilancia`, solo "Asignado" / "Sin PIN".
- Acciones: **Fijar** (campo de 4 a 6 dígitos), **Generar** y **Quitar**. Las tres son **síncronas**: llaman a la API en el momento y, si responde bien, guardan en `pines_acceso` (el PIN fijado, o el que devolvió `generate: true`) o borran la fila. Si la API falla, la acción devuelve el mensaje (por ejemplo, el `conflict` de un PIN repetido, o "access-core no respondió, inténtalo más tarde") y no cambia nada aquí. No pasan por la cola porque el valor generado tiene que volver y un repetido debe rechazarse al instante (decisión de diseño).
- Los botones se deshabilitan con "El domicilio aún no está sincronizado" mientras `titular_id` sea nulo.

#### 4.6 Pantalla de sincronización

- Página `/accesos` del fraccionamiento (menú "Accesos", icono `KeyRound`, roles `administrador` y `tesorero`) y el mismo componente en la pestaña Accesos de la consola.
- Resumen (pendientes, con error, última sincronización correcta), tabla de tareas no `ok` con domicilio, entidad, operación, intentos, error y botón "Reintentar", y el botón "Procesar ahora". Si el fraccionamiento no tiene instalación: estado vacío "Pide al super admin vincular la instalación de access-core".
- `/reportes` pierde las pestañas vehicular y peatonal y queda solo "Pagos por usuario"; se eliminan sus componentes, queries y pruebas.

#### 4.7 Morosidad mínima (adelanto del proyecto 3)

- El criterio vive solo en `perfil_deseado` (§2): moroso = alguna cuota vencida sin pagar, igual que `domicilios_info.estatus` hoy.
- Se reevalúa en cuatro momentos: al crear el domicilio, al registrar (o eliminar) un pago de cuota, al cambiar el tipo de cuota o los permisos del tipo, y cada día tras `marcar_cuotas_vencidas`. Siempre por la misma vía: `recalcular_permisos_acceso` → tarea `asignar`.
- El proyecto 2 cambiará el criterio dentro de `perfil_deseado`; el proyecto 3 queda reducido a lo que falte (por ejemplo, avisos).

### 5. Configuración y despliegue

- `.env.example`: `ACCESS_CORE_API_URL`, `ACCESS_CORE_API_KEY` (solo servidor, nunca `NEXT_PUBLIC_`) y `CRON_SECRET`.
- `README.md`: cómo obtener la llave, y que el cron del hosting debe llamar a `POST /api/sincronizacion/procesar` cada 5 minutos.
- `docs/integraciones/`: se agrega una nota con el mapeo WEADMI ↔ access-core (domicilio = titular `domicilio`, tarjeta = card, control = control, tipo de cuota = dos perfiles, botón = salida por fraccionamiento).

### 6. Pruebas de la app

- Cliente: construye URL, cabeceras y `Idempotency-Key`; convierte `{code, message}` en `AccessCoreError`; clasifica reintentables; sin llave lanza `AccessCoreNoConfigurado`. `fetch` simulado, sin red.
- Trabajador: una tarjeta espera a su `domicilio crear` y una tarjeta en `error` no bloquea a otra; guarda ids externos; aplica la escalera de reintentos; pasa a `error` en 400/409 y tras 20 intentos; se detiene con 429 y respeta `Retry-After`; `asignar` agrega al perfil deseado y quita de los demás; `reconciliar` crea lo que falta, borra lo que sobra y conserva las filas locales; `borrar` de domicilio borra tarjetas y controles antes que el titular; `control crear` manda `outputs` según `fraccionamiento_botones`.
- Acciones: cada mutación encola la tarea correcta solo cuando hay instalación; vincular una instalación encola crear, reconciliar y asignar por domicilio; cambiar o quitar instalación con domicilios sincronizados devuelve el mensaje; las acciones de PIN llaman a la API y guardan o no según la respuesta; registrar un pago llama a `recalcular_permisos_acceso`; un administrador no puede cambiar `fraccionamiento_medios` ni `fraccionamiento_botones` (`MSG_NO_PERMISO`).
- Interfaz: el diálogo de tipo de cuota muestra solo los medios habilitados; `AccesosSection` muestra una tarjeta por medio, oculta los registros de medios no permitidos y muestra el aviso sin tipo de cuota; el número de tarjeta no se edita; sin salidas configuradas no se pueden agregar controles; comité no ve el PIN; la tabla de sincronización muestra el error y "Reintentar"; `/reportes` sin pestañas de acceso; la ruta de procesar responde 401 sin el secreto.

## Lo que decide quien construye

- Nombres exactos de archivos y componentes dentro de `src/features/sincronizacion/` y `src/lib/access-core/`.
- Si el estado de sincronización por elemento se calcula con una consulta por página o con una vista `sincronizacion_estado_info`.
- Cómo validar la forma de `botones` (check con `jsonb_typeof`/`jsonb_array_length` o trigger).
- Si para desarrollo local se apunta `ACCESS_CORE_API_URL` a un servidor de pruebas o se agrega un mock pequeño; las pruebas nunca requieren red.
