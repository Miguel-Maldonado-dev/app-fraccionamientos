# Rediseño visual de la app móvil — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rediseñar las pantallas de `mobile/` según las referencias y agregar estilo de color por botón configurable desde el constructor web.

**Architecture:** Columna `app_botones.estilo` (4 valores) expuesta por `estado_app_domicilio`; paleta y mapa de íconos definidos con valores idénticos en web (`src/features/app-botones/`) y app (`mobile/src/lib/`). La app gana componentes visuales compartidos (fondo con ondas, tarjeta, insignia, botón degradado, campo píldora) y cada pantalla se reconstruye con ellos sin cambiar comportamiento.

**Tech Stack:** Supabase/pgTAP, Next.js 16 + vitest, Expo SDK 58 + Expo Router + jest-expo/RNTL, lucide, react-native-svg, expo-linear-gradient (nuevo).

**Spec:** docs/superpowers/specs/2026-11-16-rediseno-app-movil-design.md (referencias en `docs/superpowers/specs/2026-11-16-rediseno-referencias/1..6.png`)

## Global Constraints

- Estilos: `'azul' | 'azul_claro' | 'navy' | 'turquesa'`; por omisión `'azul_claro'`; si falta en la respuesta ⇒ `azul_claro`.
- Paleta (spec §4.2): azul degradado `#087BE8`→`#0FB5D8` texto blanco; azul_claro fondo `#E6F1FD` título `#071F49` ícono `#087BE8` chip `#CFE3FA`; navy `#071F49`→`#0B3270` texto blanco; turquesa `#DDF6F8` título `#071F49` ícono `#0B9DB8` chip `#C3EDF1`; deshabilitado fondo `#EEF2F6` texto/ícono `#B8C4D0`.
- Íconos (iguales en web y app): puerta `DoorOpen`, pluma `Construction`, peatonal `PersonStanding`, vehiculo `CarFront`, alberca `Waves`, gimnasio `Dumbbell`, salon `PartyPopper`, otro `KeyRound`.
- Sin botón flotante de configuración ni campana. "¿Olvidaste tu contraseña?" ⇒ aviso "Pide a la administración que restablezca tu contraseña."
- Sin cambios de comportamiento: textos de error, moroso, límites, dispositivo y flujos iguales.
- Dependencias con versión exacta. Nunca `git add`/`git rm`/commit (el usuario hace los commits): los pasos "Commit" se sustituyen por snapshot del controlador.
- Solo stack local de Supabase; CLI con `</dev/null`.

## Review Focus

1. Botón deshabilitado (moroso) con estilo `azul`: debe verse gris, sin degradado — prueba en Task 4.
2. Respuesta de `/estado` sin `estilo` (servidor viejo): app pinta `azul_claro` — prueba en Task 4.
3. `estilo` inválido enviado a `guardarBoton`: error de validación, no 500 — prueba en Task 2.
4. Editar un botón existente conserva/cambia su estilo (no se resetea a `azul_claro`) — prueba en Task 2.
5. Login: el enlace "¿Olvidaste…?" no navega ni rompe el envío del formulario — prueba en Task 5.

---

### Task 1: Base de datos — columna `estilo`

**Files:**
- Create: `supabase/migrations/20261116100000_app_botones_estilo.sql`
- Create: `supabase/tests/database/087-app-botones-estilo.test.sql`
- Modify: `supabase/scripts/demo-local.sql`, `src/lib/supabase/database.types.ts`, `docs/integraciones/api-app-movil.md`

**Interfaces:** Produces columna `app_botones.estilo text not null default 'azul_claro'` con check `app_botones_estilo_check`; `estado_app_domicilio` devuelve `'estilo'` en cada botón.

- [ ] Prueba pgTAP: `col_default_is('public','app_botones','estilo', '''azul_claro''::text')`; `throws_ok` insertar `estilo='rojo'` ⇒ `23514`; RPC de un residente de prueba incluye `botones->0->>'estilo' = 'azul_claro'`.
- [ ] Correr `supabase test db </dev/null` ⇒ falla.
- [ ] Migración: alter table + check; `create or replace function public.estado_app_domicilio` copiando la definición vigente (de `20261115090000_app_movil.sql` o la migración más reciente que la redefina) y agregando `'estilo', b.estilo`.
- [ ] `supabase db reset </dev/null` (o `migration up`), pruebas pgTAP completas en verde.
- [ ] Demo: Peatonal `azul`, demás `azul_claro`. Regenerar tipos (`supabase gen types typescript --local`). Documentar `estilo` en el contrato.

### Task 2: Web — esquema, acciones y selector de estilo

**Files:**
- Modify: `src/features/app-botones/schemas.ts`, `actions.ts`, `actions.test.ts`, `queries.ts`, `components/boton-form.tsx`, `components/iconos.tsx`
- Create: `src/features/app-botones/estilos.ts`

**Interfaces:**
- Produces: `ESTILOS = ['azul','azul_claro','navy','turquesa'] as const`, `type Estilo`, `botonSchema.estilo: z.enum(ESTILOS).default('azul_claro')`, `BotonApp.estilo: Estilo`; en `estilos.ts`: `ESTILO_INFO: Record<Estilo, { etiqueta: string; fondo: string; degradado?: [string,string]; titulo: string; icono: string; chip: string; flecha: string }>` con los valores de Global Constraints (etiquetas "Azul", "Azul claro", "Navy", "Turquesa claro").

- [ ] Pruebas (`actions.test.ts`): `guardarBoton` con `estilo:'navy'` envía `estilo:'navy'` en insert y en update; con `estilo:'rojo'` devuelve error de validación sin tocar la base; sin `estilo` usa `'azul_claro'`.
- [ ] Implementar; `queries.ts` selecciona `estilo`.
- [ ] `boton-form.tsx`: grupo de radio "Estilo" con 4 muestras (cuadro con el fondo/degradado y la etiqueta), accesible por teclado; prueba de componente: elegir "Navy" y guardar llama la acción con `estilo:'navy'`; al editar, el radio inicia en el estilo del botón.
- [ ] `iconos.tsx`: peatonal `PersonStanding`, vehiculo `CarFront`.
- [ ] `npx vitest run src/features/app-botones` verde; `npx tsc --noEmit` y eslint limpios.

### Task 3: Web — vista previa de teléfono con el nuevo diseño

**Files:** Modify `src/features/app-botones/components/vista-telefono.tsx`, `constructor-botones.test.tsx`

**Interfaces:** Consumes `ESTILO_INFO`, `ICONO_INFO`, `distribucion`.

- [ ] Prueba: un botón `azul` renderiza con fondo degradado (estilo inline `background` contiene `linear-gradient` y `#087BE8`); un botón `azul_claro` usa `#E6F1FD`; cada botón muestra chip de flecha.
- [ ] Rehacer la vista previa como la referencia 2: fondo `#F5F8FC` con ondas suaves, "Hola, Residente", tarjeta de domicilio, botones (completo: ícono + nombre grande + chip; mitad: ícono arriba, nombre y chip abajo), tarjeta PIN `••••` + "Al corriente".
- [ ] Pruebas del constructor en verde (arrastrar/soltar intacto).

### Task 4: App — tokens, componentes base y botón de acceso

**Files:**
- Modify: `mobile/package.json` (`npx expo install expo-linear-gradient`, fijar exacta), `mobile/src/lib/tema.ts`, `mobile/src/lib/inicio.ts`, `mobile/src/components/boton-acceso.tsx`, `pantalla.tsx`, `encabezado.tsx`, `tarjeta-pin.tsx`
- Create: `mobile/src/lib/estilos-boton.ts` (+ `.test.ts`), `mobile/src/lib/iconos.ts`, `mobile/src/components/{fondo-ondas,tarjeta,insignia,boton-primario,campo,icono-seccion}.tsx`, `mobile/src/components/boton-acceso.test.tsx`; mock de `expo-linear-gradient` si jest lo requiere.

**Interfaces:**
- Produces: `BotonEstado.estilo?: string`; `estiloBoton(estilo: string | undefined, habilitado: boolean): { colores: string[]; titulo: string; icono: string; chip: string; flecha: string }` (desconocido/ausente ⇒ azul_claro; deshabilitado ⇒ `['#EEF2F6']` y `#B8C4D0`); `iconoBoton(icono: string): LucideIcon` (desconocido ⇒ `DoorOpen`); componentes `<Tarjeta>`, `<Insignia tipo="ok"|"error">`, `<BotonPrimario titulo onPress cargando? icono?>`, `<Campo icono etiqueta secureTextEntry? …TextInputProps>` (ojo para mostrar si es seguro), `<IconoSeccion icono>`, `<Pantalla titulo? conLogo?>` con `<FondoOndas>` detrás. `tema.ts` agrega `radio.xl = 24`, `colores.azulSuave '#EAF3FD'`, `exito '#2E9E4F'`, `exitoSuave '#E6F6EA'`, `errorSuave '#FDECEC'`, sombra azulada.
- [ ] Pruebas `estilos-boton.test.ts`: `estiloBoton('azul', true).colores` = `['#087BE8','#0FB5D8']`; `estiloBoton('azul', false).colores` = `['#EEF2F6']`; `estiloBoton(undefined, true)` = azul_claro; `estiloBoton('rojo', true)` = azul_claro.
- [ ] Prueba `boton-acceso.test.tsx`: muestra nombre, estados "Abriendo…"/"Abierto ✓" siguen funcionando, deshabilitado no llama `onPress`.
- [ ] Implementar; `npx jest` en `mobile/` verde, `npx tsc --noEmit` limpio.

### Task 5: App — Login e Inicio

**Files:** Modify `mobile/app/login.tsx`, `login.test.tsx`, `mobile/app/(tabs)/index.tsx`, `index.test.tsx`, `mobile/app/(tabs)/_layout.tsx`, `mobile/src/components/selector-domicilio.tsx`

- [ ] Prueba login: tocar "¿Olvidaste tu contraseña?" muestra "Pide a la administración que restablezca tu contraseña." y no llama `signInWithPassword`; pruebas de error existentes intactas.
- [ ] Login según referencia 1 (logotipo grande, "Iniciar sesión", tarjeta, campos píldora con ícono, botón degradado "Entrar").
- [ ] Inicio según referencia 2 (logo, "Hola, <nombre>", fila de domicilio con chevron, botones con estilo, tarjeta PIN + insignia, aviso moroso en tarjeta roja suave). Prueba existente de moroso/estado sigue verde.
- [ ] Barra de pestañas: blanca, esquinas superiores redondeadas, activa con píldora `#EAF3FD`; íconos Inicio `House`, Domicilio `DoorClosed`, Accesos `KeyRound`, Cuenta `User`.
- [ ] `npx jest` verde.

### Task 6: App — Domicilio, Accesos, Cuenta, Recibo, Agregar residente

**Files:** Modify `mobile/app/(tabs)/{domicilio,accesos,cuenta}.tsx` y sus pruebas, `mobile/app/recibo/[id].tsx` y prueba, `mobile/app/residentes/agregar.tsx`

- [ ] Domicilio (ref. 3): tarjeta de domicilio azul clara; tarjetas Cuotas/Recibos/Residentes · N con avatar de iniciales; agregar/quitar del principal intactos.
- [ ] Accesos (ref. 4): PIN destacado con degradado y ojo; tarjetas Tarjetas/Controles/Teléfonos; nota "Para cambios en tus accesos, contacta a la administración."
- [ ] Cuenta (ref. 5): avatar + teléfono formateado; Mis domicilios con check; Cambiar contraseña (dos `Campo` + "Guardar contraseña"); Acerca de; Cerrar sesión.
- [ ] Recibo (ref. 6): "‹ Volver", cabecera con importe e insignia "Pagado", filas Concepto/Fecha de pago/Método de pago/Referencia (omitir las nulas), "Compartir PDF" degradado. Prueba: con `referencia: null` no aparece la fila "Referencia".
- [ ] Agregar residente con `Campo` y `BotonPrimario`.
- [ ] `npx jest` verde, `tsc` limpio; borrar `pantalla-provisional.tsx` si queda sin uso.
