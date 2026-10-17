# App del capataz para Google Play

**Estado:** la parte técnica de la aplicación instalable (PWA) está hecha y probada en la demo. Falta lo que depende de decisiones y cuentas: dominio, firma de la app, ficha de Google Play y política de privacidad definitiva. Nada de esto toca producción.

## Qué quedó hecho
- **Aplicación instalable (PWA):** manifiesto (`public/manifest.webmanifest`), íconos de 192, 512 y "maskable" (`public/icons/`), ícono de iPhone y colores del tema. Chrome y Edge ofrecen "Instalar app"; la pantalla del capataz tiene el botón "Instalar app".
- **Abre sin señal:** un service worker (`public/sw.js`) guarda la aplicación en el teléfono en la primera visita (incluidos los módulos que se cargan bajo demanda). Probado: con el servidor apagado, la app abre con la sesión del capataz y su lista de partes.
- **Carga sin señal:** la base ya usa el caché persistente de Firestore (`src/services/firebase.ts`): los partes cargados sin conexión se guardan en el teléfono y se envían solos al volver la señal. La pantalla del capataz muestra "Sin señal…" y marca cada parte "Sin enviar" hasta que el servidor lo confirma.
- **Qué NO guarda el service worker:** nada de `/api`, Firestore, Firebase Auth ni servicios externos. Los datos offline los maneja la base, no el service worker.
- **Firma liviana:** la firma se reduce a un máximo de 400 x 160 px antes de guardarse (`src/utils/signatureImage.ts`) y las reglas de Firestore rechazan un parte con una firma de más de 100.000 caracteres. Ver la decisión más abajo.
- **Política de privacidad (borrador):** `public/privacidad.html`, se publica en `/privacidad.html`.
- **Pruebas:** `npx tsx scripts/pwa.test.ts` (manifiesto, íconos y comportamiento del service worker) y, en `scripts/rules-test`, `npm test` (incluye el límite de la firma).
- **Demo:** botón "Simular sin señal" en la franja naranja de la demo. Para probar la versión instalable: `npx vite build --mode demo --outDir dist-demo` y la configuración "demo-instalable" (puerto 3101).

## Que no se pierda ningún parte (bandeja de salida)
La base guarda sin señal y envía sola, pero si el servidor **rechaza** un parte (sesión vencida, cuenta dada de baja, regla de seguridad), Firestore descarta la escritura. Para que el capataz nunca pierda lo que cargó en la finca (`src/services/fieldOutbox.ts`):
- Cada parte queda en una **bandeja de salida del teléfono** hasta que el servidor lo confirma.
- Si el servidor lo rechaza, el parte sigue visible como "No se pudo enviar", con el motivo y el botón "Reintentar envío".
- Al abrir la app se **reconcilia** con lo que confirmó el servidor: lo recibido se borra de la bandeja; lo que no está ni figura pendiente se vuelve a enviar (mismo identificador: no se duplica).
- Cerrar sesión con partes sin enviar pide confirmación.
- Los identificadores de parte son únicos entre teléfonos (fecha + valor aleatorio).
- Pruebas: `npx tsx scripts/outbox.test.ts`.

## Actualizaciones de la app
- Cada publicación genera un `sw.js` distinto (el build lo marca con un identificador), así los teléfonos instalan la versión nueva y guardan sus archivos para abrir sin señal.
- Cuando se instala una versión nueva, la pantalla del capataz muestra "Hay una versión nueva de la app. Tocá acá para actualizar."
- Con la app de Google Play (TWA) la web se actualiza sola: no hace falta subir una versión nueva a Play por cada cambio de la web, solo cuando cambia la app de Android.

## Vínculo con la app de Android (assetlinks)
El servidor publica `/.well-known/assetlinks.json` a partir de dos variables (`server/assetLinks.ts`, con pruebas en `scripts/assetlinks.test.ts`):
- `ANDROID_PACKAGE_NAME` (por ejemplo, `com.ucodigitallab.jobcampo`)
- `ANDROID_SHA256_CERT_FINGERPRINTS` (una o varias huellas separadas por coma: la de la clave de carga y, si se usa "Firma de apps de Play", la que muestra Play Console en *Integridad de la app*).
Sin ellas el servidor responde 404 (no publica nada inventado).

## Verificador previo a publicar
`npx tsx scripts/check_play_ready.ts https://app.dominio.com --paquete=com.ucodigitallab.jobcampo` revisa HTTPS, manifiesto, íconos, service worker, assetlinks y política de privacidad, y marca OK, AVISO o ERROR. Se probó contra la demo (con `localhost` avisa que falta HTTPS, el vínculo y la política definitiva).

## Decisión: la firma NO se pasa a Cloud Storage
El pedido original era mover la firma a Storage para no chocar con el límite de 1 MB de un documento de Firestore. Se resolvió de otra forma, a propósito:
- Una firma reducida pesa unos 5 a 25 KB, muy por debajo del límite, y las reglas la limitan a 100 KB.
- Guardarla dentro del parte permite cargar **sin señal**: el parte y su firma viajan juntos. Con Storage, una firma tomada sin conexión necesitaría una cola de subida aparte y un parte "a medias".
- Las **fotos de remitos** (canales de WhatsApp y Drive) sí van a Storage, porque pesan cientos de KB; las sube el servidor y solo las ven administración y gerencia.
- Si más adelante se quisiera Storage para firmas, hace falta una cola de subida sin conexión y reglas de Storage con permisos por rol (las reglas de Storage no leen la base con nombre propio de este proyecto; habría que usar permisos en el token).

## Compilación de prueba de la app de Android (hecha)
El proyecto Android vive en `android/` (Trusted Web Activity generada con Bubblewrap 1.27). Se compiló, se firmó con una clave **descartable de prueba** y se verificó:
- Paquete `com.ucodigitallab.jobcampo`, versión 1.0.0 (código 1), nombre "JOB Campo", Android 7.0 o superior (API 24), objetivo Android 16 (API 36).
- Salidas: `app-release-signed.apk` (aprox. 1,1 MB) para instalar de prueba, y `app-release-bundle.aab` (aprox. 1,2 MB), el formato que se sube a Play. Firma del APK verificada con `apksigner`.
- Herramientas instaladas en tu usuario (sin permisos de administrador): Android SDK (plataforma 36, herramientas de compilación 36.1.0, herramientas de dispositivo) en `%LOCALAPPDATA%\Android\Sdk`, JDK 17 en `%LOCALAPPDATA%\Programs\jdk17` y JDK 21 en `...\jdk21`.
- Para repetir: `powershell -ExecutionPolicy Bypass -File scriptsndroiduild-android.ps1`. El script ya resuelve cinco trabas que aparecieron (Java 17 obligatorio, carpeta `tools` del SDK, `NoDefaultCurrentDirectoryInExePath`, archivo de control de Bubblewrap y el mínimo de Android 24). Nunca editar `build.gradle` ni `twa-manifest.json` con `Set-Content -Encoding utf8` en PowerShell 5.1: agrega un carácter invisible (BOM) que rompe Gradle.

**Qué NO se probó:** la app no se instaló ni se ejecutó en un teléfono ni en un emulador (no hay imagen de emulador instalada). La compilación de prueba apunta a `localhost:3101`, así que en un teléfono no abriría nada útil.

**Antes de publicar de verdad**
1. Con el dominio definido: cambiar `host`, `iconUrl`, `maskableIconUrl` y `webManifestUrl` en `android/twa-manifest.json` (o ejecutar `npx @bubblewrap/cli update`), subir `appVersionCode` en cada versión y recompilar.
2. **Crear la clave de firma real** (clave de carga) y guardarla en un lugar seguro con copia: sin ella no se pueden publicar actualizaciones. La clave de prueba (`android/test-upload.keystore`) NO se debe usar para publicar y nunca se versiona (`.gitignore`). Se recomienda activar "Firma de apps de Play" al subir el primer `.aab`.
3. Cargar las huellas SHA-256 en el servidor (`ANDROID_SHA256_CERT_FINGERPRINTS`, ver más abajo) y correr `scripts/check_play_ready.ts` sobre el dominio real.

## Cómo se publica en Google Play
Hay dos caminos. Recomiendo el A.

**A. Trusted Web Activity (TWA) con Bubblewrap.** La app de Android es un marco que abre la web instalable a pantalla completa. Es lo más simple y se actualiza solo al actualizar la web.
1. **Dominio propio con HTTPS** (por ejemplo, `app.<dominio del cliente>`) apuntando al servidor. Es obligatorio para TWA y además resuelve el problema de cambiar de dirección. Opciones: mapeo de dominio de Cloud Run, o Firebase Hosting delante.
2. Instalar el JDK 17 y el Android SDK, y generar el proyecto: `npx @bubblewrap/cli init --manifest https://<dominio>/manifest.webmanifest` y `npx @bubblewrap/cli build`. Genera el paquete `.aab` y una clave de firma (guardarla en un lugar seguro: sin ella no se pueden publicar actualizaciones).
3. Publicar `/.well-known/assetlinks.json` con el nombre del paquete y la huella SHA-256 de la clave de firma (ejemplo en `public/.well-known/assetlinks.json.example`). Sin esto, la app muestra una barra de navegador.
4. Subir el `.aab` a Play Console.

**B. Capacitor.** Una app Android nativa que envuelve la web. Da acceso a funciones del teléfono (cámara nativa, notificaciones) pero exige Android Studio y más mantenimiento. Conviene solo si se necesita algo que la web no ofrezca.

## Lo que hay que preparar en Play Console (cuenta de UCO Digital Lab)
- **Cuenta de desarrollador** de Google Play (pago único; confirmar el valor vigente). Si es una cuenta personal nueva, Google puede exigir una **prueba cerrada con varios testers durante un período** antes de publicar; con cuenta de organización suele no pedirse. Confirmar la condición vigente al crear la cuenta.
- **Ficha:** nombre, descripción corta y larga en español, ícono de 512 px (ya está), imagen destacada de 1024 x 500 y capturas de pantalla del teléfono (se pueden sacar de la demo).
- **Política de privacidad** con dirección pública (la de `/privacidad.html`, ya revisada por un asesor legal).
- **Seguridad de los datos:** formulario de Play. Respuestas según la política: se recopilan nombre, correo y teléfono (cuenta), y contenido de la app (partes y firma); se cifran en tránsito; el usuario puede pedir la eliminación; no se comparten con terceros con fines de publicidad.
- **Acceso a la app:** la app exige login; hay que dar a Google una cuenta de prueba (una cuenta de capataz de la demo no sirve: debe existir en el sistema real).
- **Clasificación de contenido** y **público objetivo** (solo adultos / uso laboral).

## Pendiente (depende del cliente)
1. Dominio y quién lo administra.
2. Datos legales para la política (razón social, CUIT, correo de contacto, plazo de conservación).
3. Cuenta de Play Console de UCO Digital Lab y quién carga la ficha.
4. Decidir si el login de producción usa correo real o clave temporal (ya está resuelto con clave temporal).
5. Probar con teléfonos reales de los capataces en la finca (señal intermitente) antes de publicar.
