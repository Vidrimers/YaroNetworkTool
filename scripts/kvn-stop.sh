#!/bin/bash

###############################################################################
# kvn-stop.sh - Остановка VPN Management API
# Использование: ./scripts/kvn-stop.sh
###############################################################################

echo "[STOP] Остановка VPN Management API..."
pm2 stop vpn-api || exit 1

echo "[STOP] ✓ API остановлен"
echo "[STOP] Проверить статус: pm2 status"
echo "[STOP] Запустить снова: pm2 start vpn-api"

exit 0
