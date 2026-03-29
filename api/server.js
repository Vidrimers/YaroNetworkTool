#!/usr/bin/env node
/**
 * VPN Management API Server
 * REST API для управления VPN клиентами, статистикой и запросами на продление
 */

import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Загрузка переменных окружения
dotenv.config({ path: join(__dirname, '..', '.env') });

// Конфигурация
const PORT = process.env.API_PORT || 3000;
const HOST = process.env.API_HOST || '0.0.0.0';
const ALLOW_CORS = process.env.ALLOW_CORS === 'true';
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

// Создание Express приложения
const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS
if (ALLOW_CORS) {
  app.use(cors({
    origin: CORS_ORIGIN,
    credentials: true
  }));
}

// Логирование
app.use(morgan('combined'));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API версия
app.get('/api/v1', (req, res) => {
  res.json({
    name: 'VPN Management API',
    version: '1.0.0',
    endpoints: {
      clients: '/api/clients',
      stats: '/api/stats',
      extensionRequests: '/api/extension-requests',
      system: '/api/system'
    }
  });
});

// TODO: Подключение роутов
import clientsRouter from './routes/clients.js';
import statsRouter from './routes/stats.js';
import extensionRequestsRouter from './routes/extension-requests.js';
import subscriptionRouter from './routes/subscription.js';
import { requireApiKey } from './middleware/auth.js';

// Защита всех /api/* маршрутов по API ключу
app.use('/api', requireApiKey);

app.use('/api/clients', clientsRouter);
app.use('/api/stats', statsRouter);
app.use('/api/extension-requests', extensionRequestsRouter);
app.use('/subscription', subscriptionRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Запуск сервера
app.listen(PORT, HOST, () => {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║         VPN Management API Server                      ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');
  console.log(`🚀 Server running on http://${HOST}:${PORT}`);
  console.log(`📊 Health check: http://${HOST}:${PORT}/health`);
  console.log(`📚 API docs: http://${HOST}:${PORT}/api/v1`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔒 CORS: ${ALLOW_CORS ? 'Enabled' : 'Disabled'}`);
  console.log('\n');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n🛑 SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n🛑 SIGINT received, shutting down gracefully...');
  process.exit(0);
});

export default app;
