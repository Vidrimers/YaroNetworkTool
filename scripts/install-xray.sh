#!/bin/bash
# Скрипт установки X-Ray Core

set -e

XRAY_VERSION="latest"
INSTALL_DIR="/usr/local/bin"
CONFIG_DIR="/usr/local/etc/xray"

echo "=== Установка X-Ray Core ==="

# Создание директорий
sudo mkdir -p $CONFIG_DIR
sudo mkdir -p /var/log/xray

# Скачивание последней версии X-Ray
echo "Скачивание X-Ray Core..."
wget -O /tmp/xray.zip https://github.com/XTLS/Xray-core/releases/latest/download/Xray-linux-64.zip

# Распаковка
echo "Распаковка..."
sudo unzip -o /tmp/xray.zip -d $INSTALL_DIR
sudo chmod +x $INSTALL_DIR/xray

# Очистка
rm /tmp/xray.zip

echo ""
echo "=== X-Ray Core установлен в $INSTALL_DIR/xray ==="

# Проверка установки и вывод версии
if [ -f "$INSTALL_DIR/xray" ]; then
    echo "✓ X-Ray установлен успешно"
    echo "Версия:"
    $INSTALL_DIR/xray version
else
    echo "✗ Ошибка: X-Ray не найден в $INSTALL_DIR/xray"
    exit 1
fi

echo ""
echo "=== Установка завершена успешно ==="
