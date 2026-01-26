#!/bin/bash
# Обновление конфигурации на сервере из локального файла

set -e

if [ -z "$1" ]; then
    echo "Использование: $0 <путь-к-конфигу>"
    echo "Пример: $0 configs/xray-vless-reality.json"
    exit 1
fi

CONFIG_FILE="$1"
CONFIG_DIR="/usr/local/etc/xray"
BACKUP_DIR="/opt/xray-vpn-backup"

if [ ! -f "$CONFIG_FILE" ]; then
    echo "Ошибка: файл конфигурации не найден: $CONFIG_FILE"
    exit 1
fi

echo "=== Обновление конфигурации ==="

# Создание резервной копии
echo "Создание резервной копии..."
sudo cp $CONFIG_DIR/config.json $BACKUP_DIR/config.json.backup.$(date +%Y%m%d_%H%M%S)

# Проверка новой конфигурации
echo "Проверка конфигурации..."
/usr/local/bin/xray run -test -config "$CONFIG_FILE" || {
    echo "Ошибка: конфигурация невалидна!"
    exit 1
}

# Применение конфигурации
echo "Применение конфигурации..."
sudo cp "$CONFIG_FILE" "$CONFIG_DIR/config.json"

# Перезапуск сервиса
echo "Перезапуск X-Ray..."
sudo systemctl restart xray

# Проверка статуса
sleep 2
if sudo systemctl is-active --quiet xray; then
    echo "✓ Конфигурация применена успешно"
    sudo systemctl status xray --no-pager
else
    echo "Ошибка: X-Ray не запустился!"
    echo "Восстанавливаем предыдущую конфигурацию..."
    LAST_BACKUP=$(ls -t $BACKUP_DIR/config.json.backup.* | head -1)
    sudo cp "$LAST_BACKUP" "$CONFIG_DIR/config.json"
    sudo systemctl restart xray
    exit 1
fi
