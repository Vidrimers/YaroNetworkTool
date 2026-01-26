#!/bin/bash
# Применение конфигурации X-Ray

set -e

if [ -z "$1" ]; then
    echo "Использование: $0 <путь-к-конфигу>"
    echo "Пример: $0 ../configs/xray-vless-reality.json"
    exit 1
fi

CONFIG_FILE="$1"
CONFIG_DIR="/usr/local/etc/xray"

if [ ! -f "$CONFIG_FILE" ]; then
    echo "Ошибка: файл конфигурации не найден: $CONFIG_FILE"
    exit 1
fi

echo "=== Применение конфигурации ==="
echo "Файл: $CONFIG_FILE"

# Проверка конфигурации
echo "Проверка конфигурации..."
/usr/local/bin/xray run -test -config "$CONFIG_FILE"

# Копирование конфигурации
echo "Копирование конфигурации..."
sudo cp "$CONFIG_FILE" "$CONFIG_DIR/config.json"

# Перезапуск сервиса
echo "Перезапуск X-Ray..."
sudo systemctl restart xray

echo "=== Конфигурация применена успешно ==="
sudo systemctl status xray --no-pager
