#!/bin/bash
# Генерация конфигурации для X-Ray

set -e

CONFIG_DIR="/usr/local/etc/xray"
UUID=$(cat /proc/sys/kernel/random/uuid)
KEYS_OUTPUT=$(/usr/local/bin/xray x25519)
PRIVATE_KEY=$(echo "$KEYS_OUTPUT" | grep "PrivateKey:" | awk '{print $2}')
PUBLIC_KEY=$(echo "$KEYS_OUTPUT" | grep "Password:" | awk '{print $2}')
SHORT_ID=$(openssl rand -hex 8)

echo "=== Генерация конфигурации X-Ray ==="
echo "UUID: $UUID"
echo "Public Key: $PUBLIC_KEY"
echo "Private Key: $PRIVATE_KEY"
echo "Short ID: $SHORT_ID"

# Сохранение ключей
mkdir -p ./generated
cat > ./generated/keys.txt << EOF
UUID: $UUID
Public Key: $PUBLIC_KEY
Private Key: $PRIVATE_KEY
Short ID: $SHORT_ID
EOF

echo ""
echo "=== Ключи сохранены в ./generated/keys.txt ==="
echo "Используйте эти данные для создания конфигурации"
