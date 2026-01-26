# Руководство по развертыванию и обновлению

Этот документ описывает процесс работы с проектом через Git для удобного обновления VPN-сервера.

## Рабочий процесс

```
Локальный ПК → Git Push → GitHub → Git Pull → VPS Сервер
```

## Первоначальная настройка

### 1. На локальном ПК

```bash
# Инициализация Git (если еще не сделано)
git init
git add .
git commit -m "Initial commit"

# Создание репозитория на GitHub и push
git remote add origin https://github.com/ваш-username/ваш-repo.git
git branch -M main
git push -u origin main
```

### 2. На VPS сервере

```bash
# Скачайте скрипт первоначальной настройки
wget https://raw.githubusercontent.com/ваш-username/ваш-repo/main/scripts/initial-setup.sh
chmod +x initial-setup.sh
./initial-setup.sh

# Следуйте инструкциям скрипта
# Он клонирует репозиторий в /opt/xray-vpn
```

### 3. Установка VPN (первый раз)

```bash
cd /opt/xray-vpn

# Установка зависимостей
./scripts/install-dependencies.sh

# Установка X-Ray
./scripts/install-xray.sh

# Генерация ключей
./scripts/generate-config.sh

# Редактирование конфигурации
nano configs/xray-vless-reality.json
# Вставьте сгенерированные ключи из generated/keys.txt

# Настройка systemd
./scripts/setup-systemd.sh

# Применение конфигурации
./scripts/apply-config.sh configs/xray-vless-reality.json
```

## Процесс обновления

### На локальном ПК

```bash
# 1. Вносите изменения в конфигурацию или скрипты
nano configs/xray-vless-reality.json

# 2. Коммитите изменения
git add .
git commit -m "Обновил конфигурацию: добавил нового клиента"

# 3. Пушите на GitHub
git push origin main
```

### На VPS сервере

```bash
# Автоматическое обновление одной командой
cd /opt/xray-vpn && ./scripts/deploy.sh
```

Скрипт `deploy.sh` автоматически:
- Создаст резервную копию текущей конфигурации
- Скачает изменения с GitHub
- Проверит валидность конфигурации
- Перезапустит X-Ray
- Откатит изменения при ошибке

## Обновление только конфигурации

Если вы изменили только конфигурацию и хотите применить её без git pull:

```bash
cd /opt/xray-vpn
./scripts/update-config.sh configs/xray-vless-reality.json
```

## Автоматизация обновлений

### Вариант 1: Cron (периодическая проверка)

```bash
# Автоматическая проверка обновлений каждые 5 минут
crontab -e

# Добавьте строку:
*/5 * * * * cd /opt/xray-vpn && git fetch && [ $(git rev-parse HEAD) != $(git rev-parse @{u}) ] && ./scripts/deploy.sh >> /var/log/xray-deploy.log 2>&1
```

### Вариант 2: GitHub Webhook (мгновенное обновление)

Создайте простой webhook сервер:

```bash
# Установка webhook
sudo apt install webhook

# Создание конфигурации webhook
sudo nano /etc/webhook.conf
```

Содержимое `/etc/webhook.conf`:

```json
[
  {
    "id": "deploy-xray",
    "execute-command": "/opt/xray-vpn/scripts/deploy.sh",
    "command-working-directory": "/opt/xray-vpn",
    "response-message": "Deploying...",
    "trigger-rule": {
      "match": {
        "type": "payload-hash-sha1",
        "secret": "ваш-секретный-ключ",
        "parameter": {
          "source": "header",
          "name": "X-Hub-Signature"
        }
      }
    }
  }
]
```

Запуск webhook:

```bash
webhook -hooks /etc/webhook.conf -verbose -port 9000
```

В GitHub Settings → Webhooks добавьте:
- Payload URL: `http://ваш-сервер-ip:9000/hooks/deploy-xray`
- Content type: `application/json`
- Secret: ваш-секретный-ключ

## Безопасность

### Защита приватных данных

Никогда не коммитьте в Git:
- Приватные ключи (`*.key`)
- Сертификаты (`*.crt`, `*.csr`)
- Файл `generated/keys.txt`
- Логи

Файл `.gitignore` уже настроен для этого.

### Использование переменных окружения

Для чувствительных данных используйте переменные окружения:

```bash
# На сервере создайте файл с переменными
sudo nano /opt/xray-vpn/.env

# Добавьте:
UUID=ваш-uuid
PRIVATE_KEY=ваш-приватный-ключ
SHORT_ID=ваш-short-id
```

Модифицируйте скрипты для использования этих переменных.

## Откат изменений

Если что-то пошло не так:

```bash
cd /opt/xray-vpn

# Откат к предыдущему коммиту
git reset --hard HEAD~1

# Восстановление конфигурации из бэкапа
LAST_BACKUP=$(ls -t /opt/xray-vpn-backup/config.json.backup.* | head -1)
sudo cp "$LAST_BACKUP" /usr/local/etc/xray/config.json
sudo systemctl restart xray
```

## Мониторинг

Проверка логов деплоя:

```bash
# Логи X-Ray
sudo journalctl -u xray -f

# Логи деплоя (если используете cron)
tail -f /var/log/xray-deploy.log
```

## Структура директорий на сервере

```
/opt/xray-vpn/              # Основной проект (Git репозиторий)
├── configs/                # Конфигурации
├── scripts/                # Скрипты
└── generated/              # Сгенерированные ключи (не в Git)

/opt/xray-vpn-backup/       # Резервные копии
└── config.json.backup.*    # Бэкапы конфигураций

/usr/local/etc/xray/        # Активная конфигурация X-Ray
└── config.json             # Текущая конфигурация

/var/log/xray/              # Логи X-Ray
├── access.log
└── error.log
```

## Полезные команды

```bash
# Проверка статуса Git
cd /opt/xray-vpn && git status

# Просмотр последних изменений
git log --oneline -5

# Просмотр изменений перед pull
git fetch && git diff HEAD..origin/main

# Принудительное обновление (осторожно!)
git fetch --all && git reset --hard origin/main

# Список бэкапов
ls -lh /opt/xray-vpn-backup/

# Проверка конфигурации
/usr/local/bin/xray run -test -config /usr/local/etc/xray/config.json
```

## Troubleshooting

### Git pull не работает

```bash
# Проверьте SSH ключи или используйте HTTPS
git remote set-url origin https://github.com/username/repo.git

# Или настройте SSH ключ
ssh-keygen -t ed25519 -C "your_email@example.com"
cat ~/.ssh/id_ed25519.pub  # Добавьте в GitHub Settings → SSH Keys
```

### Конфликты при pull

```bash
# Сохраните локальные изменения
git stash

# Обновите
git pull

# Примените локальные изменения
git stash pop
```

### X-Ray не запускается после обновления

```bash
# Проверьте логи
sudo journalctl -u xray -n 50

# Восстановите последний бэкап
LAST_BACKUP=$(ls -t /opt/xray-vpn-backup/config.json.backup.* | head -1)
sudo cp "$LAST_BACKUP" /usr/local/etc/xray/config.json
sudo systemctl restart xray
```
