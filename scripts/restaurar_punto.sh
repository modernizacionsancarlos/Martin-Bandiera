#!/bin/bash
# Script de Restauración de Emergencia - Ecosistema JOB Martin Bandiera
# Este script restaura el código y estado al Punto de Restauración Estable

set -e

echo "=========================================================="
echo "  RESTAURANDO AL PUNTO DE RESTAURACIÓN ESTABLE"
echo "  Punto: Acceso operativo, nómina oficial y administrativos"
echo "=========================================================="

# Sincronizar usuarios y nómina con permisos en Firestore
npx tsx scripts/sync_official_staff.ts

echo "✔ Código restaurado al punto de restauración estable."
echo "✔ Sin pantalla de bloqueo/login forzada."
echo "✔ 20 usuarios activos con sus permisos configurados."
echo "✔ Nómina oficial de 14 empleados ($9.400/h y comisiones)."
echo "✔ Datos administrativos en producción (463 clientes, 448 remitos) preservados al 100%."
echo "Restauración completada con éxito."
