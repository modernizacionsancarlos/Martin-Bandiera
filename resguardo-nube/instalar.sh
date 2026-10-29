#!/usr/bin/env bash
# Instala la copia diaria de Firestore en la nube (depósito privado, cuenta de servicio, trabajo de Cloud Run y disparo de las 23:59).
# Se ejecuta UNA vez, con la cuenta Owner del proyecto, desde Cloud Shell:
#   1. Abra https://console.cloud.google.com, elija el proyecto y toque el ícono ">_" (Cloud Shell).
#   2. Suba la carpeta resguardo-nube (menú de tres puntos > Subir) o su .zip y descomprímala.
#   3. bash resguardo-nube/instalar.sh
# Se puede repetir sin problema: lo que ya existe se conserva y el trabajo se actualiza.
set -euo pipefail

PROYECTO="${PROYECTO:-gen-lang-client-0133313162}"
REGION="${REGION:-us-west1}"
DEPOSITO="${DEPOSITO:-gen-lang-client-0133313162-resguardos}"
BASE="${BASE:-ai-studio-jobmartinbandier-d44d882d-1592-4457-b7d7-d21ee05f7b01}"
HORARIO="${HORARIO:-59 23 * * *}"
ZONA="${ZONA:-America/Argentina/Mendoza}"
CUENTA="resguardo-sa@${PROYECTO}.iam.gserviceaccount.com"
CARPETA="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

paso() { printf '\n== %s\n' "$1"; }

command -v gcloud >/dev/null || { echo "ERROR: no se encontró gcloud. Use Cloud Shell."; exit 1; }
[ -f "$CARPETA/index.mjs" ] && [ -f "$CARPETA/Dockerfile" ] || { echo "ERROR: faltan index.mjs o Dockerfile junto a este script."; exit 1; }

USUARIO="$(gcloud config get-value account 2>/dev/null || true)"
cat <<EOF
Se va a configurar en el proyecto REAL:
  proyecto : $PROYECTO
  usuario  : ${USUARIO:-(sin sesión)}
  se crea  : depósito privado gs://$DEPOSITO, cuenta $CUENTA,
             trabajo de Cloud Run "resguardo-diario" y disparo "$HORARIO" ($ZONA).
  no toca  : los datos de Firestore (solo se les da permiso de lectura), la app ni las reglas.
EOF
read -r -p "¿Continuar? Escriba SI: " RESPUESTA
[ "$RESPUESTA" = "SI" ] || { echo "Cancelado. No se cambió nada."; exit 0; }

gcloud config set project "$PROYECTO" >/dev/null

paso "1/6 Activar servicios"
gcloud services enable run.googleapis.com cloudscheduler.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com

paso "2/6 Depósito privado (sin acceso público, con versiones y borrado a los 90 días)"
if ! gcloud storage buckets describe "gs://$DEPOSITO" >/dev/null 2>&1; then
  gcloud storage buckets create "gs://$DEPOSITO" --location="$REGION" --uniform-bucket-level-access --public-access-prevention
else
  echo "El depósito ya existe, se conserva."
fi
gcloud storage buckets update "gs://$DEPOSITO" --versioning
TMP_LIFECYCLE="$(mktemp)"
echo '{"rule":[{"action":{"type":"Delete"},"condition":{"age":90}}]}' > "$TMP_LIFECYCLE"
gcloud storage buckets update "gs://$DEPOSITO" --lifecycle-file="$TMP_LIFECYCLE"
rm -f "$TMP_LIFECYCLE"

paso "3/6 Cuenta de servicio con permisos mínimos"
if ! gcloud iam service-accounts describe "$CUENTA" >/dev/null 2>&1; then
  gcloud iam service-accounts create resguardo-sa --display-name="Copia diaria de Firestore"
  sleep 15
fi
gcloud projects add-iam-policy-binding "$PROYECTO" --member="serviceAccount:$CUENTA" --role=roles/datastore.viewer --condition=None >/dev/null
gcloud storage buckets add-iam-policy-binding "gs://$DEPOSITO" --member="serviceAccount:$CUENTA" --role=roles/storage.objectCreator >/dev/null
gcloud storage buckets add-iam-policy-binding "gs://$DEPOSITO" --member="serviceAccount:$CUENTA" --role=roles/storage.objectViewer >/dev/null

paso "4/6 Trabajo de Cloud Run (tarda unos minutos: construye la imagen)"
gcloud run jobs deploy resguardo-diario --source "$CARPETA" --region "$REGION" --service-account "$CUENTA" \
  --set-env-vars "BACKUP_BUCKET=$DEPOSITO,FIRESTORE_DATABASE_ID=$BASE,PROJECT_ID=$PROYECTO" \
  --max-retries 1 --task-timeout 15m --quiet

paso "5/6 Disparo diario"
gcloud run jobs add-iam-policy-binding resguardo-diario --region "$REGION" --member="serviceAccount:$CUENTA" --role=roles/run.invoker >/dev/null
URI="https://run.googleapis.com/v2/projects/$PROYECTO/locations/$REGION/jobs/resguardo-diario:run"
if gcloud scheduler jobs describe resguardo-diario-2359 --location "$REGION" >/dev/null 2>&1; then
  gcloud scheduler jobs update http resguardo-diario-2359 --location "$REGION" --schedule "$HORARIO" --time-zone "$ZONA" \
    --uri "$URI" --http-method POST --oauth-service-account-email "$CUENTA"
else
  gcloud scheduler jobs create http resguardo-diario-2359 --location "$REGION" --schedule "$HORARIO" --time-zone "$ZONA" \
    --uri "$URI" --http-method POST --oauth-service-account-email "$CUENTA"
fi

paso "6/6 Primera ejecución de prueba"
gcloud run jobs execute resguardo-diario --region "$REGION" --wait
echo
echo "Copias en el depósito:"
gcloud storage ls "gs://$DEPOSITO/resguardos/"
echo
echo "LISTO. Revise que la carpeta nueva tenga los archivos .json y MANIFIESTO.json."
echo "Próxima copia automática: todos los días a las 23:59 (hora de Mendoza)."
