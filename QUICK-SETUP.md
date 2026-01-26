# Быстрая установка X-Ray VPN сервера

## Автоматическая установка (рекомендуется)

Используйте интерактивный скрипт установки, который проведет вас через все шаги:

```bash
# 1. Подключитесь к серверу
ssh root@144.124.237.222

# 2. Перейдите в директорию проекта
cd /home/xray-vpn

# 3. Запустите скрипт установки
cd scripts
chmod +x initial-setup.sh
sudo ./initial-setup.sh
```

## Что делает скрипт?

Скрипт выполняет 7 шагов с подтверждением каждого:

1. **Установка зависимостей** - curl, wget, unzip, openssl, jq
2. **Установка X-Ray Core** - скачивание и установка последней версии
3. **Генерация ключей** - UUID, Private/Public ключи, Short ID
4. **Генерация SSL сертификата** - самоподписанный сертификат для Reality
5. **Выбор конфигурации** - Reality (прямое) или CDN (через Cloudflare)
6. **Настройка systemd** - автозапуск X-Ray при загрузке системы
7. **Применение конфигурации** - запуск X-Ray сервиса

## Важно перед запуском!

На шаге 5 скрипт попросит вас отредактировать конфигурацию. Вам нужно:

### Для Reality конфигурации:

Отредактируйте `configs/xray-vless-reality.json`:
```bash
nano configs/xray-vless-reality.json
```

Замените:
- `YOUR_UUID_HERE` → UUID из `scripts/generated/keys.txt`
- `YOUR_PRIVATE_KEY_HERE` → Private Key из `scripts/generated/keys.txt`
- `YOUR_SHORT_ID_HERE` → Short ID из `scripts/generated/keys.txt`

### Для CDN конфигурации:

Отредактируйте `configs/xray-vless-xhttp-cdn.json`:
```bash
nano configs/xray-vless-xhttp-cdn.json
```

Замените:
- `YOUR_UUID_HERE` → UUID из `scripts/generated/keys.txt`
- `your-domain.com` → ваш домен
- `/your-path` → желаемый путь (например `/api`)

## После установки

### Проверка статуса X-Ray:
```bash
systemctl status xray
```

### Просмотр логов:
```bash
journalctl -u xray -f
```

### Генерация ссылки для клиента:
```bash
cd /home/xray-vpn/scripts
./generate-client-link.sh
```

### Добавление нового клиента:
```bash
cd /home/xray-vpn/scripts
./add-client.sh
```

## Настройка Cloudflare (только для CDN)

Если вы выбрали CDN конфигурацию:

1. Купите домен в Cloudflare
2. Направьте домен на IP сервера (A-запись)
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

# Включить автозапуск
sudo systemctl enable xray

# Отключить автозапуск
sudo systemctl disable xray
```

## Troubleshooting

### X-Ray не запускается

```bash
# Проверьте логи
sudo journalctl -u xray -n 50

# Проверьте конфигурацию
/usr/local/bin/xray run -test -config /usr/local/etc/xray/config.json
```

### Ошибка "command not found"

```bash
# Убедитесь что X-Ray установлен
which xray

# Если не установлен, запустите:
cd /home/xray-vpn/scripts
./install-xray.sh
```

### Не работает подключение

1. Проверьте, что X-Ray запущен: `systemctl status xray`
2. Проверьте логи: `journalctl -u xray -f`
3. Убедитесь, что UUID и ключи совпадают в конфиге и ссылке
4. Проверьте, что порты открыты в файрволе

## Следующие шаги

После успешной установки X-Ray:

1. **Настройте API сервер** - для управления клиентами через API
2. **Настройте Telegram бота** - для управления через Telegram
3. **Настройте мониторинг** - отслеживание трафика и устройств

См. полную документацию в [SETUP.md](SETUP.md)
