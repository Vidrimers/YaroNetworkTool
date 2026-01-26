#!/bin/bash
# Настройка Git hooks для автоматической валидации

set -e

DEPLOY_DIR="/opt/xray-vpn"

echo "=== Настройка Git hooks ==="

cd $DEPLOY_DIR

# Создание pre-commit hook для локальной разработки
cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash
# Pre-commit hook для проверки конфигурации

echo "Проверка JSON конфигураций..."

for config in configs/*.json; do
    if [ -f "$config" ]; then
        if ! python3 -m json.tool "$config" > /dev/null 2>&1; then
            echo "Ошибка: $config содержит невалидный JSON"
            exit 1
        fi
        echo "✓ $config - OK"
    fi
done

echo "Все конфигурации валидны"
EOF

chmod +x .git/hooks/pre-commit

echo "=== Git hooks настроены ==="
echo "Pre-commit hook будет проверять JSON конфигурации перед коммитом"
