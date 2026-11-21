# Cancelar (condonar) cuotas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Estatus "Cancelada" para cuotas que se perdonan, con motivo, historial y reactivación, sin afectar morosidad.

**Architecture:** Migración (estatus 4, columnas en `cuotas`, tabla `cuotas_cancelaciones`, RPC `cancelar_cuotas`/`reactivar_cuota`, guardas en pagos, vistas y recargos); server actions + UI en la tarjeta Cuotas del detalle del domicilio; ajustes en listados, reportes y app móvil.

**Tech Stack:** Supabase (Postgres, RLS, pgTAP), Next.js 16 server actions, vitest + RTL, Expo (solo etiqueta).

**Spec:** docs/superpowers/specs/2026-11-13-cancelar-cuotas-design.md

## Global Constraints

- `estatus` id 4 nombre `'Cancelado'`; etiqueta UI "Cancelada".
- Motivo obligatorio 3–500 caracteres. Todo-o-nada; solo cuotas sin pago, no canceladas, de un mismo domicilio.
- Solo rol **administrador** cancela/reactiva (no tesorero; consola no).
- Copy: botón "Cancelar cuotas (N)"; aviso "Las cuotas canceladas no se cobrarán ni contarán para la morosidad. Puedes reactivarlas después."; toast "N cuotas canceladas"; acción "Reactivar"; chip "N Canceladas".
- Cancelar no borra `recargo_cuota`/`descuento_cuota`; reactivar recalcula estatus (Pendiente/Vencida con días de gracia) y deja recargos/descuentos como estaban.
- Cuota cancelada no se puede pagar (servidor rechaza). Tras cancelar/reactivar se encola la resincronización del domicilio.
- Solo stack local; CLI con `</dev/null`; nunca `git add`/commit.

## Review Focus

1. Proceso diario (`actualizar_estatus_cuotas` y `procesar_reglas_cobro`/recargos) sobre una cuota cancelada vencida ⇒ sigue Cancelada y sin recargo nuevo — prueba en Task 1.
2. Domicilio con 3 vencidas (umbral 3) ⇒ moroso; cancelar 1 ⇒ deja de ser moroso y `perfil_deseado` cambia a corriente — prueba en Task 1.
3. `cancelar_cuotas` con una cuota de otro fraccionamiento o de otro domicilio en el arreglo ⇒ error y nada cambia — prueba en Task 1.
4. Tesorero intenta cancelar (action o RPC) ⇒ rechazado — pruebas en Tasks 1 y 2.
5. Intentar pagar una cuota cancelada desde la web ⇒ error claro, sin pago — prueba en Tasks 1 y 2.

---

### Task 1: Base de datos

**Files:** Create `supabase/migrations/20261117090000_cancelar_cuotas.sql`, `supabase/tests/database/095-cancelar-cuotas.test.sql`. Modify `src/lib/supabase/database.types.ts` (regenerar), `supabase/scripts/demo-local.sql` only if it needs nothing (leave otherwise).

**Interfaces (Produces):** `public.cancelar_cuotas(p_cuota_ids bigint[], p_motivo text) returns integer` (canceladas); `public.reactivar_cuota(p_cuota_id bigint) returns smallint` (nuevo estatus_id); columnas `cuotas.cancelada_en/cancelada_por/motivo_cancelacion`; tabla `cuotas_cancelaciones(id, fraccionamiento_id, cuota_id, accion, motivo, usuario_id, created_at)`; vistas con `estatus_calculado = 'Cancelada'` para 4.

- [ ] pgTAP: estatus 4 existe; check columnas⇔estatus; admin cancela 2 ⇒ estatus 4 + historial 2 filas 'cancelar'; motivo '' o 'ab' ⇒ error; cuota con pago ⇒ error y ninguna cambia; ids de otro domicilio/fraccionamiento ⇒ error (RF3); tesorero ⇒ 42501 (RF4); proceso diario no toca canceladas ni crea recargo (RF1); moroso antes/después y `perfil_deseado` (RF2); reactivar vencida ⇒ 3, no vencida ⇒ 1, historial 'reactivar'; insertar pago a cuota cancelada ⇒ error (RF5, guard en el camino de pagos existente: trigger o RPC de pago); `cuotas_info.estatus_calculado = 'Cancelada'`; RLS de `cuotas_cancelaciones` (admin/tesorero leen su fraccionamiento, otro fraccionamiento 0 filas, nadie inserta directo).
- [ ] Migración: follow patterns of `20261113090000_reglas_cobro.sql` (security definer in `private`, `search_path=''`, public wrappers, grants); redefine affected views by copying their latest definitions; resync enqueue using the existing mechanism (find how pagos/acceso_forzado enqueue in `src/features/sincronizacion` / triggers).
- [ ] `supabase db reset </dev/null`, reload demo, full pgTAP green; regenerate types.

### Task 2: Server actions

**Files:** Create `src/features/cuotas/cancelacion-actions.ts` (+test). Modify pago action(s) in `src/features/pagos/actions.ts` to map the DB error to "Esta cuota está cancelada y no se puede pagar" (+test). Messages in `src/features/cuotas/messages.ts` (create or extend).

**Interfaces:** `cancelarCuotas(domicilioId: number, cuotaIds: number[], motivo: string): Promise<ActionResult<{ canceladas: number }>>`; `reactivarCuota(domicilioId: number, cuotaId: number): Promise<ActionResult>`. Validate with zod (ids ≥1 non-empty, motivo trimmed 3–500), `requireRole(ADMINISTRADOR)`, call RPC with RLS client, `revalidatePath` of `/domicilios/{id}` and `/cuotas`.

- [ ] Tests: tesorero ⇒ error sin llamar RPC (RF4); motivo corto ⇒ error; ok ⇒ `{ canceladas: 2 }`; RPC error ⇒ mensaje; reactivar ok; pago a cancelada ⇒ mensaje (RF5).
- [ ] Implement; vitest/tsc/eslint green.

### Task 3: UI web (tarjeta Cuotas, listado, reportes)

**Files:** Modify `src/features/cuotas/components/cuotas-section.tsx` (+test), create `src/features/cuotas/components/cancelar-cuotas-dialog.tsx` (+test), `src/app/(app)/domicilios/[id]/page.tsx` (pass `puedeCancelar = hasRole(user,[ADMINISTRADOR])` and actions), cuotas listado/filtros and dashboard/report totals where pending/adeudo are computed (exclude estatus 4; add "Cancelada" to estatus filter/badge).

- [ ] Tests: admin sees checkboxes only on Pendiente/Vencido/En gracia rows without pago; "Cancelar cuotas (N)" disabled at 0; dialog lists selected + total, requires motivo, shows aviso text, confirm calls `cancelarCuotas(domicilioId, ids, motivo)` and toasts "N cuotas canceladas"; cancelled row shows badge "Cancelada", motivo/quién/fecha, no Pagar/Editar, admin sees "Reactivar" with confirm; tesorero sees neither checkboxes nor Reactivar; chips: Pendientes excludes canceladas, "N Canceladas" shown when >0.
- [ ] Implement with existing pieces (SectionCard, IconButton, ConfirmDialog/FormDialog, Badge neutral); follow repo style; full vitest/tsc/eslint green.

### Task 4: App móvil

**Files:** `mobile/app/(tabs)/domicilio.tsx` (+test) and any estatus mapping in `mobile/src`.

- [ ] Test: cuota with `estatus_calculado: 'Cancelada'` renders a neutral "Cancelada" chip (light and dark palette).
- [ ] Implement; `npx jest`, `npx tsc --noEmit` in mobile/.
