# Rediseño de tarjetas y tablas en tarjeta (web) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Aplicar el estilo de las imágenes de referencia a las tarjetas con tabla (inicio, detalle de domicilio, consola, configuración y demás tablas dentro de tarjetas) sin cambiar comportamiento.

**Architecture:** Extender piezas compartidas (`SectionCard`, `DataTable` con `variante='tarjeta'`, nuevas `StatChip`, `IconButton`, `DateBlock`, `PeriodoPill`) y luego migrar cada sección a ellas.

**Tech Stack:** Next.js 16, React, Tailwind, lucide-react, vitest + RTL.

**Spec:** docs/superpowers/specs/2026-11-13-rediseno-tarjetas-web-design.md (referencias visuales: `docs/superpowers/specs/2026-11-13-rediseno-tarjetas-referencias/{8,9,10}.png`)

## Global Constraints

- Estilo nuevo **solo** en tablas dentro de tarjetas (`SectionCard`/`Card`); tablas de página completa (Domicilios, Pagos, Usuarios, Cuotas listado general, Registros de acceso) no cambian. `DataTable` por omisión = como hoy.
- Ninguna acción cambia ni desaparece; botones de ícono con `aria-label` igual al texto de la acción actual.
- Textos: "Tus transacciones más recientes", "Ver todos", "Administración de cuotas y pagos", "Cobros adicionales del domicilio", "Acceso a la app: N de M", chips "N / M · con acceso", "N · Pagadas", "N · Pendientes".
- Usar tokens existentes (`brand-primary`, `brand-navy`, `muted`, `success`, `danger`). Nunca `git add`/`rm`/commit. Leer `node_modules/next/dist/docs` si se tocan APIs de Next.

## Review Focus

1. Tabla de página completa (p. ej. listado de Domicilios) sin cambios visuales — prueba en Task 1 (DataTable por omisión no aplica clases de tarjeta).
2. Fila de residente sin cuenta/sin dispositivo y residente no principal ⇒ "—" y sin botones que hoy no aparecen — prueba en Task 3.
3. Rol tesorero/administrador ve exactamente las mismas acciones que antes en Residentes/Cuotas — prueba en Task 3.
4. Concepto largo en Últimos movimientos se trunca con "…" y conserva el texto completo en `title` — prueba en Task 2.
5. Acciones con confirmación (eliminar) siguen pidiendo confirmación tras pasar a botón de ícono — prueba en Tasks 3 y 4.

---

### Task 1: Piezas compartidas

**Files:** Modify `src/components/section-card.tsx` (+test), `src/components/data-table.tsx` (+test). Create `src/components/stat-chip.tsx`, `src/components/icon-button.tsx`, `src/components/date-block.tsx`, `src/components/periodo-pill.tsx` (+tests). Copy the 3 reference images from `/private/tmp/claude-501/-Users-miguelangelmaldonadovillar-dev-app-fraccionamientos/b8a19295-34ed-4972-ba96-555b586b6e7c/images/{8,9,10}.png` to `docs/superpowers/specs/2026-11-13-rediseno-tarjetas-referencias/`.

**Interfaces (Produces):**
- `SectionCard` adds `stats?: ReactNode` (left of `action`, divided by vertical line) and renders `icon` inside a rounded tile (~44px, `bg-brand-primary/10`, icon `text-brand-primary`) followed by a thin vertical divider; without icon unchanged layout.
- `StatChip({ icon: LucideIcon, valor: ReactNode, etiqueta: string, tono?: 'neutral'|'success'|'info' })`.
- `IconButton({ icon: LucideIcon, label: string, onClick?, tono?: 'default'|'danger', asChild?, disabled? })` — square bordered 36px, `aria-label={label}`, tooltip/title = label; forwards ref (works as Radix trigger).
- `DateBlock({ fecha: string /* AAAA-MM-DD */ })` ⇒ day number + uppercase short Spanish month ("NOV") in muted box.
- `PeriodoPill({ children })` ⇒ blue-soft pill.
- `DataTable` adds `variante?: 'pagina' | 'tarjeta'` (default `'pagina'`) and `Column.icon?: LucideIcon`; `'tarjeta'` ⇒ header row rounded/inset `bg-muted`, header text medium with icon before title. Also export `encabezadoTarjeta` class helpers (`CARD_TABLE_HEAD_ROW`, `CardTableHead({ icon, children, className })`) for non-DataTable tables in cards.

- [ ] Tests: SectionCard with `stats` renders it before action; icon rendered inside tile (`data-slot="section-card-icon-tile"`); DataTable default has no `data-variante="tarjeta"` and header cells have no icon; with `variante="tarjeta"` header row has `data-variante="tarjeta"` and column icon is rendered (`aria-hidden`); DateBlock('2026-11-13') ⇒ '13' and 'NOV'; IconButton has accessible name = label and danger tone class.
- [ ] Implement; `npx vitest run src/components` then full suite, tsc, eslint green.

### Task 2: Inicio (Últimos movimientos) y consola (Por fraccionamiento)

**Files:** Modify `src/features/dashboard/components/ultimos-movimientos.tsx` (+test), `src/features/fraccionamientos/components/metricas-plataforma.tsx` (+test).

- [ ] Últimos movimientos per spec §4.2.1 (reference 8.png): icon `ReceiptText` tile, title, "Tus transacciones más recientes", primary button "Ver todos →" (link existing destination), columns Fecha (`Calendar`, `DateBlock`), Concepto (`FileText`, truncate with `title`), Tipo (`ArrowLeftRight`: round arrow-up green / arrow-down red + existing badge Ingreso/Egreso), Importe (`Coins`, right, "+ $500.00" green / "- $…" red). Test: concept truncation + title (Review Focus 4); egreso row shows "- " and danger color.
- [ ] Por fraccionamiento (reference 10.png): `PieChart` icon tile, `variante="tarjeta"`, Estado badge "Activo", numeric columns right-aligned; keep sorting/pagination. Test: header row is tarjeta variant; existing tests green.
- [ ] Full vitest, tsc, eslint green.

### Task 3: Detalle de domicilio (Residentes, Cuotas, Pagos extra)

**Files:** Modify `src/features/residentes/components/residentes-section.tsx` (+test), `src/features/residentes/components/residente-actions.tsx`, `src/features/cuotas/components/cuotas-section.tsx` / `cuotas-table.tsx` (+tests), `src/features/pagos/components/pagos-extra-section.tsx` (+test).

- [ ] Residentes (9.png): `Users` tile, description "Acceso a la app: N de M" (N residentes con acceso, M máximo del fraccionamiento already available), `StatChip` "N / M" "con acceso", button "+ Agregar residente"; columns Nombre (`User`, avatar iniciales), Teléfono (`Phone`), Residente principal (`House`, pill "✓ Sí" success or "—"), App (`Smartphone`, "Con acceso"/"Sin acceso" + device line as today), Acciones (existing actions as `IconButton`s, delete `danger`, same visibility rules and confirmations). Tests: Review Focus 2, 3, 5.
- [ ] Cuotas (9.png): `Coins` tile, "Administración de cuotas y pagos", chips success "Pagadas" and neutral "Pendientes" (counts from current rows' estatus), "+ Crear cuota"; columns Periodo (`Calendar`, `PeriodoPill`), Concepto (`FileText`), Importe (`Coins`, bold), Vencimiento (`CalendarClock`), Estado (`Activity`, existing badge), Acciones (bordered buttons, e.g. "Recibo", plus existing). Tests: counts; actions unchanged.
- [ ] Pagos extra: same style, description "Cobros adicionales del domicilio", chips Pagados/Pendientes if the data has estatus (else omit), columns with icons, bordered actions. Test: renders tarjeta header.
- [ ] Full vitest, tsc, eslint green.

### Task 4: Configuración (catálogos) y demás tablas en tarjeta

**Files:** Modify `src/features/catalogos/components/{catalogo-section,tipos-cuota-section}.tsx` (+tests); inventory and migrate other in-card tables: `src/features/controles/components/controles-card.tsx`, `src/features/accesos/components/accesos-section.tsx`, `src/features/dashboard/components/estado-cuotas.tsx`, `src/features/pin/components/pin-card.tsx`, `src/features/domicilios/components/acceso-forzado.tsx`, `src/app/admin/fraccionamientos/[id]/page.tsx` sections — only those that contain a table.

- [ ] Catálogos (Tipos de cuota, Conceptos extra, Descuentos, Recargos): icon tile, description kept, `variante="tarjeta"` with column icons, row actions as `IconButton`s (edit, delete `danger` with confirmation). Tests: delete still confirms (Review Focus 5); header tarjeta.
- [ ] For each other in-card table found: apply `variante="tarjeta"` or `CardTableHead`; list them in the report. Do not touch full-page tables.
- [ ] Full vitest, tsc, eslint green.
