# API de la app móvil de residentes

Contrato para quien desarrolla la app móvil. El backend es Supabase (Auth + RLS) más un conjunto de rutas HTTP de la app web (`/api/app/...`) para las operaciones que requieren privilegios de servidor (abrir accesos, administrar residentes, estado de inicio).

Variables que la app necesita: `SUPABASE_URL` y la clave pública (anon). Nunca incluyas la clave service-role ni la de access-core en la app. `API_URL` es el origen de la app web (por ejemplo `https://app.ejemplo.com`).

## 1. Inicio de sesión

Los residentes inician con su teléfono de 10 dígitos y su contraseña. El correo es sintético: `<10 dígitos>@auth.internal`.

```ts
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

const { data, error } = await supabase.auth.signInWithPassword({
  email: '3300000001@auth.internal',
  password: 'contraseña',
})
// data.session.access_token  -> JWT para las rutas /api/app/*
// data.session.refresh_token -> para renovar la sesión
```

- Credenciales incorrectas: `error` con `status 400` (`Invalid login credentials`). Muestra un mensaje genérico en español.
- Una cuenta puede existir pero estar desactivada o no ser de residente: el inicio de sesión funciona, pero toda ruta `/api/app/*` responde `401`. Trátalo como "sin acceso" y cierra sesión.

### Renovación del token

El `access_token` caduca (1 hora por defecto). El SDK lo renueva solo con `autoRefreshToken: true` (predeterminado). Si usas HTTP directo:

```
POST {SUPABASE_URL}/auth/v1/token?grant_type=refresh_token
apikey: <anon key>
Content-Type: application/json

{ "refresh_token": "<refresh_token>" }
```

Responde con una sesión nueva (guarda el nuevo `refresh_token`, el anterior deja de servir). Antes de cada llamada a `/api/app/*` usa `(await supabase.auth.getSession()).data.session?.access_token`. Si una ruta responde `401`, intenta `refreshSession()` una vez; si vuelve a fallar, pide iniciar sesión.

## 2. Convenciones de las rutas `/api/app`

- Cabeceras obligatorias: `Authorization: Bearer <access_token>` y `X-Device-Id: <uuid>` (8–100 caracteres; UUID generado una vez al instalar y guardado en `expo-secure-store`). Opcional: `X-Device-Name` (p. ej. `iPhone 15`, se guarda recortado a 80 al ligar). Los cuerpos son JSON (`Content-Type: application/json`).
- Dispositivo ligado: cada cuenta queda ligada a un solo dispositivo. La primera llamada `/api/app/*` sin dispositivo ligado liga el `X-Device-Id` recibido; con otro id toda ruta responde `403 { "error": "Esta cuenta está ligada a otro dispositivo. Pide a la administración que la desligue.", "codigo": "otro_dispositivo" }`. Al recibirlo justo después del login, cierra la sesión y muestra ese mensaje. Para cambiar de teléfono (o tras reinstalar) la administración desliga la cuenta desde la web.
- `400 { "error": "Falta el header X-Device-Id" }`: falta `X-Device-Id` o su longitud es inválida (con un `Authorization` bien formado).
- Los errores tienen la forma `{ "error": "<mensaje en español>" }`; el mensaje se puede mostrar al usuario.
- `401 { "error": "No autorizado" }`: falta el header, token inválido o expirado, o el usuario no tiene cuenta de residente activa.
- `404`: el domicilio (o recurso) no existe **o no pertenece al residente**; son indistinguibles a propósito. Los ids no numéricos también dan 404.
- `500`: error inesperado; se puede reintentar.
- Todas las rutas siguientes pueden responder además `400` y `403 otro_dispositivo` como arriba.

## 3. Endpoints

### GET `/api/app/yo`

Cuenta del residente y sus domicilios (puede tener varios).

- 200:
```json
{
  "telefono": "3300000001",
  "domicilios": [
    { "id": 12, "direccion": "Calle Demo 1", "fraccionamiento": "Fracc Demo", "es_principal": true, "nombre": "Residente Demo" }
  ]
}
```
- 401 `No autorizado`; 500 `No se pudo cargar la cuenta`.

`es_principal` indica si puede administrar residentes de ese domicilio. `nombre` es el nombre del residente registrado en ese domicilio (úsalo para el saludo).

### GET `/api/app/domicilios/{id}/estado`

Pantalla de inicio de un domicilio: datos, PIN, estado de adeudo y botones.

- 200:
```json
{
  "domicilio": { "id": 12, "direccion": "Calle Demo 1" },
  "fraccionamiento": { "nombre": "Fracc Demo" },
  "moroso": false,
  "pin": "483920",
  "botones": [
    { "id": 1, "orden": 1, "nombre": "Puerta principal", "icono": "puerta", "ancho_completo": true, "estilo": "azul_claro", "habilitado": true }
  ]
}
```
- `pin`: texto o `null` si el domicilio no tiene PIN.
- `botones` ordenados por `orden` (1 a 8, como máximo 8).
- `icono` es uno de: `puerta`, `pluma`, `peatonal`, `vehiculo`, `alberca`, `gimnasio`, `salon`, `otro` (usa un icono genérico si llega un valor desconocido).
- `estilo` es uno de: `azul`, `azul_claro`, `navy`, `turquesa` (por omisión `azul_claro`; si falta o es desconocido, usa `azul_claro`). Un botón deshabilitado se pinta gris sin importar el estilo.
- Errores: 401 `No autorizado`; 404 `Domicilio no encontrado`; 500 `No se pudo cargar el estado`.

### POST `/api/app/domicilios/{id}/aperturas`

Abre una salida (puerta, pluma...) del fraccionamiento a nombre del titular del domicilio.

- Cuerpo: `{ "botonId": 1 }` (entero positivo, el `id` de un botón de `estado`).
- 200 `{ "status": "opened" | "denied" | "failed" | "timeout" }`. El estado es el resultado del panel de acceso: `opened` se abrió; `denied` el panel rechazó; `failed` falló en el panel; `timeout` el panel no respondió. Muestra un mensaje distinto para cada uno.
- Errores:

| Código | Mensaje | Cuándo |
|---|---|---|
| 400 | `Solicitud inválida` | `botonId` ausente o no es entero positivo |
| 401 | `No autorizado` | sesión inválida |
| 404 | `Domicilio no encontrado` | domicilio ajeno o inexistente |
| 404 | `Botón no encontrado` | el botón no es de ese fraccionamiento |
| 409 | `Tu domicilio tiene adeudos` | domicilio moroso |
| 422 | `Este acceso no está disponible` | botón sin salida, fraccionamiento sin instalación, domicilio sin titular, o salida inexistente en el panel |
| 429 | `Demasiados intentos, espera un momento` | más de 10 aperturas del usuario en 60 s, o límite del panel |
| 502 | `No se pudo abrir, intenta de nuevo` | falla de comunicación con el panel |
| 500 | `No se pudo abrir, intenta de nuevo` | error interno |

No hay reintentos automáticos: deshabilita el botón mientras la petición está en curso y no reintentes solo; cada toque del usuario es una apertura distinta. Todas las peticiones (también las rechazadas) quedan auditadas.

### GET `/api/app/domicilios/{id}/residentes`

Residentes del domicilio. Lo puede llamar cualquier residente del domicilio.

- 200:
```json
[
  { "id": 5, "nombre": "Residente Demo", "telefono": "3300000001", "es_principal": true, "con_acceso": true }
]
```
Principal primero, luego por nombre. `con_acceso` indica si el residente tiene cuenta para la app.
- Errores: 401; 404 `Domicilio no encontrado`; 500 `Ocurrió un error, intenta de nuevo`.

### POST `/api/app/domicilios/{id}/residentes`

Agrega un residente con acceso a la app. Solo el residente principal.

- Cuerpo: `{ "nombre": "Ana Pérez", "telefono": "3311112222", "password": "opcional" }`
  - `telefono`: 10 dígitos (se normaliza).
  - `password`: mínimo 8 caracteres; **obligatoria** si el teléfono aún no tiene cuenta; si ya tiene cuenta se vincula y no se usa.
- 201 `{ "id": 9, "cuentaCreada": true }` (`false` si se vinculó una cuenta existente).
- Errores:

| Código | Mensaje |
|---|---|
| 400 | `Solicitud inválida` (cuerpo no es un objeto JSON) |
| 401 | `No autorizado` |
| 403 | `Solo el residente principal puede administrar residentes` |
| 404 | `Domicilio no encontrado` |
| 422 | `El nombre es obligatorio` |
| 422 | `El teléfono debe tener 10 dígitos` |
| 422 | `La contraseña debe tener al menos 8 caracteres` |
| 422 | `El teléfono no tiene cuenta: escribe una contraseña para crearla` |
| 422 | `Ese teléfono ya tiene acceso en este domicilio` |
| 422 | `Este domicilio ya tiene el máximo de N residentes con acceso a la app` |
| 422 | otros mensajes de validación de la cuenta (p. ej. teléfono inválido o contraseña requerida o demasiado corta) |
| 500 | `Ocurrió un error, intenta de nuevo` |

### DELETE `/api/app/domicilios/{id}/residentes/{residenteId}`

Quita un residente del domicilio (y su acceso a la app si no le quedan más domicilios). Solo el residente principal.

- 204 sin cuerpo.
- Errores: 401; 403 `Solo el residente principal puede administrar residentes`; 404 `Domicilio no encontrado` / `Residente no encontrado`; 422 `No puedes quitarte a ti mismo`; 500 `Ocurrió un error, intenta de nuevo`.

### GET `/api/app/pagos/{id}/recibo`

PDF del recibo de un pago de los domicilios del residente (el mismo que genera la web en `/api/recibos/{pagoId}`).

- 200 `application/pdf`, `Content-Disposition: inline; filename="<referencia>.pdf"`, `Cache-Control: private, no-store`.
- Errores: 401; 404 `Recibo no disponible` (pago ajeno, inexistente o sin recibo); 500 `No se pudo cargar el recibo`.

## 4. Lectura directa con RLS

Con la sesión del residente, `supabase-js` puede leer directamente (RLS limita las filas a sus domicilios y fraccionamiento):

| Tabla / función | Qué se puede leer |
|---|---|
| `cuentas_residente` | su propia cuenta (`telefono`, `activo`) |
| `residentes` | residentes de sus domicilios (`id, nombre, telefono, es_principal, domicilio_id, user_id`) |
| `domicilios` | sus domicilios |
| `cuotas_info` | cuotas de sus domicilios (`periodo`, `concepto`, `importe_cuota`, `fecha_vencimiento`, `estatus_calculado`, ...) |
| `pagos_info` | pagos de sus domicilios (`id` para pedir el recibo, `fecha_pago`, `concepto`, `importe`, `metodo_pago`, `mes`, `anio`, ...) |
| `tarjetas_acceso`, `controles_acceso`, `telefonos_acceso` | medios de acceso de sus domicilios |
| `pines_acceso` | PIN de sus domicilios |
| `dispositivos_residente` | su dispositivo ligado (`device_id`, `nombre`, `ligado_en`; solo lectura) |
| `app_botones` | botones de su fraccionamiento (solo lectura) |
| `rpc('estado_app_domicilio', { p_domicilio_id })` | lo mismo que `GET .../estado` (`42501` si el domicilio es ajeno) |

No son legibles por el residente: `aperturas_remotas` (auditoría) ni escritura en `app_botones`. Para abrir accesos o administrar residentes usa siempre las rutas HTTP: nunca se escriben directamente.

Las lecturas directas no verifican el dispositivo: el estado y las aperturas se obtienen siempre por la API, y la pantalla de inicio no carga si la API responde `otro_dispositivo`. La app no calcula estatus: usa `moroso` de `/estado` y `estatus_calculado` de `cuotas_info`.

Recomendación: usa `GET .../estado` como fuente de la pantalla de inicio porque ya incorpora la regla de adeudo y la disponibilidad de cada botón.

## 5. Distribución de botones

La cuadrícula tiene 2 columnas. Recorre `botones` en orden (`orden`):

- Si `ancho_completo` es `true`, el botón ocupa las 2 columnas (fila propia).
- Si no, ocupa media fila y se empareja con el siguiente botón de media fila.
- Si queda un botón de media fila sin pareja (último impar), ocupa el ancho completo.

Ejemplo: `[A(full), B, C, D]` produce filas `[A]`, `[B C]`, `[D]`.

## 6. Botones deshabilitados

`habilitado` es `false` cuando se cumple cualquiera de:

1. `moroso` es `true` (el domicilio tiene adeudos; un ajuste manual del administrador puede forzar acceso o bloqueo): muestra "Tu domicilio tiene adeudos" y deshabilita todos.
2. El botón no tiene salida asignada (la consola aún no lo vincula a una salida del panel).
3. El fraccionamiento no tiene instalación de control de acceso.
4. El domicilio no tiene titular.

La API no distingue 2, 3 y 4: si `moroso` es `false` y el botón está deshabilitado, muestra "Este acceso no está disponible". Aun con un botón habilitado, la apertura puede fallar con los códigos de la sección 3.
