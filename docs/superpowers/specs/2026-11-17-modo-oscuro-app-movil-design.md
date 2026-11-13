# Modo oscuro de la app móvil — Diseño (corto)

Estado: borrador para aprobación (2026-11-17).

**Intención.** El residente puede elegir cómo se ve la app: Automático (sigue el sistema), Claro u Oscuro.

**Enfoques.** A (elegido por el usuario): selector de 3 opciones, Automático por omisión. B (interruptor
encendido/apagado) descartado: ignora el ajuste del teléfono.

**Metas**
- En Cuenta, tarjeta "Apariencia" antes de "Cerrar sesión": control segmentado Automático · Claro · Oscuro.
- La elección se guarda en el dispositivo (`expo-secure-store`, clave `apariencia`) y se aplica al
  instante y al reabrir; Automático usa `useColorScheme()`. `app.json`: `userInterfaceStyle: "automatic"`.
- Todas las pantallas (Login, Inicio, Domicilio, Accesos, Cuenta, Recibo, Agregar residente, selector de
  domicilio, barra de pestañas, barra de estado) respetan el tema.

**No metas / anti-metas.** Sin cambios de comportamiento ni de servidor; la web no cambia. Ningún texto
ilegible ni pantalla con partes que se queden en claro.

**Diseño**
- `tema.ts`: `paletaClara` (los `colores` actuales) y `paletaOscura` con las mismas claves:
  fondo `#0A1424`, superficie `#13213A`, borde `#22324D`, texto `#E6EDF5`, secundario `#93A7BF`,
  navy (títulos) `#F2F6FB`, primario `#3D9BF0`, azulSuave `#1B3252`, exitoSuave `#163A26`,
  exito `#4CC27A`, errorSuave `#3A1C22`, error `#F07B7B`, deshabilitado `#5B6B80`; sombras casi nulas;
  ondas del fondo con opacidad baja.
- `src/lib/apariencia.tsx`: `AparienciaProvider`, `useApariencia(): { preferencia: 'auto'|'claro'|'oscuro';
  setPreferencia; esquema: 'claro'|'oscuro' }` y `useTema(): Paleta`. Los componentes crean estilos con
  `useEstilos(crear: (c: Paleta) => estilos)` (memoizado por paleta) en lugar de `StyleSheet.create` con
  colores fijos. Colores literales (`#FFFFFF`, etc.) pasan a claves de la paleta.
- Botones de acceso (`estiloBoton`): Azul y Navy igual en ambos modos; en oscuro, Azul claro = fondo
  `#17304F` título `#E6EDF5` ícono `#6CB6FF`; Turquesa = fondo `#123D45` título `#E6EDF5` ícono `#4FD1E0`;
  deshabilitado = fondo `#1A2638`, texto `#5B6B80`. `estiloBoton(estilo, habilitado, esquema = 'claro')`.
- `StatusBar` en `dark`/`light` según el esquema.

**Pruebas.** Proveedor: preferencia guardada se lee y aplica; 'auto' sigue `useColorScheme`. Cuenta:
tocar "Oscuro" guarda y cambia el fondo de la pantalla. `estiloBoton` en oscuro. Suites existentes verdes.

**Decisiones mías (corregibles).** Valores de la paleta oscura; logotipo: se usa el mismo PNG sobre una
"pastilla" clara pequeña si no se lee en oscuro (decide quien construye tras verlo).
