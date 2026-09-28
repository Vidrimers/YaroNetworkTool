/**
 * Генератор подписки для мультипротокольного VPN
 */

/**
 * Генерирует подписку для клиента (plain text ссылки)
 */
export function generateSubscription({
  uuid,
  serverIp,
  publicKey,
  shortId,
  sni = 'www.microsoft.com',
  ss2022Password,
  clientName = 'MyVPN',
  includeRussianProxy = true
}) {
  const nodes = [];
  const realityServerIp = '1xbetlineboom.xyz';
  const russianProxyIp = '185.244.172.188';

  // 1-5: Reality прямые
  nodes.push(generateVlessLink({ name: `${clientName} - Reality XHTTP`, uuid, serverIp: realityServerIp, port: 8443, network: 'xhttp', security: 'reality', publicKey, shortId, sni, path: '/api/v1/documents' }));
  nodes.push(generateVlessLink({ name: `${clientName} - Reality TCP`, uuid, serverIp: realityServerIp, port: 8444, network: 'tcp', security: 'reality', publicKey, shortId, sni }));
  nodes.push(generateVlessLink({ name: `${clientName} - Reality gRPC`, uuid, serverIp: realityServerIp, port: 8445, network: 'grpc', security: 'reality', publicKey, shortId, sni, serviceName: 'vless-grpc' }));
  nodes.push(generateVlessLink({ name: `${clientName} - Reality Vision`, uuid, serverIp: realityServerIp, port: 8446, network: 'tcp', security: 'reality', publicKey, shortId, sni, flow: 'xtls-rprx-vision' }));
  nodes.push(generateVlessLink({ name: `${clientName} - Reality Vision 443`, uuid, serverIp: realityServerIp, port: 443, network: 'tcp', security: 'reality', publicKey, shortId, sni, flow: 'xtls-rprx-vision' }));

  // 6-9: Reality RU Proxy
  if (includeRussianProxy) {
    nodes.push(generateVlessLink({ name: `${clientName} - RU Reality XHTTP`, uuid, serverIp: russianProxyIp, port: 8443, network: 'xhttp', security: 'reality', publicKey, shortId, sni, path: '/api/v1/documents' }));
    nodes.push(generateVlessLink({ name: `${clientName} - RU Reality TCP`, uuid, serverIp: russianProxyIp, port: 8444, network: 'tcp', security: 'reality', publicKey, shortId, sni }));
    nodes.push(generateVlessLink({ name: `${clientName} - RU Reality gRPC`, uuid, serverIp: russianProxyIp, port: 8445, network: 'grpc', security: 'reality', publicKey, shortId, sni, serviceName: 'vless-grpc' }));
    nodes.push(generateVlessLink({ name: `${clientName} - RU Reality Vision`, uuid, serverIp: russianProxyIp, port: 8446, network: 'tcp', security: 'reality', publicKey, shortId, sni, flow: 'xtls-rprx-vision' }));
  }

  // 10-11: VLESS WS TLS
  nodes.push(generateVlessLink({ name: `${clientName} - VLESS WS TLS 443`, uuid, serverIp, port: 443, network: 'ws', security: 'tls', sni: serverIp, path: '/vless-ws' }));
  nodes.push(generateVlessLink({ name: `${clientName} - VLESS WS TLS 2053`, uuid, serverIp, port: 2053, network: 'ws', security: 'tls', sni: serverIp, path: '/vless-ws' }));

  // 12-13: SS2022
  if (ss2022Password) {
    nodes.push(generateShadowsocksLink({ name: `${clientName} - SS2022`, password: ss2022Password, serverIp, port: 8448, method: '2022-blake3-aes-128-gcm' }));
    if (includeRussianProxy) {
      nodes.push(generateShadowsocksLink({ name: `${clientName} - RU SS2022`, password: ss2022Password, serverIp: russianProxyIp, port: 8448, method: '2022-blake3-aes-128-gcm' }));
    }
  }

  // 14: VLESS WS
  nodes.push(generateVlessLink({ name: `${clientName} - VLESS WS`, uuid, serverIp, port: 8449, network: 'ws', security: 'none', path: '/ws' }));

  // 15: Hysteria2
  nodes.push(generateHysteria2Link({
    name: `${clientName} - Hysteria2`,
    password: process.env.HYSTERIA2_PASSWORD || 'admin_test_password_123',
    serverIp,
    port: process.env.HYSTERIA2_PORT || '123',
    obfs: { type: 'salamander', password: process.env.HYSTERIA2_OBFS_PASSWORD || 'cry_me_a_r1ver_2024' }
  }));

  return { version: 1, nodes };
}

/**
 * Генерирует Xray конфиг (простой формат — как у рабочих провайдеров)
 */
export function generateXrayConfig({
  uuid,
  serverIp,
  publicKey,
  shortId,
  sni = 'www.microsoft.com',
  ss2022Password,
  clientName = 'MyVPN',
  includeRussianProxy = true
}) {
  const outbounds = [];
  const domain = '1xbetlineboom.xyz';
  const russianProxyIp = '185.244.172.188';

  function addReality({ tag, server, port, network, flow = '' }) {
    const streamSettings = {
      network,
      security: 'reality',
      realitySettings: { serverName: sni, fingerprint: 'firefox', publicKey, shortId }
    };
    if (network === 'tcp') streamSettings.tcpSettings = { header: { type: 'none' } };
    if (network === 'xhttp') streamSettings.xhttpSettings = { path: '/api/v1/documents', mode: 'stream-one' };
    if (network === 'grpc') streamSettings.grpcSettings = { serviceName: 'vless-grpc' };
    outbounds.push({
      protocol: 'vless', tag,
      settings: { vnext: [{ address: server, port, users: [{ id: uuid, encryption: 'none', flow }] }] },
      streamSettings
    });
  }

  function addWsTls({ tag, server, port, path }) {
    outbounds.push({
      protocol: 'vless', tag,
      settings: { vnext: [{ address: server, port, users: [{ id: uuid, encryption: 'none', flow: '' }] }] },
      streamSettings: {
        network: 'ws', security: 'tls',
        wsSettings: { path },
        tlsSettings: { serverName: server, fingerprint: 'chrome' }
      }
    });
  }

  // Reality прямые
  addReality({ tag: `${clientName} - Reality XHTTP`, server: domain, port: 8443, network: 'xhttp' });
  addReality({ tag: `${clientName} - Reality TCP`, server: domain, port: 8444, network: 'tcp' });
  addReality({ tag: `${clientName} - Reality gRPC`, server: domain, port: 8445, network: 'grpc' });
  addReality({ tag: `${clientName} - Reality Vision`, server: domain, port: 8446, network: 'tcp', flow: 'xtls-rprx-vision' });
  addReality({ tag: `${clientName} - Reality Vision 443`, server: domain, port: 443, network: 'tcp', flow: 'xtls-rprx-vision' });

  // Reality RU Proxy
  if (includeRussianProxy) {
    addReality({ tag: `${clientName} - RU Reality XHTTP`, server: russianProxyIp, port: 8443, network: 'xhttp' });
    addReality({ tag: `${clientName} - RU Reality TCP`, server: russianProxyIp, port: 8444, network: 'tcp' });
    addReality({ tag: `${clientName} - RU Reality gRPC`, server: russianProxyIp, port: 8445, network: 'grpc' });
    addReality({ tag: `${clientName} - RU Reality Vision`, server: russianProxyIp, port: 8446, network: 'tcp', flow: 'xtls-rprx-vision' });
  }

  // VLESS WS TLS
  addWsTls({ tag: `${clientName} - VLESS WS TLS 443`, server: domain, port: 443, path: '/vless-ws' });
  addWsTls({ tag: `${clientName} - VLESS WS TLS 2053`, server: domain, port: 2053, path: '/vless-ws' });

  // SS2022
  if (ss2022Password) {
    outbounds.push({
      protocol: 'shadowsocks', tag: `${clientName} - SS2022`,
      settings: { servers: [{ address: domain, port: 8448, method: '2022-blake3-aes-128-gcm', password: ss2022Password }] }
    });
    if (includeRussianProxy) {
      outbounds.push({
        protocol: 'shadowsocks', tag: `${clientName} - RU SS2022`,
        settings: { servers: [{ address: russianProxyIp, port: 8448, method: '2022-blake3-aes-128-gcm', password: ss2022Password }] }
      });
    }
  }

  // VLESS WS
  outbounds.push({
    protocol: 'vless', tag: `${clientName} - VLESS WS`,
    settings: { vnext: [{ address: domain, port: 8449, users: [{ id: uuid, encryption: 'none', flow: '' }] }] },
    streamSettings: { network: 'ws', wsSettings: { path: '/ws' } }
  });

  // direct + block
  outbounds.push({ protocol: 'freedom', tag: 'direct' }, { protocol: 'blackhole', tag: 'block' });

  const proxyTag = outbounds[0].tag; // первый proxy — дефолтный

  return {
    log: { loglevel: 'warning' },
    dns: { servers: ['8.8.8.8', '77.88.8.8'] },
    inbounds: [
      {
        protocol: 'socks', tag: 'socks', listen: '127.0.0.1', port: 10808,
        settings: { auth: 'noauth', udp: true },
        sniffing: { enabled: true, routeOnly: true, destOverride: ['http', 'tls', 'quic'] }
      },
      {
        protocol: 'http', tag: 'http', listen: '127.0.0.1', port: 10809,
        settings: { allowTransparent: false },
        sniffing: { enabled: true, routeOnly: true, destOverride: ['http', 'tls', 'quic'] }
      }
    ],
    outbounds,
    routing: {
      domainStrategy: 'AsIs',
      rules: [
        { type: 'field', ip: ['geoip:private'], outboundTag: 'direct' },
        { type: 'field', protocol: ['bittorrent'], outboundTag: 'direct' },
        { type: 'field', network: 'tcp,udp', outboundTag: proxyTag }
      ]
    },
    remarks: `${clientName} VPN`
  };
}

// === УТИЛИТЫ ДЛЯ PLAIN TEXT ССЫЛОК ===

function generateVlessLink({ name, uuid, serverIp, port, network, security, publicKey = '', shortId = '', sni = '', flow = '', path = '', serviceName = '' }) {
  const params = new URLSearchParams({ encryption: 'none', type: network });
  if (security) params.append('security', security);
  if (flow) params.append('flow', flow);
  if (sni) params.append('sni', sni);
  if (publicKey) params.append('pbk', publicKey);
  if (shortId) params.append('sid', shortId);
  if (path) params.append('path', path);
  if (serviceName) params.append('serviceName', serviceName);
  if (security === 'reality') params.append('fp', 'firefox');
  if (security === 'tls') { params.append('fp', 'chrome'); params.append('fragment', '1'); params.append('fragment_fakedns', '1'); }
  return `vless://${uuid}@${serverIp}:${port}?${params.toString()}#${encodeURIComponent(name)}`;
}

function generateShadowsocksLink({ name, password, serverIp, port, method }) {
  const userInfo = `${method}:${password}`;
  const userInfoBase64 = Buffer.from(userInfo).toString('base64').replace(/=+$/, '');
  return `ss://${userInfoBase64}@${serverIp}:${port}#${encodeURIComponent(name)}`;
}

function generateHysteria2Link({ name, password, serverIp, port, obfs = null }) {
  const singlePort = port.includes('-') ? port.split('-')[0] : port;
  const encodedPassword = encodeURIComponent(password);
  let link = `hysteria2://${encodedPassword}@${serverIp}:${singlePort}`;
  if (obfs) {
    const params = new URLSearchParams({ obfs: obfs.type, 'obfs-password': obfs.password });
    link += `?${params.toString()}`;
  }
  return link + `#${encodeURIComponent(name)}`;
}

export function subscriptionToBase64(subscription) {
  return Buffer.from(subscription.nodes.join('\n')).toString('base64');
}

export function subscriptionToJSON(subscription) {
  return JSON.stringify(subscription, null, 2);
}

export default { generateSubscription, generateXrayConfig, subscriptionToBase64, subscriptionToJSON };
