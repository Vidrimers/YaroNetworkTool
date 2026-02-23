#!/bin/bash
# Скрипт для быстрого извлечения ключа пользователя
# Использование: ./scripts/get-client-key.sh <uuid|telegram_id|имя>

cd "$(dirname "$0")/.."

# Проверка аргументов
if [ $# -eq 0 ]; then
    echo "❌ Ошибка: не указан параметр поиска"
    echo ""
    echo "📖 Использование:"
    echo "  ./scripts/get-client-key.sh <uuid>"
    echo "  ./scripts/get-client-key.sh -t <telegram_id>"
    echo "  ./scripts/get-client-key.sh -n <имя>"
    echo ""
    exit 1
fi

# Запуск Node.js скрипта
node scripts/get-client-key.js "$@"
