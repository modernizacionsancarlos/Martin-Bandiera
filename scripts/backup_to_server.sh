#!/usr/bin/env bash
# ==============================================================================
# SCRIPT DE RESPALDO REMOTO VÍA SSH - JOB MARTIN BANDIERA S.A.
# ==============================================================================
# Este script empaqueta el código fuente, configuración y datos del sistema,
# transfiriéndolo de forma segura mediante SSH a un servidor físico local o remoto.
# ==============================================================================

set -euo pipefail

# ------------------------------------------------------------------------------
# 1. PARÁMETROS DE CONFIGURACIÓN DEL SERVIDOR REMOTO (Editar según tu entorno)
# ------------------------------------------------------------------------------
REMOTE_USER="tu_usuario"                     # Usuario SSH en el servidor físico
REMOTE_HOST="192.168.1.100"                   # IP local o dominio del servidor físico
REMOTE_PORT="22"                             # Puerto SSH (por defecto 22)
REMOTE_DEST_DIR="/var/backups/bandiera_saas" # Carpeta de destino en el servidor físico
RETENTION_DAYS=30                            # Días de antigüedad para depurar backups viejos

# ------------------------------------------------------------------------------
# 2. DIRECTORIO LOCAL DEL PROYECTO
# ------------------------------------------------------------------------------
# Toma la ruta del proyecto automáticamente o la ruta especificada
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TIMESTAMP="$(date +'%Y%m%d_%H%M%S')"
BACKUP_FILENAME="backup_bandiera_${TIMESTAMP}.tar.gz"
TEMP_BACKUP_PATH="/tmp/${BACKUP_FILENAME}"

echo "========================================================"
echo " Iniciando Respaldo del Sistema JOB Martin Bandiera S.A."
echo " Fecha: $(date '+%Y-%m-%d %H:%M:%S')"
echo " Origen: ${PROJECT_DIR}"
echo " Destino: ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DEST_DIR}"
echo "========================================================"

# ------------------------------------------------------------------------------
# 3. VERIFICAR CONECTIVIDAD SSH
# ------------------------------------------------------------------------------
echo "[-] Verificando conexión SSH al servidor físico..."
if ! ssh -p "${REMOTE_PORT}" -o BatchMode=yes -o ConnectTimeout=8 "${REMOTE_USER}@${REMOTE_HOST}" "exit" 2>/dev/null; then
    echo "[!] ADVERTENCIA: La conexión SSH sin contraseña no está configurada o el servidor no responde."
    echo "    Si es la primera vez, se te solicitará la contraseña SSH."
fi

# Asegurar que el directorio de destino existe en el servidor remoto
ssh -p "${REMOTE_PORT}" "${REMOTE_USER}@${REMOTE_HOST}" "mkdir -p '${REMOTE_DEST_DIR}'"

# ------------------------------------------------------------------------------
# 4. GENERAR ARCHIVO COMPRIMIDO (Excluyendo node_modules, cache y temporales)
# ------------------------------------------------------------------------------
echo "[-] Comprimiendo archivos del sistema (excluyendo node_modules y .git)..."

tar --exclude='node_modules' \
    --exclude='.git' \
    --exclude='dist' \
    --exclude='.cache' \
    --exclude='*.log' \
    --exclude='.DS_Store' \
    -czf "${TEMP_BACKUP_PATH}" \
    -C "${PROJECT_DIR}" .

BACKUP_SIZE="$(du -h "${TEMP_BACKUP_PATH}" | cut -f1)"
echo "[✓] Archivo comprimido generado: ${BACKUP_FILENAME} (${BACKUP_SIZE})"

# ------------------------------------------------------------------------------
# 5. TRANSFERIR ARCHIVO AL SERVIDOR FÍSICO POR SSH
# ------------------------------------------------------------------------------
echo "[-] Transfiriendo respaldo al servidor físico mediante SCP/SSH..."
scp -P "${REMOTE_PORT}" "${TEMP_BACKUP_PATH}" "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DEST_DIR}/"

# ------------------------------------------------------------------------------
# 6. LIMPIEZA LOCAL
# ------------------------------------------------------------------------------
rm -f "${TEMP_BACKUP_PATH}"
echo "[✓] Copia temporal local eliminada."

# ------------------------------------------------------------------------------
# 7. POLÍTICA DE RETENCIÓN REMOTA (Elimina respaldos más viejos de N días)
# ------------------------------------------------------------------------------
echo "[-] Aplicando política de retención en servidor físico (${RETENTION_DAYS} días)..."
ssh -p "${REMOTE_PORT}" "${REMOTE_USER}@${REMOTE_HOST}" \
    "find '${REMOTE_DEST_DIR}' -name 'backup_bandiera_*.tar.gz' -type f -mtime +${RETENTION_DAYS} -delete 2>/dev/null || true"

echo "========================================================"
echo "[✓] Respaldo completado exitosamente en el servidor físico."
echo "    Ubicación remota: ${REMOTE_DEST_DIR}/${BACKUP_FILENAME}"
echo "========================================================"
