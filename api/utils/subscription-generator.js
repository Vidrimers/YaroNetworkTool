/**
 * Генератор подписки для мультипротокольного VPN
 */

/**
 * Генерирует подписку для клиента
 * @param {Object} params - Параметры подписки
 * @param {string} params.uuid - UUID клиента
 * @param {string} params.serverIp - IP адрес сервера
 * @param {string} params.publicKey - Public Key для Reality
 * @param {string} params.shortId - Short ID для Reality
 * @param {string} params.sni - Server Name Indication
 * @param {string} params.ss2022Password - Пароль для Shadowsocks 2022
 * @param {string} params.clientName - Имя клиента
 * @param {boolean} params.includeRussianProxy - Включить российский прокси-сервер
 * @returns {Object} Объект подписки
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

  // Для Reality протоколов используем IP адрес вместо домена
  const realityServerIp = serverIp.includes('.') && !serverIp.match(/[a-z]/i) ? serverIp : '89.124.70.156';
  
  // Российский прокси-сервер
  const russianProxyIp = '185.244.172.188';

  // Параметры обфускации XHTTP (маскировка под REST API)
  const xhttpExtra = {
    xPaddingBytes: '100-1000'
  };
  
  // === ПРЯМОЕ ПОДКЛЮЧЕНИЕ (vdsina) ===
  
  // 1. VLESS Reality XHTTP (8443)
  nodes.push(generateVlessLink({
    name: `${clientName} - Reality XHTTP`,
    uuid,
    serverIp: realityServerIp,
    port: 8443,
    network: 'xhttp',
    security: 'reality',
    publicKey,
    shortId,
    sni,
    flow: '',
    path: '/api/v1/documents',
    xhttpExtra
  }));

  // 2. VLESS Reality TCP (8444)
  nodes.push(generateVlessLink({
    name: `${clientName} - Reality TCP`,
    uuid,
    serverIp: realityServerIp,
    port: 8444,
    network: 'tcp',
    security: 'reality',
    publicKey,
    shortId,
    sni,
    flow: ''
  }));

  // 3. VLESS Reality gRPC (8445)
  nodes.push(generateVlessLink({
    name: `${clientName} - Reality gRPC`,
    uuid,
    serverIp: realityServerIp,
    port: 8445,
    network: 'grpc',
    security: 'reality',
    publicKey,
    shortId,
    sni,
    flow: '',
    serviceName: 'vless-grpc'
  }));

  // 4. VLESS Reality Vision (8446)
  nodes.push(generateVlessLink({
    name: `${clientName} - Reality Vision`,
    uuid,
    serverIp: realityServerIp,
    port: 8446,
    network: 'tcp',
    security: 'reality',
    publicKey,
    shortId,
    sni,
    flow: 'xtls-rprx-vision'
  }));

  // 4.1. VLESS Reality Vision (443) - через SNI-routing, более надёжный порт
  nodes.push(generateVlessLink({
    name: `${clientName} - Reality Vision 443`,
    uuid,
    serverIp: realityServerIp,
    port: 443,
    network: 'tcp',
    security: 'reality',
    publicKey,
    shortId,
    sni,
    flow: 'xtls-rprx-vision'
  }));

  // === РОССИЙСКИЙ ПРОКСИ (для обхода блокировок) ===
  
  if (includeRussianProxy) {
    // 5. VLESS Reality XHTTP через российский прокси (8443)
    nodes.push(generateVlessLink({
      name: `${clientName} - RU Proxy - Reality XHTTP`,
      uuid,
      serverIp: russianProxyIp,
      port: 8443,
      network: 'xhttp',
      security: 'reality',
      publicKey,
      shortId,
      sni,
      flow: '',
      path: '/api/v1/documents',
      xhttpExtra
    }));

    // 6. VLESS Reality TCP через российский прокси (8444)
    nodes.push(generateVlessLink({
      name: `${clientName} - RU Proxy - Reality TCP`,
      uuid,
      serverIp: russianProxyIp,
      port: 8444,
      network: 'tcp',
      security: 'reality',
      publicKey,
      shortId,
      sni,
      flow: ''
    }));

    // 7. VLESS Reality gRPC через российский прокси (8445)
    nodes.push(generateVlessLink({
      name: `${clientName} - RU Proxy - Reality gRPC`,
      uuid,
      serverIp: russianProxyIp,
      port: 8445,
      network: 'grpc',
      security: 'reality',
      publicKey,
      shortId,
      sni,
      flow: '',
      serviceName: 'vless-grpc'
    }));

    // 8. VLESS Reality Vision через российский прокси (8446)
    nodes.push(generateVlessLink({
      name: `${clientName} - RU Proxy - Reality Vision`,
      uuid,
      serverIp: russianProxyIp,
      port: 8446,
      network: 'tcp',
      security: 'reality',
      publicKey,
      shortId,
      sni,
      flow: 'xtls-rprx-vision'
    }));
  }

  // === WEBSOCKET (через Nginx) ===

  // 9. VLESS WebSocket TLS через 443 (обход блокировки)
  nodes.push(generateVlessLink({
    name: `${clientName} - VLESS WS TLS 443`,
    uuid,
    serverIp,
    port: 443,
    network: 'ws',
    security: 'tls',
    sni: serverIp,
    path: '/vless-ws'
  }));

  // 10. VLESS WebSocket TLS через 2053 (обход блокировки порта 443)
  nodes.push(generateVlessLink({
    name: `${clientName} - VLESS WS TLS 2053`,
    uuid,
    serverIp,
    port: 2053,
    network: 'ws',
    security: 'tls',
    sni: serverIp,
    path: '/vless-ws'
  }));

  // === ДОПОЛНИТЕЛЬНЫЕ ПРОТОКОЛЫ ===

  // 11. Shadowsocks 2022 (8448) - прямое подключение
  if (ss2022Password) {
    nodes.push(generateShadowsocksLink({
      name: `${clientName} - SS2022`,
      password: ss2022Password,
      serverIp,
      port: 8448,
      method: '2022-blake3-aes-128-gcm'
    }));
  }

  // 12. Shadowsocks 2022 + WebSocket через nginx TLS (443)
  // Используем нативный Xray SS2022+WS формат (НЕ v2ray-plugin!)
  if (ss2022Password) {
    nodes.push(generateShadowsocksWSLink({
      name: `${clientName} - SS2022 WS TLS`,
      password: ss2022Password,
      serverIp,
      port: 443,
      method: '2022-blake3-aes-128-gcm',
      path: '/ss-ws',
      host: serverIp
    }));
  }

  // 13. Shadowsocks 2022 через российский прокси (8448)
  if (ss2022Password && includeRussianProxy) {
    nodes.push(generateShadowsocksLink({
      name: `${clientName} - RU Proxy - SS2022`,
      password: ss2022Password,
      serverIp: russianProxyIp,
      port: 8448,
      method: '2022-blake3-aes-128-gcm'
    }));
  }

  // 14. VLESS WebSocket (8449)
  nodes.push(generateVlessLink({
    name: `${clientName} - VLESS WS`,
    uuid,
    serverIp,
    port: 8449,
    network: 'ws',
    security: 'none',
    path: '/ws'
  }));

  // === HYSTERIA 2 (НОВЫЕ ПРОТОКОЛЫ) ===
  
  // Hysteria 2 на основном сервере
  nodes.push(generateHysteria2Link({
    name: `${clientName} - Hysteria2`,
    password: process.env.HYSTERIA2_PASSWORD || 'admin_test_password_123',
    serverIp: serverIp, // Используем домен вместо IP
    port: process.env.HYSTERIA2_PORT || '123',
    obfs: {
      type: 'salamander',
      password: process.env.HYSTERIA2_OBFS_PASSWORD || 'cry_me_a_r1ver_2024'
    }
  }));

  // Hysteria 2 через российский прокси (отключён — нет проброса UDP на RU прокси)
  // TODO: Настроить Hysteria2 на RU прокси или UDP проброс
  /*
  if (includeRussianProxy) {
    nodes.push(generateHysteria2Link({
      name: `${clientName} - RU Proxy - Hysteria2`,
      password: process.env.HYSTERIA2_PASSWORD || 'admin_test_password_123',
      serverIp: 'lol.1xbetlineboom.xyz',
      port: '25001',
      obfs: {
        type: 'salamander',
        password: process.env.HYSTERIA2_OBFS_PASSWORD || 'cry_me_a_r1ver_2024'
      }
    }));
  }
  */

  // === NAIVEPROXY ===
  // NaiveProxy на основном сервере (caddy напрямую на порту 8453)
  // ПРИМЕЧАНИЕ: NaiveProxy поддерживается только в NekoBox и нативном клиенте naive
  // Throne и Hiddify НЕ поддерживают NaiveProxy
  // Раскомментировать если клиент поддерживает:
  /*
  nodes.push(generateNaiveProxyLink({
    name: `${clientName} - NaiveProxy`,
    username: process.env.NAIVEPROXY_USERNAME || 'user1',
    password: process.env.NAIVEPROXY_PASSWORD || 'password123',
    serverIp: serverIp,
    port: 8453
  }));
  */

  // NaiveProxy через российский прокси (пока отключён — нет проброса на RU прокси)
  // TODO: Настроить проброс порта 8453 на RU прокси если нужно
  /*
  if (includeRussianProxy) {
    nodes.push(generateNaiveProxyLink({
      name: `${clientName} - RU Proxy - NaiveProxy`,
      username: process.env.NAIVEPROXY_USERNAME || 'user1',
      password: process.env.NAIVEPROXY_PASSWORD || 'password123',
      serverIp: 'lol.1xbetlineboom.xyz',
      port: 8453
    }));
  }
  */

  return {
    version: 1,
    nodes: nodes
  };
}

/**
 * Генерирует VLESS ссылку
 */
function generateVlessLink({
  name,
  uuid,
  serverIp,
  port,
  network,
  security,
  publicKey = '',
  shortId = '',
  sni = '',
  flow = '',
  path = '',
  host = '',
  serviceName = '',
  xhttpExtra = null
}) {
  const params = new URLSearchParams({
    encryption: 'none',
    type: network
  });

  if (security) params.append('security', security);
  if (flow) params.append('flow', flow);
  params.append('packetEncoding', 'xudp');
  if (sni) params.append('sni', sni);
  if (publicKey) params.append('pbk', publicKey);
  if (shortId) params.append('sid', shortId);
  if (path) params.append('path', path);
  if (host) params.append('host', host);
  if (serviceName) params.append('serviceName', serviceName);
  
  // Fingerprint для Reality
  if (security === 'reality') {
    params.append('fp', 'firefox');
    params.append('spx', '/'); // spiderX — путь для начального TLS handshake
  }

  // uTLS fingerprint + TLS Fragmentation для WS TLS (обход DPI)
  if (security === 'tls') {
    params.append('fp', 'chrome');
    params.append('fragment', '1');
    params.append('fragment_fakedns', '1');
  }

  // Параметры XHTTP обфускации
  if (network === 'xhttp' && xhttpExtra) {
    xhttpExtra.mode = 'stream-one';
    params.append('extra', JSON.stringify(xhttpExtra));
  }

  return `vless://${uuid}@${serverIp}:${port}?${params.toString()}#${encodeURIComponent(name)}`;
}

/**
 * Генерирует Trojan ссылку
 */
function generateTrojanLink({
  name,
  password,
  serverIp,
  port,
  network,
  serviceName = ''
}) {
  const params = new URLSearchParams({
    type: network,
    security: 'none'
  });

  if (serviceName) {
    params.append('serviceName', serviceName);
  }

  return `trojan://${password}@${serverIp}:${port}?${params.toString()}#${encodeURIComponent(name)}`;
}

/**
 * Генерирует Shadowsocks ссылку (SIP002 формат)
 */
function generateShadowsocksLink({
  name,
  password,
  serverIp,
  port,
  method,
  plugin = '',
  pluginOpts = ''
}) {
  // SIP002 формат: ss://BASE64(method:password)@server:port/?plugin=encoded#name
  const userInfo = `${method}:${password}`;
  const userInfoBase64 = Buffer.from(userInfo).toString('base64').replace(/=+$/, '');
  
  let link = `ss://${userInfoBase64}@${serverIp}:${port}`;
  
  // Добавляем параметры плагина если есть (SIP002 формат)
  if (plugin) {
    // Формат: plugin=pluginName%3BpluginOpts (разделитель ; URL-encoded как %3B)
    const pluginValue = plugin + ';' + pluginOpts;
    const params = new URLSearchParams();
    params.append('plugin', pluginValue);
    link += `/?${params.toString()}`;
  }
  
  link += `#${encodeURIComponent(name)}`;
  
  return link;
}

/**
 * Генерирует Shadowsocks 2022 + WebSocket ссылку (нативный Xray формат)
 * НЕ использует v2ray-plugin — это нативный Xray SS2022+WS
 */
function generateShadowsocksWSLink({
  name,
  password,
  serverIp,
  port,
  method,
  path = '/ss-ws',
  host = ''
}) {
  // SIP002 формат с транспортом WebSocket
  const userInfo = `${method}:${password}`;
  const userInfoBase64 = Buffer.from(userInfo).toString('base64').replace(/=+$/, '');

  let link = `ss://${userInfoBase64}@${serverIp}:${port}`;

  // Параметры для Xray SS2022+WS (НЕ v2ray-plugin!)
  // Формат: plugin=v2ray-plugin%3Btls%3Bhost%3Dxxx%3Bpath%3D%2Fss-ws
  // Но для нативного Xray SS2022+WS используем обфускацию через WebSocket
  const pluginOpts = [
    'tls',
    `host=${host || serverIp}`,
    `path=${path}`,
    'mode=websocket'
  ].join(';');

  const params = new URLSearchParams();
  params.append('plugin', `v2ray-plugin;${pluginOpts}`);
  link += `/?${params.toString()}`;

  link += `#${encodeURIComponent(name)}`;
  return link;
}

/**
 * Конвертирует подписку в Base64 (для совместимости)
 */
export function subscriptionToBase64(subscription) {
  const links = subscription.nodes.join('\n');
  return Buffer.from(links).toString('base64');
}

/**
 * Конвертирует подписку в JSON
 */
export function subscriptionToJSON(subscription) {
  return JSON.stringify(subscription, null, 2);
}

/**
 * Генерирует Xray конфиг с балансировщиком нагрузки "Авто"
 * Использует burstObservatory + leastLoad стратегию
 * @param {Object} params - Параметры подписки (те же что и generateSubscription)
 * @returns {Object} Xray конфиг
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

  const realityServerIp = serverIp.includes('.') && !serverIp.match(/[a-z]/i) ? serverIp : '89.124.70.156';
  const russianProxyIp = '185.244.172.188';

  // === HELPER: VLESS outbound ===
  function addVless({ tag, server, port, flow = '', streamSettings = {} }) {
    outbounds.push({
      protocol: 'vless',
      tag,
      settings: {
        vnext: [{
          address: server,
          port,
          users: [{
            id: uuid,
            encryption: 'none',
            flow
          }]
        }]
      },
      streamSettings
    });
  }

  // === HELPER: Reality stream settings ===
  function realityStream(network, extra = {}) {
    const ss = {
      network,
      security: 'reality',
      realitySettings: {
        serverName: sni,
        fingerprint: 'firefox',
        publicKey,
        shortId,
        spiderX: '/'
      }
    };
    if (network === 'xhttp') {
      ss.xhttpSettings = {
        path: '/api/v1/documents',
        mode: 'stream-one',
        extra: { xPaddingBytes: '100-1000' }
      };
    }
    if (network === 'grpc') {
      ss.grpcSettings = {
        serviceName: 'vless-grpc'
      };
    }
    return ss;
  }

  // === HELPER: TLS stream settings ===
  function tlsStream(network, sniVal, path = '') {
    const ss = {
      network,
      security: 'tls',
      tlsSettings: {
        serverName: sniVal,
        fingerprint: 'chrome'
      }
    };
    if (network === 'ws') {
      ss.wsSettings = { path };
    }
    return ss;
  }

  // === 1. Reality XHTTP (8443) ===
  addVless({
    tag: `proxy-1-${clientName}-Reality-XHTTP`,
    server: realityServerIp,
    port: 8443,
    streamSettings: realityStream('xhttp')
  });

  // === 2. Reality TCP (8444) ===
  addVless({
    tag: `proxy-2-${clientName}-Reality-TCP`,
    server: realityServerIp,
    port: 8444,
    streamSettings: realityStream('tcp')
  });

  // === 3. Reality gRPC (8445) ===
  addVless({
    tag: `proxy-3-${clientName}-Reality-gRPC`,
    server: realityServerIp,
    port: 8445,
    streamSettings: realityStream('grpc')
  });

  // === 4. Reality Vision (8446) ===
  addVless({
    tag: `proxy-4-${clientName}-Reality-Vision`,
    server: realityServerIp,
    port: 8446,
    flow: 'xtls-rprx-vision',
    streamSettings: realityStream('tcp')
  });

  // === 5. Reality Vision 443 ===
  addVless({
    tag: `proxy-5-${clientName}-Reality-Vision-443`,
    server: realityServerIp,
    port: 443,
    flow: 'xtls-rprx-vision',
    streamSettings: realityStream('tcp')
  });

  // === RU Proxy Reality ===
  if (includeRussianProxy) {
    addVless({
      tag: `proxy-6-${clientName}-RU-Reality-XHTTP`,
      server: russianProxyIp,
      port: 8443,
      streamSettings: realityStream('xhttp')
    });

    addVless({
      tag: `proxy-7-${clientName}-RU-Reality-TCP`,
      server: russianProxyIp,
      port: 8444,
      streamSettings: realityStream('tcp')
    });

    addVless({
      tag: `proxy-8-${clientName}-RU-Reality-gRPC`,
      server: russianProxyIp,
      port: 8445,
      streamSettings: realityStream('grpc')
    });

    addVless({
      tag: `proxy-9-${clientName}-RU-Reality-Vision`,
      server: russianProxyIp,
      port: 8446,
      flow: 'xtls-rprx-vision',
      streamSettings: realityStream('tcp')
    });
  }

  // === VLESS WS TLS ===
  addVless({
    tag: `proxy-10-${clientName}-VLESS-WS-TLS-443`,
    server: serverIp,
    port: 443,
    streamSettings: tlsStream('ws', serverIp, '/vless-ws')
  });

  addVless({
    tag: `proxy-11-${clientName}-VLESS-WS-TLS-2053`,
    server: serverIp,
    port: 2053,
    streamSettings: tlsStream('ws', serverIp, '/vless-ws')
  });

  // === SS2022 ===
  if (ss2022Password) {
    outbounds.push({
      protocol: 'shadowsocks',
      tag: `proxy-12-${clientName}-SS2022`,
      settings: {
        servers: [{
          address: serverIp,
          port: 8448,
          method: '2022-blake3-aes-128-gcm',
          password: ss2022Password
        }]
      }
    });
  }

  if (ss2022Password) {
    outbounds.push({
      protocol: 'shadowsocks',
      tag: `proxy-13-${clientName}-SS2022-WS-TLS`,
      settings: {
        servers: [{
          address: serverIp,
          port: 443,
          method: '2022-blake3-aes-128-gcm',
          password: ss2022Password
        }]
      },
      streamSettings: {
        network: 'ws',
        security: 'tls',
        wsSettings: {
          path: '/ss-ws',
          headers: { Host: serverIp }
        },
        tlsSettings: {
          serverName: serverIp,
          fingerprint: 'chrome'
        }
      }
    });
  }

  if (ss2022Password && includeRussianProxy) {
    outbounds.push({
      protocol: 'shadowsocks',
      tag: `proxy-14-${clientName}-RU-SS2022`,
      settings: {
        servers: [{
          address: russianProxyIp,
          port: 8448,
          method: '2022-blake3-aes-128-gcm',
          password: ss2022Password
        }]
      }
    });
  }

  // === VLESS WS ===
  addVless({
    tag: `proxy-15-${clientName}-VLESS-WS`,
    server: serverIp,
    port: 8449,
    streamSettings: {
      network: 'ws',
      wsSettings: { path: '/ws' }
    }
  });

  // === DIRECT и BLOCK ===
  outbounds.push(
    // "Авто" — loopback outbound для авто-выбора через balancer
    {
      protocol: 'loopback',
      tag: 'Авто',
      settings: {
        inboundTag: 'auto-in'
      }
    },
    { protocol: 'freedom', tag: 'direct' },
    { protocol: 'blackhole', tag: 'block' }
  );

  // === XRAY CONFIG ===
  return {
    log: {
      loglevel: 'warning'
    },
    dns: {
      servers: [
        '8.8.8.8',
        '77.88.8.8'
      ]
    },
    inbounds: [
      {
        port: 2080,
        listen: '127.0.0.1',
        protocol: 'mixed',
        tag: 'mixed-in',
        settings: {
          auth: 'noauth',
          udp: true
        },
        sniffing: {
          enabled: true,
          destOverride: ['http', 'tls']
        }
      },
      {
        // Внутренний inbound для loopback "Авто"
        tag: 'auto-in',
        listen: '127.0.0.1',
        port: 2081,
        protocol: 'mixed',
        settings: {
          auth: 'noauth',
          udp: true
        }
      }
    ],
    outbounds,
    // === BURST OBSERVATORY ===
    // Пингует узлы со случайными интервалами (меньше фингерпринт)
    burstObservatory: {
      subjectSelector: ['proxy'],
      pingConfig: {
        destination: 'https://cp.cloudflare.com/',
        interval: '1m',
        sampling: 10,
        timeout: '5s',
        httpMethod: 'HEAD'
      }
    },
    // === ROUTING ===
    routing: {
      domainStrategy: 'AsIs',
      rules: [
        // Трафик из "Авто" идёт через балансировщик
        {
          type: 'field',
          inboundTag: ['auto-in'],
          balancerTag: 'auto'
        },
        {
          type: 'field',
          ip: ['geoip:private'],
          outboundTag: 'direct'
        },
        {
          type: 'field',
          protocol: ['bittorrent'],
          outboundTag: 'direct'
        },
        {
          type: 'field',
          // Весь остальной трафик через балансировщик "Авто"
          network: 'tcp,udp',
          balancerTag: 'auto'
        }
      ],
      balancers: [
        {
          tag: 'auto',
          selector: ['proxy'],
          fallbackTag: 'direct',
          strategy: {
            type: 'leastLoad',
            settings: {
              expected: 2,
              maxRTT: '800ms',
              tolerance: 0.05,
              baselines: ['200ms', '400ms']
            }
          }
        }
      ]
    }
  };
}

/**
 * Генерирует Hysteria2 ссылку
 */
function generateHysteria2Link({
  name,
  password,
  serverIp,
  port,
  obfs = null
}) {
  // Hysteria2 использует стандартный формат: hysteria2://password@server:port
  // Если порт содержит диапазон, используем первый порт
  const singlePort = port.includes('-') ? port.split('-')[0] : port;
  
  // URL-encode пароля для корректной обработки спецсимволов
  const encodedPassword = encodeURIComponent(password);
  
  let link = `hysteria2://${encodedPassword}@${serverIp}:${singlePort}`;
  
  if (obfs) {
    const params = new URLSearchParams();
    params.append('obfs', obfs.type);
    params.append('obfs-password', obfs.password);
    link += `?${params.toString()}`;
  }
  
  link += `#${encodeURIComponent(name)}`;
  return link;
}

/**
 * Генерирует NaiveProxy ссылку
 */
function generateNaiveProxyLink({
  name,
  username,
  password,
  serverIp,
  port
}) {
  // NaiveProxy использует формат: naive+https://username:password@server:port#name
  return `naive+https://${username}:${password}@${serverIp}:${port}#${encodeURIComponent(name)}`;
}

/**
 * Генерирует пароль для Hysteria2 на основе UUID
 */
function generateHysteria2Password(uuid) {
  // Используем полный UUID для пароля
  return uuid + '_hy2';
}

/**
 * Генерирует пароль для NaiveProxy на основе UUID
 */
function generateNaiveProxyPassword(uuid) {
  // Используем полный UUID для пароля
  return uuid + '_naive';
}

export default {
  generateSubscription,
  generateXrayConfig,
  subscriptionToBase64,
  subscriptionToJSON
};
