#!/bin/bash

# Скрипт для отката nginx конфига к предыдущей версии
# Автор: VPN Management System
# Дата: 2026-02-14

set -e

echo "=========================================="
echo "Откат nginx конфига к предыдущей версии"
echo "=========================================="
echo ""

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Пути
NGINX_SITES_AVAILABLE="/etc/nginx/sites-available"
SITE_NAME="1xbetlineboom.xyz"
BACKUP_DIR="/root/nginx-backups"

# Проверка прав root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}Ошибка: Скрипт должен быть запущен с правами root${NC}"
    exit 1
fi

# Проверка наличия бэкапов
if [ ! -d "$BACKUP_DIR" ]; then
    echo -e "${RED}✗ Директория с бэкапами не найдена: $BACKUP_DIR${NC}"
    exit 1
fi

# Список доступных бэкапов
echo -e "${YELLOW}Доступные бэкапы:${NC}"
echo ""
ls -lht "$BACKUP_DIR" | grep "${SITE_NAME}_"
echo ""

# Получение последнего бэкапа
LATEST_BACKUP=$(ls -t "$BACKUP_DIR/${SITE_NAME}_"*.backup 2>/dev/null | head -1)

if [ -z "$LATEST_BACKUP" ]; then
    echo -e "${RED}✗ Бэкапы не найдены${NC}"
    exit 1
fi

echo -e "${YELLOW}Последний бэкап: ${NC}$LATEST_BACKUP"
echo ""

# Подтверждение
read -p "Восстановить этот бэкап? (y/n): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Откат отменен${NC}"
    exit 0
fi

# Создание бэкапа текущего конфига перед откатом
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
echo -e "${YELLOW}Создание бэкапа текущего конфига...${NC}"
cp "$NGINX_SITES_AVAILABLE/$SITE_NAME" "$BACKUP_DIR/${SITE_NAME}_before_rollback_${TIMESTAMP}.backup"
echo -e "${GREEN}✓ Бэкап создан${NC}"
echo ""

# Восстановление бэкапа
echo -e "${YELLOW}Восстановление конфига...${NC}"
cp "$LATEST_BACKUP" "$NGINX_SITES_AVAILABLE/$SITE_NAME"
echo -e "${GREEN}✓ Конфиг восстановлен${NC}"
echo ""

# Проверка конфига
echo -e "${YELLOW}Проверка конфигурации nginx...${NC}"
if nginx -t; then
    echo -e "${GREEN}✓ Конфигурация nginx корректна${NC}"
else
    echo -e "${RED}✗ Ошибка в конфигурации nginx!${NC}"
    exit 1
fi
echo ""

# Перезагрузка nginx
echo -e "${YELLOW}Перезагрузка nginx...${NC}"
systemctl reload nginx
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Nginx успешно перезагружен${NC}"
else
    echo -e "${RED}✗ Ошибка при перезагрузке nginx!${NC}"
    exit 1
fi
echo ""

echo "=========================================="
echo -e "${GREEN}✓ Конфиг успешно восстановлен!${NC}"
echo "=========================================="
echo ""
echo "Восстановлен из: $LATEST_BACKUP"
echo ""
