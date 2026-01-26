#!/bin/bash
# Список всех клиентов из конфигурации X-Ray

set -e

CONFIG_FILE="/usr/local/etc/xray/config.json"

echo "=== Список клиентов VPN ==="
echo ""

if [ ! -f "$CONFIG_FILE" ]; then
    echo "Ошибка: конфигурация не найдена: $CONFIG_FILE"
    exit 1
fi

# Извлечение списка клиентов
python3 << 'EOF'
import json
import sys

try:
    with open('/usr/local/etc/xray/config.json', 'r') as f:
        config = json.load(f)
    
    client_count = 0
    
    # Находим все inbound с vless
    for inbound in config['inbounds']:
        if inbound['protocol'] == 'vless':
            clients = inbound['settings'].get('clients', [])
            
            if not clients:
                print("Клиенты не найдены")
                sys.exit(0)
            
            print(f"{'№':<4} {'Имя':<20} {'UUID':<40}")
            print("-" * 70)
            
            for idx, client in enumerate(clients, 1):
                client_id = client.get('id', 'N/A')
                client_email = client.get('email', 'Без имени')
                print(f"{idx:<4} {client_email:<20} {client_id:<40}")
                client_count += 1
            
            print("-" * 70)
            print(f"Всего клиентов: {client_count}")
            break
    
    if client_count == 0:
        print("Клиенты не найдены")
        
except Exception as e:
    print(f"Ошибка: {e}")
    sys.exit(1)
EOF

echo ""
echo "Для добавления нового клиента используйте:"
echo "  ./scripts/add-client.sh"
echo ""
echo "Для удаления клиента используйте:"
echo "  ./scripts/remove-client.sh"
