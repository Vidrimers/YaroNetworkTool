/**
 * API Routes для статистики и трафика
 */

import express from 'express';
import ClientModel from '../../database/models/client.js';
import TrafficLogModel from '../../database/models/traffic-log.js';

const router = express.Router();
const DB_PATH = process.env.DB_PATH || './database/vpn.db';
const clientModel = new ClientModel(DB_PATH);
const trafficLogModel = new TrafficLogModel(DB_PATH);

/**
 * GET /clients/:uuid/traffic - Получить статистику трафика клиента
 */
router.get('/clients/:uuid/traffic', async (req, res, next) => {
  try {
    const { uuid } = req.params;
    const { startDate, endDate } = req.query;

    const client = await clientModel.getByUuid(uuid);
    if (!client) {
      return res.status(404).json({
        success: false,
        error: 'Client not found'
      });
    }

    const stats = await trafficLogModel.getClientStats(uuid, { startDate, endDate });
    const dailyLogs = await trafficLogModel.getByClient(uuid, { startDate, endDate, limit: 30 });

    res.json({
      success: true,
      traffic: {
        uuid: client.uuid,
        traffic_limit_gb: client.traffic_limit_gb,
        traffic_used_gb: parseFloat(client.traffic_used_gb.toFixed(2)),
        traffic_remaining_gb: parseFloat((client.traffic_limit_gb - client.traffic_used_gb).toFixed(2)),
        reset_date: client.traffic_reset_date,
        stats,
        daily_usage: dailyLogs.map(log => ({
          date: log.date,
          gb: (log.bytes_total / (1024 ** 3)).toFixed(2),
          connections: log.connections_count
        }))
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /clients/:uuid/status - Получить статус клиента
 */
router.get('/clients/:uuid/status', async (req, res, next) => {
  try {
    const { uuid } = req.params;
    const client = await clientModel.getByUuid(uuid);

    if (!client) {
      return res.status(404).json({
        success: false,
        error: 'Client not found'
      });
    }

    const now = new Date();
    const endDate = new Date(client.subscription_end);
    const isExpired = endDate < now;
    const isOverLimit = client.traffic_used_gb >= client.traffic_limit_gb;

    res.json({
      success: true,
      status: {
        uuid: client.uuid,
        status: client.status,
        is_active: client.status === 'active' && !isExpired && !isOverLimit,
        is_expired: isExpired,
        is_over_limit: isOverLimit,
        blocked_reason: client.blocked_reason,
        last_connection: client.last_connection
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /clients/:uuid/reset - Сбросить месячный счетчик трафика
 */
router.post('/clients/:uuid/reset', async (req, res, next) => {
  try {
    const { uuid } = req.params;
    const client = await clientModel.resetTraffic(uuid);

    res.json({
      success: true,
      message: 'Traffic counter reset successfully',
      client
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /stats/active - Получить активные подключения
 */
router.get('/active', async (req, res, next) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const dailyStats = await trafficLogModel.getDailyStats(today);

    res.json({
      success: true,
      active_connections: {
        date: today,
        active_clients: dailyStats?.active_clients || 0,
        total_connections: dailyStats?.total_connections || 0,
        total_gb: dailyStats?.total_gb || '0.00'
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /stats/top - Получить топ клиентов по трафику
 */
router.get('/top', async (req, res, next) => {
  try {
    const { startDate, endDate, limit = 10 } = req.query;
    
    const topClients = await trafficLogModel.getTopClients({
      startDate,
      endDate,
      limit: parseInt(limit)
    });

    // Добавляем информацию о клиентах
    const enrichedClients = await Promise.all(
      topClients.map(async (item) => {
        const client = await clientModel.getByUuid(item.client_uuid);
        return {
          ...item,
          name: client?.name || 'Unknown',
          email: client?.email
        };
      })
    );

    res.json({
      success: true,
      top_clients: enrichedClients
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /stats/devices - Получить количество активных устройств для каждого клиента
 */
router.get('/devices', async (req, res, next) => {
  try {
    const XRAY_LOG_PATH = process.env.XRAY_LOG_PATH || '/var/log/xray/access.log';
    const ACTIVE_WINDOW_MINUTES = 5;
    
    // Получаем всех клиентов
    const clients = await clientModel.getAll();
    const nameToUuid = new Map();
    clients.forEach(c => nameToUuid.set(c.name, c.uuid));
    
    // Читаем логи X-Ray
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    
    let stdout = '';
    try {
      const result = await execAsync(`tail -n 1000 ${XRAY_LOG_PATH}`);
      stdout = result.stdout;
    } catch (err) {
      return res.json({ success: true, devices: {} });
    }
    
    const now = Date.now();
    const activeWindowMs = ACTIVE_WINDOW_MINUTES * 60 * 1000;
    const devicesByClient = new Map();
    
    // Парсим логи
    const lines = stdout.split('\n');
    for (const line of lines) {
      if (!line.includes('accepted')) continue;
      
      const nameMatch = line.match(/email:\s*(.+?)$/);
      if (!nameMatch) continue;
      
      const clientName = nameMatch[1].trim();
      const uuid = nameToUuid.get(clientName);
      if (!uuid) continue;
      
      const ipMatch = line.match(/from\s+(\d+\.\d+\.\d+\.\d+)/);
      if (!ipMatch) continue;
      
      const timeMatch = line.match(/^(\d{4}\/\d{2}\/\d{2}\s+\d{2}:\d{2}:\d{2})/);
      if (!timeMatch) continue;
      
      const timestamp = new Date(timeMatch[1].replace(/\//g, '-')).getTime();
      if (now - timestamp > activeWindowMs) continue;
      
      if (!devicesByClient.has(uuid)) {
        devicesByClient.set(uuid, new Set());
      }
      devicesByClient.get(uuid).add(ipMatch[1]);
    }
    
    // Формируем ответ
    const devices = {};
    for (const [uuid, ips] of devicesByClient) {
      devices[uuid] = { count: ips.size, ips: Array.from(ips) };
    }
    
    res.json({ success: true, devices });
  } catch (error) {
    next(error);
  }
});
  } catch (error) {
    next(error);
  }
});

export default router;
