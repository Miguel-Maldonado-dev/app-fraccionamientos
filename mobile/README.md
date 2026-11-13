# WEADMI Residentes (app móvil)

App Expo (SDK 58, Expo Router, TypeScript) para residentes. Consume Supabase Auth y las rutas `/api/app/*` de la web (contrato en `docs/integraciones/api-app-movil.md`).

## Probar en tu teléfono (Expo Go)

Necesitas: la Mac y el teléfono en la **misma red Wi-Fi**, y el stack local de Supabase corriendo con datos demo (`supabase start`, `supabase db reset` y `supabase/scripts/demo-local.sql`, ver README raíz).

1. **Instala Expo Go** en el teléfono (App Store o Google Play).
2. **Levanta la web** escuchando en la red local. En la raíz del repo:
   ```sh
   npm run dev -- -H 0.0.0.0
   ```
3. **Averigua la IP de tu Mac** en el Wi-Fi:
   ```sh
   ipconfig getifaddr en0
   ```
   (por ejemplo `192.168.1.14`; usa esa IP, nunca `localhost`).
4. **Obtén el puerto de Supabase y la llave anon** con `supabase status` (puerto del `API_URL`, normalmente `55321`, y `ANON_KEY`).
5. **Crea `mobile/.env`** (copia `mobile/.env.example`):
   ```sh
   EXPO_PUBLIC_API_URL=http://<ip>:3000
   EXPO_PUBLIC_SUPABASE_URL=http://<ip>:<puerto del API de supabase status>
   EXPO_PUBLIC_SUPABASE_ANON_KEY=<ANON_KEY de supabase status>
   ```
6. **Arranca la app**:
   ```sh
   cd mobile && npm install && npx expo start
   ```
7. **Escanea el QR** con la cámara (iPhone) o desde Expo Go (Android).
8. Entra con el usuario demo: teléfono `3300000001`, contraseña `residente123`.

Si no conecta: revisa que ambos estén en el mismo Wi-Fi, que el firewall de macOS permita conexiones entrantes a Node, y reinicia `npx expo start -c` tras editar `.env`.

## Un dispositivo por cuenta

Cada cuenta queda ligada al primer dispositivo que la usa (cabecera `X-Device-Id`). Desde otro dispositivo verás "Esta cuenta está ligada a otro dispositivo. Pide a la administración que la desligue."

Para desligarlo desde la web: entra a `http://localhost:3000` con `admin.demo@local.test` / `admin12345` → el domicilio del residente → **Residentes** → **Desligar dispositivo**. El siguiente dispositivo que inicie sesión queda ligado.

## Apertura remota

Los botones de apertura (puertas, portones) llaman a access-core a través de la web. En local solo funcionan con una **instalación real de access-core** configurada (`ACCESS_CORE_API_URL`, `ACCESS_CORE_API_KEY` y `instalacion_id` del fraccionamiento); sin ella verás "No se pudo abrir". El resto de la app (cuotas, recibos, residentes, PIN) funciona con los datos demo.

## Scripts

- `npm test` — jest (jest-expo + Testing Library).
- `npx tsc --noEmit` — typecheck.
- `npx expo-doctor` — diagnóstico del proyecto.

Las dependencias se agregan con `npx expo install` y se fijan a versión exacta (sin `^`/`~`). Solo se usan variables `EXPO_PUBLIC_*`; nada secreto va en la app.
