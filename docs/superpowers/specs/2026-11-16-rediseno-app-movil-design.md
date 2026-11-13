# Rediseño visual de la app móvil WEADMI — Diseño

Estado: borrador para aprobación (2026-11-16).

## 1. Intención

Actualizar la app de residentes (`mobile/`) a un diseño más moderno, llamativo y minimalista, tomando
como referencia 6 pantallas que entregó el usuario (Login, Inicio, Domicilio, Accesos, Cuenta, Recibo).
Los botones de apertura se configuran desde la web (constructor `app_botones`); por eso el
constructor web gana un **estilo de color por botón**, y su vista previa de teléfono se actualiza para
verse igual que la app nueva.

## 2. Metas, no metas, anti-metas

Metas
- Las 6 pantallas de la app con el lenguaje visual de las referencias (sección 4).
- Columna `estilo` en `app_botones` con paleta cerrada; selector en el constructor web; la app y la vista
  previa la respetan.
- Íconos de los botones redibujados con el mismo set en web (vista previa/selector) y app.

No metas
- Botón flotante de configuración (aparece en las referencias: se ignora, pedido del usuario).
- Campana de notificaciones (no existe la función: se omite).
- Recuperación de contraseña real (ver "¿Olvidaste tu contraseña?" abajo).
- Rediseño del resto de la web (solo el constructor de botones y su vista previa).
- Modo oscuro, nuevas funciones o cambios a la API más allá de exponer `estilo`.

Anti-metas
- Ningún botón de acceso completamente blanco.
- Ninguna combinación de color ilegible (por eso la paleta es cerrada).
- Ningún cambio de comportamiento: reglas de moroso, límites, ligado a dispositivo, mensajes de error y
  flujos quedan igual; las pruebas de comportamiento existentes deben seguir pasando (se ajustan solo
  textos/estructura visual si cambian).

## 3. Enfoques considerados

- **Color: A (elegido) paleta cerrada de 4 estilos** de la marca. B selector de color libre: descartado,
  permite combinaciones ilegibles y rompe el minimalismo; el degradado sería difícil de exponer.
- **Notificaciones / olvidé contraseña: A (elegido)** "¿Olvidaste tu contraseña?" muestra un aviso
  "Pide a la administración que restablezca tu contraseña."; la campana se omite. B (mostrar sin
  función) y C (quitar ambas) descartados.
- **Íconos:** ya existen en `app_botones.icono` (`puerta, pluma, peatonal, vehiculo, alberca, gimnasio,
  salon, otro`); no se infieren del nombre. Solo se actualiza su dibujo, igual en web y app.

## 4. Diseño

### 4.1 Datos y API
- Migración nueva: `app_botones.estilo text not null default 'azul_claro'` con check
  `estilo in ('azul', 'azul_claro', 'navy', 'turquesa')`. Filas existentes quedan `azul_claro`.
- `estado_app_domicilio` (RPC) incluye `'estilo'` en cada botón; las acciones del constructor (crear,
  editar, reordenar si copia filas) lo aceptan y validan (zod con los 4 valores). Regenerar
  `database.types.ts`. pgTAP: check rechaza valor inválido; RPC devuelve `estilo`.
- Contrato `docs/integraciones/api-app-movil.md`: documentar `estilo`.

### 4.2 Paleta de estilos (compartida web/app; valores iguales en ambos lados)
| estilo | fondo | texto/ícono | chip de flecha |
|---|---|---|---|
| `azul` | degradado diagonal `#087BE8` → `#0FB5D8` | blanco | blanco 20% opacidad |
| `azul_claro` | `#E6F1FD` | título `#071F49`, ícono `#087BE8` | `#CFE3FA`, flecha `#087BE8` |
| `navy` | `#071F49` (degradado sutil a `#0B3270`) | blanco | blanco 15% |
| `turquesa` | `#DDF6F8` | título `#071F49`, ícono `#0B9DB8` | `#C3EDF1`, flecha `#0B9DB8` |

Deshabilitado (moroso o `habilitado=false`): fondo `#EEF2F6`, texto/ícono `#B8C4D0`, sin degradado.

### 4.3 Lenguaje visual de la app (de las referencias)
- Fondo `#F5F8FC` con **ondas decorativas** suaves (azul/turquesa muy claros) arriba a la derecha y abajo
  a la izquierda, detrás del contenido (SVG con `react-native-svg`, ya instalado).
- Encabezado: logotipo WEADMI (asset existente `logotipo-weadmi.png`) arriba a la izquierda; título de
  pantalla grande (Sora Bold ~32) debajo.
- Tarjetas blancas, radio 20–24, sombra azulada muy suave, sin bordes duros. Íconos de sección en
  cuadro redondeado `#EAF3FD` con ícono azul de línea (lucide).
- Insignias de estatus en píldora: "Al corriente"/"Pagado" verde suave con punto/check; "Con adeudo" en
  rojo suave.
- Botón primario: píldora con degradado azul (`#0A8CF0` → `#0663D6`), texto blanco.
- Campos: píldora con borde `#DCE6F0`, ícono a la izquierda separado por línea fina; ojo para mostrar
  contraseña.
- Barra de pestañas: blanca, esquinas superiores redondeadas, íconos de línea + etiqueta; la activa con
  fondo píldora `#EAF3FD` y color primario.
- Degradados: agregar `expo-linear-gradient` (versión exacta compatible con la SDK 58, funciona en Expo
  Go). Decisión mía.

### 4.4 Pantallas
- **Login:** logotipo grande centrado, "Iniciar sesión", tarjeta con Teléfono (ícono teléfono,
  "10 dígitos") y Contraseña (candado, "Tu contraseña", ojo), enlace "¿Olvidaste tu contraseña?" (aviso
  de la sección 3), botón "Entrar".
- **Inicio:** "Hola, <nombre>"; fila de domicilio (ícono casa, calle en mayúsculas, fraccionamiento,
  chevron → selector si hay varios). Botones según `estilo`/`icono`/`ancho_completo` con la misma
  distribución actual (2 columnas; ancho completo o último impar ⇒ fila completa). Botón ancho completo:
  ícono + nombre grande + chip de flecha a la derecha; botón de media fila: ícono arriba, nombre abajo y
  chip de flecha. Estados "Abriendo…/Abierto ✓/No se pudo abrir/mensaje" se muestran dentro del botón.
  Tarjeta PIN (candado, "PIN de acceso", •••• con ojo) + insignia de estatus a la derecha. Aviso de
  moroso como tarjeta suave roja. Jalar para actualizar se mantiene.
- **Domicilio:** tarjeta de domicilio (fondo azul muy claro); tarjetas Cuotas (última cuota destacada,
  insignia), Recibos (importe · concepto, fecha, "Ver ↗"), Residentes · N (avatar con iniciales en
  círculo de color suave, nombre, "Principal · teléfono"); "+ Agregar residente" y "Quitar" del principal
  se mantienen con el nuevo estilo.
- **Accesos:** tarjeta de domicilio; tarjeta PIN destacada con degradado azul (PIN grande espaciado, ojo);
  tarjetas Tarjetas/Controles/Teléfonos (ícono, título, valores o "Sin … registrados."); nota informativa
  "Para cambios en tus accesos, contacta a la administración."
- **Cuenta:** avatar + teléfono formateado; tarjetas Mis domicilios (actual marcada con check), Cambiar
  contraseña (dos campos píldora con ojo, botón "Guardar contraseña"), Acerca de (nombre y versión),
  Cerrar sesión.
- **Recibo:** "‹ Volver", título "Recibo"; tarjeta con cabecera azul clara (ícono recibo, importe grande,
  insignia "Pagado"); filas Concepto, Fecha de pago, Método de pago, Referencia con ícono en cuadro;
  botón "Compartir PDF" con degradado. Reemplaza la vista JSON actual por estas filas (datos del recibo
  existente; campos ausentes se omiten).
- **Agregar residente:** mismos campos y estilo de formulario.

### 4.5 Web
- Constructor de botones (`src/features/app-botones/`): en el formulario de botón, selector de estilo con
  4 muestras visuales (radio de tarjetas pequeñas). La vista previa de teléfono replica el Inicio nuevo
  (fondo, tarjeta de domicilio, botones con estilo/ícono/chip de flecha, tarjeta PIN). Íconos
  actualizados al mismo set que la app. Arrastrar y soltar y "Ancho completo" no cambian.

## 5. Decisiones del usuario
- Seguir las 6 referencias; ignorar el botón de configuración.
- Campana omitida; "¿Olvidaste tu contraseña?" muestra aviso de contactar a la administración.
- Íconos los mismos de la web (set compartido); actualizarlos también allá.
- Colores elegibles desde la web con paleta cerrada de 4 estilos; ningún botón blanco; por omisión azul
  claro.
- La vista previa de la web debe verse consistente con la app.

## 6. Decisiones mías (corregibles)
- Valores exactos de la paleta (4.2) y degradados; `expo-linear-gradient` para degradados, SVG para ondas.
- Recibo pasa de JSON a filas legibles.
- El resto de la web no se rediseña.

## 7. Para el constructor
Medidas finas, sombras, animaciones de presión, organización de componentes compartidos, textos
secundarios menores.

## 8. Respuestas a la revisión del constructor (decisiones mías)
- **Referencias:** las 6 imágenes están en `docs/superpowers/specs/2026-11-16-rediseno-referencias/`
  (1 Login, 2 Inicio, 3 Domicilio, 4 Accesos, 5 Cuenta, 6 Recibo). Son la referencia visual; el botón
  flotante de engrane y la campana se ignoran.
- **Íconos:** set lucide en ambos lados (`lucide-react` en web, `lucide-react-native` en app), un mapa
  idéntico: puerta `DoorOpen`, pluma `Construction`, peatonal `PersonStanding`, vehiculo `CarFront`,
  alberca `Waves`, gimnasio `Dumbbell`, salon `PartyPopper`, otro `KeyRound` (cambian peatonal y vehículo
  para parecerse a las referencias).
- **Compatibilidad:** `estilo` es aditivo; la app usa `azul_claro` si falta. Solo Expo Go (pruebas), sin
  coordinación de despliegue.
- **Constructor:** todo punto que inserte o actualice `app_botones` acepta `estilo`; el estilo se edita en
  botones existentes. `demo-local.sql` asigna estilos variados (p. ej. Peatonal `azul`, resto `azul_claro`).
- **Recibo:** solo UI. `pagos_info` ya trae concepto, fecha, método y referencia, y "Compartir PDF" sigue
  usando `GET /api/app/pagos/{id}/recibo` con Bearer, como hoy.
- **Dependencias:** `npx expo install expo-linear-gradient` (versión exacta fijada); Sora e Inter ya
  están cargadas.
