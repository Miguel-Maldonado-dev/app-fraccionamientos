# Registros de acceso — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Pestaña "Registros" en Accesos (admin y consola super admin) que consulta, filtra y exporta (Excel/PDF) los logs de access-core.

**Architecture:** Cliente access-core `listarLogs`/`listarPaneles` (server-only); módulo de dominio puro que valida filtros y traduce cada log a una fila; server actions con validación de rol/fraccionamiento que devuelven una página traducida; UI con filtros en la URL; exportación conducida por el navegador página por página con `exceljs`/`jsPDF` cargados con `import()`.

**Tech Stack:** Next.js 16 (App Router, server actions), Supabase, zod, vitest + RTL, exceljs 4.4.0, jspdf 4.2.1, jspdf-autotable 5.0.9.

**Spec:** docs/superpowers/specs/2026-11-13-registros-acceso-design.md

## Global Constraints

- API: `GET /installations/{id}/logs?desde&hasta&panel&titular&resultado&origen&pagina` ⇒ `{ data, page, page_size: 50, total }`; `GET /installations/{id}/panels`.
- Rango obligatorio, por omisión hoy–hoy, máximo 31 días; desde ≤ hasta.
- Exportación: tope 5,000 registros (100 páginas); aviso "Se exportarán los primeros 5,000 de N registros; reduce el rango para obtener todos".
- Fecha/hora: tal como viene en `ts` (hora de pared del panel), formato `dd/mm/aaaa HH:mm:ss`, sin convertir zona.
- Textos de origen y motivo exactamente como spec §4.2.
- Roles: administrador (su fraccionamiento) y super admin. Tesorero no ve Registros. Llave de access-core solo en servidor.
- URL: admin `/accesos?vista=registros|sincronizacion`; consola `?tab=accesos&vista=…`; filtros `desde, hasta, domicilio, panel, resultado, origen, pagina`.
- Nunca `git add`/`rm`/commit (snapshots del controlador). Leer `node_modules/next/dist/docs` antes de usar APIs de Next.

## Review Focus

1. Filtros inválidos en la URL (fecha mal formada, origen '9', pagina '0') ⇒ se ignoran/normalizan sin 500 — prueba en Task 2.
2. Administrador pidiendo registros con `fraccionamientoId` ajeno (manipulando la action) ⇒ rechazado — prueba en Task 2.
3. Log con todos los opcionales nulos (`holder_*`, `code`, `output_*`) ⇒ fila con "—", sin crash — prueba en Task 1.
4. 429 de access-core en la consulta de pantalla ⇒ "Demasiadas consultas, espera un momento" — prueba en Task 2.
5. Exportación con `total` = 0 ⇒ no genera archivo y avisa "No hay registros para exportar" — prueba en Task 4.

---

### Task 1: Cliente access-core y traducción de logs

**Files:** Create `src/lib/access-core/logs.ts` (+ `logs.test.ts`), export from `src/lib/access-core/index.ts`; add `Log`, `Panel` types to `tipos.ts`. Create `src/features/registros-acceso/traduccion.ts` (+ test).

**Interfaces (Produces):**
- `listarLogs(instalacionId: string, filtros: FiltrosApi): Promise<{ data: Log[]; page: number; page_size: number; total: number }>` where `FiltrosApi = { desde: string; hasta: string; panel?: string; titular?: string; resultado?: 'permitido'|'denegado'; origen?: '0'|'1'|'2'|'3'|'4'|'5'; pagina: number }` (omit undefined params; encode).
- `listarPaneles(instalacionId: string): Promise<{ id: string; panel_code: string }[]>`.
- `ORIGENES: Record<0|1|2|3|4|5, string>`, `MOTIVOS: Record<number, string>` (spec §4.2 verbatim).
- `type FilaRegistro = { id: number; fechaHora: string; panel: string; titular: string; origen: string; credencial: string; salida: string; permitido: boolean; resultado: 'Permitido'|'Denegado'; motivo: string }`.
- `traducirLog(log: Log, domicilioPorTitular: Map<string, string>): FilaRegistro`; `formatearTs(ts: string): string` (wall clock from the string, e.g. `'2026-11-13T19:05:09-06:00'` ⇒ `'13/11/2026 19:05:09'`; no Date timezone conversion).

- [ ] Tests: `listarLogs` builds `/installations/i1/logs?desde=2026-11-01&hasta=2026-11-13&resultado=denegado&pagina=2` (mock `llamar`), omits empty filters; `traducirLog` maps holder via map ⇒ dirección, else `holder_name`, else '—'; credencial = label ?? String(code) ?? '—'; salida = alias ?? `Salida ${index}` ?? '—'; reason 10 ⇒ 'PIN bloqueado'; source 4 ⇒ 'Remota (app)'; all-null log ⇒ '—' fields (Review Focus 3); `formatearTs` cases with offset, with `Z`, and with fractional seconds.
- [ ] Implement; `npx vitest run src/lib/access-core src/features/registros-acceso` green; tsc clean.

### Task 2: Filtros, permisos y consulta del servidor

**Files:** Create `src/features/registros-acceso/filtros.ts` (+test), `src/features/registros-acceso/actions.ts` (+test).

**Interfaces:**
- Consumes Task 1.
- Produces: `type Filtros = { desde: string; hasta: string; domicilio?: number; panel?: string; resultado?: 'permitido'|'denegado'; origen?: '0'..'5'; pagina: number }`; `leerFiltros(sp: Record<string, string|string[]|undefined>, hoy: string): { filtros: Filtros; error: string | null }` (invalid values dropped/normalized; >31 días or desde>hasta ⇒ `error` "El rango máximo es de 31 días" / "La fecha inicial debe ser anterior a la final", filtros reset to hoy–hoy); `filtrosAParams(f: Filtros): URLSearchParams`.
- `consultarRegistros(fraccionamientoId: number | null, filtros: Filtros): Promise<ResultadoRegistros>` (server action; `null` = fraccionamiento del administrador en sesión; número = solo super admin) where `ResultadoRegistros = { ok: true; filas: FilaRegistro[]; total: number; pagina: number; paginas: number } | { ok: false; error: string; sinInstalacion?: boolean }`.
- `opcionesRegistros(fraccionamientoId: number | null): Promise<{ domicilios: { id: number; direccion: string }[]; paneles: { id: string; panel_code: string }[] }>` (domicilios with `titular_id` only).
- Authorization: administrador ⇒ only own tenant (ignore/deny other id); super admin via `requireSuperAdmin` when id given; tesorero/others ⇒ `{ ok:false, error:'No autorizado' }`. Domicilio filter ⇒ resolve its `titular_id` within the fraccionamiento (RLS client) and pass as `titular`. Build `domicilioPorTitular` from domicilios of the fraccionamiento.
- Errors: AccessCoreError 429 ⇒ 'Demasiadas consultas, espera un momento'; other ⇒ 'No se pudieron cargar los registros'; no instalación ⇒ `{ ok:false, sinInstalacion:true, error:'Este fraccionamiento no tiene instalación de access-core.' }`.

- [ ] Tests: `leerFiltros` default hoy; 32 días ⇒ error; desde>hasta ⇒ error; origen '9', pagina '0', fecha 'abc' ⇒ normalizados (Review Focus 1); actions: administrador con id ajeno ⇒ No autorizado y `llamar` no llamado (Review Focus 2); tesorero ⇒ No autorizado; domicilio ⇒ `titular` = su titular_id; 429 ⇒ mensaje (Review Focus 4); sin instalación ⇒ sinInstalacion; `paginas = ceil(total/50)`.
- [ ] Implement following existing patterns (`requireRole`, `requireSuperAdmin`, `instalacionDe`, `getTenantContext`); vitest green; tsc/eslint clean.

### Task 3: Pantalla Registros en Accesos (admin y consola)

**Files:** Create `src/features/registros-acceso/components/{registros-tab,registros-filtros,registros-tabla}.tsx` (+tests), `src/features/registros-acceso/components/accesos-vistas.tsx` (tabs Registros/Sincronización). Modify `src/app/(app)/accesos/page.tsx` (+test), `src/app/admin/fraccionamientos/[id]/page.tsx` (+test).

**Interfaces:** Consumes Task 2 (`leerFiltros`, `filtrosAParams`, `consultarRegistros`, `opcionesRegistros`). Produces `<RegistrosTab fraccionamientoId={number|null} searchParams=… />` (server component) and a placeholder slot `exportar?: ReactNode` in the filter bar for Task 4.

- [ ] Tests: admin page shows tabs "Registros" (default) and "Sincronización"; tesorero sees only Sincronización content and no "Registros"; vista=sincronizacion renders the existing `PanelSincronizacion`; console `tab=accesos&vista=registros` renders RegistrosTab with the fraccionamiento id; table renders columns "Fecha y hora, Panel, Domicilio / titular, Origen, Credencial, Salida, Resultado, Motivo", Permitido/Denegado badges, total "1,234 registros", "Página X de Y" with prev/next links preserving filters; empty ⇒ "No hay registros con estos filtros."; error ⇒ message + Reintentar; filter validation error shown.
- [ ] Implement: filters as a GET form/links updating searchParams (desde/hasta date inputs, domicilio, panel, resultado, origen, "Limpiar"); table styled like Domicilios table; load `frontend-design` and `vercel-react-best-practices` skills first. Update PageHeader description of /accesos to cover both views.
- [ ] Full `npx vitest run`, tsc, eslint green.

### Task 4: Exportar a Excel y PDF

**Files:** Create `src/features/registros-acceso/export/{generar.ts,generar.test.ts}`, `src/features/registros-acceso/components/exportar-registros.tsx` (+test). Modify `actions.ts` (add `paginaExport`), `registros-tab.tsx` (mount button). Reuse logo loading/brand colors pattern from `src/features/movimientos/export/generar.ts`.

**Interfaces:**
- `paginaExport(fraccionamientoId: number | null, filtros: Filtros, pagina: number): Promise<ResultadoRegistros>` — same auth as `consultarRegistros`; on 429 waits `Retry-After` (max 10 s) and retries once.
- `metaExport` returned with first page: `{ fraccionamiento: string; generadoPor: string; generadoEn: string }` (add to `ResultadoRegistros` ok branch as optional `meta`).
- `generarExcel(filas: FilaRegistro[], meta: MetaRegistros): Promise<Blob>`; `generarPdf(filas, meta): Promise<Blob>` with `MetaRegistros = { fraccionamiento; desde; hasta; filtros: string[]; generadoPor; generadoEn; total; exportados }`.
- Filename `registros-acceso-<slug>-<desde>_<hasta>.xlsx|pdf`.

- [ ] Tests: `generarExcel` ⇒ sheets "Registros" (8 columns, same headers) and "Información"; `generarPdf` ⇒ landscape letter, contains "Registros de acceso", period, "Generado por", "Página 1 de"; component: total 0 ⇒ "No hay registros para exportar" and no download (Review Focus 5); total 6,000 ⇒ confirm text "Se exportarán los primeros 5,000 de 6,000 registros; reduce el rango para obtener todos"; progress "Exportando… 2 de 3"; calls `paginaExport` sequentially pages 1..n (n = min(ceil(total/50), 100)); failure ⇒ "No se pudo completar la exportación, intenta de nuevo".
- [ ] Implement; `exceljs`/`jspdf` only via `import()`; button "Exportar" with menu Excel / PDF, disabled with "Exportando…" while running.
- [ ] Full vitest, tsc, eslint green.
