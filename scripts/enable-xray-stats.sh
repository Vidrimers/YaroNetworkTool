#!/bin/bash
# Скрипт для включения API статистики в X-Ray

set -e

CONFIG_FILE="/usr/local/etc/xray/config.json"
BACKUP_FILE="/usr/local/etc/xray/config.json.backup.$(date +%Y%m%d_%H%M%S)"

echo "Создание бэкапа конфига..."
cp "$CONFIG_FILE" "$BACKUP_FILE"
echo "Бэкап создан: $BACKUP_FILE"

echo "Обновление конфига X-Ray..."

# Создаем новый конфиг с API статистики
cat > "$CONFIG_FILE" << 'EOF'
{
  "log": {
    "loglevel": "warning",
    "access": "/var/log/xray/access.log",
    "error": "/var/log/xray/error.log"
  },
  "api": {
    "tag": "api",
    "services": [
      "StatsService"
    ]
  },
  "stats": {},
  "policy": {
    "levels": {
      "0": {
        "statsUserUplink": true,
        "statsUserDownlink": true
      }
    },
    "system": {
      "statsInboundUplink": true,
      "statsInboundDownlink": true,
      "statsOutboundUplink": true,
      "statsOutboundDownlink": true
    }
  },
  "inbounds": [
    {
      "port": 8443,
      "protocol": "vless",
      "settings": {
        "clients": [
          {
            "id": "70fc207d-2cb0-4ba4-9158-c9054b83374e",
            "flow": "",
            "email": "Админ"
          },
          {
            "id": "31fe60d5-1d82-4a6d-98b5-fb227188e4ff",
            "flow": "",
            "email": "Тестик"
          },
          {
            "id": "eb1e0b4d-696b-4fad-932e-4d2f3a161125",
            "flow": "",
            "email": "Бим"
          },
          {
            "id": "30bccf70-49ae-4850-ac3e-f4de4e955261",
            "flow": "",
            "email": "Мадест"
          },
          {
            "id": "373e7bf5-c874-4eaf-a0de-ea8741c07e8f",
            "flow": "",
            "email": "Svrn"
          },
          {
            "id": "49a3319d-1916-41dd-a88d-6de495262a68",
            "flow": "",
            "email": "Mexter"
          }
        ],
        "decryption": "none"
      },
      "streamSettings": {
        "network": "xhttp",
        "security": "reality",
        "realitySettings": {
          "show": false,
          "dest": "www.microsoft.com:443",
          "xver": 0,
          "serverNames": [
            "www.microsoft.com"
          ],
          "privateKey": "-LjCdqufcyXRHQ3gq-rFczceLuIInPtER1KulPMC6FM",
          "shortIds": [
            "fdb985c09b6b1ecd"
          ]
        },
        "xhttpSettings": {
          "path": "/",
          "host": ""
        }
      },
      "sniffing": {
        "enabled": true,
        "destOverride": [
          "http",
          "tls"
        ]
      }
    },
    {
      "listen": "127.0.0.1",
      "port": 10085,
      "protocol": "dokodemo-door",
      "settings": {
        "address": "127.0.0.1"
      },
      "tag": "api"
    }
  ],
  "outbounds": [
    {
      "protocol": "freedom",
      "tag": "direct"
    },
    {
      "protocol": "blackhole",
      "tag": "block"
    }
  ],
  "routing": {
    "rules": [
      {
        "inboundTag": [
          "api"
        ],
        "outboundTag": "api",
        "type": "field"
      },
      {
        "type": "field",
        "ip": [
          "geoip:private"
        ],
        "outboundTag": "block"
      }
    ]
  }
}
EOF

echo "Конфиг обновлен!"
echo ""
echo "Проверка конфига..."
if xray -test -config="$CONFIG_FILE"; then
    echo "✅ Конфиг валиден!"
    echo ""
    echo "Перезапуск X-Ray..."
    systemctl restart xray
    echo "✅ X-Ray перезапущен!"
    echo ""
    echo "Проверка статуса..."
    systemctl status xray --no-pager
else
    echo "❌ Ошибка в конфиге! Восстанавливаем бэкап..."
    cp "$BACKUP_FILE" "$CONFIG_FILE"
    echo "Бэкап восстановлен"
    exit 1
fi
