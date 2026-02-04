/**
 * API Routes для подписки
 */

import express from 'express';
import ClientModel from '../../database/models/client.js';
import { generateSubscription, subscriptionToBase64 } from '../utils/subscription-generator.js';

const router = express.Router();
const DB_PATH = process.env.DB_PATH || './database/vpn.db';
const clientModel = new ClientModel(DB_PATH);

/**
 * GET /subscription/:uuid - Получить подписку клиента
 */
router.get('/:uuid', async (req, res, next) => {
  try {
    const { uuid } = req.params;
    const { format = 'base64' } = req.query;
    
    // Читаем переменные окружения внутри обработчика
    const SERVER_IP = process.env.SERVER_IP;
    const XRAY_PUBLIC_KEY = process.env.XRAY_PUBLIC_KEY;
    const XRAY_SHORT_ID = process.env.XRAY_SHORT_ID;
    const XRAY_SNI = process.env.XRAY_SNI || 'www.microsoft.com';
    const SS2022_PASSWORD = process.env.SS2022_PASSWORD;
    
    const client = await clientModel.getByUuid(uuid);
    
    if (!client) {
      return res.status(404).json({
        success: false,
        error: 'Client not found'
      });
    }
    
    if (client.status !== 'active') {
      return res.status(403).json({
        success: false,
        error: 'Client is not active'
      });
    }

    const subscription = generateSubscription({
      uuid: client.uuid,
      serverIp: SERVER_IP,
      publicKey: XRAY_PUBLIC_KEY,
      shortId: XRAY_SHORT_ID,
      sni: XRAY_SNI,
      ss2022Password: SS2022_PASSWORD,
      clientName: client.name
    });
    
    if (format === 'json') {
      return res.json({
        success: true,
        subscription: subscription
      });
    }
    
    // По умолчанию возвращаем Base64
    const base64 = subscriptionToBase64(subscription);
    res.set('Content-Type', 'text/plain');
    res.send(base64);
    
  } catch (error) {
    next(error);
  }
});

export default router;
