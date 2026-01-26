#!/bin/bash
# Применение конфигурации X-Ray

set -e

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

if [ -z "$1" ]; then
    echo "Использование: $0 <путь-к-конфигу>"
    echo "Пример: $0 configs/xray-vless-reality.json"
    exit 1
fi

CONFIG_FILE="$1"
CONFIG_DIR="/usr/local/etc/xray"
BACKUP_DIR="/opt/xray-vpn-backup"

if [ ! -f "$CONFIG_FILE" ]; then
    echo -e "${RED}[ERROR]${NC} Файл конфигурации не найден: $CONFIG_FILE"
    exit 1
fi

echo -e "${YELLOW}=== Применение конфигурации ===${NC}"
echo "Файл: $CONFIG_FILE"
echo ""

# Создание директории для бэкапов
sudo mkdir -p "$BACKUP_DIR"

# Валидация конфигурации
echo -e "${YELLOW}[1/4]${NC} Валидация конфигурации..."
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
if ! "$SCRIPT_DIR/validate-config.sh" "$CONFIG_FILE"; then
    echo -e "${RED}[ERROR]${NC} Конфигурация невалидна!"
    exit 1
fi

# Создание резервной копии текущей конфигурации
echo -e "${YELLOW}[2/4]${NC} Создание резервной копии..."
if [ -f "$CONFIG_DIR/config.json" ]; then
    BACKUP_FILE="$BACKUP_DIR/config.json.backup.$(date +%Y%m%d_%H%M%S)"
    sudo cp "$CONFIG_DIR/config.json" "$BACKUP_FILE"
    echo -e "${GREEN}[OK]${NC} Резервная копия создана: $BACKUP_FILE"
else
    echo -e "${YELLOW}[WARNING]${NC} Текущая конфигурация не найдена, пропускаем бэкап"
fi

# Копирование новой конфигурации
echo -e "${YELLOW}[3/4]${NC} Копирование конфигурации..."
sudo cp "$CONFIG_FILE" "$CONFIG_DIR/config.json"
echo -e "${GREEN}[OK]${NC} Конфигурация скопирована"

# Перезапуск сервиса
echo -e "${YELLOW}[4/4]${NC} Перезапуск X-Ray..."
if sudo systemctl restart xray; then
    sleep 2
    if sudo systemctl is-active --quiet xray; then
        echo -e "${GREEN}[OK]${NC} X-Ray успешно перезапущен"
        echo ""
        echo -e "${GREEN}=== Конфигурация применена успешно ===${NC}"
        sudo systemctl status xray --no-pager -l
    else
        echo -e "${RED}[ERROR]${NC} X-Ray не запустился!"
        echo ""
        echo "Логи:"
        sudo journalctl -u xray -n 20 --no-pager
        
        # Откат к предыдущей конфигурации
        if [ -f "$BACKUP_FILE" ]; then
            echo ""
            echo -e "${YELLOW}[ROLLBACK]${NC} Откат к предыдущей конфигурации..."
            sudo cp "$BACKUP_FILE" "$CONFIG_DIR/config.json"
            sudo systemctl restart xray
            echo -e "${GREEN}[OK]${NC} Откат выполнен"
        fi
        exit 1
    fi
else
    echo -e "${RED}[ERROR]${NC} Не удалось перезапустить X-Ray"
    exit 1
fi
