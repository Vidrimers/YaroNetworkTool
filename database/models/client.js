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
      traffic_limit_gb = 100.0
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
      'status', 'blocked_reason'
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
    const result = await this.db.run('DELETE FROM clients WHERE uuid = ?', [uuid]);
    return result.changes > 0;
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
   * Закрыть соединение с БД
   */
  close() {
    return new Promise((resolve) => this.db.close(resolve));
  }
}

export default ClientModel;
