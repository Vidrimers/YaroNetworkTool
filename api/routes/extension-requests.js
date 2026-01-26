/**
 * API Routes для запросов на продление подписки
 */

import express from 'express';
import ExtensionRequestModel from '../../database/models/extension-request.js';
import ClientModel from '../../database/models/client.js';

const router = express.Router();
const DB_PATH = process.env.DB_PATH || './database/vpn.db';
const extensionRequestModel = new ExtensionRequestModel(DB_PATH);
const clientModel = new ClientModel(DB_PATH);

/**
 * POST /extension-requests/create - Создать запрос на продление
 */
router.post('/create', async (req, res, next) => {
  try {
    const { client_uuid, telegram_id, requested_months } = req.body;

    if (!client_uuid || !telegram_id || !requested_months) {
      return res.status(400).json({
        success: false,
        error: 'client_uuid, telegram_id, and requested_months are required'
      });
    }

    if (requested_months < 1 || requested_months > 12) {
      return res.status(400).json({
        success: false,
        error: 'requested_months must be between 1 and 12'
      });
    }

    // Проверяем существование клиента
    const client = await clientModel.getByUuid(client_uuid);
    if (!client) {
      return res.status(404).json({
        success: false,
        error: 'Client not found'
      });
    }

    // Проверяем, нет ли уже активного запроса
    const existingRequests = await extensionRequestModel.getAll({
      client_uuid,
      status: 'pending'
    });

    if (existingRequests.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Client already has a pending request',
        existing_request: existingRequests[0]
      });
    }

    const request = await extensionRequestModel.create({
      client_uuid,
      telegram_id,
      requested_months
    });

    res.status(201).json({
      success: true,
      message: 'Extension request created successfully',
      request
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /extension-requests - Получить все запросы
 */
router.get('/', async (req, res, next) => {
  try {
    const { status, client_uuid, telegram_id } = req.query;
    const filters = {};

    if (status) filters.status = status;
    if (client_uuid) filters.client_uuid = client_uuid;
    if (telegram_id) filters.telegram_id = parseInt(telegram_id);

    const requests = await extensionRequestModel.getAll(filters);

    // Добавляем информацию о клиентах
    const enrichedRequests = await Promise.all(
      requests.map(async (request) => {
        const client = await clientModel.getByUuid(request.client_uuid);
        return {
          ...request,
          client_name: client?.name || 'Unknown',
          client_email: client?.email
        };
      })
    );

    res.json({
      success: true,
      count: enrichedRequests.length,
      requests: enrichedRequests
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /extension-requests/:id - Получить детали запроса
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const request = await extensionRequestModel.getById(id);

    if (!request) {
      return res.status(404).json({
        success: false,
        error: 'Request not found'
      });
    }

    // Добавляем информацию о клиенте
    const client = await clientModel.getByUuid(request.client_uuid);

    res.json({
      success: true,
      request: {
        ...request,
        client_name: client?.name || 'Unknown',
        client_email: client?.email
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /extension-requests/:id/approve - Одобрить запрос
 */
router.post('/:id/approve', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { admin_telegram_id, approved_days } = req.body;

    if (!admin_telegram_id) {
      return res.status(400).json({
        success: false,
        error: 'admin_telegram_id is required'
      });
    }

    const request = await extensionRequestModel.approve(id, admin_telegram_id, approved_days);

    // Продлеваем подписку клиента
    const days = request.approved_days || request.requested_days;
    await clientModel.extendSubscription(request.client_uuid, days);

    res.json({
      success: true,
      message: 'Request approved and subscription extended',
      request
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /extension-requests/:id/deny - Отклонить запрос
 */
router.post('/:id/deny', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { admin_telegram_id, reason } = req.body;

    if (!admin_telegram_id) {
      return res.status(400).json({
        success: false,
        error: 'admin_telegram_id is required'
      });
    }

    const request = await extensionRequestModel.deny(id, admin_telegram_id, reason);

    res.json({
      success: true,
      message: 'Request denied',
      request
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /extension-requests/:id/period - Изменить период запроса
 */
router.put('/:id/period', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { days } = req.body;

    if (!days || days <= 0) {
      return res.status(400).json({
        success: false,
        error: 'days must be a positive number'
      });
    }

    const request = await extensionRequestModel.changePeriod(id, days);

    res.json({
      success: true,
      message: 'Request period updated',
      request
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /extension-requests/client/:uuid - Получить запросы клиента
 */
router.get('/client/:uuid', async (req, res, next) => {
  try {
    const { uuid } = req.params;
    const requests = await extensionRequestModel.getByClientUuid(uuid);

    res.json({
      success: true,
      count: requests.length,
      requests
    });
  } catch (error) {
    next(error);
  }
});

export default router;
