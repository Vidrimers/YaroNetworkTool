# Руководство по установке VPN-сервера

Этот проект позволяет вручную настроить VPN-сервер на базе X-Ray Core с протоколом VLESS и транспортом XHTTP.

## Требования

- VPS сервер с Ubuntu 24.04 (минимум 1 CPU, 1 GB RAM, 10 GB диска)
- Root доступ или sudo права
- Базовые знания работы с Linux

## Быстрый старт

### 1. Подготовка сервера

```bash
# Смена пароля
openssl rand -base64 32  # Сгенерировать пароль
passwd                    # Сменить пароль

# Обновление системы
sudo apt update
sudo apt upgrade -y
sudo reboot
```

### 2. Установка зависимостей

```bash
cd scripts
chmod +x install-dependencies.sh
./install-dependencies.sh
```

### 3. Установка X-Ray Core

```bash
chmod +x install-xray.sh
./install-xray.sh
```

### 4. Генерация ключей

```bash
chmod +x generate-config.sh
./generate-config.sh
```

Сохраните сгенерированные ключи из файла `generated/keys.txt`

### 5. Настройка конфигурации

Выберите один из вариантов:

#### Вариант A: VLESS Reality (прямое подключение, быстрее)

```bash
# Отредактируйте configs/xray-vless-reality.json
# Замените:
# - YOUR_UUID_HERE на ваш UUID
# - YOUR_PRIVATE_KEY_HERE на ваш Private Key
# - YOUR_SHORT_ID_HERE на ваш Short ID
```

#### Вариант B: VLESS XHTTP через CDN (скрывает IP)

```bash
# Отредактируйте configs/xray-vless-xhttp-cdn.json
# Замените:
# - YOUR_UUID_HERE на ваш UUID
# - your-domain.com на ваш домен
# - /your-path на желаемый путь
```

### 6. Создание SSL сертификата (для Reality)

```bash
cd ..
chmod +x opensslcert
mkdir cert
cd cert
../opensslcert
```

### 7. Применение конфигурации

```bash
cd ../scripts
chmod +x setup-systemd.sh apply-config.sh
./setup-systemd.sh

# Для Reality:
./apply-config.sh ../configs/xray-vless-reality.json

# Для CDN:
./apply-config.sh ../configs/xray-vless-xhttp-cdn.json
```

### 8. Генерация ссылки для клиента

```bash
chmod +x generate-client-link.sh
./generate-client-link.sh
```

Следуйте инструкциям скрипта для создания ссылки подключения.

## Настройка Cloudflare (для варианта с CDN)

1. Купите домен в Cloudflare
2. Направьте домен на IP вашего сервера (A-запись)
3. В Cloudflare:
   - **SSL/TLS** → выберите **Flexible**
   - **SSL/TLS → Edge Certificates** → выключите TLS 1.3
   - **Network** → включите gRPC
   - **Rules → Origin Rules** → создайте правило:
     - Field: Hostname = ваш домен
     - Destination Port: Rewrite to → порт из конфига (8443)

## Управление сервисом

```bash
# Запуск
sudo systemctl start xray

# Остановка
sudo systemctl stop xray

# Перезапуск
sudo systemctl restart xray

# Статус
sudo systemctl status xray

# Логи
sudo journalctl -u xray -f
```

## Клиенты

- **Windows/Linux**: [v2rayN](https://github.com/2dust/v2rayN)
- **Android**: [v2rayNG](https://github.com/2dust/v2rayNG)
- **iOS/macOS**: [Streisand](https://apps.apple.com/app/streisand/id6450534064)

## Структура проекта

```
.
├── configs/                    # Конфигурационные файлы
│   ├── xray-vless-reality.json    # Конфиг для Reality
│   └── xray-vless-xhttp-cdn.json  # Конфиг для CDN
├── scripts/                    # Скрипты установки и настройки
│   ├── install-dependencies.sh    # Установка зависимостей
│   ├── install-xray.sh           # Установка X-Ray Core
│   ├── generate-config.sh        # Генерация ключей
│   ├── setup-systemd.sh          # Создание systemd сервиса
│   ├── apply-config.sh           # Применение конфигурации
│   └── generate-client-link.sh   # Генерация ссылки для клиента
├── opensslcert                 # Скрипт генерации SSL сертификата
├── Readme.md                   # Теоретическое описание
└── SETUP.md                    # Это руководство
```

## Безопасность

- Всегда используйте сильные пароли
- Регулярно обновляйте систему
- Не делитесь своими ключами и UUID
- Используйте файрвол (ufw) для ограничения доступа

## Management API и Telegram Bot

После установки X-Ray можно настроить Management API и Telegram бота для удобного управления.

### Management API

```bash
# Перейти в директорию API
cd /home/xray-vpn

# Установить зависимости
npm install

# Настроить .env
cp .env.example .env
nano .env

# Запустить через PM2
pm2 start api/server.js --name vpn-api --time
pm2 save
```

API будет доступен на порту 333.

### Telegram Bot

```bash
# Перейти в директорию бота
cd ~/yaronetworktool-bot

# Установить зависимости
npm install

# Настроить .env
cp .env.example .env
nano .env
# Указать TELEGRAM_BOT_TOKEN и ADMIN_TELEGRAM_ID

# Запустить через PM2
pm2 start bot/yaronetworktool_bot.js --name vpn-bot --time
pm2 save
```

Подробнее см. `yaronetworktool/README.md`

## Автоматические задачи (Cron)

Система поддерживает автоматические проверки и отчеты:

```bash
cd ~/yaronetworktool-bot

# Проверка подписок (каждый день в 10:00)
./bot/setup-subscription-checker-cron.sh

# Проверка трафика (3 раза в день)
./bot/setup-traffic-checker-cron.sh

# Обнаружение торрентов (каждый день в 22:00)
./bot/setup-torrent-detector-cron.sh

# Резервное копирование (каждые 3 дня в 03:00)
./bot/setup-backup-cron.sh

# Ежемесячный сброс трафика (1-го числа в 00:00)
./bot/setup-traffic-reset-cron.sh

# Парсер логов X-Ray (каждый час)
./bot/setup-log-parser-cron.sh

# Недельный отчет (понедельник в 09:00)
./bot/setup-weekly-report-cron.sh
```

Проверить активные задачи: `crontab -l`

## Troubleshooting

### X-Ray не запускается

```bash
# Проверьте логи
sudo journalctl -u xray -n 50

# Проверьте конфигурацию
/usr/local/bin/xray run -test -config /usr/local/etc/xray/config.json
```

### Не работает подключение

1. Проверьте, что порты открыты в файрволе
2. Убедитесь, что UUID и ключи совпадают
3. Проверьте логи X-Ray
4. Для CDN: проверьте настройки Cloudflare

### API не отвечает

```bash
# Проверьте статус
pm2 status vpn-api

# Проверьте логи
pm2 logs vpn-api

# Перезапустите
pm2 restart vpn-api
```

### Бот не отвечает

```bash
# Проверьте статус
pm2 status vpn-bot

# Проверьте логи
pm2 logs vpn-bot

# Перезапустите
pm2 restart vpn-bot
```

## Дополнительные ресурсы

- [Документация X-Ray](https://xtls.github.io/)
- [GitHub X-Ray Core](https://github.com/XTLS/Xray-core)
- [Telegram Bot API](https://core.telegram.org/bots/api)
