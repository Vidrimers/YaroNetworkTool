#!/bin/bash
# Скрипт диагностики и исправления Xray сервиса

set -e

echo "🔍 Диагностика Xray сервиса..."
echo ""

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. Проверка конфига
echo "1️⃣ Проверка конфигурации..."
if /usr/local/bin/xray run -test -config /usr/local/etc/xray/config.json 2>&1 | grep -q "Configuration OK"; then
    echo -e "${GREEN}✅ Конфигурация валидна${NC}"
else
    echo -e "${RED}❌ Ошибка в конфигурации${NC}"
    /usr/local/bin/xray run -test -config /usr/local/etc/xray/config.json
    exit 1
fi
echo ""

# 2. Проверка прав доступа
echo "2️⃣ Проверка прав доступа..."
CONFIG_PERMS=$(stat -c "%a" /usr/local/etc/xray/config.json)
if [ "$CONFIG_PERMS" != "644" ]; then
    echo -e "${YELLOW}⚠️  Неправильные права: $CONFIG_PERMS, исправляю на 644${NC}"
    chmod 644 /usr/local/etc/xray/config.json
else
    echo -e "${GREEN}✅ Права доступа корректны: $CONFIG_PERMS${NC}"
fi
echo ""

# 3. Проверка владельца
echo "3️⃣ Проверка владельца файла..."
CONFIG_OWNER=$(stat -c "%U:%G" /usr/local/etc/xray/config.json)
if [ "$CONFIG_OWNER" != "root:root" ]; then
    echo -e "${YELLOW}⚠️  Неправильный владелец: $CONFIG_OWNER, исправляю на root:root${NC}"
    chown root:root /usr/local/etc/xray/config.json
else
    echo -e "${GREEN}✅ Владелец корректен: $CONFIG_OWNER${NC}"
fi
echo ""

# 4. Проверка занятости портов
echo "4️⃣ Проверка портов..."
PORTS=(8443 8444 8445 8446 8447 8448 8449)
PORTS_BUSY=0
for PORT in "${PORTS[@]}"; do
    if netstat -tulpn 2>/dev/null | grep -q ":$PORT "; then
        PROCESS=$(netstat -tulpn 2>/dev/null | grep ":$PORT " | awk '{print $7}')
        echo -e "${YELLOW}⚠️  Порт $PORT занят: $PROCESS${NC}"
        PORTS_BUSY=1
    fi
done

if [ $PORTS_BUSY -eq 0 ]; then
    echo -e "${GREEN}✅ Все порты свободны${NC}"
fi
echo ""

# 5. Проверка директории логов
echo "5️⃣ Проверка директории логов..."
if [ ! -d "/var/log/xray" ]; then
    echo -e "${YELLOW}⚠️  Директория /var/log/xray не существует, создаю${NC}"
    mkdir -p /var/log/xray
    chown root:root /var/log/xray
    chmod 755 /var/log/xray
else
    echo -e "${GREEN}✅ Директория логов существует${NC}"
fi
echo ""

# 6. Сброс failed состояния
echo "6️⃣ Сброс failed состояния сервиса..."
systemctl reset-failed xray 2>/dev/null || true
echo -e "${GREEN}✅ Состояние сброшено${NC}"
echo ""

# 7. Перезапуск сервиса
echo "7️⃣ Перезапуск Xray сервиса..."
if systemctl restart xray; then
    echo -e "${GREEN}✅ Сервис успешно перезапущен${NC}"
else
    echo -e "${RED}❌ Ошибка перезапуска сервиса${NC}"
    echo ""
    echo "Логи ошибок:"
    journalctl -xeu xray.service -n 50 --no-pager
    exit 1
fi
echo ""

# 8. Проверка статуса
echo "8️⃣ Проверка статуса сервиса..."
sleep 2
if systemctl is-active --quiet xray; then
    echo -e "${GREEN}✅ Xray работает${NC}"
    systemctl status xray --no-pager -l
else
    echo -e "${RED}❌ Xray не запущен${NC}"
    systemctl status xray --no-pager -l
    exit 1
fi
echo ""

# 9. Проверка портов после запуска
echo "9️⃣ Проверка прослушиваемых портов..."
sleep 1
LISTENING=0
for PORT in "${PORTS[@]}"; do
    # Проверяем и IPv4 и IPv6
    if ss -tulpn 2>/dev/null | grep -q "xray.*:$PORT "; then
        echo -e "${GREEN}✅ Порт $PORT прослушивается${NC}"
        LISTENING=$((LISTENING + 1))
    else
        echo -e "${RED}❌ Порт $PORT НЕ прослушивается${NC}"
    fi
done

if [ $LISTENING -eq ${#PORTS[@]} ]; then
    echo ""
    echo -e "${GREEN}🎉 Все порты успешно прослушиваются!${NC}"
else
    echo ""
    echo -e "${YELLOW}⚠️  Прослушивается $LISTENING из ${#PORTS[@]} портов${NC}"
fi
echo ""

echo "✅ Диагностика завершена!"
echo ""
echo "Для просмотра логов в реальном времени:"
echo "  tail -f /var/log/xray/error.log"
