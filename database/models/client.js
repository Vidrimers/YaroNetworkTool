/**
 * Модель Client - управление VPN клиентами
 */

import sqlite3 from 'sqlite3';
import { promisify } from 'util';

class ClientModel {
  constructor(dbPath) {
    this.db = new sqlite3.Database(dbPath);
    this.db.run = promisify(this.db.run.bind(this.db));
    this.db.get = promisify(this.db.get.bind(this.db));
    this.db.all = promisify(this.db.all.bind(this.db));
  }

  /**
   * Создать нового клиента
   */
  async create(clientData) {
    const {
      uuid,
      name,
      telegram_id = null,
      email = null,
      subscription_days = 30,
      traffic_limit_gb = 200.0
    } = clientData;

    const subscription_start = new Date().toISOString();
    const subscription_end = new Date(Date.now() + subscription_days * 24 * 60 * 60 * 1000).toISOString();
    const traffic_reset_date = new Date().toISOString();

    await this.db.run(
      `INSERT INTO clients (
        uuid, name, telegram_id, email,
        subscription_days, subscription_start, subscription_end,
        traffic_limit_gb, traffic_used_gb, traffic_reset_date,
        status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuid, name, telegram_id, email,
        subscription_days, subscription_start, subscription_end,
        traffic_limit_gb, 0.0, traffic_reset_date,
        'active'
      ]
    );

    return this.getByUuid(uuid);
  }

  /**
   * Получить клиента по UUID
   */
  async getByUuid(uuid) {
    return this.db.get('SELECT * FROM clients WHERE uuid = ?', [uuid]);
  }

  /**
   * Получить клиента по Telegram ID
   */
  async getByTelegramId(telegramId) {
    return this.db.get('SELECT * FROM clients WHERE telegram_id = ?', [telegramId]);
  }

  /**
   * Получить всех клиентов
   */
  async getAll(filters = {}) {
    let query = 'SELECT * FROM clients WHERE 1=1';
    const params = [];

    if (filters.status) {
      query += ' AND status = ?';
      params.push(filters.status);
    }

    if (filters.telegram_id) {
      query += ' AND telegram_id = ?';
      params.push(filters.telegram_id);
    }

    query += ' ORDER BY created_at DESC';

    return this.db.all(query, params);
  }

  /**
   * Обновить клиента
   */
  async update(uuid, updates) {
    const allowedFields = [
      'name', 'telegram_id', 'email',
      'subscription_days', 'subscription_end',
      'traffic_limit_gb', 'traffic_used_gb',
      'status', 'blocked_reason', 'warnings_count', 'last_warning_date',
      'max_devices', 'custom_price_kaspa'
    ];

    const fields = [];
    const values = [];

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    }

    if (fields.length === 0) {
      throw new Error('No valid fields to update');
    }

    values.push(uuid);

    await this.db.run(
      `UPDATE clients SET ${fields.join(', ')} WHERE uuid = ?`,
      values
    );

    return this.getByUuid(uuid);
  }

  /**
   * Удалить клиента
   */
  async delete(uuid) {
    try {
      await this.db.run('DELETE FROM clients WHERE uuid = ?', [uuid]);
      // Проверяем, существует ли клиент после удаления
      const client = await this.getByUuid(uuid);
      return !client; // Вернет true если клиент удален (не найден)
    } catch (error) {
      console.error('Error deleting client:', error);
      return false;
    }
  }

  /**
   * Продлить подписку
   */
  async extendSubscription(uuid, days) {
    const client = await this.getByUuid(uuid);
    if (!client) {
      throw new Error('Client not found');
    }

    const currentEnd = new Date(client.subscription_end);
    const now = new Date();
    
    // Если подписка истекла, продлеваем от текущей даты
    const startDate = currentEnd > now ? currentEnd : now;
    const newEnd = new Date(startDate.getTime() + days * 24 * 60 * 60 * 1000);

    await this.update(uuid, {
      subscription_end: newEnd.toISOString(),
      subscription_days: client.subscription_days + days,
      status: 'active'
    });

    // Синхронизируем с Xray конфигом (добавляем клиента если его нет)
    try {
      const XrayConfigManager = (await import('../api/utils/xray-config.js')).default;
      const xrayConfig = new XrayConfigManager();
      await xrayConfig.addClient(uuid, client.name);
      console.log(`[extendSubscription] Клиент ${client.name} (${uuid}) синхронизирован с Xray`);
    } catch (error) {
      console.error(`[extendSubscription] Ошибка синхронизации с Xray:`, error.message);
      // Не бросаем ошибку, чтобы продление подписки в БД прошло успешно
    }

    return this.getByUuid(uuid);
  }

  /**
   * Обновить использованный трафик
   */
  async updateTraffic(uuid, bytesUsed) {
    const client = await this.getByUuid(uuid);
    if (!client) {
      throw new Error('Client not found');
    }

    const gbUsed = bytesUsed / (1024 ** 3);
    const newTotal = client.traffic_used_gb + gbUsed;

    await this.update(uuid, {
      traffic_used_gb: newTotal,
      last_connection: new Date().toISOString()
    });

    // Проверить лимит
    if (newTotal >= client.traffic_limit_gb) {
      await this.block(uuid, 'Traffic limit exceeded');
    }

    return this.getByUuid(uuid);
  }

  /**
   * Сбросить месячный счетчик трафика
   */
  async resetTraffic(uuid) {
    await this.update(uuid, {
      traffic_used_gb: 0.0,
      traffic_reset_date: new Date().toISOString()
    });

    return this.getByUuid(uuid);
  }

  /**
   * Заблокировать клиента
   */
  async block(uuid, reason) {
    await this.update(uuid, {
      status: 'blocked',
      blocked_reason: reason
    });

    return this.getByUuid(uuid);
  }

  /**
   * Разблокировать клиента
   */
  async unblock(uuid) {
    await this.update(uuid, {
      status: 'active',
      blocked_reason: null
    });

    return this.getByUuid(uuid);
  }

  /**
   * Выдать предупреждение клиенту
   */
  async addWarning(uuid, reason) {
    const client = await this.getByUuid(uuid);
    if (!client) {
      throw new Error('Client not found');
    }

    const newWarningsCount = (client.warnings_count || 0) + 1;
    const now = new Date();

    // Определяем действие в зависимости от количества предупреждений
    let blockDuration = null;
    let blockReason = null;

    if (newWarningsCount === 1) {
      // Первое предупреждение - блокировка на 24 часа
      blockDuration = 24 * 60 * 60 * 1000; // 24 часа в миллисекундах
      blockReason = `Первое предупреждение: ${reason}. Блокировка на 24 часа.`;
    } else if (newWarningsCount === 2) {
      // Второе предупреждение - блокировка на 7 дней
      blockDuration = 7 * 24 * 60 * 60 * 1000; // 7 дней
      blockReason = `Второе предупреждение: ${reason}. Блокировка на 7 дней.`;
    } else if (newWarningsCount >= 3) {
      // Третье предупреждение - постоянная блокировка
      blockReason = `Третье предупреждение: ${reason}. Постоянная блокировка.`;
    }

    await this.update(uuid, {
      warnings_count: newWarningsCount,
      last_warning_date: now.toISOString(),
      status: 'blocked',
      blocked_reason: blockReason
    });

    return {
      client: await this.getByUuid(uuid),
      warningsCount: newWarningsCount,
      blockDuration: blockDuration
    };
  }

  /**
   * Сбросить предупреждения клиента
   */
  async resetWarnings(uuid) {
    await this.update(uuid, {
      warnings_count: 0,
      last_warning_date: null
    });

    return this.getByUuid(uuid);
  }

  /**
   * Проверить истекшие подписки
   */
  async checkExpired() {
    const now = new Date().toISOString();
    
    await this.db.run(
      `UPDATE clients 
       SET status = 'expired' 
       WHERE status = 'active' 
       AND datetime(subscription_end) < datetime(?)`,
      [now]
    );

    return this.db.all(
      `SELECT * FROM clients WHERE status = 'expired' AND datetime(subscription_end) < datetime(?)`,
      [now]
    );
  }

  /**
   * Получить общий трафик за период (с даты сброса до текущего момента)
   */
  async getTotalTrafficForPeriod(uuid) {
    const client = await this.getByUuid(uuid);
    if (!client) {
      throw new Error('Client not found');
    }

    // Получаем сумму трафика из traffic_logs с даты сброса
    const result = await this.db.get(
      `SELECT 
        COALESCE(SUM(bytes_total), 0) as total_bytes
       FROM traffic_logs 
       WHERE client_uuid = ? 
       AND date >= date(?)`,
      [uuid, client.traffic_reset_date]
    );

    // Конвертируем байты в GB и добавляем текущий трафик
    const totalFromLogs = (result.total_bytes || 0) / (1024 ** 3);
    const totalTraffic = totalFromLogs + (client.traffic_used_gb || 0);

    return {
      total_gb: totalTraffic,
      current_gb: client.traffic_used_gb || 0,
      from_logs_gb: totalFromLogs,
      reset_date: client.traffic_reset_date
    };
  }

  /**
   * Получить трафик за последние N дней
   */
  async getTrafficForDays(uuid, days) {
    const client = await this.getByUuid(uuid);
    if (!client) {
      throw new Error('Client not found');
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const result = await this.db.get(
      `SELECT 
        COALESCE(SUM(bytes_total), 0) as total_bytes
       FROM traffic_logs 
       WHERE client_uuid = ? 
       AND created_at >= ?`,
      [uuid, startDate.toISOString()]
    );

    const trafficGb = (result.total_bytes || 0) / (1024 ** 3);

    return {
      days: days,
      traffic_gb: trafficGb,
      start_date: startDate.toISOString()
    };
  }

  /**
   * Получить статистику трафика (день/неделя/месяц)
   */
  async getTrafficStats(uuid) {
    const [day, week, month] = await Promise.all([
      this.getTrafficForDays(uuid, 1),
      this.getTrafficForDays(uuid, 7),
      this.getTrafficForDays(uuid, 30)
    ]);

    return {
      day: day.traffic_gb,
      week: week.traffic_gb,
      month: month.traffic_gb
    };
  }

  /**
   * Закрыть соединение с БД
   */
  close() {
    return new Promise((resolve) => this.db.close(resolve));
  }
}

export default ClientModel;
