/**
 * Модель ExtensionRequest - управление запросами на продление подписки
 */

import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import { v4 as uuidv4 } from 'uuid';

class ExtensionRequestModel {
  constructor(dbPath) {
    this.db = new sqlite3.Database(dbPath);
    this.db.run = promisify(this.db.run.bind(this.db));
    this.db.get = promisify(this.db.get.bind(this.db));
    this.db.all = promisify(this.db.all.bind(this.db));
  }

  /**
   * Создать запрос на продление
   */
  async create(requestData) {
    const {
      client_uuid,
      telegram_id,
      requested_months
    } = requestData;

    const id = uuidv4();
    const requested_days = requested_months * 30;
    const expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 дней

    await this.db.run(
      `INSERT INTO extension_requests (
        id, client_uuid, telegram_id,
        requested_months, requested_days,
        status, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, client_uuid, telegram_id, requested_months, requested_days, 'pending', expires_at]
    );

    return this.getById(id);
  }

  /**
   * Получить запрос по ID
   */
  async getById(id) {
    return this.db.get('SELECT * FROM extension_requests WHERE id = ?', [id]);
  }

  /**
   * Получить все запросы
   */
  async getAll(filters = {}) {
    let query = 'SELECT * FROM extension_requests WHERE 1=1';
    const params = [];

    if (filters.status) {
      query += ' AND status = ?';
      params.push(filters.status);
    }

    if (filters.client_uuid) {
      query += ' AND client_uuid = ?';
      params.push(filters.client_uuid);
    }

    if (filters.telegram_id) {
      query += ' AND telegram_id = ?';
      params.push(filters.telegram_id);
    }

    query += ' ORDER BY created_at DESC';

    return this.db.all(query, params);
  }

  /**
   * Получить pending запросы
   */
  async getPending() {
    return this.getAll({ status: 'pending' });
  }

  /**
   * Получить запросы клиента
   */
  async getByClientUuid(client_uuid) {
    return this.getAll({ client_uuid });
  }

  /**
   * Одобрить запрос
   */
  async approve(id, adminTelegramId, approvedDays = null) {
    const request = await this.getById(id);
    if (!request) {
      throw new Error('Request not found');
    }

    if (request.status !== 'pending') {
      throw new Error(`Request already ${request.status}`);
    }

    const days = approvedDays || request.requested_days;

    await this.db.run(
      `UPDATE extension_requests 
       SET status = 'approved',
           approved_days = ?,
           admin_telegram_id = ?,
           processed_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [days, adminTelegramId, id]
    );

    return this.getById(id);
  }

  /**
   * Отклонить запрос
   */
  async deny(id, adminTelegramId, reason = null) {
    const request = await this.getById(id);
    if (!request) {
      throw new Error('Request not found');
    }

    if (request.status !== 'pending') {
      throw new Error(`Request already ${request.status}`);
    }

    await this.db.run(
      `UPDATE extension_requests 
       SET status = 'denied',
           denial_reason = ?,
           admin_telegram_id = ?,
           processed_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [reason, adminTelegramId, id]
    );

    return this.getById(id);
  }

  /**
   * Изменить период запроса
   */
  async changePeriod(id, newDays) {
    const request = await this.getById(id);
    if (!request) {
      throw new Error('Request not found');
    }

    if (request.status !== 'pending') {
      throw new Error(`Request already ${request.status}`);
    }

    const newMonths = Math.ceil(newDays / 30);

    await this.db.run(
      `UPDATE extension_requests 
       SET requested_days = ?,
           requested_months = ?
       WHERE id = ?`,
      [newDays, newMonths, id]
    );

    return this.getById(id);
  }

  /**
   * Пометить истекшие запросы
   */
  async expireOld() {
    const now = new Date().toISOString();
    
    await this.db.run(
      `UPDATE extension_requests 
       SET status = 'expired' 
       WHERE status = 'pending' 
       AND datetime(expires_at) < datetime(?)`,
      [now]
    );

    return this.db.all(
      `SELECT * FROM extension_requests 
       WHERE status = 'expired' 
       AND datetime(expires_at) < datetime(?)`,
      [now]
    );
  }

  /**
   * Удалить запрос
   */
  async delete(id) {
    const result = await this.db.run('DELETE FROM extension_requests WHERE id = ?', [id]);
    return result.changes > 0;
  }

  /**
   * Закрыть соединение с БД
   */
  close() {
    return new Promise((resolve) => this.db.close(resolve));
  }
}

export default ExtensionRequestModel;
