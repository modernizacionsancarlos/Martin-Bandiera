# App Android · JOB Bandiera

App Android del sistema, hecha con Capacitor 8. Usa el mismo código web y la misma base Supabase.
Los remitos cargados sin señal se guardan en el teléfono y se suben solos al volver la conexión.

- **ID de la app:** `ar.com.jobbandiera.gestion`. No se puede cambiar después de la primera publicación.
- **Nombre:** JOB Bandiera
- **Android mínimo:** 7.0 (API 24). **Target:** API 36.

## Qué ve cada rol

- **Capataz y Empleado:** ven una sola pantalla, con "Cargar remito" y la lista de lo enviado desde ese teléfono.
  - No ven montos, tarifas, facturación ni ningún menú.
  - La base les bloquea la lectura de todos los datos del negocio.
  - El remito viaja por la función `submit_field_report`. El servidor descarta cualquier monto, asigna el número `#N-AAAA` y lo marca con `costosPendientes`.
  - El número lo asigna siempre el servidor, en el orden en que cada remito llega. Sin señal no tiene número: lo recibe al subir. Dos cargas simultáneas nunca comparten número, tampoco con las que se hacen desde la web.
  - Mientras el remito siga en estado "Cargado", quien lo tiene a cargo puede editarlo (`update_field_report`), por ejemplo para sumar una jornada al volver al lugar. Cada edición vuelve a marcarlo para recalcular costos.
  - Un Capataz puede transferir el remito a otro Capataz que tenga cuenta (`transfer_field_report`), con una nota opcional. El que recibe lo ve en "Mis remitos" y lo puede seguir editando.
  - En Auditoría, administración ve las etiquetas "Transferido a …" y "Editado en campo", y en el detalle el historial completo.
- **Administradores** (SuperAdmin, Owner, Gerente y Admin): ven el sistema completo. Al abrir la app, los remitos de campo pendientes se calculan solos (costos, materiales y precio sugerido) y aparecen en Auditoría con estado "Cargado".

## Cómo funciona sin internet

| Situación | Qué pasa |
|---|---|
| Se carga o edita un remito sin señal | Se guarda en el teléfono (IndexedDB) y aparece en la lista al instante. Arriba de la barra inferior se ve "Sin conexión · N cambios pendientes". |
| Vuelve la señal | La cola sube sola, en orden. Además reintenta cada 30 s y cada vez que se renueva la sesión. Tocar el aviso fuerza un reintento. |
| Se cierra la app o se apaga el teléfono | La cola queda guardada y sube la próxima vez que se abra con señal. |
| La sesión vence en la finca | El usuario sigue trabajando con la última cuenta verificada. La sesión se renueva al volver la señal. |
| El servidor rechaza un cambio (por ejemplo, falta de permiso) | Se muestra un aviso rojo y ese cambio se descarta para no trabar la cola. |
| Escanear un remito con IA | Necesita internet. Sin señal, el remito se carga a mano. |

Importante: el primer ingreso de cada usuario necesita internet, para iniciar sesión y descargar los datos.

## Requisitos de la PC

- Node 20 o superior.
- Android Studio, con SDK Platform **36** y Build-Tools instalados desde SDK Manager.
- `android/local.properties` con `sdk.dir=...`. Android Studio lo crea solo al abrir el proyecto.

## Comandos

```bash
npm run android:sync     # compila la web y la copia al proyecto Android
npm run android:open     # abre el proyecto en Android Studio
npm run android:apk      # APK de prueba: android/app/build/outputs/apk/debug/app-debug.apk
npm run android:bundle   # AAB firmado para Play Store: android/app/build/outputs/bundle/release/app-release.aab
```

Después de cada cambio en el código web, corré `npm run android:sync` antes de compilar.

Para probar en un teléfono: activá "Depuración USB", conectalo y en Android Studio tocá Run.
También podés instalar `app-debug.apk` directo en el teléfono.

## Variables

- `VITE_API_BASE_URL`: dirección del backend que usa el escaneo con IA desde la app. Por defecto es `https://bandiera-gestion.vercel.app`. Si el dominio final cambia, ponelo en `.env.local` antes de `android:sync`.
- En Vercel tiene que estar `GEMINI_API_KEY`, y además deployada la versión que incluye el CORS para la app (`api/ai/scan-remito.ts`).

## Firma (solo la primera vez)

1. Creá la clave de subida. Guardá el archivo y las claves en un lugar seguro: sin ellos no se pueden publicar actualizaciones.
   ```bash
   keytool -genkeypair -v -keystore android/upload-key.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000
   ```
2. Copiá `android/keystore.properties.example` a `android/keystore.properties` y completá las claves.
   El archivo `.jks` y `keystore.properties` están en `.gitignore` y en `.vercelignore`.
3. En Play Console activá **Play App Signing**: Google guarda la clave final y vos solo usás la de subida.

## Publicar en Play Store

1. Creá la cuenta de desarrollador en Play Console. Tiene un pago único. Si es a nombre de la empresa, se necesita el número D-U-N-S.
2. **Crear app:** nombre "JOB Bandiera", idioma Español (Argentina), tipo App, gratis.
3. **Recomendado: publicación privada.** Es una herramienta interna. Hay dos opciones:
   - Si la empresa tiene Google Workspace: publicala como **app privada** con Managed Google Play. No pasa revisión pública ni aparece en la tienda.
   - Si no: usá la pista de **Prueba interna** (hasta 100 testers por correo) o **Prueba cerrada**.
     Atención: las cuentas de desarrollador personales nuevas deben hacer una prueba cerrada con 12 testers durante 14 días antes de publicar en Producción.
4. **Ficha de la tienda.** Material listo en `assets/`:
   - Ícono 512×512: `assets/play-icon-512.png`
   - Gráfico destacado 1024×500: `assets/play-feature-1024x500.png`
   - Capturas: al menos 2 del teléfono. Sacalas del emulador o del teléfono con la app instalada.
   - Descripción breve, por ejemplo: "Carga de remitos y reportes de campo para el personal de JOB Bandiera, con o sin señal."
5. **Política de privacidad:** `https://bandiera-gestion.vercel.app/privacidad.html` (o tu dominio final).
   Antes de publicar, completá el correo de contacto en `public/privacidad.html`.
6. **Contenido de la app** (formularios de Play Console):
   - Acceso a la app: "Toda o parte de la funcionalidad está restringida". Cargá un usuario de prueba con rol Capataz para el revisor.
   - Anuncios: No.
   - Clasificación de contenido: Utilidad / Productividad, sin contenido sensible.
   - Público objetivo: 18 años o más.
   - Seguridad de los datos:
     - Datos recopilados: correo y nombre (gestión de cuenta), fotos (función de la app, opcional) y otros contenidos generados por el usuario (remitos y firmas).
     - Datos compartidos: fotos con Google Gemini, solo al escanear.
     - Cifrado en tránsito: Sí.
     - El usuario puede pedir que se borren sus datos: Sí, por el correo de contacto.
7. Subí el `.aab` a la pista elegida y enviá a revisión.

## Cada actualización

1. Subí `versionCode` (+1) y `versionName` en `android/app/build.gradle`.
2. Corré `npm run android:bundle`.
3. Subí el nuevo `.aab` en Play Console.

Los cambios de la base Supabase y del backend de Vercel no necesitan una nueva versión de la app.

## Permisos

Pide solo `INTERNET` y `ACCESS_NETWORK_STATE`. La cámara se usa desde el selector de archivos del sistema, así que no requiere permiso propio.
Las copias de seguridad están desactivadas (`allowBackup=false` y `data_extraction_rules.xml`), para que la sesión y los remitos pendientes no se copien a otros dispositivos.
