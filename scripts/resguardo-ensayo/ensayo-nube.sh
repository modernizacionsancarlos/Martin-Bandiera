#!/usr/bin/env bash
# Ensayo del trabajo de copia diaria en la nube contra emuladores de Firestore y Storage (nunca toca la nube real).
# Se ejecuta con: npm run test:resguardo-nube
set -euo pipefail
cd "$(dirname "$0")/../.."
FOLDER="$(ls -d backups/20*/ | tail -1)"
PROD=$(node -e "console.log(JSON.parse(require('fs').readFileSync('firebase-applet-config.json','utf8')).firestoreDatabaseId)")
fail() { echo "FALLA: $1"; exit 1; }
export FIRESTORE_EMULATOR_HOST=localhost:8091 STORAGE_EMULATOR_HOST=http://127.0.0.1:9199
export BACKUP_BUCKET=demo-resguardo.appspot.com FIRESTORE_DATABASE_ID="$PROD" PROJECT_ID="$(node -e "console.log(JSON.parse(require('fs').readFileSync('firebase-applet-config.json','utf8')).projectId)")"
job() { node resguardo-nube/index.mjs "$@"; }

TMP="backups/.ensayo-tmp-$$"; mkdir -p "$TMP"; cp -r "$FOLDER"/. "$TMP"/
node scripts/resguardo.mjs restaurar "$TMP" --base "$PROD" --emulador localhost:8091 --aplicar >/dev/null
EXPECTED=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$TMP/MANIFIESTO.json','utf8')).totalDocumentos)")

job exportar > "$TMP/job.log" 2>&1 || { cat "$TMP/job.log"; fail "el trabajo terminó con error"; }; grep -q "Copia completa y verificada.*($EXPECTED documentos)" "$TMP/job.log" || { cat "$TMP/job.log"; fail "la copia en la nube no quedó completa"; }; echo "ok  la copia queda en el depósito, verificada y con $EXPECTED documentos"
job listar | grep -q "$EXPECTED documentos" || fail "no aparece en el listado"; echo "ok  aparece en el listado"
COPY=$(job listar | tail -1 | awk '{print $1}')
rm -rf "backups/$COPY"; job descargar "$COPY" >/dev/null
node scripts/resguardo.mjs verificar "backups/$COPY" >/dev/null || fail "la copia descargada no verifica"; echo "ok  se descarga y verifica con la herramienta local"
node scripts/resguardo.mjs comparar "backups/$COPY" --emulador localhost:8091 >/dev/null || fail "la copia de la nube no coincide con la base"; echo "ok  coincide con la base"
rm -rf "backups/$COPY"

node scripts/resguardo-ensayo/borrar.mjs "$PROD" >/dev/null
sleep 1
ALERT_DROP_PERCENT=0.1 job exportar >/dev/null 2>&1 && fail "no avisó que la base perdió documentos"; echo "ok  avisa (termina en error) si la base perdió documentos respecto de la copia anterior"
job listar | wc -l | grep -q "^2$" || fail "la copia con alerta no quedó guardada"; echo "ok  la copia con alerta igual se guarda"
rm -rf "$TMP"; echo "TODAS LAS PRUEBAS DE LA COPIA EN LA NUBE PASARON"
