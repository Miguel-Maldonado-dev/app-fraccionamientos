# Identidad WEADMI: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Toda la app (panel del fraccionamiento, consola `/admin`, login y `/sin-acceso`) adopta la identidad WEADMI: paleta, Sora e Inter, logos oficiales y componentes compartidos alineados a la guía, sin cambiar ninguna funcionalidad.

**Architecture:** Los tokens existentes de `src/app/globals.css` toman los valores WEADMI y se agregan los tokens de marca que faltan. Las primitivas de `src/components/ui/` y los compartidos de `src/components/` se ajustan a las reglas de la guía. Como las pantallas consumen esos componentes, la coherencia llega sin rehacerlas; una pasada final cubre casos sueltos y el PDF.

**Tech Stack:** Next.js 16.3 (`next/font/local`, `next/image`, metadatos de archivo `icon.png`/`apple-icon.png`), Tailwind v4 (`@theme inline`), shadcn/ui, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-10-identidad-weadmi-design.md` (aprobado). Guía de marca: `docs/marca/identidad.md`. Logos: `docs/marca/logos/`.

## Global Constraints

- **No hacer commits.** El usuario hace todos los commits.
- **Next.js 16 no es el que conoces:** leer `node_modules/next/dist/docs/` antes de usar `next/font/local`, `next/image` o los archivos de metadatos (AGENTS.md).
- **No levantar el servidor.** Al cerrar cada tarea deben pasar `npm test`, `npx tsc --noEmit`, `npm run lint` y `npm run build`.
- **Cero cambios de lógica:** no se tocan Server Actions, queries, permisos, rutas, validaciones ni textos funcionales. Las pruebas que fijan valores visuales (clases, tokens o el texto del logo) se actualizan; ninguna prueba de comportamiento cambia su intención.
- **Colores:** siempre desde tokens. No usar HEX ni clases de color fijas de Tailwind (`blue-600`, `gray-500`…) en componentes. La única excepción es el generador del PDF (jsPDF no lee CSS), con constantes HEX.
- **Valores exactos de la spec:** los de §1 (tokens y tabla de estados), §2 (tipografía), §3 (logo) y §4 (componentes). El primario de botones y enlaces es `#086BB8`; `#087BE8` es `--brand-primary`.
- **Logo:** nunca reconstruirlo con texto, CSS ni SVG; solo los PNG oficiales con su proporción (logotipo 1047:217, isotipo 1:1).
- **Textos en español**, sentence case. TDD: la prueba primero.

## Review Focus

1. **Texto de estado "Pendiente" sobre su fondo suave.** Debe leerse: usa `--warning-foreground` (`#8A5300`), nunca `#E9A23B` como color de texto. Prueba en la tarea 3.
2. **Logo deformado.** El ancho y el alto pasados a `next/image` respetan la proporción 1047:217 en todas las variantes y tamaños. Prueba en la tarea 2.
3. **Foco de teclado.** Botones, inputs, ítems del menú y pestañas mantienen un anillo visible con `--ring`. Prueba en la tarea 3 (clases `focus-visible:` presentes en `Button` e `Input`).
4. **Ítem activo del menú.** Se distingue sin depender solo del color: barra izquierda de 3 px y `aria-current="page"`. Prueba en la tarea 4.
5. **Build sin red.** Sora se carga desde un archivo local; `npm run build` no descarga fuentes. Verificación en la tarea 1.

---

### Task 1: Tokens globales y tipografías

**Files:**
- Modify: `src/app/globals.css`, `src/app/globals.test.ts`, `src/app/layout.tsx`
- Create: `src/app/fonts/sora-latin-wght-normal.woff2`, el woff2 variable de Sora (latin) descargado una vez de Google Fonts. Licencia OFL: agregar `src/app/fonts/OFL-Sora.txt`.

**Interfaces:**
- Produces (lo usan las tareas 2–5):
  - Todos los valores de tokens de la spec §1.
  - Tokens nuevos en `:root` y expuestos en `@theme inline` como colores de Tailwind:
    - marca: `--brand-primary`, `--brand-navy`, `--brand-aqua`, `--brand-blue-mid` → clases `bg-brand-primary`, `text-brand-navy`, etc.;
    - terciario: `--tertiary`, `--tertiary-foreground`;
    - texto de estado: `--success-foreground`, `--warning-foreground`, `--danger-foreground`, `--info-foreground`, `--neutral`, `--neutral-foreground`, `--neutral-light`;
    - `--brand-gradient`, como variable sin clase.
  - Fuente: variable `--font-heading` (Sora) en `<html>` y `--font-heading` en `@theme` → clase `font-heading`. `--font-sans` sigue siendo Inter.
  - Base: `h1, h2, h3, h4` con `font-heading` y color `--brand-navy` en `@layer base`. Así, los títulos usan Sora de una sola forma.

- [ ] **Step 1: Actualizar `globals.test.ts` primero.**
  - Valores esperados:
    - `--primary #086BB8`, `--primary-hover #075A9C`, `--primary-light #E7F1FD`, `--brand-primary #087BE8`, `--brand-navy #071F49`, `--brand-aqua #00C7C7`
    - `--background #F5F8FC`, `--foreground #172536`, `--text-secondary #496985`, `--muted-foreground #64748B`, `--border #E8EEF4`, `--muted #EEF3F8`, `--ring #087BE8`
    - `--success #16A36A`, `--success-foreground #0B7A4D`, `--success-light #E3F6EE`
    - `--warning #E9A23B`, `--warning-foreground #8A5300`, `--warning-light #FDF1DE`
    - `--danger #DC4C4C`, `--danger-foreground #B42F2F`, `--danger-light #FCE8E8`
    - `--info #087BE8`, `--info-foreground #0A5FB4`, `--info-light #E7F1FD`
    - `--radius 14px`
  - `--font-heading` ahora **debe** existir.
  - Se mantienen las prohibiciones de `.dark {`, `@custom-variant dark` y `oklch(`.
- [ ] **Step 2: Correr** `npx vitest run src/app/globals.test.ts` → FAIL.
- [ ] **Step 3: Implementar** los tokens (spec §1 completa: sidebar, gráficas, `--destructive #DC4C4C`, tertiary) y Sora con `localFont({ src: './fonts/sora-latin-wght-normal.woff2', variable: '--font-heading', weight: '600 800' })` junto a Inter.
- [ ] **Step 4: Verificar** los cuatro comandos → verde. `npm run build` no debe hacer peticiones a `fonts.googleapis.com`: grep en la salida.
- [ ] **Step 5: Listo para commit.**

---

### Task 2: Logos, favicon y nombre del producto

**Files:**
- Create: `public/brand/weadmi-logotipo.png` y `public/brand/weadmi-isotipo.png` (copias de `docs/marca/logos/logotipo-weadmi.png` e `isotipo-weadmi.png`); `src/app/icon.png` (copia del isotipo); `src/app/apple-icon.png` (180×180 sobre fondo blanco, generado con `sips` desde el isotipo).
- Delete: `src/app/favicon.ico`
- Modify: `src/components/brand-logo.tsx` (+ crear `brand-logo.test.tsx`), `src/lib/constants.ts` (`PRODUCTO = 'WEADMI'`), `src/app/layout.tsx` (metadatos), y los usos de `BrandLogo`: `src/components/layout/sidebar-content.tsx`, `src/components/layout/app-bar.tsx`, `src/app/admin/layout.tsx`, `src/app/sin-acceso/page.tsx`, `src/features/auth/components/login-form.tsx` (+ sus pruebas).

**Interfaces:**
- Consumes: tokens de la tarea 1.
- Produces:
  - `BrandLogo({ variant = 'logotipo', width, subtitulo, priority }: { variant?: 'logotipo' | 'isotipo'; width: number; subtitulo?: string; priority?: boolean })`.
    - Usa `next/image` con `src` `/brand/weadmi-logotipo.png` o `/brand/weadmi-isotipo.png` y `alt="WEADMI"`.
    - El alto se calcula: `Math.round(width * 217 / 1047)` para el logotipo, `width` para el isotipo.
    - Con `subtitulo`, lo muestra debajo en Inter 500 de 13 px con `text-text-secondary` (o el token equivalente de color secundario) y `truncate`.
  - Ubicaciones y anchos:
    - menú lateral: logotipo de 160 px con `subtitulo` = nombre del fraccionamiento;
    - barra superior móvil: isotipo de 32 px;
    - encabezado de `/admin`: logotipo de 140 px;
    - login: logotipo de 240 px con `priority`;
    - `/sin-acceso`: logotipo de 180 px.
  - Metadatos raíz: `title: 'WEADMI'`, `description: 'WEADMI · Gestión residencial'`. El título del fraccionamiento sigue como `<nombre> · WEADMI` vía `PRODUCTO`.

- [ ] **Step 1: Pruebas:**
  - `brand-logo.test.tsx`:
    - `variant` por defecto con `width={160}` → `img` con `alt="WEADMI"`, `width="160"`, `height="33"` y `src` que contiene `weadmi-logotipo.png`.
    - Isotipo con `width={32}` → `height="32"` y `src` con `weadmi-isotipo.png` (Review Focus 2).
    - Con `subtitulo="Fracc Demo"` muestra el texto.
  - Actualizar las pruebas de `sidebar-content`, `app-bar`, `admin/layout`, `sin-acceso` y `login-form` que buscaban "Fraccionamientos" como texto del logo: ahora buscan el `img` con `alt="WEADMI"`.
  - `grep -rn "Fraccionamientos'" src/lib/constants.ts` vacío.
- [ ] **Step 2: Correr** → FAIL.
- [ ] **Step 3: Implementar.** Si `next/image` necesita configuración para imágenes locales en `public/`, consultar la guía; no agregar dominios remotos.
- [ ] **Step 4: Verificar** los cuatro comandos → verde. `ls src/app/favicon.ico` → no existe.
- [ ] **Step 5: Listo para commit.**

---

### Task 3: Primitivas y estados

**Files:**
- Modify: `src/components/ui/{button,input,textarea,select,checkbox,card,dialog,alert-dialog,table,tabs,badge,popover,dropdown-menu,tooltip,sonner}.tsx` y `src/components/{status-badge,search-input,labeled-select}.tsx` (+ tests: `button.test.tsx`, `status-badge.test.tsx`, crear `input.test.tsx` si no existe).

**Interfaces:**
- Consumes: tokens de la tarea 1.
- Produces:
  - `Button`:
    - variante nueva `tertiary` (`bg-tertiary text-tertiary-foreground`);
    - `default` con `bg-primary hover:bg-primary-hover text-primary-foreground font-semibold text-sm rounded-md`;
    - `secondary` con `bg-card text-brand-navy border border-border`;
    - tamaños `default` `h-11`, `sm` `h-9`, `icon` `size-9`;
    - todas las variantes con `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2` y `disabled:opacity-50 disabled:cursor-not-allowed`.
  - `Input`, `Textarea` y `SelectTrigger`: `h-11` (textarea sin alto fijo), `rounded-md`, `bg-card`, `border-input`, `focus-visible:border-primary` más el anillo, y `aria-invalid:border-danger`.
  - `Card` y `DialogContent`: `rounded-[var(--radius)]` (14 px), `border-border`, sin sombra en `Card` y `--shadow-elevated` en flotantes. Títulos de diálogo con la regla base de h2/h3 (Sora, navy).
  - `Table`: encabezado `bg-muted text-text-secondary text-xs font-medium` y fila con hover `bg-muted/60`.
  - `StatusBadge`:
    - Tonos `success | warning | danger | info | neutral`. Cada tono = `bg-<tono>-light text-<tono>-foreground` más un punto de 6 px `bg-<tono>`.
    - Se conserva el mapeo actual de etiquetas a tonos. "Inactivo" y los estados sin tono definido → `neutral`.

- [ ] **Step 1: Pruebas:**
  - `button.test.tsx`: `variant="tertiary"` tiene `bg-tertiary`; por defecto tiene `h-11` y `focus-visible:ring-2` (Review Focus 3).
  - `input.test.tsx`: `h-11` y `focus-visible:border-primary`.
  - `status-badge.test.tsx`:
    - "Pendiente" tiene `text-warning-foreground` y `bg-warning-light`, y **no** `text-warning` (Review Focus 1).
    - "Pagado" usa `text-success-foreground`.
    - "Inactivo" usa `neutral`.
- [ ] **Step 2: Correr** → FAIL.
- [ ] **Step 3: Implementar.** Ajustar las pruebas existentes que fijaban clases viejas (`h-10`, colores antiguos) a los valores nuevos, sin cambiar lo que verifican.
- [ ] **Step 4: Verificar** los cuatro comandos → verde.
- [ ] **Step 5: Listo para commit.**

---

### Task 4: Compartidos y navegación

**Files:**
- Modify: `src/components/{page-header,section-card,metric-card,metric-strip,metric-group,empty-state,error-state,page-breadcrumb,filter-bar,data-table,row-actions,donut-chart}.tsx`, `src/components/layout/{sidebar-content,nav-list,app-bar,mobile-nav,sidebar}.tsx`, `src/app/admin/layout.tsx` (+ tests).

**Interfaces:**
- Consumes: tareas 1–3.
- Produces:
  - `PageHeader`: `h1` en Sora 700 de 32 px (`text-[26px] md:text-[32px]`; los tamaños de la escala de la spec son la excepción permitida a "sin valores arbitrarios"), navy; descripción en `text-text-secondary` de 15 px.
  - `SectionCard`: título `h3` en Sora 600 de 20 px, navy; contenedor `Card`.
  - `MetricCard`: valor en `font-heading` 600, en su tamaño actual, navy; etiqueta Inter 500 de 12 px en `text-text-secondary`.
  - `EmptyState` y `ErrorState`: título `h3` en Sora 600 de 20 px; ícono con `text-brand-primary`.
  - `DonutChart` y gráficas: colores de `--chart-1…5`.
  - `RowActions` y barras de filtros: botones `size="sm"` (36 px).
  - Navegación (`nav-list`):
    - ítem con `text-brand-navy font-medium`, `hover:bg-muted`;
    - ítem activo con `bg-primary-light text-primary`, ícono `text-brand-primary`, `aria-current="page"` y barra izquierda de 3 px `bg-brand-primary` (pseudo-elemento o `border-l-[3px]`);
    - íconos Lucide con `strokeWidth={1.75}`.
  - Menú lateral, barra superior y encabezado de `/admin`: fondo `bg-card` con `border-border`; sin degradados.

- [ ] **Step 1: Pruebas:**
  - `nav-list` (o `sidebar-content`): el ítem de la ruta actual tiene `aria-current="page"` y la clase `bg-primary-light`; los demás no (Review Focus 4).
  - `page-header.test.tsx`: el título es un `h1` con `font-heading`.
  - `section-card.test.tsx`: el título es un `h3`.
- [ ] **Step 2: Correr** → FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Verificar** los cuatro comandos → verde.
- [ ] **Step 5: Listo para commit.**

---

### Task 5: Pasada por pantallas, PDF y verificación final

**Files:**
- Modify: `src/features/pagos/components/recibo-dialog.tsx` (único color fijo encontrado), `src/features/movimientos/export/generar.ts` (+ test), las pantallas que la búsqueda señale, y `README.md` (una línea sobre la identidad y `docs/marca/`).

**Interfaces:**
- Consumes: tareas 1–4.
- Produces:
  - En `generar.ts`, constantes `PDF_NAVY = [7, 31, 73]` (`#071F49`), `PDF_PRIMARIO = [8, 107, 184]` (`#086BB8`) y `PDF_TEXTO_SECUNDARIO = [73, 105, 133]` (`#496985`). Título en navy, encabezados de tabla en `PDF_PRIMARIO` con texto blanco, textos secundarios en `PDF_TEXTO_SECUNDARIO`.

- [ ] **Step 1: Pruebas:** el test del generador verifica que `setTextColor` del título recibe `7, 31, 73` y que `headStyles.fillColor` es `[8, 107, 184]`.
- [ ] **Step 2: Correr** → FAIL.
- [ ] **Step 3: Implementar el PDF** y reemplazar el color fijo de `recibo-dialog.tsx` por un token.
- [ ] **Step 4: Pasada por pantallas:**
  - `grep -rnE "#[0-9A-Fa-f]{6}|(bg|text|border|ring|fill|stroke)-(emerald|green|gray|slate|zinc|neutral|red|amber|yellow|blue|sky|teal)-[0-9]{2,3}" src --include='*.tsx' --include='*.ts'`, excluyendo tests, `database.types.ts` y `generar.ts` → vacío.
  - Revisar visualmente en el código: login, `/sin-acceso`, `/admin` y su detalle, Inicio, Domicilios y su detalle, Cuotas, Pagos, Movimientos, Reportes, Usuarios y Configuración. Ningún título de página debe quedar fuera de `PageHeader`, ni tarjeta fuera de `SectionCard` o `Card`, ni botón con estilos propios que contradigan la tarea 3.
  - Cualquier `h1`, `h2` o `h3` suelto hereda Sora de la regla base.
- [ ] **Step 5: Verificación final:** `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build` → verde. `supabase test db </dev/null` → PASS (no debería cambiar nada).
- [ ] **Step 6: Listo para commit.**

---

## Resultado y pendientes (2026-11-10)

Identidad WEADMI aplicada: 515 pruebas de Vitest y pgTAP en verde; `tsc`, lint y build limpios.

Decisiones tomadas durante la ejecución (reflejadas en la spec):
- Ningún texto usa el color de marca de un estado; errores, montos y avisos usan el tono `-foreground`.
- Botón destructivo con fondo `#B42F2F` (blanco sobre `#DC4C4C` no llegaba a AA).
- `--muted-foreground` `#5B6B80` y `--tertiary-foreground` `#077389`, oscurecidos respecto a la guía para cumplir AA.
- Gráfica de estado de cuotas con colores de estado (verde/rojo), no de serie.
- `next/image` usa `preload` (en Next 16 `priority` está obsoleto).

Pendientes (pueden esperar):
1. Los títulos de tarjeta son `h3` aunque la página no tenga `h2`.
2. Íconos de éxito decorativos sobre fondo verde claro a 2.88:1.
3. Foco de los ítems de menú solo con tinte de fondo (patrón de shadcn); botón de mostrar contraseña sin estilo de foco propio.
4. Sora se aplica por la regla base y también con clases explícitas en algunos componentes.
5. Logo en PNG; si llegan los SVG oficiales, solo se reemplazan los archivos de `public/brand/`.
