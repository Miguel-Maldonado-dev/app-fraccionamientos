# Rediseño de tarjetas y tablas (web) — Diseño

Estado: aprobado con precisión del usuario (2026-11-13).

## 1. Intención
Llevar a la web el estilo de las imágenes de referencia del usuario (Últimos movimientos, Residentes,
Cuotas, Por fraccionamiento) y aplicarlo también a Pagos extra y a los catálogos de Configuración (Tipos
de cuota, Conceptos extra, Descuentos, Recargos), para que la app se vea moderna y consistente.

## 2. Metas / no metas / anti-metas
- Metas: los 4 puntos del usuario; el mismo lenguaje visual en todas las tablas.
- No metas: cambiar datos, permisos, acciones o flujos; modo oscuro; la app móvil.
- Anti-metas: ninguna acción existente se pierde ni cambia de comportamiento; las tablas siguen siendo
  accesibles (encabezados, `aria-label` en botones de ícono) y responsivas.

## 3. Enfoques (elegido A)
- **A (elegido):** mejorar las piezas compartidas y usarlas en cada sección. **Precisión del usuario:** el
  estilo nuevo aplica **solo a tablas dentro de tarjetas** (`SectionCard`): las que pidió y cualquier otra
  tabla que esté dentro de una tarjeta. Las tablas de página completa (p. ej. listado de Domicilios,
  Pagos, Usuarios) no cambian.
- B: rediseño por sección — descartado (duplica estilo, tablas inconsistentes).

## 4. Diseño

### 4.1 Piezas compartidas
- `SectionCard`: el ícono del título va en un **cuadro redondeado** de color suave (≈44 px, fondo
  primario muy claro, ícono primario) con una línea divisoria fina a su derecha (como "Últimos
  movimientos"); prop opcional `stats?: ReactNode` que se muestra a la izquierda de `action`, separada por
  una línea vertical. Sin `icon` se ve como hoy.
- `StatChip` nuevo: píldora con ícono, número grande y etiqueta pequeña ("3 / Pagadas"); variantes
  `neutral` (gris suave), `success` (verde suave), `info` (azul suave).
- `DataTable`: nueva prop opcional `variante?: 'pagina' | 'tarjeta'` (por omisión `'pagina'` = como hoy).
  Con `'tarjeta'`: encabezado con fondo `muted` **redondeado e inset** (margen lateral, esquinas
  redondeadas), texto de encabezado en peso medio, y `Column.icon?: LucideIcon` dibuja un ícono de línea
  antes del título. Orden, paginación y filas clicables no cambian. Tablas dentro de tarjetas que no usan
  `DataTable` (tablas propias) reciben el mismo estilo con una clase/componente compartido
  (`CardTable` / estilos de encabezado exportados).
- Inventario: el constructor lista todas las tablas dentro de `SectionCard`/`Card` con encabezado y las
  pasa a `'tarjeta'`; las de página completa se quedan igual.
- `IconButton` de acción: botones cuadrados con borde (≈36 px) para acciones de fila; variante
  `danger` (ícono rojo). Se usa donde hoy hay menús o botones de texto de acciones de fila en las
  secciones de este diseño.
- Celdas reutilizables: `DateBlock` (día grande / mes abreviado en mayúsculas, caja gris suave),
  `PeriodoPill` (periodo "Nov/2026" en píldora azul suave), avatar de iniciales (ya existe `avatar.tsx`).

### 4.2 Por sección
1. **Inicio · Últimos movimientos:** cuadro de ícono + título + "Tus transacciones más recientes" +
   botón primario "Ver todos →". Tabla con íconos: Fecha (calendario, `DateBlock`), Concepto (documento,
   truncado con "…"), Tipo (flechas: círculo con flecha ↑ verde/↓ roja + badge Ingreso/Egreso), Importe
   (monedas, "+ $500.00" verde / "- $…" rojo, alineado a la derecha).
2. **Detalle de domicilio:**
   - **Residentes:** ícono personas; descripción "Acceso a la app: N de M"; `StatChip` "N / M con
     acceso"; botón "+ Agregar residente". Columnas con ícono: Nombre (avatar iniciales + nombre),
     Teléfono, Residente principal (píldora "✓ Sí" verde o "—" gris), App ("Con acceso"/"Sin acceso" +
     línea pequeña del dispositivo), Acciones (botones de ícono con las acciones actuales: restablecer
     contraseña, desligar dispositivo, dar/quitar acceso, editar, eliminar en rojo; solo las que hoy
     aplican a cada fila y rol).
   - **Cuotas:** ícono monedas; "Administración de cuotas y pagos"; `StatChip` success "N Pagadas" y
     neutral "N Pendientes"; botón "+ Crear cuota". Columnas con ícono: Periodo (`PeriodoPill`), Concepto,
     Importe (negritas), Vencimiento, Estado (badge actual), Acciones (botones con borde, p. ej. "Recibo",
     y las acciones que ya existen).
   - **Pagos extra:** mismo estilo que Cuotas (ícono, descripción, chips de conteo que apliquen, columnas
     con ícono, acciones con borde).
3. **Consola · Por fraccionamiento:** ícono gráfico de pastel en cuadro; tabla con el encabezado nuevo,
   Estado como badge "● Activo", números alineados a la derecha; paginación tal cual (ya coincide).
4. **Configuración · Tipos de cuota, Conceptos extra, Descuentos, Recargos:** misma tarjeta (cuadro de
   ícono, descripción) y tablas con íconos en encabezados y acciones con botones de ícono con borde.

## 5. Decisiones del usuario
- Enfoque A; el estilo nuevo solo en tablas dentro de tarjetas (las mencionadas y otras que estén en tarjeta).
- Seguir las imágenes; Pagos extra y catálogos con el mismo estilo.

## 6. Decisiones mías (corregibles)
- Textos "Tus transacciones más recientes", "Administración de cuotas y pagos"; Pagos extra:
  "Cobros adicionales del domicilio" con chips Pagados/Pendientes.
- Íconos lucide por columna (Calendar, FileText, ArrowLeftRight, Coins, User, Phone, House, Smartphone,
  Activity) y en tarjetas (ReceiptText, Users, Coins, PieChart, etc.).
- Acciones de fila como botones de ícono visibles en lugar de menú solo en estas secciones; en móvil
  (pantallas angostas) pueden envolver o pasar a menú.

## 7. Para el constructor
Medidas exactas, tokens de color existentes (`brand-primary`, `muted`, `success`), estructura de
componentes, pruebas (las de comportamiento existentes deben seguir pasando; ajustar solo las que dependan
del marcado de menús).
