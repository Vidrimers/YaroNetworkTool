#!/bin/bash

# Скрипт для установки индивидуальной цены Kaspa для клиента
# Использование: ./set-custom-price.sh <uuid> <price>
# Пример: ./set-custom-price.sh abc123-def456 15

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DB_PATH="$PROJECT_ROOT/database/vpn.db"

# Проверка аргументов
if [ $# -lt 1 ]; then
    echo "❌ Использование: $0 <uuid> [price]"
    echo ""
    echo "Примеры:"
    echo "  $0 abc123-def456 15          # Установить цену 15 KAS"
    echo "  $0 abc123-def456 0           # Установить цену 0 KAS (бесплатно)"
    echo "  $0 abc123-def456 null        # Сбросить на стандартную цену"
    echo ""
    exit 1
fi

UUID="$1"
PRICE="${2:-}"

# Проверка существования БД
if [ ! -f "$DB_PATH" ]; then
    echo "❌ База данных не найдена: $DB_PATH"
    exit 1
fi

# Проверка существования клиента
CLIENT_EXISTS=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM clients WHERE uuid = '$UUID';")

if [ "$CLIENT_EXISTS" -eq 0 ]; then
    echo "❌ Клиент с UUID '$UUID' не найден"
    echo ""
    echo "Список клиентов:"
    sqlite3 -header -column "$DB_PATH" "SELECT uuid, name, telegram_id FROM clients;"
    exit 1
fi

# Получаем информацию о клиенте
CLIENT_INFO=$(sqlite3 -separator '|' "$DB_PATH" "SELECT name, telegram_id, custom_price_kaspa FROM clients WHERE uuid = '$UUID';")
CLIENT_NAME=$(echo "$CLIENT_INFO" | cut -d'|' -f1)
CLIENT_TG=$(echo "$CLIENT_INFO" | cut -d'|' -f2)
CURRENT_PRICE=$(echo "$CLIENT_INFO" | cut -d'|' -f3)

echo "👤 Клиент: $CLIENT_NAME"
echo "📱 Telegram ID: $CLIENT_TG"
echo "💰 Текущая индивидуальная цена: ${CURRENT_PRICE:-стандартная}"
echo ""

# Если цена не указана, показываем текущую и выходим
if [ -z "$PRICE" ]; then
    echo "ℹ️  Для изменения цены укажите второй аргумент:"
    echo "   $0 $UUID <price>"
    exit 0
fi

# Обновляем цену
if [ "$PRICE" = "null" ] || [ "$PRICE" = "NULL" ]; then
    # Сбрасываем на стандартную
    sqlite3 "$DB_PATH" "UPDATE clients SET custom_price_kaspa = NULL WHERE uuid = '$UUID';"
    echo "✅ Индивидуальная цена сброшена. Клиент будет использовать стандартные цены."
elif [[ "$PRICE" =~ ^[0-9]+(\.[0-9]+)?$ ]]; then
    # Устанавливаем индивидуальную цену
    sqlite3 "$DB_PATH" "UPDATE clients SET custom_price_kaspa = $PRICE WHERE uuid = '$UUID';"
    echo "✅ Индивидуальная цена установлена: $PRICE KAS"
    echo ""
    echo "ℹ️  Теперь при оплате через Kaspa клиент будет платить $PRICE KAS вместо стандартной цены."
else
    echo "❌ Неверный формат цены: $PRICE"
    echo "   Используйте число (например: 15, 20.5) или 'null' для сброса"
    exit 1
fi

echo ""
echo "📊 Обновленная информация:"
sqlite3 -header -column "$DB_PATH" "SELECT uuid, name, custom_price_kaspa FROM clients WHERE uuid = '$UUID';"
