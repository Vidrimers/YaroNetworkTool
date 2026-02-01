#!/bin/bash
# Автоматическая очистка логов доступа Xray
# Оставляет только последние 1000 строк (примерно 5-10 минут активности)

set -e

ACCESS_LOG="/var/log/xray/access.log"

# Проверяем существование файла
if [ ! -f "$ACCESS_LOG" ]; then
    exit 0
fi

# Получаем последние 1000 строк и перезаписываем файл
tail -n 1000 "$ACCESS_LOG" > "$ACCESS_LOG.tmp"
mv "$ACCESS_LOG.tmp" "$ACCESS_LOG"

# Устанавливаем правильные права
chown xray:xray "$ACCESS_LOG" 2>/dev/null || true
chmod 644 "$ACCESS_LOG"
