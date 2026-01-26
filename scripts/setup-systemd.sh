#!/bin/bash
# Создание systemd сервиса для X-Ray

set -e

SERVICE_FILE="/etc/systemd/system/xray.service"

echo "=== Создание systemd сервиса ==="

sudo tee $SERVICE_FILE > /dev/null << 'EOF'
[Unit]
Description=Xray Service
Documentation=https://github.com/xtls
After=network.target nss-lookup.target

[Service]
User=root
CapabilityBoundingSet=CAP_NET_ADMIN CAP_NET_BIND_SERVICE
AmbientCapabilities=CAP_NET_ADMIN CAP_NET_BIND_SERVICE
NoNewPrivileges=true
ExecStart=/usr/local/bin/xray run -config /usr/local/etc/xray/config.json
Restart=on-failure
RestartPreventExitStatus=23
LimitNPROC=10000
LimitNOFILE=1000000

[Install]
WantedBy=multi-user.target
EOF

echo "=== Перезагрузка systemd ==="
sudo systemctl daemon-reload
sudo systemctl enable xray

echo "=== Сервис создан и включен ==="
echo "Используйте команды:"
echo "  sudo systemctl start xray    - запустить"
echo "  sudo systemctl stop xray     - остановить"
echo "  sudo systemctl status xray   - проверить статус"
echo "  sudo systemctl restart xray  - перезапустить"
