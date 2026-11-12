# Mapeo WEADMI ↔ access-core

Resumen de cómo se representa cada elemento de WEADMI en access-core. El diseño completo está en `docs/superpowers/specs/2026-11-11-medios-acceso-access-core-design.md`; la API, en `access-core-openapi.json`.

| WEADMI | access-core | Notas |
| --- | --- | --- |
| Fraccionamiento | Instalación (`installationId`) | Se vincula con `fraccionamientos.instalacion_id`. |
| Domicilio | Titular (`holder`) de tipo `domicilio` | El id externo se guarda en `domicilios.titular_id`. |
| Tarjeta (`tarjetas_acceso`) | Tarjeta (`card`) | `numero` es el `card_code`; no se edita: para cambiarlo se borra y se crea otra. |
| Control RF | Control | Se crea con `outputs` tomadas de `fraccionamiento_botones` (salida por botón). |
| Tipo de cuota | Dos perfiles (al corriente y moroso) | `perfil_deseado` decide cuál corresponde a cada domicilio: primero `domicilios.acceso_forzado` (`activo` = al corriente, `inactivo` = moroso) y, si no hay ajuste, si el domicilio es moroso según `cuotas_para_moroso` del fraccionamiento (cuotas vencidas >= umbral). La tarea `asignar` lo agrega y quita los demás. El proceso diario llama a `limpiar_accesos_forzados`, que borra el ajuste manual cuando ya coincide con el estado real. |
| PIN | PIN del titular | Síncrono: la acción llama a la API y, si responde bien, guarda en `pines_acceso`. No pasa por la cola. |

## Cola de sincronización

- Cada mutación local encola una tarea en `sincronizaciones_acceso` (entidad, operación, carga) solo si el fraccionamiento tiene instalación.
- Un trabajador procesa la cola por fraccionamiento tomando un lease (`adquirir_sincronizacion`); si otro lo tiene, el fraccionamiento se omite.
- Una tarjeta espera a que su domicilio tenga `titular_id`; un error en una tarea no bloquea las demás.
- Reintentos con escalera de espera; a los 20 intentos o ante 400/409 la tarea pasa a `error` y se puede reintentar a mano. Con 429 se detiene respetando `Retry-After`.
- Disparo: tras cada cambio se intenta procesar de inmediato; además, el cron del hosting llama cada 5 minutos a `POST /api/sincronizacion/procesar` con `Authorization: Bearer <CRON_SECRET>`.
- Pantalla: `/accesos` (administrador y tesorero) y pestaña Accesos de la consola.

## Seguridad

`ACCESS_CORE_API_KEY` actúa como admin de todas las instalaciones de su tenant: solo se usa en el servidor y nunca lleva prefijo `NEXT_PUBLIC_`. La consola no muestra el estado de pago: la asignación de perfil se presenta como "Actualizar acceso".
