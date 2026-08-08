#!/usr/bin/env python3
"""Fix nginx /xhttp location for XHTTP protocol (not WebSocket)"""

with open('/etc/nginx/sites-enabled/1xbetlineboom.xyz', 'r') as f:
    content = f.read()

old_location = """    # VLESS XHTTP (packet-up fragmentation, bypasses 16KB trap)
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
    }"""

new_location = """    # VLESS XHTTP (packet-up fragmentation, bypasses 16KB trap)
    # XHTTP is HTTP POST-based, NOT WebSocket
    location /xhttp {
        proxy_pass http://127.0.0.1:8451;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
        proxy_request_buffering off;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
        proxy_connect_timeout 75s;
    }"""

if old_location in content:
    content = content.replace(old_location, new_location)
    with open('/etc/nginx/sites-enabled/1xbetlineboom.xyz', 'w') as f:
        f.write(content)
    print('Fixed /xhttp location: removed WebSocket headers, added proxy_request_buffering off')
else:
    print('ERROR: Could not find old location block')
