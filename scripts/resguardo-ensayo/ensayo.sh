#!/usr/bin/env bash
# Ensayo de la restauración contra un emulador de Firestore (nunca toca la base real).
# Se ejecuta desde la raíz del proyecto con: npm run test:resguardo
set -euo pipefail
cd "$(dirname "$0")/../.."
FOLDER="${1:-$(ls -d backups/20*/ | tail -1)}"
EMU="localhost:8091"
PROD=$(node -e "console.log(JSON.parse(require('fs').readFileSync('firebase-applet-config.json','utf8')).firestoreDatabaseId)")
fail() { echo "FALLA: $1"; exit 1; }
run() { node scripts/resguardo.mjs "$@"; }

TMP="$(mktemp -d)"; cp -r "$FOLDER"/. "$TMP"/; rm -f "$TMP/MANIFIESTO.json"; run sellar "$TMP" >/dev/null
run verificar "$TMP" >/dev/null || fail "la copia sana no verifica"
echo " " >> "$TMP/workers.json"; run verificar "$TMP" >/dev/null 2>&1 && fail "no detectó un archivo alterado"; echo "ok  detecta una copia alterada"
cp "$FOLDER/workers.json" "$TMP/workers.json"; run verificar "$TMP" >/dev/null || fail "la copia restituida no verifica"

run restaurar "$TMP" --base "$PROD" --emulador $EMU | grep -q "Documentos a crear: [1-9]" || fail "la simulación no vio documentos"
run restaurar "$TMP" --base "$PROD" --emulador $EMU --aplicar >/dev/null
run comparar "$TMP" --emulador $EMU >/dev/null || fail "tras restaurar la base no quedó completa"; echo "ok  restaurar deja la base completa"
run restaurar "$TMP" --base "$PROD" --emulador $EMU --aplicar | grep -q "Documentos a crear: 0" || fail "re-aplicar creó documentos"; echo "ok  re-aplicar no duplica ni pisa"
node scripts/resguardo-ensayo/borrar.mjs "$PROD" >/dev/null
run comparar "$TMP" --emulador $EMU >/dev/null 2>&1 && fail "no detectó documentos borrados"; echo "ok  detecta documentos que faltan"
run restaurar "$TMP" --base "$PROD" --emulador $EMU --aplicar | grep -q "Documentos a crear: 2" || fail "no recuperó los 2 borrados"
run comparar "$TMP" --emulador $EMU >/dev/null || fail "tras recuperar siguen faltando documentos"; echo "ok  recupera lo borrado sin pisar lo modificado"
run restaurar "$TMP" --base "$PROD" --aplicar >/dev/null 2>&1 && fail "escribió en producción sin confirmación"; echo "ok  se niega a escribir en producción sin confirmación explícita"
rm -rf "$TMP"; echo "TODAS LAS PRUEBAS DEL RESGUARDO PASARON"
