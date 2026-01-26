#!/bin/bash
# Первоначальная настройка сервера для работы с GitHub

set -e

DEPLOY_DIR="/opt/xray-vpn"
BACKUP_DIR="/opt/xray-vpn-backup"

echo "=== Первоначальная настройка сервера ==="
echo ""

# Запрос данных репозитория
read -p "Введите URL вашего GitHub репозитория (например, https://github.com/username/repo.git): " REPO_URL

# Создание директорий
echo "[SETUP] Создаем директории..."
sudo mkdir -p $DEPLOY_DIR
sudo mkdir -p $BACKUP_DIR

# Клонирование репозитория
echo "[SETUP] Клонируем репозиторий..."
if [ -d "$DEPLOY_DIR/.git" ]; then
    echo "Репозиторий уже существует, пропускаем клонирование"
else
    sudo git clone $REPO_URL $DEPLOY_DIR
fi

# Установка прав
echo "[SETUP] Настраиваем права доступа..."
sudo chown -R $USER:$USER $DEPLOY_DIR
sudo chown -R $USER:$USER $BACKUP_DIR

# Переход в директорию проекта
cd $DEPLOY_DIR

# Делаем скрипты исполняемыми
echo "[SETUP] Делаем скрипты исполняемыми..."
chmod +x scripts/*.sh
chmod +x opensslcert

echo ""
echo "=== Первоначальная настройка завершена ==="
echo ""
echo "Теперь выполните установку по порядку:"
echo "  cd $DEPLOY_DIR"
echo "  ./scripts/install-dependencies.sh"
echo "  ./scripts/install-xray.sh"
echo "  ./scripts/generate-config.sh"
echo "  # Отредактируйте конфигурацию в configs/"
echo "  ./scripts/setup-systemd.sh"
echo "  ./scripts/apply-config.sh configs/xray-vless-reality.json"
echo ""
echo "Для последующих обновлений используйте:"
echo "  cd $DEPLOY_DIR && ./scripts/deploy.sh"
