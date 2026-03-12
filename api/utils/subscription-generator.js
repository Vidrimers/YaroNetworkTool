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
    flow: ''
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
      flow: ''
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

  // 12. Shadowsocks 2022 + WebSocket (8450) - обфускация
  if (ss2022Password) {
    nodes.push(generateShadowsocksLink({
      name: `${clientName} - SS2022 WS`,
      password: ss2022Password,
      serverIp,
      port: 8450,
      method: '2022-blake3-aes-128-gcm',
      plugin: 'v2ray-plugin',
      pluginOpts: 'path=/ss-ws'
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
    port: process.env.HYSTERIA2_PORT || '25000',
    obfs: {
      type: 'salamander',
      password: process.env.HYSTERIA2_OBFS_PASSWORD || 'cry_me_a_r1ver_2024'
    }
  }));

  // Hysteria 2 через российский прокси
  if (includeRussianProxy) {
    nodes.push(generateHysteria2Link({
      name: `${clientName} - RU Proxy - Hysteria2`,
      password: process.env.HYSTERIA2_PASSWORD || 'admin_test_password_123',
      serverIp: 'lol.1xbetlineboom.xyz', // Российский поддомен
      port: '25001', // Отдельный порт для lol домена
      obfs: {
        type: 'salamander',
        password: process.env.HYSTERIA2_OBFS_PASSWORD || 'cry_me_a_r1ver_2024'
      }
    }));
  }

  // === NAIVEPROXY (НОВЫЕ ПРОТОКОЛЫ) ===
  
  // NaiveProxy на основном сервере
  nodes.push(generateNaiveProxyLink({
    name: `${clientName} - NaiveProxy`,
    username: process.env.NAIVEPROXY_USERNAME || 'user1',
    password: process.env.NAIVEPROXY_PASSWORD || 'UVAWZtQE0R5EeYsxx0ISg',
    serverIp: serverIp, // Используем домен для совпадения с сертификатом
    port: 8453,
    path: ''
  }));

  // NaiveProxy через российский прокси
  if (includeRussianProxy) {
    nodes.push(generateNaiveProxyLink({
      name: `${clientName} - RU Proxy - NaiveProxy`,
      username: process.env.NAIVEPROXY_USERNAME || 'user1',
      password: process.env.NAIVEPROXY_PASSWORD || 'UVAWZtQE0R5EeYsxx0ISg',
      serverIp: russianProxyIp,
      port: 8453,
      path: ''
    }));
  }

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
  serviceName = ''
}) {
  const params = new URLSearchParams({
    encryption: 'none',
    type: network
  });

  if (security) params.append('security', security);
  if (flow) params.append('flow', flow);
  if (sni) params.append('sni', sni);
  if (publicKey) params.append('pbk', publicKey);
  if (shortId) params.append('sid', shortId);
  if (path) params.append('path', path);
  if (host) params.append('host', host);
  if (serviceName) params.append('serviceName', serviceName);
  
  // Fingerprint для Reality
  if (security === 'reality') {
    params.append('fp', 'chrome');
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
 * Генерирует Shadowsocks ссылку
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
  // Формат: ss://method:password@server:port#name
  const userInfo = `${method}:${password}`;
  const userInfoBase64 = Buffer.from(userInfo).toString('base64');
  
  let link = `ss://${userInfoBase64}@${serverIp}:${port}`;
  
  // Добавляем параметры плагина если есть
  if (plugin) {
    const params = new URLSearchParams();
    params.append('plugin', `${plugin};${pluginOpts}`);
    link += `?${params.toString()}`;
  }
  
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
  port,
  path = '/'
}) {
  // NaiveProxy использует стандартный формат: https://username:password@server:port/path#name
  return `https://${username}:${password}@${serverIp}:${port}${path}#${encodeURIComponent(name)}`;
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
  subscriptionToBase64,
  subscriptionToJSON
};
