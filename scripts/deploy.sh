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

# Генерация конфигурации X-Ray из шаблона + .env
echo "[DEPLOY] Генерируем конфигурацию X-Ray из шаблона..."
if [ -f "configs/xray-vless-reality.json.template" ] && [ -f ".env" ]; then
    export $(grep -v '^#' .env | grep -v '^$' | xargs)
    envsubst '${XRAY_PRIVATE_KEY} ${XRAY_SHORT_ID} ${SS2022_PASSWORD}' \
        < configs/xray-vless-reality.json.template \
        > /tmp/xray-config-generated.json
    echo "[DEPLOY] Конфигурация сгенерирована"
else
    echo "[ERROR] Не найден шаблон или .env файл!"
    exit 1
fi

# Проверка новой конфигурации
if [ -f "/tmp/xray-config-generated.json" ]; then
    echo "[DEPLOY] Проверяем конфигурацию X-Ray..."
    /usr/local/bin/xray run -test -config /tmp/xray-config-generated.json || {
        echo "[ERROR] Конфигурация невалидна! Откатываем изменения..."
        rm -f /tmp/xray-config-generated.json
        git reset --hard HEAD~1
        exit 1
    }
    echo "[DEPLOY] Конфигурация валидна, копируем..."
    sudo cp /tmp/xray-config-generated.json /usr/local/etc/xray/config.json
    rm -f /tmp/xray-config-generated.json
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
