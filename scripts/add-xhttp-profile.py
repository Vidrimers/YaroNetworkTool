#!/usr/bin/env python3
"""Add VLESS XHTTP 443 profile to subscription generator"""

with open('/home/xray-vpn/api/utils/subscription-generator.js', 'r') as f:
    content = f.read()

# 1. Add mode parameter to generateVlessLink function
old_params = """  if (serviceName) params.append('serviceName', serviceName);
  
  // Fingerprint для Reality"""

new_params = """  if (serviceName) params.append('serviceName', serviceName);
  if (mode) params.append('mode', mode);
  
  // Fingerprint для Reality"""

if 'if (mode) params.append' not in content:
    content = content.replace(old_params, new_params)
    print('Added mode parameter to generateVlessLink')
else:
    print('mode parameter already exists')

# 2. Add mode to function signature
old_sig = """  serviceName = '',
  xhttpExtra = null"""
new_sig = """  serviceName = '',
  xhttpExtra = null,
  mode = ''"""

if "mode = ''" not in content:
    content = content.replace(old_sig, new_sig)
    print('Added mode to function signature')
else:
    print('mode in signature already exists')

# 3. Add VLESS XHTTP 443 profile (after VLESS WS TLS 2053)
xhttp_profile = """
  // 10.5. VLESS XHTTP TLS 443 (packet-up fragmentation, bypasses 16KB trap)
  nodes.push(generateVlessLink({
    name: `${clientName} - VLESS XHTTP 443`,
    uuid,
    serverIp,
    port: 443,
    network: 'xhttp',
    security: 'tls',
    sni: serverIp,
    path: '/xhttp',
    mode: 'packet-up',
    xhttpExtra: { xPaddingBytes: '100-1000' }
  }));
"""

marker = "  // 11. Shadowsocks 2022"
if '// 10.5. VLESS XHTTP' not in content:
    content = content.replace(marker, xhttp_profile + marker)
    print('Added VLESS XHTTP 443 profile')
else:
    print('VLESS XHTTP 443 profile already exists')

with open('/home/xray-vpn/api/utils/subscription-generator.js', 'w') as f:
    f.write(content)

print('Done!')
