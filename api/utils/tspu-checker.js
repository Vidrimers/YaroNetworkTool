/**
 * TSPU Checker - диагностика блокировок ТСПУ
 * Утилиты для проверки доступности серверов, портов, SNI, DNS
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import net from 'net';

const execAsync = promisify(exec);

// Порты VPN-сервера для проверки
const VPN_PORTS = [
  { port: 443, name: 'HTTPS' },
  { port: 8443, name: 'Reality XHTTP' },
  { port: 8444, name: 'Reality TCP' },
  { port: 8448, name: 'SS2022' },
  { port: 8449, name: 'VLESS WS' },
  { port: 25000, name: 'Hysteria2' },
];

// SNI для проверки фильтрации
const SNI_TESTS = [
  { sni: '1xbetlineboom.xyz', name: 'YaroVPN' },
  { sni: 'www.microsoft.com', name: 'Microsoft (Reality)' },
];

/**
 * Проверить пинг до сервера
 */
export async function checkPing(ip) {
  try {
    const { stdout } = await execAsync(`ping -c 2 -W 2 ${ip}`, { timeout: 10000 });
    const latencyMatch = stdout.match(/rtt min\/avg\/max\/mdev = [\d.]+\/([\d.]+)\//);
    const lossMatch = stdout.match(/(\d+)% packet loss/);
    return {
      reachable: !lossMatch || parseInt(lossMatch[1]) < 100,
      latency_ms: latencyMatch ? Math.round(parseFloat(latencyMatch[1])) : null,
      packet_loss: lossMatch ? `${lossMatch[1]}%` : '0%',
    };
  } catch {
    return { reachable: false, latency_ms: null, packet_loss: '100%' };
  }
}

/**
 * Проверить один TCP-порт через net.Socket
 */
export function checkPort(ip, port, timeout = 3000) {
  return new Promise((resolve) => {
    const start = Date.now();
    const socket = new net.Socket();
    socket.setTimeout(timeout);

    socket.on('connect', () => {
      const time = Date.now() - start;
      socket.destroy();
      resolve({ open: true, time_ms: time });
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve({ open: false, time_ms: null });
    });

    socket.on('error', () => {
      socket.destroy();
      resolve({ open: false, time_ms: null });
    });

    socket.connect(port, ip);
  });
}

/**
 * Проверить несколько портов параллельно
 */
export async function checkPorts(ip, ports = VPN_PORTS) {
  const results = {};
  const checks = ports.map(async ({ port, name }) => {
    const result = await checkPort(ip, port);
    results[port] = { ...result, name };
  });
  await Promise.allSettled(checks);
  return results;
}

/**
 * Проверить SNI-фильтрацию через openssl
 */
export async function checkSNI(ip, sni) {
  try {
    const { stdout, stderr } = await execAsync(
      `timeout 5 openssl s_client -connect ${ip}:443 -servername ${sni} -tlsextdebug 2>&1`,
      { timeout: 8000 }
    );
    const output = stdout + stderr;
    if (output.includes('BEGIN CERTIFICATE')) {
      const certMatch = output.match(/issuer=([^\n]+)/);
      return { pass: true, cert: certMatch ? certMatch[1].trim() : 'OK' };
    }
    if (output.includes('Connection reset')) {
      return { pass: false, cert: null, error: 'RST — SNI заблокирован' };
    }
    return { pass: false, cert: null, error: 'Нет ответа' };
  } catch {
    return { pass: false, cert: null, error: 'Таймаут' };
  }
}

/**
 * Проверить несколько SNI параллельно
 */
export async function checkSNIList(ip, sniList = SNI_TESTS) {
  const results = {};
  const checks = sniList.map(async ({ sni, name }) => {
    const result = await checkSNI(ip, sni);
    results[sni] = { ...result, name };
  });
  await Promise.allSettled(checks);
  return results;
}

/**
 * Проверить DNS — системный и DoH
 */
export async function checkDNS(domain = 'ya.ru') {
  const results = { system: null, doh_1111: null, spoofing: false };

  try {
    const { stdout } = await execAsync(`dig +short ${domain}`, { timeout: 5000 });
    const ip = stdout.trim().split('\n')[0];
    results.system = { ip, ok: /^\d+\.\d+\.\d+\.\d+$/.test(ip) };
  } catch {
    results.system = { ip: null, ok: false };
  }

  try {
    const { stdout } = await execAsync(`dig +short ${domain} @1.1.1.1`, { timeout: 5000 });
    const ip = stdout.trim().split('\n')[0];
    results.doh_1111 = { ip, ok: /^\d+\.\d+\.\d+\.\d+$/.test(ip) };
  } catch {
    results.doh_1111 = { ip: null, ok: false };
  }

  if (results.system?.ok && results.doh_1111?.ok) {
    results.spoofing = results.system.ip !== results.doh_1111.ip;
  }

  return results;
}

/**
 * Определить режим ТСПУ (allowlist / blocklist / none)
 */
export async function detectTSPUMode() {
  const testIp = '173.194.222.113'; // Google

  const [pingResult, portResult] = await Promise.all([
    checkPing(testIp),
    checkPort(testIp, 443),
  ]);

  const icmpOk = pingResult.reachable;
  const tcpOk = portResult.open;

  if (icmpOk && !tcpOk) return 'allowlist';
  if (!icmpOk && !tcpOk) return 'blocklist';
  if (icmpOk && tcpOk) return 'none';
  return 'unknown';
}

/**
 * Полная диагностика сервера
 */
export async function fullCheck(ip) {
  const [ping, ports, sni, dns, tspuMode] = await Promise.allSettled([
    checkPing(ip),
    checkPorts(ip),
    checkSNIList(ip),
    checkDNS(),
    detectTSPUMode(),
  ]);

  return {
    success: true,
    ip,
    timestamp: new Date().toISOString(),
    ping: ping.status === 'fulfilled' ? ping.value : { reachable: false },
    ports: ports.status === 'fulfilled' ? ports.value : {},
    sni: sni.status === 'fulfilled' ? sni.value : {},
    dns: dns.status === 'fulfilled' ? dns.value : {},
    tspu_mode: tspuMode.status === 'fulfilled' ? tspuMode.value : 'unknown',
  };
}
