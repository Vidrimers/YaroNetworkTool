#!/bin/bash

###############################################################################
# kvn.sh - Скрипт обновления VPN Management API через Git
# Использование: ./scripts/kvn.sh
###############################################################################

set -e  # Остановить при ошибке

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Конфигурация
REPO_DIR="$HOME/xray-vpn"
BACKUP_DIR="$HOME/xray-vpn-backup"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
PM2_APP_NAME="vpn-api"

log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] ✓${NC} $1"
}

log_error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ✗${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] ⚠${NC} $1"
}

# Функция отката
rollback() {
    log_error "Обнаружена ошибка! Выполняется откат..."
    cd "$REPO_DIR"
    git reset --hard HEAD@{1}
    pm2 restart "$PM2_APP_NAME"
    log_error "Откат завершен. API восстановлен к предыдущему состоянию."
    exit 1
}

trap rollback ERR

log "=========================================="
log "Начало обновления VPN Management API"
log "=========================================="

# Шаг 1: Проверка директории
log "Шаг 1/6: Проверка директории..."
if [ ! -d "$REPO_DIR" ]; then
    log_error "Директория $REPO_DIR не найдена!"
    exit 1
fi
cd "$REPO_DIR"
log_success "Директория найдена"

# Шаг 2: Создание резервной копии базы данных
log "Шаг 2/6: Создание резервной копии базы данных..."
mkdir -p "$BACKUP_DIR"
if [ -f "database/vpn.db" ]; then
    cp database/vpn.db "${BACKUP_DIR}/vpn_${TIMESTAMP}.db"
    log_success "База данных сохранена"
fi

# Шаг 3: Проверка Git
log "Шаг 3/6: Проверка обновлений..."
if [ ! -d ".git" ]; then
    log_error "Это не Git репозиторий!"
    exit 1
fi

CURRENT_COMMIT=$(git rev-parse HEAD)
log "Текущий коммит: $CURRENT_COMMIT"

git fetch origin
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main 2>/dev/null || git rev-parse origin/master)

if [ "$LOCAL" = "$REMOTE" ]; then
    log_warning "Нет новых обновлений. Репозиторий уже актуален."
    exit 0
fi

# Шаг 4: Получение обновлений
log "Шаг 4/6: Получение обновлений из Git..."
git pull origin main 2>/dev/null || git pull origin master
log_success "Обновления получены"

# Шаг 5: Проверка зависимостей
log "Шаг 5/6: Проверка зависимостей..."
if git diff --name-only HEAD@{1} HEAD | grep -q "package.json"; then
    log "Обнаружены изменения в package.json. Обновление зависимостей..."
    npm install --production
    log_success "Зависимости обновлены"
else
    log "Изменений в зависимостях нет"
fi

# Шаг 6: Перезапуск API
log "Шаг 6/6: Перезапуск API через PM2..."
if ! pm2 list | grep -q "$PM2_APP_NAME"; then
    log_warning "PM2 приложение '$PM2_APP_NAME' не найдено. Запуск нового процесса..."
    pm2 start api/server.js --name "$PM2_APP_NAME" --time
else
    pm2 restart "$PM2_APP_NAME"
fi

sleep 3

if pm2 list | grep "$PM2_APP_NAME" | grep -q "online"; then
    log_success "API успешно перезапущен"
else
    log_error "API не запустился!"
    rollback
fi

# Проверка работоспособности
log "Проверка работоспособности API..."
sleep 2
if curl -f -s http://localhost:3000/health > /dev/null 2>&1; then
    log_success "API работает корректно"
else
    log_warning "API не отвечает на health check (возможно endpoint не реализован)"
fi

pm2 save

# Очистка старых бэкапов (оставить последние 10)
cd "$BACKUP_DIR"
ls -t vpn_*.db 2>/dev/null | tail -n +11 | xargs -r rm

NEW_COMMIT=$(git rev-parse HEAD)

log "=========================================="
log_success "Обновление завершено успешно!"
log "=========================================="
log "Предыдущий коммит: $CURRENT_COMMIT"
log "Новый коммит:      $NEW_COMMIT"
log ""
log "Проверить статус: pm2 status"
log "Просмотреть логи: pm2 logs $PM2_APP_NAME"
log "=========================================="

exit 0
