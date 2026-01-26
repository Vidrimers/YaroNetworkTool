#!/bin/bash
# Скрипт автоматического обновления VPN-сервера с GitHub

set -e

DEPLOY_DIR="/opt/xray-vpn"
BACKUP_DIR="/opt/xray-vpn-backup"

echo "[DEPLOY] Начинаем обновление..."

# Переход в директорию проекта
cd $DEPLOY_DIR || exit 1

# Создание резервной копии текущей конфигурации
echo "[DEPLOY] Создаем резервную копию конфигурации..."
sudo cp /usr/local/etc/xray/config.json $BACKUP_DIR/config.json.backup.$(date +%Y%m%d_%H%M%S) 2>/dev/null || true

# Обновление кода из GitHub
echo "[DEPLOY] Обновляем код из GitHub..."
git pull origin main || git pull origin master || exit 1

# Проверка новой конфигурации (если она изменилась)
if [ -f "/usr/local/etc/xray/config.json" ]; then
    echo "[DEPLOY] Проверяем конфигурацию X-Ray..."
    /usr/local/bin/xray run -test -config /usr/local/etc/xray/config.json || {
        echo "[ERROR] Конфигурация невалидна! Откатываем изменения..."
        git reset --hard HEAD~1
        exit 1
    }
fi

# Перезапуск X-Ray сервиса
echo "[DEPLOY] Перезапускаем X-Ray..."
sudo systemctl restart xray

# Проверка статуса
sleep 2
if sudo systemctl is-active --quiet xray; then
    echo "[DEPLOY] ✓ X-Ray успешно перезапущен"
    sudo systemctl status xray --no-pager -l
else
    echo "[ERROR] X-Ray не запустился! Проверьте логи:"
    sudo journalctl -u xray -n 20 --no-pager
    exit 1
fi

echo "[DEPLOY] Обновление завершено успешно!"
