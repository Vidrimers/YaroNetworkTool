#!/bin/bash
# Синхронизация клиентов между локальным конфигом и сервером

set -e

LOCAL_CONFIG="$1"
SERVER_CONFIG="/usr/local/etc/xray/config.json"

if [ -z "$LOCAL_CONFIG" ]; then
    echo "Использование: $0 <путь-к-локальному-конфигу>"
    echo "Пример: $0 configs/xray-vless-reality.json"
    exit 1
fi

if [ ! -f "$LOCAL_CONFIG" ]; then
    echo "Ошибка: файл не найден: $LOCAL_CONFIG"
    exit 1
fi

echo "=== Синхронизация клиентов ==="
echo ""

# Извлечение клиентов из обоих конфигов
python3 << EOF
import json

# Читаем локальный конфиг
with open('$LOCAL_CONFIG', 'r') as f:
    local_config = json.load(f)

# Читаем серверный конфиг
with open('$SERVER_CONFIG', 'r') as f:
    server_config = json.load(f)

# Находим клиентов в локальном конфиге
local_clients = []
for inbound in local_config['inbounds']:
    if inbound['protocol'] == 'vless':
        local_clients = inbound['settings'].get('clients', [])
        break

# Находим клиентов в серверном конфиге
server_clients = []
for inbound in server_config['inbounds']:
    if inbound['protocol'] == 'vless':
        server_clients = inbound['settings'].get('clients', [])
        break

print(f"Локальных клиентов: {len(local_clients)}")
print(f"Серверных клиентов: {len(server_clients)}")
print("")

# Показываем различия
local_uuids = {c['id'] for c in local_clients}
server_uuids = {c['id'] for c in server_clients}

new_in_local = local_uuids - server_uuids
new_in_server = server_uuids - local_uuids

if new_in_local:
    print("Новые клиенты в локальном конфиге (будут добавлены на сервер):")
    for client in local_clients:
        if client['id'] in new_in_local:
            print(f"  - {client.get('email', 'Без имени')}: {client['id']}")

if new_in_server:
    print("Новые клиенты на сервере (отсутствуют в локальном конфиге):")
    for client in server_clients:
        if client['id'] in new_in_server:
            print(f"  - {client.get('email', 'Без имени')}: {client['id']}")

if not new_in_local and not new_in_server:
    print("✓ Клиенты синхронизированы")
EOF

echo ""
read -p "Применить изменения? (y/n): " CONFIRM

if [ "$CONFIRM" != "y" ]; then
    echo "Отменено"
    exit 0
fi

# Применяем конфигурацию
./scripts/apply-config.sh "$LOCAL_CONFIG"
