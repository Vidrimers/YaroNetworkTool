# Индивидуальные цены для клиентов

## Описание

Система поддерживает установку индивидуальных цен для конкретных клиентов при оплате через Kaspa. Это полезно для:

- VIP клиентов со скидкой
- Партнеров с особыми условиями
- Тестовых аккаунтов (бесплатно или символическая цена)
- Промо-акций

## Как это работает

1. По умолчанию все клиенты используют стандартные цены из `SUBSCRIPTION_PLANS`
2. Если для клиента установлена индивидуальная цена (`custom_price_kaspa`), она используется вместо стандартной
3. Индивидуальная цена применяется **только для Kaspa**, другие методы оплаты используют стандартные цены

## Установка индивидуальной цены

### Способ 1: Через скрипт (рекомендуется)

```bash
# Установить цену 15 KAS
./scripts/set-custom-price.sh <uuid> 15

# Установить бесплатно (0 KAS)
./scripts/set-custom-price.sh <uuid> 0

# Сбросить на стандартную цену
./scripts/set-custom-price.sh <uuid> null

# Посмотреть текущую цену
./scripts/set-custom-price.sh <uuid>
```

### Способ 2: Через SQL

```bash
# Установить индивидуальную цену
sqlite3 database/vpn.db "UPDATE clients SET custom_price_kaspa = 15 WHERE uuid = '<uuid>';"

# Сбросить на стандартную
sqlite3 database/vpn.db "UPDATE clients SET custom_price_kaspa = NULL WHERE uuid = '<uuid>';"

# Посмотреть все индивидуальные цены
sqlite3 -header -column database/vpn.db "SELECT name, uuid, custom_price_kaspa FROM clients WHERE custom_price_kaspa IS NOT NULL;"
```

### Способ 3: Через API

```bash
# Установить индивидуальную цену
curl -X PATCH http://localhost:3000/api/clients/<uuid> \
  -H "Content-Type: application/json" \
  -d '{"custom_price_kaspa": 15}'

# Сбросить на стандартную
curl -X PATCH http://localhost:3000/api/clients/<uuid> \
  -H "Content-Type: application/json" \
  -d '{"custom_price_kaspa": null}'
```

## Примеры использования

### Пример 1: VIP клиент со скидкой 50%

Стандартная цена за 1 месяц: 25 KAS
VIP цена: 12.5 KAS

```bash
./scripts/set-custom-price.sh abc123-def456 12.5
```

### Пример 2: Партнер с бесплатным доступом

```bash
./scripts/set-custom-price.sh abc123-def456 0
```

### Пример 3: Тестовый аккаунт (символическая цена)

```bash
./scripts/set-custom-price.sh abc123-def456 1
```

## Проверка

После установки индивидуальной цены:

1. Клиент увидит индивидуальную цену при выборе оплаты через Kaspa
2. В сообщении будет указано "(индивидуальная)" рядом с ценой
3. Стандартные цены для других методов оплаты не изменятся

## Миграция базы данных

Если база данных уже существует, выполни миграцию:

```bash
sqlite3 database/vpn.db < database/migrations/003_add_custom_price_kaspa.sql
```

## Технические детали

### Структура БД

```sql
ALTER TABLE clients ADD COLUMN custom_price_kaspa REAL;
```

- `NULL` = использовать стандартную цену
- Число = индивидуальная цена в KAS

### Измененные файлы

1. `database/init.sql` - добавлено поле `custom_price_kaspa`
2. `database/models/Client.js` - добавлено в `allowedFields`
3. `yaronetworktool/bot/payments/kaspa.js` - поддержка `customPrice`
4. `yaronetworktool/bot/payments/payment-handler.js` - получение индивидуальной цены
5. `yaronetworktool/bot/yaronetworktool_bot.js` - передача `apiClient`

## Примечания

- Индивидуальная цена применяется **только для Kaspa**
- Для других методов оплаты (TON, USDT, Stars) используются стандартные цены
- Если нужны индивидуальные цены для других методов, можно добавить аналогичные поля (`custom_price_ton`, `custom_price_usdt` и т.д.)
