# Análisis de estabilidad y plan para no volver a perder información

Fecha del análisis: 14 de octubre de 2026. Es una revisión del código y de la configuración del repositorio. No se tocó la base de datos real ni la consola de Firebase.

## 1. Resumen

El sistema guarda los datos de negocio en Firestore, pero además usa el navegador (localStorage e IndexedDB) como segunda fuente de verdad, y varias funciones "de respaldo" también viven solo en el navegador. Los datos del navegador pertenecen a una dirección web concreta. Si la dirección cambia, todo lo que solo estaba en el navegador desaparece, y el sistema puede dar la impresión de que se perdió información aunque la base siga intacta.

Además, los errores de escritura se ignoran en silencio, la app nunca confirma que un dato llegó al servidor, y no hay una copia de seguridad real fuera del navegador. Con esas tres cosas juntas, un cambio de URL puede destruir trabajo que parecía guardado.

## 2. Qué pudo pasar al cambiar la URL (causas probables)

No tengo acceso al historial de AI Studio, por lo que estas son las causas que el código permite, ordenadas por probabilidad. Conviene confirmar la primera en la consola de Firebase.

1. **Se creó otra base de datos.** `firebase-applet-config.json` apunta a una base con nombre propio (`firestoreDatabaseId: ai-studio-...`). Si AI Studio vuelve a aprovisionar Firebase para una app nueva, genera otro identificador y la app queda mirando una base vacía. Los datos anteriores siguen en la base vieja. Cómo comprobarlo: en la consola de Firebase, Firestore Database, abrir el selector de bases de datos arriba a la izquierda. Si aparece más de una base `ai-studio-...`, los datos anteriores están en la más antigua y se pueden recuperar.
2. **Datos que solo estaban en el navegador.** Al cambiar la URL cambia el "origen": localStorage, IndexedDB, la sesión y las escrituras pendientes de sincronizar no se trasladan. Lo que no llegó a Firestore se pierde. Ver las causas de la sección 3 que hacen probable que haya habido datos así.
3. **Los "puntos de restauración" no eran copias reales.** `MasterBackupView.tsx` (líneas 43 a 125) guarda los puntos de restauración en el localStorage del navegador. Cambiar la URL los borra.
4. **La app se rellena sola con datos de ejemplo.** Si una colección llega vacía, `DataContext.tsx` rescribe en Firestore lo que haya en caché (líneas 408 a 418) o los datos iniciales del código (vehículos y eventos, líneas 529 a 558; personal, línea 366). Con una base nueva y vacía, aparecen personas y vehículos del código como si fueran datos reales.
5. **No había historial de versiones del código.** El repositorio de GitHub tiene solo dos commits ("Initial commit" y "initialize project structure and base app"). Todo el desarrollo anterior no está versionado, por lo que no hay forma de volver a una versión previa.
6. **Secretos y dominios autorizados.** La clave de Gemini vive en los secretos de AI Studio, y Firebase Auth solo acepta los dominios autorizados. Con una URL nueva, el escaneo con IA y el inicio de sesión pueden fallar hasta reconfigurarlos.

## 3. Fallas encontradas

### Críticas

- **Escrituras fallidas que nadie ve.** Hay 67 `.catch(() => {})` (62 sobre escrituras o borrados en Firestore) y unos 98 bloques `catch {}` vacíos. `handleFirestoreError` solo escribe una advertencia en la consola. Si Firestore rechaza una escritura (sin conexión, cuota, reglas), el usuario ve el dato en pantalla porque está en memoria y en localStorage, pero nunca llegó a la base.
- **La app nunca confirma una escritura.** No se usa `waitForPendingWrites` ni `metadata.hasPendingWrites`. No hay indicador de "guardado" ni de "pendiente de sincronizar".
- **Sin copia de seguridad real.** `scripts/backup_to_server.sh` tiene datos de ejemplo (`tu_usuario`, `192.168.1.100`) y no exporta Firestore. Los "puntos de restauración" son del navegador.
- **Reglas de Firestore abiertas** (`allow read, write: if true`) y **login falso** con claves maestras. Ya está corregido en la rama `feat/firebase-auth-rules`, pero falta publicarlo (ver `docs/MIGRACION_AUTH.md`).
- **Botones destructivos sin red de seguridad.** "Poner sistema en 0" (`resetAllData`, `DataContext.tsx:1799`) borra clientes, remitos, materiales y vehículos con errores silenciados y sin respaldo previo. El modal pide escribir una confirmación, pero no exporta nada antes.
- **"Restaurar" pisa usuarios con los del código.** `resetUsersToDefaults` guarda `INITIAL_USERS` en Firestore y el "punto canónico" de `MasterBackupView` lo invoca. Eso sobrescribe roles y permisos reales.

### Altas

- **Datos de facturación que se descartan.** `bulkPassToFacturado` acepta tres argumentos (`DataContext.tsx:126` y `:1009`), pero `FacturadoView.tsx:1134` y `TechnicalAuditTable.tsx:2791` le pasan cuatro. El cuarto (`billing`, que viene del modal de facturación) se ignora. Hay que revisar si IVA y retenciones se están guardando.
- **Se leen las colecciones completas.** Cada pantalla suscribe colecciones enteras (502 remitos y 466 clientes hoy). Funciona, pero el costo y el tiempo de carga crecen con los datos.
- **Resurrección de datos.** Si se borra el último elemento de una colección, el respaldo en caché lo vuelve a escribir. Los "tombstones" de usuarios eliminados viven en localStorage y en Firestore y pueden desincronizarse.
- **Estado "sistema en cero" en el navegador.** `ZERO_STATE_KEY` está en localStorage (`DataContext.tsx:197`). Dos equipos pueden ver cosas distintas.
- **Archivos enormes.** `TechnicalAuditTable` (2916 líneas), `DataContext` (2085), `FieldReportModal` (2011). Cualquier cambio tiene riesgo de romper otra cosa y no hay pruebas.
- **Despliegue atado a AI Studio.** No existe `firebase.json` ni `.firebaserc` en el repositorio, ni dominio propio, ni integración continua.

### Medias

- `SandboxRemitoOcr.tsx:142` usa `c.name`, pero el campo se llama `razonSocial`. El escaneo con IA recibe la lista de clientes vacía.
- `DashboardView.tsx:47` toma `canViewFinancials` del contexto equivocado (`useData` en lugar de `useAuth`), por lo que la restricción financiera del tablero no funciona como se pretende.
- `UserProfileView.tsx:8` lee `theme` e `isDarkMode`, que no existen.
- Los modelos de Gemini del servidor (`gemini-3.6-flash`, `gemini-3.5-flash`, `gemini-3.8-flash`) no están verificados, y cada nombre inválido suma reintentos.
- `xlsx@0.18.5` tiene vulnerabilidades conocidas. No hay tests ni monitoreo de errores.
- `tsc` informaba cero errores solo porque faltaban `@types/react`. Ya instalados, quedan 11 errores previos.

## 4. Plan para que quede estable

### Fase 0: proteger lo que existe (antes de cualquier cambio)

1. En la consola de Firebase, abrir el selector de bases de datos y anotar cuántas hay y cuál usa la app. Esto responde si hay datos anteriores recuperables.
2. Repetir el respaldo con `node scripts/export_firestore.mjs` y guardarlo en un lugar seguro (por ejemplo, un disco o carpeta privada de Drive).
3. Activar los respaldos automáticos de Firestore (copias programadas y recuperación a un punto en el tiempo). Requiere habilitar facturación (plan Blaze) en el proyecto.
4. Subir todo el código actual a GitHub con commits frecuentes y proteger la rama `main`.

### Fase 1: una URL que no cambie nunca

1. Registrar un dominio o subdominio del cliente (por ejemplo `sistema.cliente.com.ar`) y asociarlo al servicio publicado (Cloud Run o Firebase Hosting).
2. Agregar ese dominio a los dominios autorizados de Firebase Auth.
3. Desde ese momento, la dirección que usan las personas es siempre la misma, aunque el servicio detrás cambie. Un cambio de hosting pasa a ser invisible para el cliente.

### Fase 2: que Firestore sea la única fuente de verdad

1. Dejar de rellenar Firestore desde la caché del navegador y desde los datos iniciales del código. Una colección vacía debe mostrarse vacía.
2. Reemplazar por un aviso visible con reintento los `.catch(() => {})` de las escrituras a Firestore (62 hoy), y revisar uno por uno los `catch {}` vacíos.
3. Mostrar un indicador "Guardado" solo cuando el servidor confirma la escritura, y "Pendiente de sincronizar" mientras no llegue.
4. Eliminar los puntos de restauración del navegador y reemplazarlos por exportes reales (JSON o Excel) descargables, y por los respaldos de la Fase 0.
5. Antes de "Poner sistema en 0", exigir y guardar un exporte automático.
6. Quitar los datos de personas, vehículos y clientes de `initialData.ts` de la compilación de producción (ya existe una versión ficticia en `src/demo/`).
7. Mostrar en el pie de la pantalla de ingreso el identificador del proyecto y de la base en uso, para detectar de inmediato si la app apunta a otra.

### Fase 3: acceso y seguridad

Publicar lo que ya está hecho en la rama `feat/firebase-auth-rules` siguiendo `docs/MIGRACION_AUTH.md`: login real, roles validados por el servidor, reglas cerradas y API de IA protegida.

### Fase 4: calidad y despliegue controlado

1. Corregir los errores de tipos de la sección 3 (empezando por `bulkPassToFacturado`).
2. Agregar `firebase.json` y `.firebaserc`, y publicar reglas desde la línea de comandos, no pegándolas en la consola.
3. Mantener un proyecto de Firebase separado de pruebas (staging) para ensayar cambios, y usar el modo demo (`npm run demo`) para mostrar el sistema sin tocar datos reales.
4. Integración continua en GitHub: verificar tipos y compilar en cada cambio.
5. Dividir los archivos más grandes de a poco, con pruebas sobre los cálculos de remitos y liquidaciones.
6. Agregar monitoreo de errores y revisar la facturación de Firebase para evitar sorpresas.

## 4 bis. Estado de avance (rama `feat/firebase-auth-rules`, sin publicar)

Hecho en el código y probado en el modo demo (`npm run demo`). Ninguno de estos cambios se probó contra la base real de Firestore.

- **Indicador de guardado.** Cada escritura informa cuándo empieza, cuándo el servidor la confirma y cuándo falla (`syncStatus.ts`, `trackedWrites.ts`, `SyncIndicator.tsx`). Se ve "Guardando…", "Guardado ✓ hora", "N cambios sin sincronizar" o un error rojo que dice que el dato NO se guardó. Si hay cambios pendientes, el navegador avisa antes de cerrar la pestaña.
- **Sin rellenado automático.** `DataContext` ya no reescribe en Firestore lo que haya en la caché del navegador ni usa datos de ejemplo del código como valor inicial (personal, vehículos, eventos). Una colección vacía se muestra vacía.
- **Respaldo y restauración reales.** `MasterBackupView` se reescribió: exporta un JSON sin contraseñas, y restaura escribiendo en Firestore (solo agrega o actualiza por identificador, nunca borra), con vista previa de lo que contiene el archivo, confirmación y copia automática previa. Se retiraron los puntos de restauración del navegador, el botón "Sincronizar ahora" (era simulado) y la "restauración canónica" que sobrescribía usuarios. Los archivos del formato anterior siguen siendo compatibles.
- **Borrado masivo protegido.** "Poner el sistema en 0" ya no se hace con un solo clic: exige escribir `BORRAR TODO` y descarga un respaldo completo antes de borrar. Los botones "Restaurar datos Demo" y "Eliminar solo datos Demo" solo existen en la demo; en producción están ocultos y las funciones están bloqueadas.
- **Datos de facturación.** `bulkPassToFacturado` ahora conserva lo ingresado en el modal (base, 7 %, IVA y total) en cada remito. No modifica `billedPrice`. Falta una decisión de negocio, ver abajo.
- **Base en uso a la vista.** La pantalla de ingreso y la de respaldo muestran el proyecto y la base de datos con los que está funcionando la app.
- **Otros arreglos.** El escaneo con IA recibe la lista de clientes (`razonSocial`); se eliminó una lectura inexistente en `UserProfileView`. Los errores de tipos bajaron de 11 a 8.

Pendiente o decisión del dueño del sistema:

- **`billedPrice` y el total facturado.** Hoy `billedPrice` queda con el precio base sin recargo ni IVA, mientras que el modal calcula un total con 7 % e IVA. La pantalla de Facturado ya muestra "Base (+7 % + IVA)" cuando existen estos campos, y al editar un importe fija `billedPrice` igual a `totalFacturado`. Hay que decidir qué importe debe contar como facturado en los totales y los cobros antes de unificarlos.
- **`DashboardView` toma `canViewFinancials` del contexto equivocado.** Corregirlo haría que roles como Admin dejen de ver las finanzas del tablero (así está definido en `permissionUtils.ts`). Es un cambio para usuarios reales, por eso no se aplicó.
- Los perfiles creados por Capataz o Empleado en `users` y `workers` son rechazados por las reglas nuevas.
- Dominio propio, copias de seguridad automáticas de Firestore, proyecto de pruebas, integración continua y pruebas de los cálculos (Fases 0, 1 y 4).

## 5. Lista de verificación antes de cualquier cambio de URL o de hosting

1. Respaldo exportado y probado (abrir el archivo y comprobar cantidades).
2. Confirmar que `firebase-applet-config.json` conserva el mismo `projectId` y `firestoreDatabaseId`.
3. Agregar el dominio nuevo a los dominios autorizados de Firebase Auth.
4. Cargar de nuevo `GEMINI_API_KEY` y cualquier otro secreto en el entorno nuevo.
5. Probar con un usuario real y comprobar cantidades de remitos, clientes y usuarios contra el respaldo.
6. Mantener la dirección anterior funcionando hasta terminar la verificación.

## 6. Qué no se pudo verificar

- Qué ocurrió exactamente en el cambio de URL anterior: no hay acceso al historial de AI Studio ni a los registros de Firebase.
- Cuántas bases de datos tiene el proyecto y si hay datos anteriores en alguna.
- Si el proyecto tiene facturación habilitada (necesaria para los respaldos programados).
- El comportamiento de las reglas nuevas con usuarios reales (están sin probar en emulador).
