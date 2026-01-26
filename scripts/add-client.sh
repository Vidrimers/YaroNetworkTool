#!/bin/bash
# Добавление нового клиента в конфигурацию X-Ray

set -e

CONFIG_FILE="/usr/local/etc/xray/config.json"
CLIENTS_DB="./clients.txt"

echo "=== Добавление нового клиента ==="
echo ""

# Запрос имени клиента
read -p "Введите имя клиента (например, Ivan, Maria): " CLIENT_NAME

if [ -z "$CLIENT_NAME" ]; then
    echo "Ошибка: имя клиента не может быть пустым"
    exit 1
fi

# Генерация UUID для клиента
CLIENT_UUID=$(cat /proc/sys/kernel/random/uuid)

echo ""
echo "Сгенерирован UUID для клиента $CLIENT_NAME:"
echo "$CLIENT_UUID"
echo ""

# Создание временного файла с обновленной конфигурацией
TMP_CONFIG="/tmp/xray-config-tmp.json"

# Добавление клиента в JSON
python3 << EOF
import json
import sys

try:
    with open('$CONFIG_FILE', 'r') as f:
        config = json.load(f)
    
    # Находим inbound с vless
    for inbound in config['inbounds']:
        if inbound['protocol'] == 'vless':
            # Добавляем нового клиента
            new_client = {
                "id": "$CLIENT_UUID",
                "flow": "",
                "email": "$CLIENT_NAME"
            }
            inbound['settings']['clients'].append(new_client)
            break
    
    # Сохраняем обновленную конфигурацию
    with open('$TMP_CONFIG', 'w') as f:
        json.dump(config, f, indent=2)
    
    print("✓ Клиент добавлен в конфигурацию")
except Exception as e:
    print(f"Ошибка: {e}")
    sys.exit(1)
EOF

if [ $? -ne 0 ]; then
    echo "Ошибка при добавлении клиента"
    exit 1
fi

# Проверка новой конфигурации
echo "Проверка конфигурации..."
/usr/local/bin/xray run -test -config "$TMP_CONFIG" || {
    echo "Ошибка: конфигурация невалидна!"
    rm "$TMP_CONFIG"
    exit 1
}

# Создание резервной копии
BACKUP_DIR="/opt/xray-vpn-backup"
sudo mkdir -p "$BACKUP_DIR"
sudo cp "$CONFIG_FILE" "$BACKUP_DIR/config.json.backup.$(date +%Y%m%d_%H%M%S)"

# Применение новой конфигурации
sudo cp "$TMP_CONFIG" "$CONFIG_FILE"
rm "$TMP_CONFIG"

# Перезапуск X-Ray
echo "Перезапуск X-Ray..."
sudo systemctl restart xray

sleep 2
if sudo systemctl is-active --quiet xray; then
    echo "✓ X-Ray успешно перезапущен"
    
    # Сохранение информации о клиенте
    mkdir -p "$(dirname $CLIENTS_DB)"
    echo "$(date '+%Y-%m-%d %H:%M:%S') | $CLIENT_NAME | $CLIENT_UUID" >> "$CLIENTS_DB"
    
    echo ""
    echo "=== Клиент успешно добавлен ==="
    echo "Имя: $CLIENT_NAME"
    echo "UUID: $CLIENT_UUID"
    echo ""
    echo "Теперь сгенерируйте ссылку для клиента:"
    echo "./scripts/generate-client-link.sh"
    echo ""
else
    echo "Ошибка: X-Ray не запустился!"
    sudo journalctl -u xray -n 20 --no-pager
    exit 1
fi
