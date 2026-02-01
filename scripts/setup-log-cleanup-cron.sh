#!/bin/bash
# Настройка автоматической очистки логов доступа каждые 5 минут

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
CLEANUP_SCRIPT="$PROJECT_DIR/scripts/cleanup-access-logs.sh"

echo "=== Настройка автоочистки логов доступа ==="
echo ""

# Делаем скрипт исполняемым
chmod +x "$CLEANUP_SCRIPT"

# Проверяем существует ли уже задание в crontab
if sudo crontab -l 2>/dev/null | grep -q "cleanup-access-logs.sh"; then
    echo "✓ Задание cron уже существует"
else
    # Добавляем задание в crontab (каждые 5 минут)
    (sudo crontab -l 2>/dev/null; echo "*/5 * * * * $CLEANUP_SCRIPT") | sudo crontab -
    echo "✓ Задание cron добавлено (каждые 5 минут)"
fi

echo ""
echo "=== Настройка завершена ==="
echo ""
echo "Логи доступа будут автоматически очищаться каждые 5 минут"
echo "Хранятся только последние 1000 строк (~5-10 минут активности)"
