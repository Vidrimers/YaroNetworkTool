/**
 * TSPU Diagnostics API Route
 * POST /api/tspu/check — диагностика блокировок ТСПУ
 */

import express from 'express';
import { fullCheck } from '../utils/tspu-checker.js';

const router = express.Router();

const DEFAULT_IP = process.env.SERVER_IP || '89.124.70.156';

/**
 * POST /api/tspu/check
 * Body: { ip?: string }
 * Returns: полная диагностика сервера
 */
router.post('/check', async (req, res, next) => {
  try {
    const ip = req.body?.ip || DEFAULT_IP;

    // Валидация IP
    if (!/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid IP address format',
      });
    }

    const result = await fullCheck(ip);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/tspu/check
 * Query: ?ip=...
 * То же самое, но через GET для удобства
 */
router.get('/check', async (req, res, next) => {
  try {
    const ip = req.query.ip || DEFAULT_IP;

    if (!/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid IP address format',
      });
    }

    const result = await fullCheck(ip);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
