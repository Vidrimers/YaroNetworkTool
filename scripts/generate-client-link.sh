#!/bin/bash
# Генерация ссылки для клиента

set -e

echo "=== Генератор ссылки для клиента ==="
echo ""

# Показываем список клиентов
if [ -f "/usr/local/etc/xray/config.json" ]; then
    echo "Доступные клиенты:"
    ./scripts/list-clients.sh 2>/dev/null || true
    echo ""
fi

read -p "Введите UUID клиента: " UUID
read -p "Введите IP или домен сервера: " SERVER
read -p "Введите порт (по умолчанию 443): " PORT
PORT=${PORT:-443}

echo ""
echo "Выберите тип подключения:"
echo "1) VLESS Reality (прямое подключение)"
echo "2) VLESS XHTTP через CDN"
read -p "Ваш выбор (1 или 2): " CHOICE

if [ "$CHOICE" == "1" ]; then
    read -p "Введите Public Key: " PUBLIC_KEY
    read -p "Введите Short ID: " SHORT_ID
    read -p "Введите SNI (например, www.microsoft.com): " SNI
    
    LINK="vless://${UUID}@${SERVER}:${PORT}?encryption=none&flow=&security=reality&sni=${SNI}&fp=chrome&pbk=${PUBLIC_KEY}&sid=${SHORT_ID}&type=xhttp&host=#MyVPN-Reality"
    
elif [ "$CHOICE" == "2" ]; then
    read -p "Введите домен (host): " HOST
    read -p "Введите путь (path, например /your-path): " PATH
    
    LINK="vless://${UUID}@${SERVER}:${PORT}?encryption=none&security=tls&sni=${HOST}&type=xhttp&host=${HOST}&path=${PATH}#MyVPN-CDN"
    
else
    echo "Неверный выбор"
    exit 1
fi

echo ""
echo "=== Ссылка для подключения ==="
echo "$LINK"
echo ""
echo "Скопируйте эту ссылку и используйте в клиенте (v2rayN, v2rayNG, Streisand)"
