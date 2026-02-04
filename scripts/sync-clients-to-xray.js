#!/usr/bin/env node
/**
 * Скрипт синхронизации клиентов из БД в Xray конфиг
 * Добавляет всех активных клиентов во все inbound'ы
 */

import dotenv from 'dotenv';
import ClientModel from '../database/models/client.js';
import XrayConfigManager from '../api/utils/xray-config.js';

dotenv.config();

const DB_PATH = process.env.DB_PATH || './database/vpn.db';

async function syncClients() {
  console.log('🔄 Начинаем синхронизацию клиентов...\n');
  
  const clientModel = new ClientModel(DB_PATH);
  const xrayConfig = new XrayConfigManager();
  
  try {
    // Получаем всех клиентов из БД
    const clients = await clientModel.getAll();
    console.log(`📊 Найдено клиентов в БД: ${clients.length}\n`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const client of clients) {
      try {
        console.log(`➕ Добавляем клиента: ${client.name} (${client.uuid})`);
        await xrayConfig.addClient(client.uuid, client.name);
        successCount++;
        console.log(`   ✅ Успешно\n`);
      } catch (error) {
        errorCount++;
        console.error(`   ❌ Ошибка: ${error.message}\n`);
      }
    }
    
    console.log('📈 Результаты синхронизации:');
    console.log(`   ✅ Успешно: ${successCount}`);
    console.log(`   ❌ Ошибок: ${errorCount}`);
    console.log(`   📊 Всего: ${clients.length}\n`);
    
    if (errorCount === 0) {
      console.log('🎉 Синхронизация завершена успешно!');
    } else {
      console.log('⚠️  Синхронизация завершена с ошибками');
    }
    
  } catch (error) {
    console.error('❌ Критическая ошибка:', error);
    process.exit(1);
  } finally {
    await clientModel.close();
  }
}

syncClients();
