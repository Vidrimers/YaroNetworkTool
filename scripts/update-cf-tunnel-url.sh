#!/bin/bash
# Get current Cloudflare tunnel URL and save to file
CF_URL=$(journalctl -u cloudflared-tunnel --no-pager 2>/dev/null | grep -oP 'https://[a-z0-9-]+\.trycloudflare\.com' | tail -1)
if [ -n "$CF_URL" ]; then
    echo "$CF_URL" > /etc/cloudflare-tunnel-url.txt
    echo "Updated: $CF_URL"
else
    echo "No tunnel URL found"
fi
