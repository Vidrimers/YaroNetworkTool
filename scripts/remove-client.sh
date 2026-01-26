#!/bin/bash
# Удаление клиента из конфигурации X-Ray

set -e

CONFIG_FILE="/usr/local/etc/xray/config.json"

echo "=== Удаление клиента ==="
echo ""

# Показываем список клиентов
./scripts/list-clients.sh

echo ""
read -p "Введите UUID клиента для удаления: " CLIENT_UUID

if [ -z "$CLIENT_UUID" ]; then
    echo "Ошибка: UUID не может быть пустым"
    exit 1
fi

# Создание временного файла
TMP_CONFIG="/tmp/xray-config-tmp.json"

# Удаление клиента из JSON
python3 << EOF
import json
import sys

try:
    with open('$CONFIG_FILE', 'r') as f:
        config = json.load(f)
    
    removed = False
    
    # Находим inbound с vless
    for inbound in config['inbounds']:
        if inbound['protocol'] == 'vless':
            clients = inbound['settings']['clients']
            
            # Ищем и удаляем клиента
            for i, client in enumerate(clients):
                if client['id'] == '$CLIENT_UUID':
                    client_name = client.get('email', 'Без имени')
                    clients.pop(i)
                    removed = True
                    print(f"✓ Клиент '{client_name}' удален")
                    break
            break
    
    if not removed:
        print("Ошибка: клиент с таким UUID не найден")
        sys.exit(1)
    
    # Сохраняем обновленную конфигурацию
    with open('$TMP_CONFIG', 'w') as f:
        json.dump(config, f, indent=2)
        
except Exception as e:
    print(f"Ошибка: {e}")
    sys.exit(1)
EOF

if [ $? -ne 0 ]; then
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
    echo ""
    echo "=== Клиент успешно удален ==="
else
    echo "Ошибка: X-Ray не запустился!"
    sudo journalctl -u xray -n 20 --no-pager
    exit 1
fi
