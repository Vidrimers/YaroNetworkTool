#!/bin/bash
# Get current Cloudflare tunnel URL and generate VLESS links
UUID="70fc207d-2cb0-4ba4-9158-c9054b83374e"

# Get tunnel URL from journal
CF_URL=$(journalctl -u cloudflared-tunnel --no-pager 2>/dev/null | grep -oP 'https://[a-z0-9-]+\.trycloudflare\.com' | tail -1)

if [ -z "$CF_URL" ]; then
    echo "ERROR: Cloudflare tunnel not running"
    exit 1
fi

HOST=$(echo "$CF_URL" | sed 's|https://||')

echo "=== Cloudflare Tunnel VPN Links ==="
echo ""
echo "VLESS WS TLS (Cloudflare):"
echo "vless://${UUID}@${HOST}:443?encryption=none&type=ws&security=tls&sni=${HOST}&path=%2Fws#CF-VLESS-WS"
echo ""
echo "VLESS XHTTP TLS (Cloudflare):"
echo "vless://${UUID}@${HOST}:443?encryption=none&type=xhttp&security=tls&sni=${HOST}&path=%2Fxhttp&mode=packet-up#CF-VLESS-XHTTP"
echo ""
echo "Direct link (for import):"
echo "https://${HOST}"
