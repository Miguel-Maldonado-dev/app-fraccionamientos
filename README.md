# Fraccionamientos — Panel de Administración

App multi-tenant (Next.js 16, App Router, y Supabase) para administrar fraccionamientos: domicilios, residentes, cuotas, pagos, movimientos y accesos. Cada fraccionamiento es un tenant aislado por RLS; los roles se verifican en el servidor.

## Requisitos

- Node 24
- npm 11
- Acceso al proyecto Supabase

## Configuración

1. `cp .env.example .env.local` y rellenar las variables de entorno:

   | Variable | Uso |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase. |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Llave publicable (navegador y servidor). |
   | `SUPABASE_SERVICE_ROLE_KEY` | Llave service role. Solo servidor (`src/lib/supabase/admin.ts`, alta de usuarios); nunca con prefijo `NEXT_PUBLIC_`. En local: `SERVICE_ROLE_KEY` de `supabase status -o json`. |
   | `ACCESS_CORE_API_URL` | Base de la API de access-core (por defecto `https://access-core-cloud.vercel.app/api/v1`). |
   | `ACCESS_CORE_API_KEY` | Llave `acc_…` de access-core. Solo servidor; nunca con prefijo `NEXT_PUBLIC_`. Se obtiene en el panel de access-core y actúa como admin de todas las instalaciones de su tenant. |
   | `CRON_SECRET` | Secreto que autoriza al cron a llamar a la ruta de sincronización. Solo servidor. |
2. `npm install`

## Comandos

| Comando | Descripción |
| --- | --- |
| `npm run dev` | Servidor de desarrollo |
| `npm test` | Pruebas con Vitest |
| `npm run typecheck` | Verificación de tipos con TypeScript |
| `npm run lint` | ESLint |
| `npm run build` | Build de producción |
| `npm start` | Sirve el build de producción |

## Base de datos local

Esquema multi-tenant de Supabase en `supabase/migrations/`. La app (`src/`) ya está adaptada a este esquema.

```bash
supabase start        # API en el puerto 55321, base en 55322 (puertos 553xx)
supabase db reset     # aplica migraciones y seed.sql (borra la base local)
supabase test db      # pruebas pgTAP en supabase/tests/database/
```

Si `supabase start` falla por salud de contenedores: `supabase start -x logflare,vector,imgproxy`. En entornos no interactivos, añadir `</dev/null` a los comandos.

Usuario local (super admin, sin fraccionamiento): `superadmin@local.test` / `superadmin123`.

### Fraccionamiento de demostración

`seed.sql` solo crea al super admin. Para probar la app en el navegador, carga el fraccionamiento `Fracc Demo` (slug `fracc-demo`) con un administrador, un tesorero y una cuota `Mensual` de 500 con acceso por teléfono y tarjeta. El script es idempotente (se puede correr varias veces sin duplicar):

```bash
psql postgresql://postgres:postgres@127.0.0.1:55322/postgres -v ON_ERROR_STOP=1 -f supabase/scripts/demo-local.sql
# si psql no está instalado en tu máquina, dentro del contenedor:
docker exec -i supabase_db_app-fraccionamientos psql -U postgres -v ON_ERROR_STOP=1 < supabase/scripts/demo-local.sql
```

El script aborta si la base no es la local de desarrollo (exige el super admin de `seed.sql`).

`supabase db reset` borra la demo: vuelve a correr el script después de cada reset.

| Cuenta | Correo | Contraseña |
| --- | --- | --- |
| Super admin (sin fraccionamiento) | `superadmin@local.test` | `superadmin123` |
| Administrador de Fracc Demo | `admin.demo@local.test` | `admin12345` |
| Tesorero de Fracc Demo | `tesorero.demo@local.test` | `tesorero12345` |

Para comprobar el inicio de sesión sin la app (la llave `ANON_KEY` sale de `supabase status -o env`):

```bash
curl -s -X POST "http://127.0.0.1:55321/auth/v1/token?grant_type=password" \
  -H "apikey: $ANON_KEY" -H "Content-Type: application/json" \
  -d '{"email":"admin.demo@local.test","password":"admin12345"}'
```

## Reglas de cobro

Cada fraccionamiento puede configurar sus reglas en Configuración (tabla `reglas_cobro`). Sin fila de reglas, o con los campos vacíos, rige el comportamiento anterior.

| Campo | Significado | Valor por defecto |
| --- | --- | --- |
| `dia_generacion` (1-28) | Día del mes en que se generan las cuotas automáticamente. | Vacío: no se generan solas. |
| `dia_vencimiento` (1-31) | Día del mes en que vence la cuota. | Vacío: vence como antes (fecha de la cuota). |
| `dias_gracia` (0-60) | Días después del vencimiento en que la cuota se muestra "En gracia" y aún no pasa a Vencido. | 0 |
| `cuotas_para_moroso` (1-12) | Cuotas vencidas a partir de las cuales el domicilio es moroso. | 1 |
| `concepto_recargo_id` | Concepto de recargo que se aplica a las cuotas que vencen (no es retroactivo: `recargo_desde` guarda la fecha de activación). | Vacío: sin recargo. |

- El proceso diario `procesar_reglas_cobro` (pg_cron, job `procesar-reglas-cobro`, 06:00 UTC) genera cuotas, marca vencidas, aplica recargos y limpia accesos forzados. Reemplaza a `marcar_cuotas_vencidas`.
- Acceso manual: solo el administrador puede forzar el acceso de un domicilio (`activo` o `inactivo`) sin importar su morosidad. El ajuste se quita solo cuando coincide con el estado real.

## Recibos

- Al registrar un pago, la app guarda en `pagos.recibo` una foto JSON pequeña del recibo (fraccionamiento, dirección, residente, concepto, fechas e importes). No se guarda ningún PDF en la base.
- El PDF (ticket de 58 mm con logotipo y QR de la referencia) se genera cada vez que alguien lo abre, en `GET /api/recibos/[pagoId]`, a partir de ese JSON y de `pagos.referencia`. Así, un recibo reimpreso muestra siempre los datos del momento del pago.
- Un pago sin `recibo` o con un JSON inválido responde 404 "Recibo no disponible".
- La impresión no cambia: el diálogo del recibo envía el PDF al servidor de impresión local de cada caseta (`http://localhost:8000/print`).

## Sincronización con access-core

Los cambios de domicilios, tarjetas, controles y PIN se encolan en `sincronizaciones_acceso` y un trabajador los envía a access-core (con lease por fraccionamiento y reintentos). Quien administra ve el estado en `/accesos`; el super admin, en la pestaña Accesos de la consola.

El cron del hosting debe llamar cada 5 minutos a `POST /api/sincronizacion/procesar` con la cabecera `Authorization: Bearer <CRON_SECRET>`. Sin el secreto correcto responde 401. Mapeo completo: [docs/integraciones/access-core-mapeo.md](docs/integraciones/access-core-mapeo.md).

## Estructura

- `src/app`: rutas de la aplicación, con los grupos `(auth)` y `(app)` y los endpoints en `api/`.
- `src/features/<dominio>/{queries,actions,schemas,messages,components}`: lógica y UI de cada dominio (consultas, server actions, esquemas zod, mensajes y componentes).
- `src/lib`: clientes de Supabase, autenticación y utilidades.
- `src/components`: componentes `ui` de shadcn, de layout y compartidos.
- `src/proxy.ts`: sesión y redirecciones.

## Sistema de diseño

Spec completa: [`docs/superpowers/specs/2026-10-06-rediseno-visual-design.md`](docs/superpowers/specs/2026-10-06-rediseno-visual-design.md).

La identidad visual es la de WEADMI (paleta, tipografía Sora/Inter y logos); ver [`docs/marca/`](docs/marca/) y la spec [`2026-11-10-identidad-weadmi-design.md`](docs/superpowers/specs/2026-11-10-identidad-weadmi-design.md).

**Tokens** (definidos en `src/app/globals.css`, usados como utilidades Tailwind):

| Token | Valor | Utilidad |
| --- | --- | --- |
| Primario / hover / claro | `#065F46` / `#054E39` / `#E6F4EF` | `bg-primary`, `hover:bg-primary-hover`, `bg-primary-light` |
| Éxito | `#15803D` / `#DCFCE7` | `text-success`, `bg-success-light` |
| Peligro | `#B91C1C` / `#FEE2E2` | `text-danger`, `bg-danger-light` |
| Advertencia | `#B45309` / `#FEF3C7` | `text-warning`, `bg-warning-light` |
| Información | `#1D4ED8` / `#DBEAFE` | `text-info`, `bg-info-light` |
| Fondo / superficie | `#F6F8FA` / `#FFFFFF` | `bg-background`, `bg-card` |
| Texto | `#111827` | `text-foreground` |
| Texto secundario | `#4B5563` | `text-secondary-foreground` (no `text-secondary`, que es blanco en shadcn) |
| Texto atenuado | `#6B7280` | `text-muted-foreground` |
| Borde | `#E5E7EB` | `border-border` |

**Tipografía:** una sola familia, Inter (pesos 400-700, variable `--font-sans`). Escala resumida: título de página 30 px bold, título de sección y diálogo 18 px semibold, valor de métrica 28 px bold, cuerpo 14 px, etiquetas y ayudas 12-13 px, importes con cifras tabulares. Sin mayúsculas sostenidas, salvo el campo Dirección, que se captura en mayúsculas porque así se almacena.

**Componentes compartidos** (`src/components/*`):

- `PageHeader`: breadcrumb, título, descripción y acciones de la página.
- `MetricCard`, `MetricGroup`, `MetricStrip`: tarjeta de métrica y sus agrupaciones.
- `FilterBar`: contenedor de filtros de lista.
- `SearchInput`: campo de búsqueda con icono.
- `LabeledSelect`: select nativo con etiqueta accesible.
- `SearchableSelect`: selector con búsqueda y botón de limpiar.
- `DataTable`: tabla con orden (`aria-sort`), columnas `hideBelow` y paginación.
- `RowActions`: menú de acciones por fila.
- `FormDialog`: diálogo de formulario con pie de acciones.
- `ConfirmDialog`: diálogo de confirmación.
- `StatusBadge`: insignia de estado.
- `Money`: importe formateado con color por signo.
- `Avatar`: iniciales en círculo.
- `PersonCell`: avatar con nombre y dato secundario.
- `EmptyState`, `ErrorState`: estados vacío y de error.
- `Skeletons`: marcadores de carga.
- `SectionCard`: tarjeta de sección con título y acciones.
- `CopyButton`: copiar al portapapeles.
- `BrandLogo`: logotipo de la marca.
- `DonutChart`: dona de estado de cuotas.

**Patrón de página:** breadcrumb, título, acciones, métricas, filtros y tabla.

## Consola del super admin

`/admin` (solo super admin; cualquier otro usuario recibe 404) lista los fraccionamientos con su estado y los conteos de usuarios y domicilios.

- **Crear / editar:** "+ Nuevo fraccionamiento" y el lápiz de cada fila abren un diálogo con nombre, slug (se sugiere a partir del nombre), ID de instalación (opcional) y activo.
- **Detalle:** el nombre de cada fila enlaza a `/admin/fraccionamientos/<id>`, con pestañas:
  - **Usuarios:** crear usuarios con cualquier rol del fraccionamiento y activarlos o desactivarlos. Editar nombre o rol lo hace el administrador del propio fraccionamiento.
  - **Catálogos:** tipos de cuota, extras, descuentos y recargos (una pestaña por catálogo).

## Roles

- **Administrador**: edita domicilios, residentes, accesos, catálogos y usuarios.
- **Tesorero**: gestiona cuotas, pagos y movimientos.
- **Comité**: solo lectura.
- **Vigilancia**: lee domicilios, residentes y accesos (y los reportes de acceso).
- **Super admin**: usa `/admin`.

Matriz de permisos completa en la especificación multi-tenant.

## Documentación

- [Especificación multi-tenant](docs/superpowers/specs/2026-11-09-multitenant-design.md)
- [Medios de acceso con access-core](docs/superpowers/specs/2026-11-11-medios-acceso-access-core-design.md) y [mapeo WEADMI ↔ access-core](docs/integraciones/access-core-mapeo.md)
- Planes por fase: [fase 1, esquema](docs/superpowers/plans/2026-11-09-multitenant-fase1-esquema.md), [fase 2, app](docs/superpowers/plans/2026-11-10-multitenant-fase2-app.md), [fase 3, consola](docs/superpowers/plans/2026-11-10-multitenant-fase3-consola.md)
- Históricos (migración desde FlutterFlow): [diseño](docs/superpowers/specs/2026-10-05-migracion-flutterflow-nextjs-design.md), [inventario funcional](docs/superpowers/specs/2026-10-05-inventario-funcional-flutterflow.md), [plan](docs/superpowers/plans/2026-10-05-migracion-nextjs.md)

## Limitaciones conocidas

- El pago no es transaccional (varias escrituras); se mitiga con un guard de pago existente.
- El RLS de la base de datos es permisivo; la app verifica los roles en el servidor.
- La impresión de recibos requiere el servidor de impresión local de cada caseta en `http://localhost:8000/print`.

## Lista de comprobación manual

1. Login con credenciales malas muestra "Error: …"; con usuario inactivo muestra el mensaje de cuenta inactiva; con usuario válido entra al dashboard y las 7 tarjetas muestran importes.
2. Un usuario Comite no ve "Usuarios" en el sidebar y `/usuarios` le da 404; un Administrador sí entra.
3. Domicilios: búsqueda filtra; alta rechaza dirección duplicada; clic en fila abre el detalle; URL inválida da 404.
4. Detalle: editar domicilio y cambiar tipo de cuota; agregar hasta 2 teléfonos y 3 tarjetas (el botón desaparece al llegar al máximo); agregar, editar (principal) y eliminar residente.
5. Cuotas: cambiar año/mes re-consulta; estatus filtra en cliente; "Generar Cuotas" (Tesorero) muestra éxito o error.
6. Detalle: "Crear Cuota" rechaza duplicado; editar cuota añade y quita descuento/recargo; "Pagar" registra pago, la cuota pasa a Pagado y aparece "Recibo"; el recibo abre, descarga e imprime (con el agente local activo).
7. Pagos: "Pago Extra" desde la lista (elige domicilio) y desde el detalle (domicilio fijo); ambos generan recibo.
8. Movimientos: el saldo refleja el pago anterior (trigger); "Nuevo Movimiento" egreso resta.
9. Reportes: pestaña 1 exige los tres filtros y muestra TOTAL; pestaña 2 descarga CSV; pestaña 3 exige ID Inicio y descarga TXT.
10. Usuarios: crear usuario y verificar que aparece; editar rol; desactivar (no al propio) y activar.
11. En una ventana estrecha, el menú móvil abre el sidebar.
12. Sidebar y header en móvil (drawer), métricas y filtros en cada lista, orden y filas por página en tablas, dona de estado de cuotas en Inicio.
