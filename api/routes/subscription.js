/**
 * API Routes для подписки
 */

import express from 'express';
import ClientModel from '../../database/models/client.js';
import { generateSubscription, generateSingboxConfig, subscriptionToBase64 } from '../utils/subscription-generator.js';

const router = express.Router();
const DB_PATH = process.env.DB_PATH || './database/vpn.db';
const clientModel = new ClientModel(DB_PATH);

// Клиенты которые поддерживают sing-box JSON с группами
const SINGBOX_CLIENTS = /sing-box|clash|hiddify|throne|nekobox|v2rayng|streisand|fool|shadowrocket|stash/i;

/**
 * GET /subscription/:uuid - Получить подписку клиента
 * Авто-определение формата по User-Agent:
 * - sing-box/Hiddify/Throne/Clash → JSON с группой "Авто"
 * - Остальные → plain text (base64)
 */
router.get('/:uuid', async (req, res, next) => {
  try {
    const { uuid } = req.params;
    const { format } = req.query;
    const userAgent = req.get('User-Agent') || '';
    
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

    const subscriptionParams = {
      uuid: client.uuid,
      serverIp: SERVER_IP,
      publicKey: XRAY_PUBLIC_KEY,
      shortId: XRAY_SHORT_ID,
      sni: XRAY_SNI,
      ss2022Password: SS2022_PASSWORD,
      clientName: client.name
    };

    // Определяем формат: явный параметр > User-Agent > plain text
    const wantsSingbox = format === 'singbox' || (!format && SINGBOX_CLIENTS.test(userAgent));

    if (wantsSingbox) {
      // Sing-box JSON с группой "Авто" (url-test)
      const singboxConfig = generateSingboxConfig(subscriptionParams);
      res.set('Content-Type', 'application/json');
      res.set('Profile-Update-Interval', '6');
      res.set('Subscription-Userinfo', `upload=0; download=0; total=0; expire=0`);
      return res.json(singboxConfig);
    }

    if (format === 'json') {
      const subscription = generateSubscription(subscriptionParams);
      return res.json({
        success: true,
        subscription: subscription
      });
    }

    // По умолчанию — Base64 plain text
    const subscription = generateSubscription(subscriptionParams);
    const base64 = subscriptionToBase64(subscription);
    res.set('Content-Type', 'text/plain');
    res.set('Profile-Update-Interval', '6');
    res.set('Subscription-Userinfo', `upload=0; download=0; total=0; expire=0`);
    res.send(base64);
    
  } catch (error) {
    next(error);
  }
});

export default router;
