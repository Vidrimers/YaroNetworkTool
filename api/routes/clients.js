/**
 * API Routes для управления клиентами
 */

import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import ClientModel from '../../database/models/client.js';

const router = express.Router();
const DB_PATH = process.env.DB_PATH || './database/vpn.db';
const clientModel = new ClientModel(DB_PATH);

/**
 * GET /clients - Получить список всех клиентов
 */
router.get('/', async (req, res, next) => {
  try {
    const { status, telegram_id } = req.query;
    const filters = {};

    if (status) filters.status = status;
    if (telegram_id) filters.telegram_id = parseInt(telegram_id);

    const clients = await clientModel.getAll(filters);

    res.json({
      success: true,
      count: clients.length,
      clients
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /clients/:uuid - Получить детали клиента
 */
router.get('/:uuid', async (req, res, next) => {
  try {
    const { uuid } = req.params;
    const client = await clientModel.getByUuid(uuid);

    if (!client) {
      return res.status(404).json({
        success: false,
        error: 'Client not found'
      });
    }

    res.json({
      success: true,
      client
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /clients - Создать нового клиента
 */
router.post('/', async (req, res, next) => {
  try {
    const {
      name,
      telegram_id,
      email,
      subscription_days = 30,
      traffic_limit_gb = 100
    } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Name is required'
      });
    }

    const uuid = uuidv4();

    const client = await clientModel.create({
      uuid,
      name,
      telegram_id,
      email,
      subscription_days,
      traffic_limit_gb
    });

    res.status(201).json({
      success: true,
      message: 'Client created successfully',
      client
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /clients/:uuid - Обновить клиента
 */
router.put('/:uuid', async (req, res, next) => {
  try {
    const { uuid } = req.params;
    const updates = req.body;

    const client = await clientModel.update(uuid, updates);

    if (!client) {
      return res.status(404).json({
        success: false,
        error: 'Client not found'
      });
    }

    res.json({
      success: true,
      message: 'Client updated successfully',
      client
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /clients/:uuid - Удалить клиента
 */
router.delete('/:uuid', async (req, res, next) => {
  try {
    const { uuid } = req.params;
    const deleted = await clientModel.delete(uuid);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Client not found'
      });
    }

    res.json({
      success: true,
      message: 'Client deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /clients/:uuid/subscription - Получить информацию о подписке
 */
router.get('/:uuid/subscription', async (req, res, next) => {
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
    const daysRemaining = Math.max(0, Math.ceil((endDate - now) / (1000 * 60 * 60 * 24)));

    res.json({
      success: true,
      subscription: {
        uuid: client.uuid,
        subscription_days_total: client.subscription_days,
        subscription_days_remaining: daysRemaining,
        subscription_start: client.subscription_start,
        subscription_end: client.subscription_end,
        status: client.status
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /clients/:uuid/extend - Продлить подписку
 */
router.post('/:uuid/extend', async (req, res, next) => {
  try {
    const { uuid } = req.params;
    const { days } = req.body;

    if (!days || days <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Days must be a positive number'
      });
    }

    const client = await clientModel.extendSubscription(uuid, days);

    res.json({
      success: true,
      message: `Subscription extended by ${days} days`,
      client
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /clients/:uuid/block - Заблокировать клиента
 */
router.post('/:uuid/block', async (req, res, next) => {
  try {
    const { uuid } = req.params;
    const { reason } = req.body;

    const client = await clientModel.block(uuid, reason || 'Blocked by admin');

    res.json({
      success: true,
      message: 'Client blocked successfully',
      client
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /clients/:uuid/unblock - Разблокировать клиента
 */
router.post('/:uuid/unblock', async (req, res, next) => {
  try {
    const { uuid } = req.params;
    const client = await clientModel.unblock(uuid);

    res.json({
      success: true,
      message: 'Client unblocked successfully',
      client
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /clients/:uuid/warn - Выдать предупреждение клиенту
 */
router.post('/:uuid/warn', async (req, res, next) => {
  try {
    const { uuid } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({
        success: false,
        error: 'Reason is required'
      });
    }

    const result = await clientModel.addWarning(uuid, reason);

    res.json({
      success: true,
      message: 'Warning issued successfully',
      client: result.client,
      warningsCount: result.warningsCount,
      blockDuration: result.blockDuration
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /clients/:uuid/reset-warnings - Сбросить предупреждения
 */
router.post('/:uuid/reset-warnings', async (req, res, next) => {
  try {
    const { uuid } = req.params;
    const client = await clientModel.resetWarnings(uuid);

    res.json({
      success: true,
      message: 'Warnings reset successfully',
      client
    });
  } catch (error) {
    next(error);
  }
});

export default router;
