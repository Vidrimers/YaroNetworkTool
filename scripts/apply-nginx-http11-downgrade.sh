#!/bin/bash

# Скрипт для применения nginx конфига с HTTP/1.1 downgrade для обхода DPI
# Автор: VPN Management System
# Дата: 2026-02-14

set -e

echo "=========================================="
echo "Применение nginx конфига с HTTP/1.1 downgrade"
echo "=========================================="
echo ""

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Пути
NGINX_SITES_AVAILABLE="/etc/nginx/sites-available"
NGINX_SITES_ENABLED="/etc/nginx/sites-enabled"
SITE_NAME="1xbetlineboom.xyz"
BACKUP_DIR="/root/nginx-backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Проверка прав root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}Ошибка: Скрипт должен быть запущен с правами root${NC}"
    exit 1
fi

# Создание директории для бэкапов
echo -e "${YELLOW}[1/6] Создание директории для бэкапов...${NC}"
mkdir -p "$BACKUP_DIR"
echo -e "${GREEN}✓ Директория создана: $BACKUP_DIR${NC}"
echo ""

# Бэкап текущего конфига
echo -e "${YELLOW}[2/6] Создание бэкапа текущего конфига...${NC}"
if [ -f "$NGINX_SITES_AVAILABLE/$SITE_NAME" ]; then
    cp "$NGINX_SITES_AVAILABLE/$SITE_NAME" "$BACKUP_DIR/${SITE_NAME}_${TIMESTAMP}.backup"
    echo -e "${GREEN}✓ Бэкап создан: $BACKUP_DIR/${SITE_NAME}_${TIMESTAMP}.backup${NC}"
else
    echo -e "${RED}✗ Файл конфига не найден: $NGINX_SITES_AVAILABLE/$SITE_NAME${NC}"
    exit 1
fi
echo ""

# Показать текущую версию nginx
echo -e "${YELLOW}[3/6] Информация о nginx:${NC}"
nginx -v
echo ""

# Проверка нового конфига (должен быть загружен на сервер)
echo -e "${YELLOW}[4/6] Применение нового конфига...${NC}"
NEW_CONFIG_PATH="/root/nginx-1xbetlineboom.xyz-http1.1-only"

if [ ! -f "$NEW_CONFIG_PATH" ]; then
    echo -e "${RED}✗ Новый конфиг не найден: $NEW_CONFIG_PATH${NC}"
    echo -e "${YELLOW}Загрузите файл configs/nginx-1xbetlineboom.xyz-http1.1-only на сервер в /root/${NC}"
    exit 1
fi

# Копирование нового конфига
cp "$NEW_CONFIG_PATH" "$NGINX_SITES_AVAILABLE/$SITE_NAME"
echo -e "${GREEN}✓ Новый конфиг скопирован${NC}"
echo ""

# Проверка конфига nginx
echo -e "${YELLOW}[5/6] Проверка конфигурации nginx...${NC}"
if nginx -t; then
    echo -e "${GREEN}✓ Конфигурация nginx корректна${NC}"
else
    echo -e "${RED}✗ Ошибка в конфигурации nginx!${NC}"
    echo -e "${YELLOW}Восстанавливаем бэкап...${NC}"
    cp "$BACKUP_DIR/${SITE_NAME}_${TIMESTAMP}.backup" "$NGINX_SITES_AVAILABLE/$SITE_NAME"
    echo -e "${GREEN}✓ Бэкап восстановлен${NC}"
    exit 1
fi
echo ""

# Перезагрузка nginx
echo -e "${YELLOW}[6/6] Перезагрузка nginx...${NC}"
systemctl reload nginx
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Nginx успешно перезагружен${NC}"
else
    echo -e "${RED}✗ Ошибка при перезагрузке nginx!${NC}"
    echo -e "${YELLOW}Восстанавливаем бэкап...${NC}"
    cp "$BACKUP_DIR/${SITE_NAME}_${TIMESTAMP}.backup" "$NGINX_SITES_AVAILABLE/$SITE_NAME"
    systemctl reload nginx
    echo -e "${GREEN}✓ Бэкап восстановлен${NC}"
    exit 1
fi
echo ""

echo "=========================================="
echo -e "${GREEN}✓ Конфиг успешно применен!${NC}"
echo "=========================================="
echo ""
echo "Изменения:"
echo "  - TLS 1.3 → TLS 1.2 (downgrade)"
echo "  - HTTP/2 → HTTP/1.1 (downgrade)"
echo "  - Добавлен ssl_alpn http/1.1"
echo ""
echo "Бэкап сохранен в:"
echo "  $BACKUP_DIR/${SITE_NAME}_${TIMESTAMP}.backup"
echo ""
echo "Для отката изменений выполните:"
echo "  sudo cp $BACKUP_DIR/${SITE_NAME}_${TIMESTAMP}.backup $NGINX_SITES_AVAILABLE/$SITE_NAME"
echo "  sudo systemctl reload nginx"
echo ""
echo "Проверьте работу VPN и логи:"
echo "  sudo tail -f /var/log/nginx/error.log"
echo "  sudo tail -f /var/log/nginx/access.log"
echo ""
