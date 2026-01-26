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

### VPN Server (xray-vpn-server)

На локальном ПК:

```bash
# 1. Вносите изменения в конфигурацию или скрипты
nano configs/xray-vless-reality.json

# 2. Коммитите изменения
git add .
git commit -m "Обновил конфигурацию"

# 3. Пушите на GitHub
git push origin main
```

На VPS сервере:

```bash
# Автоматическое обновление одной командой
cd /home/xray-vpn && ./scripts/kvn.sh
```

Скрипт `kvn.sh` автоматически:
- Создаст резервную копию БД
- Скачает изменения с GitHub
- Обновит зависимости (если изменился package.json)
- Перезапустит API через PM2
- Проверит health check
- Откатит изменения при ошибке

### Telegram Bot (yaronetworktool-bot)

На локальном ПК:

```bash
cd yaronetworktool
git add .
git commit -m "Обновил бота"
git push origin main
```

На VPS сервере:

```bash
cd ~/yaronetworktool-bot && ./bot/kvn-bot.sh
```

Скрипт `kvn-bot.sh`:
- Скачает изменения с GitHub
- Перезапустит бота через PM2

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

**ВАЖНО:** Никогда не коммитьте в Git:
- Приватные ключи (`*.key`)
- Сертификаты (`*.crt`, `*.csr`)
- Файл `generated/keys.txt`
- Файлы `.env` с токенами и паролями
- Базу данных (`*.db`)
- Логи (`*.log`)
- Резервные копии с реальными данными

Файл `.gitignore` уже настроен для защиты чувствительных данных.

### Использование .env файлов

Для чувствительных данных используйте `.env` файлы:

**VPN Server (.env):**
```bash
DB_PATH=/home/xray-vpn/database/vpn.db
API_PORT=333
JWT_SECRET=[СЕКРЕТНЫЙ_КЛЮЧ]
```

**Telegram Bot (.env):**
```bash
TELEGRAM_BOT_TOKEN=[ВАШ_ТОКЕН]
ADMIN_TELEGRAM_ID=[ВАШ_ID]
API_BASE_URL=http://localhost:333
SERVER_IP=[IP_СЕРВЕРА]
XRAY_LOG_PATH=/var/log/xray/access.log
```

Используйте `.env.example` как шаблон (без реальных данных).

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
/home/xray-vpn/                 # VPN Server + API
├── api/                        # Management API
│   ├── server.js
│   ├── routes/
│   └── middleware/
├── configs/                    # Конфигурации X-Ray
├── scripts/                    # Скрипты управления
├── database/                   # База данных
│   ├── init.sql
│   ├── models/
│   └── vpn.db
├── .env                        # Переменные окружения (не в Git!)
└── package.json

~/yaronetworktool-bot/          # Telegram Bot
├── bot/
│   ├── yaronetworktool_bot.js
│   ├── subscription-checker.js
│   ├── traffic-checker.js
│   ├── torrent-detector.js
│   ├── backup.sh
│   ├── traffic-reset.js
│   ├── xray-log-parser.js
│   ├── weekly-report.js
│   └── utils/
├── database/
│   ├── init.sql
│   └── yaronetworkbase.db
├── backups/                    # Резервные копии
├── logs/                       # Логи
├── .env                        # Переменные окружения (не в Git!)
└── package.json

/usr/local/etc/xray/            # Активная конфигурация X-Ray
└── config.json

/var/log/xray/                  # Логи X-Ray
├── access.log
└── error.log
```

## Полезные команды

```bash
# === Git ===
cd /home/xray-vpn && git status
git log --oneline -5
git fetch && git diff HEAD..origin/main

# === PM2 ===
pm2 status
pm2 logs vpn-api
pm2 logs vpn-bot
pm2 restart vpn-api
pm2 restart vpn-bot

# === X-Ray ===
sudo systemctl status xray
sudo journalctl -u xray -f
/usr/local/bin/xray run -test -config /usr/local/etc/xray/config.json

# === Cron ===
crontab -l
crontab -e

# === Резервные копии ===
ls -lh ~/yaronetworktool-bot/backups/

# === База данных ===
sqlite3 /home/xray-vpn/database/vpn.db "SELECT * FROM clients;"
sqlite3 ~/yaronetworktool-bot/database/yaronetworkbase.db "SELECT * FROM clients;"
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
