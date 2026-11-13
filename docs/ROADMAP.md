# Roadmap del sistema JOB Bandiera

Última revisión: 13 de noviembre de 2026. Reemplaza a `docs/PLAN_ESTABILIDAD.md` (14 de octubre de 2026), que describía la versión sobre Firebase y queda en el historial de git.

Esta revisión se hizo leyendo el código y los commits de la rama `actualizacion-supabase-app`. Nada de lo marcado como hecho se comprobó contra la base de datos real ni en los teléfonos de los capataces.

## 1. Resumen para el dueño del sistema

- El sistema ya no depende de Firebase para funcionar. Los datos viven en Supabase y la web se publica en Vercel.
- La app Android (versión 1.4) permite a capataces y empleados cargar remitos sin señal. Los remitos esperan en el teléfono y se suben solos cuando vuelve la conexión.
- El sistema viejo (Firestore) sigue encendido. Una función copia lo que se carga ahí hacia Supabase, sin pisar lo cargado en el sistema nuevo.
- Lo más urgente ahora: tener copias de seguridad automáticas de Supabase, proteger el borrado total del sistema y apagar Firestore de forma ordenada para que haya una sola base de datos.

## 2. Qué está hecho

### Base de datos y hosting
- Datos en Supabase, en una tabla `documents` que imita la forma de Firestore (`src/services/docstore.ts`). El acceso por rol lo controla RLS en Supabase.
- Hosting en Vercel (`vercel.json`) con cabeceras de seguridad (CSP, HSTS, X-Frame-Options).
- Aviso diario desde Vercel (`/api/keepalive`, 12:00 UTC) para que el proyecto gratuito de Supabase no se pause.

### Copia desde el sistema viejo
- Función `supabase/functions/firestore-sync` que copia Firestore a Supabase sin pisar lo cargado en Supabase.
- Scripts manuales: `scripts/migrate_firestore_to_supabase.mjs`, `scripts/sync_firestore_to_supabase.mjs` (con comparación previa y respaldo local) e `scripts/import_firebase_users.mjs` (copia cuentas sin mostrar ni guardar claves).

### Usuarios y acceso
- Cambio de clave obligatorio en el primer ingreso y después de que un administrador pone una clave.
- "Cambiar mi clave" disponible para cada usuario, en web y app.
- Capataz y Empleado solo cargan remitos y no ven montos.

### App de campo (Android con Capacitor)
- Carga de remitos sin conexión. La cola de pendientes vive en IndexedDB (`src/services/outbox.ts`), así que un cierre forzado de la app no pierde nada.
- Indicador de "sin conexión" y cantidad de cambios esperando (`SyncStatusBadge`), y aviso de error de sincronización (`SyncErrorToast`).
- Guía de compilación y publicación en `ANDROID_PLAY_STORE.md`.

### Remitos y facturación
- Un solo total por remito: Auditoría, comprobante, Facturado y PDFs usan el mismo precio guardado. Al editar un remito el total sigue a costos más honorarios. Esto cierra la duda sobre `billedPrice` que estaba pendiente en el plan anterior.
- Facturar varios remitos juntos, 7 % solo al facturar, opción "Sin factura" y cobro en conjunto.
- Edición de remitos y transferencia entre capataces.
- Etiqueta de origen (App), filtro "Origen" e historial de quién cargó cada remito en Auditoría.
- Papelera para recuperar lo eliminado (`TrashView`).
- Trabajos sin capataz asignado: no se cobra comisión de capataz.
- PDFs con mejor ajuste de textos largos y corte de página en los resúmenes.

## 3. Qué falta, por prioridad

### Fase 1: no perder datos (urgente)

1. **Copias de seguridad automáticas de Supabase.** Hoy no hay ninguna. El plan gratuito de Supabase no guarda copias que se puedan descargar. `scripts/backup_to_server.sh` es una plantilla con valores de ejemplo (`tu_usuario`, `192.168.1.100`) y no está en uso. Hace falta una copia diaria fuera de Supabase (por ejemplo `pg_dump` o exportar la tabla `documents` a un depósito privado), con una prueba de restauración.
2. **Guardar el esquema y las reglas RLS en el repositorio.** No hay archivos `.sql` ni migraciones de Supabase en el repo. Si el proyecto de Supabase se pierde o hay que crear uno de pruebas, no hay cómo reconstruir las tablas ni los permisos. Exportar el esquema actual a `supabase/migrations/`.
3. **Proteger "Poner el sistema en 0".** `ResetSystemModal` declara un campo de confirmación (`confirmInput`) pero no lo usa: el borrado total no exige escribir nada. Pedir que se escriba `BORRAR TODO` y descargar un respaldo completo antes de borrar.
4. **Quitar los puntos de restauración del navegador.** `MasterBackupView` todavía guarda y restaura "puntos" en `localStorage` y tiene una "restauración canónica" de usuarios. Esos datos no salen del navegador y la restauración canónica puede sobrescribir usuarios. Reemplazar por un exporte JSON descargable sin contraseñas y una restauración con vista previa que solo agregue o actualice.
5. **Revisar la tarjeta "Sincronización Cloud Firestore"** de `MasterBackupView`, que ya no corresponde con la base nueva.

### Fase 2: apagar Firestore (corte definitivo)

Mientras Firestore siga recibiendo cargas hay dos bases de datos y el riesgo de que no coincidan. Pasos, en este orden:

1. Confirmar que todos los capataces y empleados usan la app nueva (versión 1.4 o posterior) y que nadie entra a la URL vieja.
2. Avisar el día y la hora del corte. Desde ese momento no se carga nada en el sistema viejo.
3. Correr una última copia con `scripts/sync_firestore_to_supabase.mjs`, guardando el respaldo local que genera.
4. Comparar cantidades por colección entre Firestore y Supabase (remitos, clientes, trabajadores, vehículos, usuarios) y revisar a mano los últimos remitos cargados.
5. Hacer una copia de seguridad de Supabase (Fase 1, punto 1) justo después.
6. Apagar la función `firestore-sync` y su tarea programada.
7. Dejar Firestore en solo lectura con reglas que rechacen toda escritura. No borrarlo durante al menos 3 meses.
8. Quitar del código lo que quedó de Firebase: `firebase-applet-config.json`, `firebase-blueprint.json`, `firestore.rules`, `FirebaseConfigModal.tsx` y las menciones a Firestore en la interfaz.

Dato a aclarar antes del corte: el commit `cff53b3` dice que la copia corre cada 3 horas, pero el comentario de `supabase/functions/firestore-sync/index.ts` dice cada 15 minutos. Verificar en `pg_cron` cuál es el valor real.

### Fase 3: traer lo útil de la rama `feat/firebase-auth-rules`

Esa rama (subida a GitHub como respaldo, no se va a unir tal cual) tiene trabajo que la línea Supabase no tiene. Portar, en este orden:

1. **Aviso antes de cerrar la pestaña con cambios pendientes** (`beforeunload`). Hoy no existe en la web.
2. **Respaldo y restauración reales** (ver Fase 1, punto 4). La rama Firebase tiene la versión con vista previa, confirmación y copia previa.
3. **Modo demo** (`npm run demo`) con datos ficticios, para mostrar y probar sin tocar datos reales. Habría que adaptarlo a Supabase.
4. **Pruebas automáticas.** La rama Firebase tiene 7 archivos de prueba; la rama Supabase no tiene ninguno.
5. **Canales de entrada de remitos por WhatsApp y Google Drive** (`docs/CANALES_ENTRADA.md`, `server/whatsapp.ts`, `server/driveIntake.ts`). Decidir primero si se quieren.

### Fase 4: calidad y despliegue controlado

1. Pruebas de los cálculos (totales, 7 %, IVA, comisiones, liquidaciones), que son la parte con más riesgo de errores de dinero.
2. Integración continua en GitHub: `npm run lint`, pruebas y `npm run build` en cada cambio.
3. Proyecto de Supabase de pruebas (staging) para ensayar cambios antes de producción. Depende de la Fase 1, punto 2.
4. Monitoreo de errores en la web y la app (hoy no hay ninguno).
5. Dominio propio del cliente apuntando a Vercel, para que la URL no vuelva a cambiar.

### Fase 5: Play Store

1. Firmar y publicar la app siguiendo `ANDROID_PLAY_STORE.md`.
2. Definir quién guarda la clave de firma y dónde. Si se pierde, no se puede actualizar la app publicada.

## 4. Decisiones pendientes del dueño del sistema

- **Finanzas en el tablero.** `DashboardView` toma `canViewFinancials` de `useData()` en vez del contexto de usuario. Corregirlo cambia quién ve las finanzas del tablero. Hay que confirmar qué roles deben verlas antes de tocarlo.
- **Canales por WhatsApp y Google Drive:** si se quieren o no (Fase 3, punto 5).
- **Fecha del corte de Firestore** (Fase 2).
- **Dónde se guardan las copias de seguridad** (Fase 1, punto 1) y por cuánto tiempo.

## 5. Historia

- Hasta octubre de 2026 el sistema corría sobre Firebase, creado desde AI Studio. Un cambio de URL hizo perder información; el análisis de causas está en `docs/PLAN_ESTABILIDAD.md`, en el historial de git de la rama `feat/firebase-auth-rules`.
- Esa rama sumó login con Firebase Auth, reglas de Firestore, app de campo instalable (PWA y TWA), cola de pendientes, modo demo, pruebas y copias diarias a Cloud Storage. Nunca se publicó en producción.
- En noviembre de 2026 el trabajo siguió en `actualizacion-supabase-app`: migración a Supabase, Vercel y app Android con Capacitor. Esta es la línea activa.
