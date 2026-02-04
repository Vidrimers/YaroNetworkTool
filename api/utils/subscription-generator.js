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
 * @returns {Object} Объект подписки
 */
export function generateSubscription({
  uuid,
  serverIp,
  publicKey,
  shortId,
  sni = 'www.microsoft.com',
  ss2022Password,
  clientName = 'MyVPN'
}) {
  const nodes = [];

  // 1. VLESS Reality XHTTP (8443)
  nodes.push(generateVlessLink({
    name: `${clientName} - Reality XHTTP`,
    uuid,
    serverIp,
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
    serverIp,
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
    serverIp,
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
    serverIp,
    port: 8446,
    network: 'tcp',
    security: 'reality',
    publicKey,
    shortId,
    sni,
    flow: 'xtls-rprx-vision'
  }));

  // 5. Trojan gRPC (8447)
  nodes.push(generateTrojanLink({
    name: `${clientName} - Trojan gRPC`,
    password: uuid,
    serverIp,
    port: 8447,
    network: 'grpc',
    serviceName: 'grpc'
  }));

  // 6. Shadowsocks 2022 (8448)
  if (ss2022Password) {
    nodes.push(generateShadowsocksLink({
      name: `${clientName} - SS2022`,
      password: ss2022Password,
      serverIp,
      port: 8448,
      method: '2022-blake3-aes-128-gcm'
    }));
  }

  // 7. VLESS WebSocket (8449)
  nodes.push(generateVlessLink({
    name: `${clientName} - VLESS WS`,
    uuid,
    serverIp,
    port: 8449,
    network: 'ws',
    security: 'none',
    path: '/ws'
  }));

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
  method
}) {
  // Формат: ss://method:password@server:port#name
  const userInfo = `${method}:${password}`;
  const userInfoBase64 = Buffer.from(userInfo).toString('base64');
  
  return `ss://${userInfoBase64}@${serverIp}:${port}#${encodeURIComponent(name)}`;
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

export default {
  generateSubscription,
  subscriptionToBase64,
  subscriptionToJSON
};
