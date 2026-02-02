/**
 * Модель TrafficLog - логирование и статистика трафика
 */

import sqlite3 from 'sqlite3';
import { promisify } from 'util';

class TrafficLogModel {
  constructor(dbPath) {
    this.db = new sqlite3.Database(dbPath);
    this.db.run = promisify(this.db.run.bind(this.db));
    this.db.get = promisify(this.db.get.bind(this.db));
    this.db.all = promisify(this.db.all.bind(this.db));
  }

  /**
   * Добавить почасовую запись трафика (без UNIQUE constraint)
   */
  async addHourly(logData) {
    const {
      client_uuid,
      bytes_uploaded = 0,
      bytes_downloaded = 0,
      bytes_total = 0,
      connections_count = 1
    } = logData;

    const result = await this.db.run(
      `INSERT INTO traffic_logs (
        client_uuid,
        bytes_uploaded, bytes_downloaded, bytes_total,
        connections_count
      ) VALUES (?, ?, ?, ?, ?)`,
      [client_uuid, bytes_uploaded, bytes_downloaded, bytes_total, connections_count]
    );

    return this.db.get('SELECT * FROM traffic_logs WHERE id = ?', [result.lastID]);
  }

  /**
   * Получить последнюю запись для клиента
   */
  async getLastRecord(client_uuid) {
    return this.db.get(
      'SELECT * FROM traffic_logs WHERE client_uuid = ? ORDER BY created_at DESC LIMIT 1',
      [client_uuid]
    );
  }

  /**
   * Добавить запись трафика
   */
  async add(logData) {
    const {
      client_uuid,
      date = new Date().toISOString().split('T')[0], // YYYY-MM-DD
      bytes_uploaded = 0,
      bytes_downloaded = 0,
      connections_count = 1
    } = logData;

    const bytes_total = bytes_uploaded + bytes_downloaded;

    // Проверяем, есть ли уже запись за этот день
    const existing = await this.db.get(
      'SELECT * FROM traffic_logs WHERE client_uuid = ? AND date = ?',
      [client_uuid, date]
    );

    if (existing) {
      // Обновляем существующую запись
      await this.db.run(
        `UPDATE traffic_logs 
         SET bytes_uploaded = bytes_uploaded + ?,
             bytes_downloaded = bytes_downloaded + ?,
             bytes_total = bytes_total + ?,
             connections_count = connections_count + ?
         WHERE client_uuid = ? AND date = ?`,
        [bytes_uploaded, bytes_downloaded, bytes_total, connections_count, client_uuid, date]
      );
    } else {
      // Создаем новую запись
      await this.db.run(
        `INSERT INTO traffic_logs (
          client_uuid, date,
          bytes_uploaded, bytes_downloaded, bytes_total,
          connections_count
        ) VALUES (?, ?, ?, ?, ?, ?)`,
        [client_uuid, date, bytes_uploaded, bytes_downloaded, bytes_total, connections_count]
      );
    }

    return this.getByClientAndDate(client_uuid, date);
  }

  /**
   * Получить запись по клиенту и дате
   */
  async getByClientAndDate(client_uuid, date) {
    return this.db.get(
      'SELECT * FROM traffic_logs WHERE client_uuid = ? AND date = ?',
      [client_uuid, date]
    );
  }

  /**
   * Получить логи клиента
   */
  async getByClient(client_uuid, options = {}) {
    const { startDate, endDate, limit = 100 } = options;

    let query = 'SELECT * FROM traffic_logs WHERE client_uuid = ?';
    const params = [client_uuid];

    if (startDate) {
      query += ' AND created_at >= ?';
      params.push(startDate);
    }

    if (endDate) {
      query += ' AND created_at <= ?';
      params.push(endDate);
    }

    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);

    return this.db.all(query, params);
  }

  /**
   * Получить статистику клиента за период
   */
  async getClientStats(client_uuid, options = {}) {
    const { startDate, endDate } = options;

    let query = `
      SELECT 
        client_uuid,
        COUNT(*) as records_count,
        SUM(bytes_uploaded) as total_uploaded,
        SUM(bytes_downloaded) as total_downloaded,
        SUM(bytes_total) as total_bytes,
        SUM(connections_count) as total_connections
      FROM traffic_logs 
      WHERE client_uuid = ?
    `;
    const params = [client_uuid];

    if (startDate) {
      query += ' AND created_at >= ?';
      params.push(startDate);
    }

    if (endDate) {
      query += ' AND created_at <= ?';
      params.push(endDate);
    }

    const stats = await this.db.get(query, params);

    // Конвертируем в GB
    if (stats) {
      stats.total_uploaded_gb = (stats.total_uploaded / (1024 ** 3)).toFixed(2);
      stats.total_downloaded_gb = (stats.total_downloaded / (1024 ** 3)).toFixed(2);
      stats.total_gb = (stats.total_bytes / (1024 ** 3)).toFixed(2);
    }

    return stats;
  }

  /**
   * Получить топ клиентов по трафику
   */
  async getTopClients(options = {}) {
    const { startDate, endDate, limit = 10 } = options;

    let query = `
      SELECT 
        client_uuid,
        SUM(bytes_total) as total_bytes,
        SUM(connections_count) as total_connections
      FROM traffic_logs 
      WHERE 1=1
    `;
    const params = [];

    if (startDate) {
      query += ' AND created_at >= ?';
      params.push(startDate);
    }

    if (endDate) {
      query += ' AND created_at <= ?';
      params.push(endDate);
    }

    query += ' GROUP BY client_uuid ORDER BY total_bytes DESC LIMIT ?';
    params.push(limit);

    const results = await this.db.all(query, params);

    // Конвертируем в GB
    return results.map(row => ({
      ...row,
      total_gb: (row.total_bytes / (1024 ** 3)).toFixed(2)
    }));
  }

  /**
   * Получить дневную статистику
   */
  async getDailyStats(date) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const query = `
      SELECT 
        COUNT(DISTINCT client_uuid) as active_clients,
        SUM(bytes_total) as total_bytes,
        SUM(connections_count) as total_connections
      FROM traffic_logs 
      WHERE created_at >= ? AND created_at <= ?
    `;

    const stats = await this.db.get(query, [startOfDay.toISOString(), endOfDay.toISOString()]);

    if (stats) {
      stats.total_gb = (stats.total_bytes / (1024 ** 3)).toFixed(2);
    }

    return stats;
  }

  /**
   * Удалить старые логи
   */
  async deleteOld(daysToKeep = 90) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await this.db.run(
      'DELETE FROM traffic_logs WHERE created_at < ?',
      [cutoffDate.toISOString()]
    );

    return result.changes;
  }

  /**
   * Закрыть соединение с БД
   */
  close() {
    return new Promise((resolve) => this.db.close(resolve));
  }
}

export default TrafficLogModel;
