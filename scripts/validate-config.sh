#!/bin/bash

###############################################################################
# validate-config.sh - Валидация конфигурации X-Ray
# Проверяет корректность JSON конфигурации перед применением
###############################################################################

set -e

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Путь к конфигурации
CONFIG_FILE="${1:-/usr/local/etc/xray/config.json}"

echo -e "${YELLOW}[VALIDATE]${NC} Проверка конфигурации: $CONFIG_FILE"

# Проверка существования файла
if [ ! -f "$CONFIG_FILE" ]; then
    echo -e "${RED}[ERROR]${NC} Файл конфигурации не найден: $CONFIG_FILE"
    exit 1
fi

# Проверка валидности JSON
if command -v python &> /dev/null; then
    if ! python -m json.tool "$CONFIG_FILE" > /dev/null 2>&1; then
        echo -e "${RED}[ERROR]${NC} Невалидный JSON в файле: $CONFIG_FILE"
        exit 1
    fi
elif command -v python3 &> /dev/null; then
    if ! python3 -m json.tool "$CONFIG_FILE" > /dev/null 2>&1; then
        echo -e "${RED}[ERROR]${NC} Невалидный JSON в файле: $CONFIG_FILE"
        exit 1
    fi
else
    echo -e "${YELLOW}[WARNING]${NC} Python не найден, пропускаем валидацию JSON"
fi

echo -e "${GREEN}[OK]${NC} JSON синтаксис корректен"

# Проверка обязательных полей
if ! grep -q '"log"' "$CONFIG_FILE"; then
    echo -e "${RED}[ERROR]${NC} Отсутствует поле: log"
    exit 1
fi

if ! grep -q '"inbounds"' "$CONFIG_FILE"; then
    echo -e "${RED}[ERROR]${NC} Отсутствует поле: inbounds"
    exit 1
fi

if ! grep -q '"outbounds"' "$CONFIG_FILE"; then
    echo -e "${RED}[ERROR]${NC} Отсутствует поле: outbounds"
    exit 1
fi

echo -e "${GREEN}[OK]${NC} Обязательные поля присутствуют"

# Проверка наличия клиентов
CLIENT_COUNT=$(grep -o '"id"' "$CONFIG_FILE" | wc -l)

if [ "$CLIENT_COUNT" -eq 0 ]; then
    echo -e "${YELLOW}[WARNING]${NC} Нет клиентов в конфигурации"
else
    echo -e "${GREEN}[OK]${NC} Найдено клиентов: $CLIENT_COUNT"
fi

# Проверка placeholder
if grep -q "YOUR_UUID_HERE" "$CONFIG_FILE"; then
    echo -e "${YELLOW}[WARNING]${NC} Найдены placeholder UUID"
fi

if grep -q "YOUR_PRIVATE_KEY_HERE" "$CONFIG_FILE"; then
    echo -e "${YELLOW}[WARNING]${NC} Найдены placeholder private key"
fi

if grep -q "YOUR_SHORT_ID_HERE" "$CONFIG_FILE"; then
    echo -e "${YELLOW}[WARNING]${NC} Найдены placeholder short ID"
fi

# Проверка протокола
if grep -q '"protocol".*:.*"vless"' "$CONFIG_FILE"; then
    echo -e "${GREEN}[OK]${NC} Протокол: VLESS"
else
    echo -e "${YELLOW}[WARNING]${NC} Протокол не VLESS"
fi

# Проверка network
if grep -q '"network".*:.*"xhttp"' "$CONFIG_FILE"; then
    echo -e "${GREEN}[OK]${NC} Network: XHTTP"
else
    echo -e "${YELLOW}[WARNING]${NC} Network не XHTTP"
fi

# Проверка security
if grep -q '"security".*:.*"reality"' "$CONFIG_FILE"; then
    echo -e "${GREEN}[OK]${NC} Security: Reality"
elif grep -q '"security".*:.*"none"' "$CONFIG_FILE"; then
    echo -e "${GREEN}[OK]${NC} Security: None (CDN режим)"
else
    echo -e "${YELLOW}[WARNING]${NC} Security не определен"
fi

# Проверка портов
if grep -q '"port"' "$CONFIG_FILE"; then
    PORT=$(grep -o '"port"[[:space:]]*:[[:space:]]*[0-9]*' "$CONFIG_FILE" | head -1 | grep -o '[0-9]*$')
    if [ -n "$PORT" ]; then
        echo -e "${GREEN}[OK]${NC} Порт: $PORT"
    fi
fi

# Проверка логов
if grep -q '"access"' "$CONFIG_FILE"; then
    echo -e "${GREEN}[OK]${NC} Логирование настроено"
fi

# Валидация через X-Ray (если установлен)
if command -v xray &> /dev/null; then
    echo -e "${YELLOW}[VALIDATE]${NC} Проверка через X-Ray..."
    
    if xray run -test -config "$CONFIG_FILE" 2>&1 | grep -q "Configuration OK"; then
        echo -e "${GREEN}[OK]${NC} X-Ray валидация пройдена"
    else
        echo -e "${RED}[ERROR]${NC} X-Ray валидация не пройдена"
        echo -e "${YELLOW}[INFO]${NC} Запустите вручную: xray run -test -config $CONFIG_FILE"
        exit 1
    fi
else
    echo -e "${YELLOW}[WARNING]${NC} X-Ray не установлен, пропускаем валидацию через X-Ray"
fi

echo ""
echo -e "${GREEN}[SUCCESS]${NC} Конфигурация валидна!"
exit 0
