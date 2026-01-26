#!/bin/bash
# Скрипт установки зависимостей для VPN-сервера

set -e

echo "=== Обновление системы ==="
sudo apt update
sudo apt upgrade -y

echo "=== Установка необходимых пакетов ==="
sudo apt install -y curl wget unzip openssl

echo ""
echo "=== Проверка установленных пакетов ==="

# Проверка curl
if command -v curl &> /dev/null; then
    echo "✓ curl установлен: $(curl --version | head -n 1)"
else
    echo "✗ curl не установлен"
    exit 1
fi

# Проверка wget
if command -v wget &> /dev/null; then
    echo "✓ wget установлен: $(wget --version | head -n 1)"
else
    echo "✗ wget не установлен"
    exit 1
fi

# Проверка unzip
if command -v unzip &> /dev/null; then
    echo "✓ unzip установлен: $(unzip -v | head -n 1)"
else
    echo "✗ unzip не установлен"
    exit 1
fi

# Проверка openssl
if command -v openssl &> /dev/null; then
    echo "✓ openssl установлен: $(openssl version)"
else
    echo "✗ openssl не установлен"
    exit 1
fi

echo ""
echo "=== Все зависимости установлены успешно ==="
