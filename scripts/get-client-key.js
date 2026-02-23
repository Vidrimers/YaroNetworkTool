#!/usr/bin/env node
/**
 * Скрипт для извлечения ключа (подписки) конкретного пользователя
 * 
 * Использование:
 *   node scripts/get-client-key.js <uuid>
 *   node scripts/get-client-key.js --telegram-id <telegram_id>
 *   node scripts/get-client-key.js --name <имя>
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';
import ClientModel from '../database/models/client.js';
import { generateSubscription, subscriptionToBase64 } from '../api/utils/subscription-generator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Загрузка переменных окружения
dotenv.config({ path: join(__dirname, '..', '.env') });

const DB_PATH = process.env.DB_PATH || './database/vpn.db';

// Параметры сервера из .env
const SERVER_IP = process.env.SERVER_IP || '89.124.70.156';
const PUBLIC_KEY = process.env.REALITY_PUBLIC_KEY || '';
const SHORT_ID = process.env.REALITY_SHORT_ID || '';
const SNI = process.env.REALITY_SNI || 'www.microsoft.com';
const SS2022_PASSWORD = process.env.SS2022_PASSWORD || '';

/**
 * Главная функция
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('❌ Ошибка: не указаны параметры поиска');
    printUsage();
    process.exit(1);
  }

  const clientModel = new ClientModel(DB_PATH);
  let client = null;

  try {
    // Поиск по UUID
    if (args[0] && !args[0].startsWith('--')) {
      const uuid = args[0];
      client = await clientModel.getByUuid(uuid);
      
      if (!client) {
        console.error(`❌ Клиент с UUID "${uuid}" не найден`);
        process.exit(1);
      }
    }
    // Поиск по Telegram ID
    else if (args[0] === '--telegram-id' || args[0] === '-t') {
      const telegramId = parseInt(args[1]);
      
      if (!telegramId) {
        console.error('❌ Ошибка: не указан Telegram ID');
        process.exit(1);
      }
      
      client = await clientModel.getByTelegramId(telegramId);
      
      if (!client) {
        console.error(`❌ Клиент с Telegram ID "${telegramId}" не найден`);
        process.exit(1);
      }
    }
    // Поиск по имени
    else if (args[0] === '--name' || args[0] === '-n') {
      const name = args.slice(1).join(' ');
      
      if (!name) {
        console.error('❌ Ошибка: не указано имя');
        process.exit(1);
      }
      
      const clients = await clientModel.getAll();
      client = clients.find(c => c.name.toLowerCase().includes(name.toLowerCase()));
      
      if (!client) {
        console.error(`❌ Клиент с именем "${name}" не найден`);
        process.exit(1);
      }
    }
    else {
      console.error('❌ Неизвестный параметр');
      printUsage();
      process.exit(1);
    }

    // Вывод информации о клиенте
    console.log('\n╔════════════════════════════════════════════════════════╗');
    console.log('║              ИНФОРМАЦИЯ О КЛИЕНТЕ                      ║');
    console.log('╚════════════════════════════════════════════════════════╝\n');
    
    console.log(`👤 Имя: ${client.name}`);
    console.log(`🔑 UUID: ${client.uuid}`);
    
    if (client.telegram_id) {
      console.log(`💬 Telegram ID: ${client.telegram_id}`);
    }
    
    if (client.email) {
      console.log(`📧 Email: ${client.email}`);
    }
    
    console.log(`📊 Статус: ${getStatusEmoji(client.status)} ${client.status}`);
    console.log(`📅 Подписка до: ${new Date(client.subscription_end).toLocaleString('ru-RU')}`);
    console.log(`📈 Трафик: ${client.traffic_used_gb.toFixed(2)} / ${client.traffic_limit_gb} GB`);
    
    // Генерация подписки
    console.log('\n╔════════════════════════════════════════════════════════╗');
    console.log('║                   ПОДПИСКА                             ║');
    console.log('╚════════════════════════════════════════════════════════╝\n');
    
    const subscription = generateSubscription({
      uuid: client.uuid,
      serverIp: SERVER_IP,
      publicKey: PUBLIC_KEY,
      shortId: SHORT_ID,
      sni: SNI,
      ss2022Password: SS2022_PASSWORD,
      clientName: client.name,
      includeRussianProxy: true
    });
    
    // Base64 подписка
    const base64Subscription = subscriptionToBase64(subscription);
    
    console.log('📋 Base64 подписка (для импорта в клиент):');
    console.log('─'.repeat(60));
    console.log(base64Subscription);
    console.log('─'.repeat(60));
    
    // Отдельные ссылки
    console.log('\n🔗 Отдельные ссылки:');
    console.log('─'.repeat(60));
    subscription.nodes.forEach((link, index) => {
      const linkName = decodeURIComponent(link.split('#')[1] || `Link ${index + 1}`);
      console.log(`\n${index + 1}. ${linkName}`);
      console.log(link);
    });
    console.log('─'.repeat(60));
    
    // URL подписки
    const subscriptionUrl = `${process.env.API_URL || 'http://localhost:3000'}/subscription/${client.uuid}`;
    console.log('\n🌐 URL подписки (для автообновления):');
    console.log('─'.repeat(60));
    console.log(subscriptionUrl);
    console.log('─'.repeat(60));
    
    console.log('\n✅ Готово!\n');

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    process.exit(1);
  } finally {
    await clientModel.close();
  }
}

/**
 * Вывод справки
 */
function printUsage() {
  console.log('\n📖 Использование:');
  console.log('  node scripts/get-client-key.js <uuid>');
  console.log('  node scripts/get-client-key.js --telegram-id <telegram_id>');
  console.log('  node scripts/get-client-key.js --name <имя>');
  console.log('\n📝 Примеры:');
  console.log('  node scripts/get-client-key.js 12345678-1234-1234-1234-123456789abc');
  console.log('  node scripts/get-client-key.js -t 123456789');
  console.log('  node scripts/get-client-key.js -n "Иван Иванов"');
  console.log('');
}

/**
 * Получить эмодзи для статуса
 */
function getStatusEmoji(status) {
  const emojis = {
    'active': '✅',
    'blocked': '🚫',
    'expired': '⏰'
  };
  return emojis[status] || '❓';
}

// Запуск
main();
