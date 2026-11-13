# Modo oscuro app móvil — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Selector de apariencia Automático/Claro/Oscuro en Cuenta y todas las pantallas de `mobile/` con tema claro y oscuro.

**Architecture:** Paletas con las mismas claves en `tema.ts`; `AparienciaProvider` guarda la preferencia en SecureStore y expone el esquema efectivo; los componentes crean estilos con `useEstilos(crear)` a partir de la paleta activa.

**Tech Stack:** Expo SDK 58, Expo Router, expo-secure-store, jest-expo + RNTL.

**Spec:** docs/superpowers/specs/2026-11-17-modo-oscuro-app-movil-design.md

## Global Constraints

- Preferencias: `'auto' | 'claro' | 'oscuro'`, por omisión `'auto'`; clave SecureStore `apariencia`.
- Textos: tarjeta "Apariencia", opciones "Automático", "Claro", "Oscuro"; colocada antes de "Cerrar sesión".
- Paleta oscura y estilos oscuros de botones: valores exactos del spec.
- Sin cambios de comportamiento ni de servidor/web. Nunca `git add`/`rm`/commit. Dependencias exactas.

## Review Focus

1. Valor inválido o error leyendo SecureStore ⇒ `'auto'` sin crashear — prueba en Task 1.
2. Con 'auto', cambio del esquema del sistema actualiza la app — prueba en Task 1 (mock de `useColorScheme`).
3. Botón deshabilitado en oscuro se ve deshabilitado (`#1A2638`) — prueba en Task 1.
4. Ningún color literal claro sobrante en pantallas (`#FFFFFF` de superficie, `colores.` estático) — verificación por grep en Task 3.
5. Modal del selector de domicilio y barra de pestañas también cambian — Task 2.

---

### Task 1: Infraestructura de tema y selector en Cuenta

**Files:** Modify `mobile/src/lib/tema.ts`, `mobile/src/lib/estilos-boton.ts` (+test), `mobile/app/_layout.tsx`, `mobile/app.json`, `mobile/app/(tabs)/cuenta.tsx` (+test). Create `mobile/src/lib/apariencia.tsx` (+ `apariencia.test.tsx`).

**Interfaces (Produces):**
- `tema.ts`: `type Paleta` (claves de `colores` actuales), `paletaClara: Paleta` (= colores actuales; `colores` se conserva como alias de `paletaClara` hasta Task 3), `paletaOscura: Paleta`, `sombraPara(esquema): ViewStyle`.
- `apariencia.tsx`: `type Preferencia = 'auto'|'claro'|'oscuro'`; `AparienciaProvider`; `useApariencia(): { preferencia; setPreferencia(p): void; esquema: 'claro'|'oscuro' }`; `useTema(): Paleta`; `useEstilos<T>(crear: (c: Paleta, esquema) => T): T` (memo por esquema).
- `estiloBoton(estilo, habilitado, esquema: 'claro'|'oscuro' = 'claro')`.

- [ ] Pruebas: lee 'oscuro' guardado ⇒ `esquema==='oscuro'`; valor 'rojo' o error de lectura ⇒ `preferencia==='auto'`; 'auto' + `useColorScheme()==='dark'` ⇒ oscuro; `setPreferencia('claro')` guarda en SecureStore; `estiloBoton('azul_claro', true, 'oscuro').colores` = `['#17304F']`; deshabilitado oscuro = `['#1A2638']`.
- [ ] Implementar; envolver la app en `AparienciaProvider` en `app/_layout.tsx`; `StatusBar style` según esquema; `app.json` `userInterfaceStyle: "automatic"`.
- [ ] Cuenta: tarjeta "Apariencia" con control segmentado (accessibilityRole radio, `accessibilityState.selected`) antes de "Cerrar sesión", y la pantalla Cuenta ya usa `useEstilos`. Prueba: tocar "Oscuro" llama `setItemAsync('apariencia','oscuro')` y queda seleccionada.
- [ ] `npx jest`, `npx tsc --noEmit` verdes.

### Task 2: Componentes compartidos, Login e Inicio

**Files:** Modify `mobile/src/components/*.tsx` (pantalla, encabezado, tarjeta, insignia, boton-primario, campo, icono-seccion, fondo-ondas, tarjeta-pin, selector-domicilio, boton-acceso), `mobile/app/login.tsx`, `mobile/app/(tabs)/index.tsx`, `mobile/app/(tabs)/_layout.tsx`.

- [ ] Prueba: renderizar Inicio dentro del provider con preferencia 'oscuro' ⇒ fondo de la pantalla `#0A1424`; `BotonAcceso` azul_claro en oscuro usa `#17304F`.
- [ ] Convertir cada archivo a `useTema`/`useEstilos`; literales claros a claves de paleta; ondas con opacidad baja en oscuro; logotipo legible (pastilla clara si hace falta); barra de pestañas y modal del selector temáticos.
- [ ] `npx jest`, `tsc` verdes.

### Task 3: Domicilio, Accesos, Recibo, Agregar residente y limpieza

**Files:** Modify `mobile/app/(tabs)/{domicilio,accesos}.tsx`, `mobile/app/recibo/[id].tsx`, `mobile/app/residentes/agregar.tsx`, `mobile/src/lib/tema.ts`.

- [ ] Convertir a `useTema`/`useEstilos`. Prueba: Recibo en oscuro ⇒ fondo `#0A1424`.
- [ ] Quitar el alias estático `colores` si ya nada lo usa; `grep -rn "colores\.\|#FFFFFF" app src` sin usos estáticos de colores de superficie/texto (degradados y texto sobre degradado pueden quedar blancos).
- [ ] `npx jest`, `tsc` verdes.
