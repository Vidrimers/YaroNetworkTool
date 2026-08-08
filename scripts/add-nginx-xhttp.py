#!/usr/bin/env python3
import re

with open('/etc/nginx/sites-enabled/1xbetlineboom.xyz', 'r') as f:
    content = f.read()

xhttp_location = """
    # VLESS XHTTP (packet-up fragmentation, bypasses 16KB trap)
    location /xhttp {
        proxy_pass http://127.0.0.1:8451;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
        proxy_connect_timeout 75s;
    }
"""

if '/xhttp' in content:
    print('Nginx /xhttp location already exists')
else:
    marker = '    # SS2022 WebSocket'
    if marker in content:
        content = content.replace(marker, xhttp_location + '\n' + marker)
        with open('/etc/nginx/sites-enabled/1xbetlineboom.xyz', 'w') as f:
            f.write(content)
        print('Nginx /xhttp location added')
    else:
        print('ERROR: Could not find insertion point')
