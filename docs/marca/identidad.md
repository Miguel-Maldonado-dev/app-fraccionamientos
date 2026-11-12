# WEADMI --- Guía de identidad visual para implementación en producto

> **Objetivo:** aplicar la identidad visual de WEADMI de forma
> consistente en toda la plataforma (aplicación de residentes, panel
> administrativo, sitio web y componentes compartidos), sin alterar la
> lógica funcional ni introducir cambios innecesarios en la arquitectura
> existente.

## 1. Instrucción principal para Claude Code

Actúa como **diseñador de producto digital y frontend engineer senior**.
Primero inspecciona el repositorio para identificar el framework,
sistema de estilos, estructura de rutas, componentes compartidos, temas,
tipografías y puntos de entrada de cada experiencia.

Después implementa la identidad WEADMI de forma transversal y coherente.

### Reglas de trabajo

1.  **No asumas el stack:** detecta el framework, librerías,
    convenciones y arquitectura existentes antes de modificar archivos.
2.  **No rehagas la aplicación desde cero.** Respeta la arquitectura,
    componentes, navegación, integraciones y patrones actuales.
3.  **No modifiques lógica de negocio, API, autenticación, permisos,
    base de datos ni flujos funcionales** salvo que sea estrictamente
    necesario para aplicar estilos; en ese caso, explica el motivo antes
    de hacerlo.
4.  Prioriza tokens globales y componentes reutilizables sobre estilos
    aislados o duplicados.
5.  Mantén la compatibilidad responsive, accesibilidad, estados de
    interacción y comportamiento actual.
6.  No reemplaces contenido funcional por datos ficticios ni elimines
    funcionalidades para simplificar el diseño.
7.  Antes de terminar, ejecuta las comprobaciones disponibles (lint,
    typecheck, tests y build, según el proyecto) y corrige los errores
    introducidos.
8.  Trabaja por etapas y resume qué archivos modificaste y qué quedó
    pendiente.
9.  Si existen varias aplicaciones o áreas (residente, administración,
    acceso, etc.), comparte el mismo sistema visual, adaptando la
    densidad y jerarquía a cada contexto.
10. No inventes ni reconstruyas el logotipo con texto o CSS si existen
    archivos oficiales. Utiliza los recursos de marca proporcionados.

------------------------------------------------------------------------

## 2. Esencia de marca

**Nombre:** WEADMI\
**Descriptor oficial:** GESTIÓN RESIDENCIAL\
**Categoría:** plataforma SaaS de administración residencial.

WEADMI centraliza la administración de fraccionamientos, condominios y
comunidades residenciales: residentes, domicilios, cuotas ordinarias,
pagos, cargos extraordinarios y control de accesos.

### Personalidad

-   Confiable y segura.
-   Profesional y ordenada.
-   Moderna y tecnológica.
-   Cercana y fácil de utilizar.
-   Clara, eficiente y consistente.

### Conceptos de marca

**CONFIANZA · CONEXIÓN · CONTROL**

La interfaz debe sentirse profesional, limpia y tecnológica. Evita una
apariencia recargada, excesivamente decorativa o demasiado lúdica.

------------------------------------------------------------------------

## 3. Paleta cromática

Los siguientes colores son los tokens de referencia de WEADMI. Los
valores se definieron a partir de la propuesta visual del logotipo y
deben cotejarse con el arte vectorial maestro cuando esté disponible.

### Colores de marca

  -----------------------------------------------------------------------
  Token                   HEX                     Uso
  ----------------------- ----------------------- -----------------------
  `weadmi-primary`        `#087BE8`               Acciones principales,
                                                  enlaces, controles
                                                  activos y selección

  `weadmi-navy`           `#071F49`               Identidad, navegación,
                                                  encabezados y texto
                                                  institucional

  `weadmi-aqua`           `#00C7C7`               Acentos, detalles
                                                  gráficos e indicadores
                                                  destacados

  `weadmi-blue-mid`       `#087FBD`               Transiciones y
                                                  variaciones del azul

  `weadmi-blue-dark`      `#086BB8`               Estados hover o
                                                  variantes de azul

  `weadmi-blue-gray`      `#496985`               Texto secundario y
                                                  elementos de apoyo
  -----------------------------------------------------------------------

### Neutros

  -----------------------------------------------------------------------
  Token                   HEX                     Uso
  ----------------------- ----------------------- -----------------------
  `weadmi-background`     `#F5F8FC`               Fondo general de
                                                  páginas

  `weadmi-surface`        `#FFFFFF`               Tarjetas, paneles,
                                                  modales y formularios

  `weadmi-border`         `#E8EEF4`               Bordes, divisores y
                                                  separadores

  `weadmi-text`           `#172536`               Texto principal

  `weadmi-muted`          `#64748B`               Texto secundario,
                                                  ayudas y metadatos
  -----------------------------------------------------------------------

### Colores semánticos

  Token              HEX         Uso
  ------------------ ----------- ---------------------------------
  `status-success`   `#16A36A`   Pagado, correcto, activo
  `status-warning`   `#E9A23B`   Pendiente, por vencer, atención
  `status-danger`    `#DC4C4C`   Error, vencido, rechazado
  `status-info`      `#087BE8`   Información y avisos

Los colores semánticos no sustituyen la paleta de marca. Utilízalos
únicamente para comunicar estados.

### Degradado institucional

El degradado es un recurso distintivo del isotipo. Debe usarse con
moderación, principalmente en el símbolo de marca y acentos gráficos
puntuales.

``` css
linear-gradient(110deg, #087BE8 0%, #087FBD 50%, #00C7C7 100%)
```

No conviertas todos los botones, tarjetas o fondos en degradados.

### Proporción visual orientativa

-   60% fondos blancos y neutros.
-   25% azul marino y tonos oscuros.
-   10% azul institucional.
-   5% turquesa y acentos.

Es una orientación, no una regla matemática rígida. La prioridad es
mantener legibilidad y jerarquía.

------------------------------------------------------------------------

## 4. Tipografía

### Fuente de encabezados: Sora

Google Fonts: <https://fonts.google.com/specimen/Sora>

Usos: - Títulos de página y sección. - Encabezados de tarjetas
importantes. - Mensajes destacados. - Elementos de identidad y
comunicación comercial.

Pesos: - SemiBold 600. - Bold 700. - ExtraBold 800, con moderación.

### Fuente de interfaz y lectura: Inter

Google Fonts: <https://fonts.google.com/specimen/Inter>

Usos: - Texto general. - Formularios y campos. - Tablas y listados. -
Botones. - Etiquetas, ayudas, notificaciones y mensajes. - Datos
numéricos y contenido operativo.

Pesos: - Regular 400. - Medium 500. - SemiBold 600. - Bold 700.

### Jerarquía tipográfica recomendada

  Elemento           Familia     Peso   Tamaño de referencia
  ------------------ --------- ------ ----------------------
  H1                 Sora         700                  32 px
  H2                 Sora         600                  26 px
  H3                 Sora         600                  20 px
  H4                 Sora         600                  17 px
  Texto principal    Inter        400                  15 px
  Texto secundario   Inter        400                  13 px
  Etiquetas          Inter        500                  12 px
  Botones            Inter        600                  14 px

Ajusta tamaños en móvil para mantener legibilidad. Evita tamaños
demasiado pequeños en tablas, formularios o información financiera.

**Importante:** el lettering del logotipo es un recurso gráfico
independiente. No sustituyas el logotipo oficial por Sora ni por texto
HTML.

------------------------------------------------------------------------

## 5. Principios de diseño de interfaz

### Dirección visual

-   Diseño limpio, moderno, profesional y tecnológico.
-   Jerarquía visual clara.
-   Espaciado generoso y consistente.
-   Superficies blancas sobre fondos neutros.
-   Azul marino para estructura y navegación.
-   Azul primario para acciones.
-   Turquesa como acento, no como color dominante.
-   Sombras discretas; utiliza bordes sutiles para separar superficies.
-   Evita gradientes excesivos, glassmorphism, brillos y decoraciones
    innecesarias.

### Botones

**Primario** - Fondo: `#087BE8`. - Texto: `#FFFFFF`. - Fuente: Inter
SemiBold, 14 px. - Radio: 8 px. - Altura recomendada: 44--48 px. -
Hover: utilizar una variante más oscura, por ejemplo `#086BB8`. -
Disabled: reducir énfasis y comunicar claramente que no está disponible.

**Secundario** - Fondo: `#FFFFFF`. - Texto: `#071F49`. - Borde:
`#E8EEF4`. - Radio: 8 px.

**Alternativo / terciario** - Fondo suave: `#EAF7F8`. - Texto:
`#087F9B`. - Reservar para acciones de menor énfasis.

Los botones deben tener estados hover, focus-visible, active, disabled y
loading coherentes. No elimines los indicadores de foco accesible.

### Tarjetas y paneles

-   Fondo: blanco.
-   Radio recomendado: 12--16 px.
-   Borde: `#E8EEF4`.
-   Sombra: muy ligera y solo cuando ayude a separar niveles.
-   Título: azul marino.
-   Texto auxiliar: `#496985` o `#64748B`.
-   Mantén padding y separación interna consistentes.

### Formularios

-   Etiquetas visibles y claras.
-   Campos con fondo blanco.
-   Borde neutro y radio consistente.
-   Focus con borde azul primario y un indicador visible.
-   Errores junto al campo correspondiente, en rojo semántico.
-   Ayudas y descripciones en texto secundario.
-   No dependas únicamente del color para comunicar errores.

### Tablas y listados

Son elementos centrales en una plataforma de administración residencial.

-   Prioriza legibilidad y alineación.
-   Usa encabezados claros y discretos.
-   Mantén una separación visual sutil entre filas.
-   Alinea cantidades y montos de forma consistente.
-   Usa Inter para los datos.
-   Destaca estados mediante etiquetas compactas.
-   Conserva filtros, búsqueda, ordenamiento, paginación y acciones
    existentes.
-   En móvil, utiliza una adaptación responsive que no oculte
    información crítica.

### Navegación

-   Azul marino para la estructura principal cuando el diseño actual
    utilice navegación oscura.
-   Elemento activo claramente identificable con azul institucional.
-   Iconos lineales consistentes.
-   Etiquetas legibles.
-   No uses el turquesa como fondo dominante de navegación.

### Iconografía

Se recomienda un estilo lineal y consistente, por ejemplo Lucide: -
Trazo aproximado de 1.75--2 px. - Esquinas suavizadas. - Tamaños
consistentes. - No mezclar arbitrariamente iconos outline, sólidos y
multicolor. - Mantener los iconos existentes si ya forman un sistema
coherente.

------------------------------------------------------------------------

## 6. Diseño de estados y datos

WEADMI gestiona información financiera, administrativa y de acceso. Los
estados deben ser fáciles de identificar y comprender.

  Estado        Color       Ejemplos
  ------------- ----------- -------------------------------------
  Correcto      `#16A36A`   Pagado, autorizado, activo
  Pendiente     `#E9A23B`   Cuota pendiente, pago en revisión
  Error         `#DC4C4C`   Vencido, rechazado, acceso denegado
  Información   `#087BE8`   Aviso, dato informativo
  Neutral       `#64748B`   Inactivo, archivado, sin estado

Acompaña los colores con texto, iconos o ambos. No uses únicamente color
para indicar el estado.

Los importes, saldos, fechas y referencias deben tener jerarquía visual
clara. No exageres el tamaño de todos los números: destaca solo los
indicadores relevantes.

------------------------------------------------------------------------

## 7. Aplicación por áreas del producto

Aplica un sistema visual compartido, pero adapta la densidad de
información al usuario y al contexto.

### Panel administrativo

Debe priorizar: - Visibilidad de indicadores y saldos. - Acceso rápido a
residentes y domicilios. - Gestión de cuotas ordinarias y
extraordinarias. - Seguimiento de pagos y adeudos. - Administración de
usuarios y permisos. - Control de accesos y registros. - Tablas, filtros
y acciones operativas.

La interfaz debe ser eficiente para tareas frecuentes y grandes
volúmenes de información.

### Experiencia del residente

Debe priorizar: - Claridad de cuotas y pagos. - Historial de
movimientos. - Información del domicilio. - Datos de residentes y
vehículos, si el producto los contempla. - Invitaciones o autorizaciones
de acceso, si están disponibles. - Notificaciones y avisos de
administración.

Debe sentirse más sencilla y amigable que el panel administrativo,
manteniendo la misma identidad.

### Control de acceso

Debe priorizar: - Estados inequívocos: autorizado, pendiente y
denegado. - Identificación clara del residente o visitante. - Lectura
rápida de fecha y hora. - Acciones visibles y comprensibles. - Contraste
suficiente para uso en dispositivos y pantallas diversas.

No alteres reglas de autorización ni permisos existentes al aplicar
estilos.

------------------------------------------------------------------------

## 8. Responsive y accesibilidad

-   Diseña para móvil, tablet y escritorio.
-   Conserva la funcionalidad de cada pantalla en todos los tamaños.
-   Evita scroll horizontal accidental.
-   Mantén áreas táctiles cómodas, idealmente de al menos 44 × 44 px.
-   Asegura contraste suficiente entre texto y fondo.
-   Conserva foco visible para navegación por teclado.
-   Usa etiquetas accesibles en controles e iconos sin texto.
-   Respeta preferencias de reducción de movimiento.
-   No comuniques estados únicamente mediante color.

------------------------------------------------------------------------

## 9. Tokens CSS de referencia

Adapta estos tokens al sistema de estilos real del proyecto. Si el
repositorio usa Tailwind, Sass, CSS Modules, styled-components, Flutter
u otro mecanismo, integra los mismos valores siguiendo sus convenciones,
sin introducir una segunda solución innecesaria.

``` css
:root {
  /* WEADMI brand */
  --weadmi-primary: #087BE8;
  --weadmi-navy: #071F49;
  --weadmi-aqua: #00C7C7;
  --weadmi-blue-mid: #087FBD;
  --weadmi-blue-dark: #086BB8;
  --weadmi-blue-gray: #496985;

  /* Neutrals */
  --weadmi-background: #F5F8FC;
  --weadmi-surface: #FFFFFF;
  --weadmi-border: #E8EEF4;
  --weadmi-text: #172536;
  --weadmi-muted: #64748B;

  /* Semantic states */
  --status-success: #16A36A;
  --status-warning: #E9A23B;
  --status-danger: #DC4C4C;
  --status-info: #087BE8;

  /* Brand gradient */
  --weadmi-gradient: linear-gradient(
    110deg,
    #087BE8 0%,
    #087FBD 50%,
    #00C7C7 100%
  );

  /* Typography */
  --font-heading: 'Sora', sans-serif;
  --font-body: 'Inter', sans-serif;

  /* Shape */
  --radius-button: 8px;
  --radius-card: 14px;
}
```

### Carga de fuentes

Si el producto es web y el proyecto no tiene ya una estrategia de
fuentes, utiliza Google Fonts o archivos locales optimizados. En
producción, considera alojar las fuentes localmente para controlar
disponibilidad y rendimiento.

Ejemplo de importación CSS:

``` css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Sora:wght@600;700;800&display=swap');
```

No agregues esta importación si las fuentes ya están cargadas por otro
mecanismo.

------------------------------------------------------------------------

## 10. Recursos oficiales de marca

Utiliza los archivos de logotipo que proporcione el usuario o que estén
presentes en el repositorio.

Nombres sugeridos para organizar los recursos:

``` text
assets/
  brand/
    weadmi-horizontal.svg
    weadmi-vertical.svg
    weadmi-isotipo.svg
    weadmi-monocromatico.svg
    weadmi-negativo.svg
    weadmi-app-icon.png
```

Estos nombres son una propuesta de organización, no archivos que deban
inventarse.

### Reglas del logotipo

-   No estirar ni deformar.
-   No cambiar proporciones ni espaciado.
-   No sustituir el arte oficial por texto.
-   No reconstruir el isotipo con CSS.
-   No aplicar sombras o efectos nuevos.
-   Mantener el área de seguridad.
-   Usar la versión horizontal en encabezados y documentos.
-   Usar el isotipo en iconos, favicons y espacios reducidos.
-   Elegir versión positiva o negativa según el contraste del fondo.

Si los recursos oficiales no están disponibles, solicita al usuario los
archivos SVG/PNG originales antes de reemplazar el logotipo. Mientras
tanto, puedes implementar el sistema de diseño sin modificar el recurso
de marca.

------------------------------------------------------------------------

## 11. Plan de implementación solicitado

Realiza el trabajo en este orden:

### Fase 1 --- Auditoría

1.  Inspecciona la estructura del repositorio.
2.  Identifica todas las aplicaciones, layouts, páginas y componentes
    compartidos.
3.  Identifica el sistema de estilos y componentes UI.
4.  Localiza el logotipo y otros recursos de marca existentes.
5.  Detecta inconsistencias visuales y duplicación de estilos.
6.  Presenta un resumen breve del plan antes de realizar cambios
    amplios.

### Fase 2 --- Fundamentos

1.  Configura colores y tokens globales.
2.  Configura Sora e Inter.
3.  Establece jerarquía tipográfica.
4.  Define radios, bordes, sombras y espaciado.
5.  Integra los recursos de marca oficiales disponibles.

### Fase 3 --- Componentes compartidos

Actualiza de forma consistente: - Botones. - Inputs y selects. -
Formularios. - Tarjetas. - Tablas. - Badges y estados. - Modales y
diálogos. - Menús y navegación. - Alertas y notificaciones. -
Componentes de carga y estados vacíos.

No dupliques componentes si ya existe un sistema reutilizable.

### Fase 4 --- Pantallas y experiencias

Aplica el sistema visual a todas las pantallas relevantes,
conservando: - Funcionalidad. - Datos. - Rutas. - Permisos. -
Validaciones. - Integraciones. - Comportamiento responsive.

No te limites a cambiar el color de algunos botones: busca coherencia
visual integral entre todas las pantallas.

### Fase 5 --- Validación

1.  Revisa escritorio, tablet y móvil.
2.  Comprueba contraste y legibilidad.
3.  Verifica estados hover, focus, active y disabled.
4.  Comprueba tablas, formularios, modales y navegación.
5.  Ejecuta lint, typecheck, tests y build disponibles.
6.  Corrige regresiones introducidas.
7.  Entrega un resumen de archivos modificados, decisiones visuales y
    pendientes.

------------------------------------------------------------------------

## 12. Criterios de aceptación

La implementación se considera terminada cuando:

-   Todas las pantallas relevantes utilizan la paleta WEADMI.
-   Sora se utiliza en encabezados y elementos de marca donde
    corresponda.
-   Inter se utiliza en contenido y controles de interfaz.
-   Los componentes compartidos mantienen estilos consistentes.
-   Los estados financieros y administrativos son claros.
-   La navegación y las acciones principales tienen jerarquía visual.
-   La experiencia funciona en móvil, tablet y escritorio.
-   El logotipo conserva su arte y proporciones originales.
-   No se han roto flujos, permisos, integraciones ni funcionalidades.
-   Las comprobaciones disponibles del proyecto terminan correctamente,
    o se documentan claramente los problemas preexistentes.

## 13. Instrucción final

**Aplica la identidad WEADMI al producto existente de manera integral,
profesional y consistente.**

No hagas un rediseño superficial limitado a colores. Construye un
lenguaje visual reutilizable que pueda mantenerse y evolucionar con el
producto.

Prioriza siempre:

**CONFIANZA · CONEXIÓN · CONTROL**

**WEADMI --- GESTIÓN RESIDENCIAL**
