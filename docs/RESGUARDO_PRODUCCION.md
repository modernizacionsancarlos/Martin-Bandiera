# Resguardo de la producción

Objetivo: que el cliente no pierda nada de lo que ya cargó (remitos, clientes, capataces, empleados, ayudantes, parámetros, vehículos, recibos) al aplicar cualquier cambio del sistema.

Este documento describe las copias que existen, cómo hacer una nueva, cómo comprobar que nada se perdió después de un cambio y cómo recuperar algo si faltara. Los comandos de esta guía no modifican la base real salvo el último (restaurar), que está bloqueado a menos que se confirme.

## 1. Qué protege cada capa

| Capa | Qué guarda | Dónde está | Estado |
|---|---|---|---|
| Copias diarias de Firestore | Toda la base, 7 días | Google Cloud (programadas) | Activas desde el 14/10/2026 |
| Recuperación a un instante (PITR) | Cualquier momento de los últimos 7 días | Google Cloud | Activa desde el 14/10/2026 |
| Copia diaria automática en la nube (sección 8) | Toda la base, cada día a las 23:59, durante 90 días | Depósito privado de Cloud Storage del proyecto | **Preparada, sin instalar** |
| Copia local verificable (este documento) | Toda la base en archivos, con huella digital por archivo | Carpeta `backups/` de esta computadora | Disponible; la última copia real es del 14/10/2026 |
| Copia fuera de esta computadora | La carpeta anterior, copiada a otro lugar | Pendiente de elegir (disco externo o Drive de la empresa) | **Pendiente** |
| Código | El sistema | GitHub | Solo el código; no contiene datos |

Una copia local que está únicamente en esta computadora no alcanza: si la computadora falla, se pierde con ella. Copie la carpeta de cada copia a un segundo lugar.

## 2. Qué NO queda cubierto y por qué

- **Datos que solo existan en el navegador de alguien** (localStorage o IndexedDB de una dirección web anterior). Ninguna copia del servidor los ve. Antes de aplicar cambios, pida a quien cargaba datos con la dirección anterior que no limpie su navegador.
- **Cuentas de acceso (Firebase Auth).** Hoy los usuarios del sistema están en la colección `users`. Las cuentas reales de acceso se crean en la migración (`docs/MIGRACION_AUTH.md`). Esa colección sí queda en la copia.
- **Archivos de firma en Storage.** Aún no existen en producción: la firma se guarda dentro del documento y queda incluida en la copia.
- **Los 48 remitos, 1 recibo y 3 perfiles que solo están en la base anterior** (`future-apricot-m8chg`). Están en `backups/base-anterior-future-apricot.json`. Es una decisión del cliente si se incorporan; no se mezclan solos.

## 3. Cómo hacer una copia nueva (antes de cualquier cambio)

Lectura solamente. No escribe nada en la base real. Se ejecuta en esta computadora, en la carpeta del proyecto.

```bash
npm run resguardo:exportar
```

Al terminar, el comando verifica por su cuenta que los archivos quedaron completos y muestra la cantidad de documentos de cada colección. Si alguna colección falla, avisa que la copia quedó incompleta y no debe usarse.

La carpeta nueva queda en `backups/<fecha>/` e incluye `MANIFIESTO.json`: fecha, base de origen, versión del código, y para cada archivo la cantidad de documentos y su huella digital (SHA-256).

Para comprobar más tarde que una copia no cambió ni se dañó (no necesita conexión):

```bash
npm run resguardo:verificar backups/<fecha>
```

Después, copie la carpeta completa a un segundo lugar.

## 4. Orden recomendado al aplicar los cambios

1. `npm run resguardo:exportar` y copiar la carpeta a un segundo lugar.
2. Anotar la hora. Con la recuperación a un instante activa, Google puede devolver la base a cualquier momento de los últimos 7 días.
3. Aplicar el cambio, siguiendo `docs/MIGRACION_AUTH.md`.
4. `npm run resguardo:comparar backups/<fecha>` (solo lectura). Dice, colección por colección, si falta algo de lo que había en la copia. Los documentos "modificados desde la copia" son normales si se siguió trabajando.
5. Si el comando termina sin faltantes, no se perdió ningún documento. Si avisa que faltan, no siga cargando datos y pase a la sección 5.

## 5. Si faltara algo: recuperar

Hay tres caminos, de menos a más invasivo.

**A. Revisar qué falta.** `npm run resguardo:comparar backups/<fecha>` lista los identificadores que faltan.

**B. Recuperar solo lo que falta (modo seguro).** Primero una simulación, que no escribe nada:

```bash
node scripts/resguardo.mjs restaurar backups/<fecha> --base <id-de-la-base>
```

Muestra cuántos documentos crearía. En este modo solo crea los que faltan y nunca pisa ni borra uno existente. Para aplicar de verdad, agregue `--aplicar`. Si el destino es la base de producción, el comando se niega salvo que se agregue `--confirmo-produccion`. Hágalo únicamente cuando la comparación haya mostrado faltantes reales.

**C. Reemplazar documentos que cambiaron.** Agregue `--sobrescribir`. Pisa los documentos que difieran de la copia, incluso los que se editaron después. Úselo solo si hay documentos dañados y se acepta perder lo editado desde la copia.

Para volver toda la base a un momento anterior, use en cambio la recuperación a un instante de Google Cloud (consola de Firestore). Es una decisión del dueño del proyecto y se debe hacer con calma.

## 6. Pruebas hechas

`npm run test:resguardo` ensaya todo el circuito contra un emulador local, con la última copia real. Comprueba que:

- una copia alterada se detecta;
- restaurar en una base vacía la deja completa (1.049 documentos con la copia del 14/10);
- aplicar dos veces no duplica ni pisa nada;
- borrar remitos se detecta y la restauración segura los recupera sin pisar lo modificado;
- escribir en producción se rechaza sin confirmación explícita.

Estas pruebas no usaron la base real. Falta una prueba contra la base real, que consistiría en exportar y comparar de inmediato. Esa lectura requiere la autorización del dueño de la cuenta.

## 7. Qué hay hoy en `backups/`

Los manifiestos de las tres copias anteriores se crearon el 19/10/2026 a partir de lo que ya había en las carpetas. Sirven para detectar cambios desde ese día, no prueban cómo estaban los archivos antes.

| Copia | Documentos |
|---|---|
| 2026-10-08 | 1.049 |
| 2026-10-13 | 1.046 |
| 2026-10-14 (la más reciente) | 1.049 |

Han pasado varios días desde la última: antes de aplicar cambios, haga una copia nueva (sección 3).

## 8. Copia diaria automática a las 23:59 (en la nube)

### Por qué no en Firebase Hosting

Hosting publica archivos en internet: cualquiera con la dirección podría bajarlos. Las copias contienen clientes, precios, remitos y usuarios. Por eso el trabajo guarda las copias en un depósito **privado** de Cloud Storage, que forma parte del mismo proyecto de Firebase y se ve en la pestaña Storage de la consola. Nunca se publica nada.

### Cómo funciona

- Un trabajo de Cloud Run (`resguardo-nube/index.mjs`) lee todas las colecciones con una cuenta de servicio de solo lectura sobre Firestore.
- Cloud Scheduler lo dispara todos los días a las 23:59, hora de Mendoza.
- Guarda los archivos en `gs://<depósito>/resguardos/<fecha>/`, vuelve a leerlos para comprobar que se guardaron bien, y recién entonces escribe `MANIFIESTO.json`. Una carpeta sin manifiesto es una copia incompleta y se ignora.
- Si la base tiene más de 10 % menos documentos que en la copia anterior, el trabajo termina en error, aunque la copia se guarda. Un borrado masivo se nota al día siguiente en el historial de ejecuciones.
- El nombre de la carpeta usa la hora UTC: la copia de las 23:59 de Mendoza lleva la fecha del día siguiente, entre las 02:59 y 03:00.
- Usa el Admin SDK, que no depende de las reglas de seguridad. Sigue funcionando después de publicar las reglas nuevas. **El comando manual `npm run resguardo:exportar` no:** usa el SDK de cliente sin sesión y dejará de leer cuando se cierren las reglas. Después de ese paso, use la copia automática y `descargar`.
- El formato es el mismo que el de la copia manual. Una copia descargada se verifica, compara y restaura con `scripts/resguardo.mjs`.

### Instalación rápida (un solo comando)

La carpeta `resguardo-nube` incluye `instalar.sh`, que hace todos los pasos de abajo, pide confirmación escribiendo SI antes de cambiar algo y se puede repetir sin problema. La ejecuta el dueño del proyecto, que es quien puede iniciar sesión con permisos de Owner:

1. Entre a la consola de Google Cloud, elija el proyecto y abra Cloud Shell (ícono `>_`).
2. Suba `resguardo-nube.tar.gz` (menú de tres puntos, Subir; el archivo se genera con `tar -czf resguardo-nube.tar.gz resguardo-nube` en la carpeta del proyecto).
3. Ejecute:

```bash
tar xzf resguardo-nube.tar.gz && bash resguardo-nube/instalar.sh
```

Al final corre una primera copia de prueba y lista lo que quedó en el depósito. Si la construcción del trabajo falla por permisos de Cloud Build, el mensaje del error indica el rol que falta; es un ajuste de una sola vez.

### Instalación paso a paso (equivale al comando anterior)

Nada de esto está instalado: es un cambio en el proyecto de producción. Se hace una vez, desde Cloud Shell (consola de Google Cloud, ícono `>_`) o con `gcloud` instalado, con la cuenta Owner. Reemplace los valores si cambian.

```bash
PROYECTO=gen-lang-client-0133313162
REGION=us-west1
DEPOSITO=gen-lang-client-0133313162-resguardos
BASE=ai-studio-jobmartinbandier-d44d882d-1592-4457-b7d7-d21ee05f7b01
CUENTA=resguardo-sa@$PROYECTO.iam.gserviceaccount.com

gcloud config set project $PROYECTO
gcloud services enable run.googleapis.com cloudscheduler.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com

# 1. Depósito privado: sin acceso público, con historial de versiones y borrado automático a los 90 días.
gcloud storage buckets create gs://$DEPOSITO --location=$REGION --uniform-bucket-level-access --public-access-prevention
gcloud storage buckets update gs://$DEPOSITO --versioning
echo '{"rule":[{"action":{"type":"Delete"},"condition":{"age":90}}]}' > lifecycle.json
gcloud storage buckets update gs://$DEPOSITO --lifecycle-file=lifecycle.json

# 2. Cuenta de servicio con lo mínimo: leer Firestore y crear/leer objetos. No puede borrar ni pisar copias.
gcloud iam service-accounts create resguardo-sa --display-name="Copia diaria de Firestore"
gcloud projects add-iam-policy-binding $PROYECTO --member=serviceAccount:$CUENTA --role=roles/datastore.viewer
gcloud storage buckets add-iam-policy-binding gs://$DEPOSITO --member=serviceAccount:$CUENTA --role=roles/storage.objectCreator
gcloud storage buckets add-iam-policy-binding gs://$DEPOSITO --member=serviceAccount:$CUENTA --role=roles/storage.objectViewer

# 3. Trabajo de Cloud Run (se construye desde la carpeta resguardo-nube del repositorio).
gcloud run jobs deploy resguardo-diario --source resguardo-nube --region $REGION --service-account $CUENTA \
  --set-env-vars BACKUP_BUCKET=$DEPOSITO,FIRESTORE_DATABASE_ID=$BASE,PROJECT_ID=$PROYECTO \
  --max-retries 1 --task-timeout 15m

# 4. Disparo diario a las 23:59 de Mendoza.
gcloud run jobs add-iam-policy-binding resguardo-diario --region $REGION --member=serviceAccount:$CUENTA --role=roles/run.invoker
gcloud scheduler jobs create http resguardo-diario-2359 --location $REGION --schedule "59 23 * * *" --time-zone "America/Argentina/Mendoza" \
  --uri "https://run.googleapis.com/v2/projects/$PROYECTO/locations/$REGION/jobs/resguardo-diario:run" \
  --http-method POST --oauth-service-account-email $CUENTA
```

### Probarlo la primera vez

```bash
gcloud run jobs execute resguardo-diario --region us-west1 --wait
```

Debe terminar bien y dejar una carpeta en el depósito con 14 o más archivos y su `MANIFIESTO.json`. Si la prueba falla, el historial de ejecuciones del trabajo muestra el mensaje exacto.

### Usarlo

Con la sesión de Google Cloud iniciada en esta computadora (`gcloud auth application-default login`):

```bash
# PowerShell
$env:BACKUP_BUCKET="gen-lang-client-0133313162-resguardos"
$env:FIRESTORE_DATABASE_ID="ai-studio-jobmartinbandier-d44d882d-1592-4457-b7d7-d21ee05f7b01"
$env:PROJECT_ID="gen-lang-client-0133313162"
node resguardo-nube/index.mjs listar
node resguardo-nube/index.mjs descargar <nombre-de-la-copia>
npm run resguardo:verificar backups/<nombre-de-la-copia>
```

El usuario que descarga necesita el rol de lector de objetos del depósito.

### Costo y límites

Cada copia pesa alrededor de 1 MB. Con retención de 90 días son unos 100 MB: centavos de dólar por mes. Cloud Scheduler incluye 3 trabajos gratis. El trabajo necesita que el proyecto tenga facturación activa, y la tiene desde el 14/10/2026.

### Avisos

El trabajo termina en error si falla algo o si la base pierde más de 10 % de sus documentos. Para recibir un correo en esos casos, cree una alerta en Cloud Monitoring sobre las ejecuciones fallidas del trabajo `resguardo-diario`. Ese paso se hace en la consola y queda a cargo del dueño del proyecto.

### Pruebas hechas

`npm run test:resguardo-nube` ensaya el trabajo contra emuladores de Firestore y Storage: la copia queda completa y verificada, aparece en el listado, se descarga y verifica con la herramienta local, coincide con la base, y el trabajo avisa si la base perdió documentos. No se ejecutó contra la nube real porque nada está instalado todavía.
