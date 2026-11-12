# Identidad WEADMI: diseño

Fecha: 2026-11-10 · Estado: aprobado

Fuente de la marca: `docs/marca/identidad.md` (guía oficial) y `docs/marca/logos/` (`logotipo-weadmi.png` 1047×217, `isotipo-weadmi.png` 440×440, ambos con transparencia, versión positiva).

## Objetivo

El producto se llama **WEADMI · Gestión residencial**. Toda la app actual adopta esa identidad visual de forma coherente:

- el panel del fraccionamiento (`(app)`);
- la consola del super admin (`/admin`);
- el login;
- `/sin-acceso`.

La guía pide un lenguaje visual reutilizable, no un cambio superficial de colores, y que la interfaz transmita **confianza, conexión y control**.

**Éxito:** todas las pantallas usan la paleta, las tipografías y el logo oficiales; los estados financieros se leen sin ambigüedad; no cambia ninguna funcionalidad.

## No objetivos y anti-objetivos

- **Fuera de alcance:**
  - Portal de residentes, sitio web y control de acceso. La guía los menciona, pero no existen en la app.
  - Modo oscuro.
  - Cambios de navegación, rutas, datos, permisos o validaciones.
- **Anti-objetivos (aunque funcione, sería un fracaso):**
  - Reconstruir el logo con texto, CSS o SVG propio.
  - Llenar botones, tarjetas o fondos de degradados.
  - Usar el turquesa como color dominante.
  - Perder el foco visible o la legibilidad de tablas y montos.

## Restricciones

- **Stack actual.**
  - Next.js 16, Tailwind v4 con tokens en `src/app/globals.css` (`:root` + `@theme inline`) y primitivas shadcn en `src/components/ui/`.
  - Compartidos en `src/components/`.
  - Inter local con `next/font/local`, porque el build no debe depender de la red.
  - Hay un sistema de diseño previo documentado en `docs/superpowers/specs/2026-10-06-rediseno-visual-design.md`. Esta identidad lo reemplaza en valores, no en estructura.
- **Nada de lógica:** no se toca lógica, Server Actions, queries, permisos ni pruebas de comportamiento. Las pruebas que fijan valores visuales (por ejemplo `globals.test.ts`) se actualizan a los valores nuevos.
- **Comprobaciones:** `npm test`, `npx tsc --noEmit`, `npm run lint` y `npm run build` deben pasar al terminar.

## Enfoques considerados

1. **Solo cambiar los tokens de color.** Es rápido, pero la guía lo descarta explícitamente ("no hagas un rediseño superficial limitado a colores"): no habría Sora, logo, radios ni jerarquía.
2. **Un sistema de diseño nuevo junto al actual** (variables `--weadmi-*` más componentes propios). Duplica estilos y contradice la regla de la guía de integrarse al sistema existente "sin introducir una segunda solución".
3. **Tokens globales primero y después los componentes compartidos (elegido).** Los tokens existentes (`--primary`, `--border`, etc.) toman los valores WEADMI, se agregan los pocos tokens de marca que faltan, y los componentes compartidos y las primitivas se ajustan a las reglas de la guía. Como todas las pantallas consumen esos componentes, la coherencia llega sin tocar cada pantalla una por una. Al final, una revisión por pantalla cubre los casos sueltos.

Lo eligió el usuario el 2026-11-10, junto con el menú lateral blanco.

## Decisiones del usuario

- Nombre del producto: **WEADMI**; descriptor: **Gestión residencial**.
- **Primario accesible:** botones y enlaces en `#086BB8`; `#087BE8` en logo, íconos, foco e indicador activo.
- **Menú lateral blanco**, con el logotipo positivo (no hay versión negativa). Aplica también al menú móvil y al encabezado de `/admin`; el logotipo positivo se lee bien sobre blanco.

## Diseño

### 1. Tokens (en `src/app/globals.css`)

Valores de la guía aplicados a los tokens existentes:

| Token existente | Valor nuevo | Origen |
|---|---|---|
| `--primary` | `#086BB8` | weadmi-blue-dark (accesible, ver nota) |
| `--primary-hover` | `#075A9C` | variante más oscura (decisión de diseño) |
| `--brand-primary` (nuevo) | `#087BE8` | weadmi-primary |
| `--primary-light` | `#E7F1FD` | tinte del primario (decisión de diseño) |
| `--ring` y `--sidebar-ring` | `#087BE8` | weadmi-primary |
| `--sidebar-primary` | `#086BB8` | |
| `--background` | `#F5F8FC` | weadmi-background |
| `--card`, `--popover`, `--secondary` y `--sidebar` | `#FFFFFF` | weadmi-surface |
| `--foreground`, `--card-foreground`, `--popover-foreground`, `--secondary-foreground`, `--accent-foreground` y `--sidebar-accent-foreground` | `#172536` | weadmi-text |
| `--sidebar-foreground` | `#071F49` | navy |
| `--text-secondary` | `#496985` | weadmi-blue-gray |
| `--muted-foreground` | `#5B6B80` | weadmi-muted oscurecido para AA sobre fondos claros (decisión de diseño; la guía da `#64748B`) |
| `--border`, `--input` y `--sidebar-border` | `#E8EEF4` | weadmi-border |
| `--muted`, `--accent` y `--sidebar-accent` | `#EEF3F8` | neutro de apoyo (decisión de diseño) |
| `--radius` | `14px` (tarjetas y diálogos) | guía |

**Nota sobre el primario (decisión del usuario, 2026-11-10):** `#087BE8` con texto blanco da 4.2:1, por debajo de WCAG AA (4.5:1) para texto de 14 px. Por eso:
- botones primarios, enlaces y textos en primario usan `#086BB8` (5.5:1);
- `#087BE8` (`--brand-primary`) se reserva para el logo, los íconos destacados, el anillo de foco y la barra del ítem activo del menú.

Tokens nuevos, también expuestos en `@theme inline` para usarse como clases de Tailwind:

| Token | Valor |
|---|---|
| `--brand-navy` | `#071F49` |
| `--brand-aqua` | `#00C7C7` |
| `--brand-blue-mid` | `#087FBD` |
| `--brand-gradient` | `linear-gradient(110deg, #087BE8 0%, #087FBD 50%, #00C7C7 100%)` |
| `--tertiary` | `#EAF7F8` |
| `--tertiary-foreground` | `#077389` (la guía da `#087F9B`; oscurecido para AA) |

**Estados.** La guía fija el color de marca de cada estado. Algunos (sobre todo el amarillo `#E9A23B`) no tienen contraste suficiente como texto sobre fondo claro, así que cada estado tiene dos tonos:

| Estado | Color de marca (`--success`, `--warning`…): iconos, puntos, rellenos y gráficas | Texto sobre fondo claro (`--success-foreground`…) | Fondo suave (`--*-light`) |
|---|---|---|---|
| Correcto | `#16A36A` | `#0B7A4D` | `#E3F6EE` |
| Pendiente | `#E9A23B` | `#8A5300` | `#FDF1DE` |
| Error | `#DC4C4C` | `#B42F2F` | `#FCE8E8` |
| Información | `#087BE8` | `#0A5FB4` | `#E7F1FD` |
| Neutral | `#64748B` | `#475569` | `#EEF3F8` |

- `--destructive` = `#DC4C4C` para íconos y bordes; el botón destructivo usa fondo `--danger-foreground` (`#B42F2F`) con texto blanco (6.2:1), porque blanco sobre `#DC4C4C` da 4.05:1.
- Ningún texto usa el color de marca de un estado (`text-success`, `text-danger`, `text-warning`): mensajes de error, montos, avisos y asteriscos de campo obligatorio usan el tono `-foreground`.
- `StatusBadge` y cualquier texto de estado usan el tono de texto sobre el fondo suave.
- Los tonos de texto, fondo suave y `--primary-light` son decisiones de diseño para cumplir WCAG AA (4.5:1). La guía pide "contraste suficiente".

**Gráficas:**

| Token | Valor |
|---|---|
| `--chart-1` | `#087BE8` (`--brand-primary`) |
| `--chart-2` | `#00C7C7` |
| `--chart-3` | `#071F49` |
| `--chart-4` | `#E9A23B` |
| `--chart-5` | `#DC4C4C` |

**Avatares:** se conserva la paleta actual de seis pares. Son identificadores, no marca.

### 2. Tipografía

- **Sora** (600, 700, 800) se agrega como fuente local en `src/app/fonts/`, igual que Inter: un solo archivo woff2 variable (subconjunto latin) descargado una vez de Google Fonts con licencia OFL, durante la implementación. El build no necesita red. Variable CSS `--font-heading`, expuesta en `@theme` como `font-heading`. Esto revierte a propósito la prueba actual que prohíbe `--font-heading`.
- **Inter** sigue siendo `--font-sans`, la fuente de toda la interfaz.
- **Jerarquía (escritorio):**

  | Elemento | Familia | Peso | Tamaño | Color |
  |---|---|---|---|---|
  | H1 (título de página, `PageHeader`) | Sora | 700 | 32 px | navy |
  | H2 (títulos destacados: login, `/sin-acceso`, estado vacío principal) | Sora | 600 | 26 px | navy |
  | H3 (título de `SectionCard` y de diálogos) | Sora | 600 | 20 px | navy |
  | H4 (subtítulos, valores de `MetricCard`) | Sora | 600 | 17 px | navy |
  | Texto | Inter | 400 | 15 px | |
  | Secundario | Inter | 400 | 13 px | |
  | Etiquetas | Inter | 500 | 12 px | |
  | Botones | Inter | 600 | 14 px | |

  Los valores de `MetricCard` llevan Sora en su tamaño actual, no 17 px.
- **Móvil:** H1 baja a 26 px.
- **Datos:** montos y tablas siguen en Inter con cifras tabulares (`tabular-nums`) donde ya se usan.
- **Escala (decisión de diseño):** se sigue la escala de la guía (32/26/20/17). Los títulos de tarjeta y de diálogo son H3 (20 px), porque H2 a 26 px dentro de cada tarjeta compite con el título de página.

### 3. Logo y favicon

- Los PNG oficiales se copian a `public/brand/weadmi-logotipo.png` y `public/brand/weadmi-isotipo.png`. Los originales se quedan en `docs/marca/logos/`.
- `BrandLogo` se reescribe con `next/image`. Nunca se deforma: ancho y alto en la proporción del archivo (logotipo 1047:217, isotipo 1:1). Variantes:
  - `variant="logotipo"`: horizontal; menú lateral, login, encabezado de `/admin` y `/sin-acceso`.
  - `variant="isotipo"`: barra superior móvil y espacios reducidos.
  - La prop `subtitulo` (nombre del fraccionamiento) se conserva y se muestra debajo del logotipo, en Inter 500 de 13 px y color secundario.
  - `alt="WEADMI"`.
- Favicon e íconos con la convención de Next: `src/app/icon.png` (isotipo, 440×440) y `src/app/apple-icon.png` (180×180). El segundo se genera una sola vez con `sips` (macOS) desde el isotipo sobre fondo blanco y se versiona como archivo. Se elimina `src/app/favicon.ico`.
- Los PNG tienen transparencia. El logotipo trae un margen mínimo propio, que funciona como área de seguridad; no se recorta. A 1047 px de ancho alcanza para mostrarse nítido a 2x en los tamaños indicados (máx. ~240 px).
- **Nombre y metadatos:**
  - `PRODUCTO` = `'WEADMI'`.
  - Metadatos raíz: `title: 'WEADMI'`, `description: 'WEADMI · Gestión residencial'`.
  - Título en la app: `<nombre del fraccionamiento> · WEADMI`, el formato ya existente.
- El degradado institucional solo aparece en el isotipo. Ningún componente lo usa como fondo; el token existe para acentos puntuales futuros.

### 4. Componentes compartidos

Todos leen tokens; ninguno define colores fijos.

- **Button** (`ui/button.tsx`):

  | Elemento | Valor |
  |---|---|
  | `default` | fondo primario, hover `--primary-hover`, texto blanco, Inter 600 14 px |
  | `secondary` | fondo blanco, texto navy, borde `--border` |
  | `tertiary` (nueva) | fondo `--tertiary`, texto `--tertiary-foreground` |
  | `destructive`, `ghost` y `link` | se conservan con los tokens nuevos |
  | Radio | 8 px (`rounded-md`; el token `--radius-md` ya vale 8 px) |
  | Tamaños | `default` 44 px, `sm` 36 px, íconos 36 px |
  | Foco | anillo visible con `--ring` |
  | Deshabilitado | opacidad reducida con cursor no permitido |
  | Cargando | se mantiene el patrón actual |

- **Inputs, select, textarea, checkbox y búsqueda:**
  - Fondo blanco, borde `--input` y radio de 8 px (`rounded-md`).
  - Foco con borde primario y anillo visible.
  - Error con borde y texto en el tono de error.
  - Alto de 44 px en formularios.
- **Card, `SectionCard`, `MetricCard` y diálogos:**
  - Fondo blanco, borde `--border` y radio de 14 px.
  - Sombra mínima solo en elementos flotantes (diálogos, popovers, menús).
  - Títulos en Sora navy; texto auxiliar en `--text-secondary`.
- **Tablas** (`ui/table.tsx`, `DataTable`):
  - Encabezado con fondo `--muted`, texto `--text-secondary` en Inter 500 de 12 px y mayúsculas suaves (se conserva el estilo actual).
  - Separación entre filas con `--border`, hover de fila `--muted`.
  - Montos alineados a la derecha.
  - Se conservan filtros, búsqueda, orden, paginación y acciones.
- **`StatusBadge`:**
  - Compacto, radio completo, fondo suave, texto en el tono de texto del estado y punto o ícono del color de marca. Así el estado no depende solo del color.
  - El mapeo de etiquetas a estados se conserva: Pagado/Activo/Al corriente → correcto; Pendiente → pendiente; Vencido/Moroso/Inactivo* → error o neutral, según el mapeo actual.
- **Tabs, breadcrumb, `EmptyState`, `ErrorState`, skeletons, toasts (sonner) y tooltips:** se ajustan a los tokens; los títulos de los estados vacío y de error van en Sora.
- **Navegación** (`sidebar-content`, `nav-list`, `app-bar`, `mobile-nav`, encabezado de `/admin`):
  - Menú blanco con borde `--border`.
  - Ítems en navy (Inter 500); el activo con fondo `--primary-light`, texto en `--primary`, ícono y barra de 3 px a la izquierda en `--brand-primary`.
  - Hover `--muted`.
  - Íconos Lucide actuales, trazo de 1.75 px.
  - El logotipo va arriba del menú, con el nombre del fraccionamiento debajo.

### 5. Pantallas

Ninguna pantalla cambia su estructura ni su contenido. La pasada por pantallas sirve para:

- reemplazar colores o tamaños fijos que no salgan de tokens (buscar `#`, `text-[`, `bg-[` y clases de color de Tailwind como `emerald-`, `green-`, `gray-`);
- confirmar la jerarquía (H1, H2, montos destacados solo en indicadores);
- revisar login, `/sin-acceso` y la consola `/admin` con el logotipo;
- revisar el PDF de movimientos: título en navy (`#071F49`) y encabezado de tabla en primario (`#086BB8`). jsPDF no lee variables CSS, así que se usan esos HEX exactos en una constante del generador.

### 6. Responsive y accesibilidad

- Se conservan los breakpoints actuales; sin scroll horizontal accidental.
- Áreas táctiles de 44 px en botones y controles de formulario. En contextos densos (acciones de fila en tablas, barras de filtros y pies de tabla) se usa `sm` (36 px); es una excepción aceptada para escritorio.
- Contraste AA en texto (los tonos de texto de estado existen para eso). Foco visible en todo. `prefers-reduced-motion` respetado si hay animaciones.

### 7. Pruebas

- `globals.test.ts` fija los valores nuevos de los tokens clave y que `--font-heading` existe.
- `BrandLogo`: renderiza una imagen con `alt="WEADMI"` y el `src` de cada variante; con `subtitulo` muestra el nombre.
- `button.test.tsx` cubre la variante `tertiary` y la altura por defecto.
- `StatusBadge`: cada tono usa sus clases de token.
- Las pruebas existentes que busquen textos o clases viejos se actualizan; ninguna prueba de comportamiento cambia su intención.

## Lo que decide quien construye

- El orden de los archivos dentro de cada componente, siempre que use tokens.
- Tamaños de logo por ubicación, dentro de estas proporciones aproximadas:
  - menú lateral: ~160 px de ancho;
  - login: ~240 px;
  - encabezado de `/admin`: ~140 px;
  - isotipo en la barra móvil: 32 px.
- Cómo aplicar Sora a los títulos: clase utilitaria `font-heading` o regla base en `h1–h3`. Que sea una sola forma, consistente.
