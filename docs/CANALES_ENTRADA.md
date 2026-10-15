# Canales de entrada de remitos: WhatsApp y Google Drive

**Estado:** el servidor de los dos canales está hecho y probado con simulaciones (Meta, Drive, Cloud Storage y la IA reemplazados). La demo incluye un simulador. Nada está conectado a servicios reales ni publicado.

## Cómo funciona
1. El capataz saca una foto del remito de papel y la manda por WhatsApp al número de la empresa, o la sube a su carpeta de Drive.
2. El servidor lee la foto con IA (Gemini) y arma un **parte de campo Pendiente** en la misma bandeja "Partes de Campo" que usa la app del capataz.
3. Administración o Gerencia revisa el parte junto a la foto y lo convierte en remito. **Nunca se crea un remito ni un precio automáticamente**, porque la lectura de letra manuscrita puede equivocarse.

## Qué hace el sistema con lo que lee la IA
- **Valida cada campo.** Fechas, horas y números inválidos se descartan. La respuesta de la IA nunca se guarda tal cual. Esto también protege al escáner del Espacio de Prueba.
- **Compara con el catálogo** de clientes, personal y materiales, tolerando errores de letra y tildes. Si no hay una coincidencia clara (o hay dos igual de parecidas) no elige: deja el texto leído.
- **Marca lo dudoso** en una lista "Revisar antes de convertir": cliente o personal desconocidos, fecha u horario faltantes, material fuera del listado y lectura menor a 80%.
- Muestra el **origen** (WhatsApp, Drive o app), el **porcentaje de lectura** y la **foto original** ampliable.
- Si la foto no se puede leer, el capataz recibe un aviso para repetirla; no se crea ningún parte.

## WhatsApp (`server/whatsapp.ts`)
- Usa la API oficial de WhatsApp Business (Meta Cloud API).
- Cada llamada de Meta se acepta solo con una **firma válida** (HMAC-SHA256 con el secreto de la app).
- Solo atiende a **teléfonos registrados como capataz activo**. Se comparan los últimos 10 dígitos del teléfono del perfil. Un número desconocido, un Empleado o un capataz dado de baja recibe un aviso y no carga nada.
- **No duplica:** si Meta reintenta un mensaje, el parte no se crea dos veces (identificador estable por mensaje).
- Responde al capataz con el resumen de lo que entendió.

## Google Drive (`server/driveIntake.ts`)
- Cada capataz tiene una carpeta con subcarpetas Pendientes, Procesados y Con error, compartida con la cuenta de servicio del sistema. La identidad sale de la carpeta.
- Cloud Scheduler llama cada pocos minutos a `POST /api/intake/drive/run`, protegido con un secreto compartido.
- Las fotos leídas pasan a Procesados; las ilegibles, a Con error; si una descarga falla, queda en Pendientes y se reintenta. Hay un máximo de fotos por ejecución para acotar el costo de IA.
- La configuración de carpetas está en `systemSettings/driveIntake`.

## Seguridad y datos
- Las fotos se guardan en **Cloud Storage** (`fieldReports/{id}`), no dentro del documento. Solo Administración y Gerencia las ven, a través del servidor (`GET /api/admin/field-reports/:id/image`); el capataz no.
- Un capataz dado de baja (en Firebase Auth o en `userRoles`) deja de poder cargar por ambos canales.

## Pruebas (requieren Java)
- `npx tsx scripts/intake.test.ts`: validación y armado de partes (sin base).
- `scripts/rules-test`, `npm run test:channels`: 42 pruebas de integración con los emuladores (firma de WhatsApp, teléfonos, reintentos, formatos, tamaño, IA caída, fotos para administración, Drive, secreto del disparador).
- Estas pruebas encontraron y corrigieron un error real: Firestore rechazaba partes con campos vacíos.
- En la demo: pestaña **Canales de Entrada (simulador)**, con un chat de WhatsApp y las carpetas de Drive. La lectura de la foto está simulada.

## Para activar en producción
1. `GEMINI_API_KEY` en el servidor (sin ella la IA no lee).
2. **WhatsApp:** número dedicado y verificación de empresa en Meta; variables `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_TOKEN` y `WHATSAPP_PHONE_NUMBER_ID`; URL del webhook `/api/whatsapp/webhook`. Los costos de conversación los define Meta y hay que confirmarlos. Cargar el teléfono de cada capataz en su perfil.
3. **Drive:** carpetas por capataz compartidas con la cuenta de servicio, `INTAKE_CRON_SECRET`, un trabajo de Cloud Scheduler y el documento `systemSettings/driveIntake`.
4. La cuenta de servicio del servidor necesita, además de los roles de usuarios, **Storage Object Admin** y el alcance de **Drive**.
5. Antes de usar fotos reales: probar con remitos reales en un entorno de prueba y medir el porcentaje de lectura correcta.

## Archivos
`src/utils/remitoIntake.ts`, `server/ocr.ts`, `server/intake.ts`, `server/whatsapp.ts`, `server/driveIntake.ts`, `server.ts`, `src/components/PartesCampoView.tsx`, `src/demo/ChannelsSimulator.tsx`, `scripts/intake.test.ts`, `scripts/channels.test.ts`.
