import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';

const XRAY_CONFIG_PATH = process.env.XRAY_CONFIG_PATH || '/usr/local/etc/xray/config.json';
const XRAY_BACKUP_DIR = process.env.XRAY_BACKUP_DIR || '/opt/xray-vpn-backup';

class XrayConfigManager {
  
  readConfig() {
    try {
      const configData = readFileSync(XRAY_CONFIG_PATH, 'utf-8');
      return JSON.parse(configData);
    } catch (error) {
      throw new Error(`Failed to read X-Ray config: ${error.message}`);
    }
  }

  writeConfig(config) {
    try {
      const configJson = JSON.stringify(config, null, 2);
      writeFileSync(XRAY_CONFIG_PATH, configJson, 'utf-8');
    } catch (error) {
      throw new Error(`Failed to write X-Ray config: ${error.message}`);
    }
  }

  createBackup() {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = `${XRAY_BACKUP_DIR}/config.json.backup.${timestamp}`;
      execSync(`mkdir -p ${XRAY_BACKUP_DIR}`);
      execSync(`cp ${XRAY_CONFIG_PATH} ${backupPath}`);
      return backupPath;
    } catch (error) {
      console.error('Failed to create backup:', error.message);
      return null;
    }
  }

  validateConfig() {
    try {
      execSync(`/usr/local/bin/xray run -test -config ${XRAY_CONFIG_PATH}`, { stdio: 'pipe' });
      return true;
    } catch (error) {
      return false;
    }
  }

  restartXray() {
    try {
      execSync('systemctl restart xray', { stdio: 'pipe' });
      return true;
    } catch (error) {
      console.error('Failed to restart X-Ray:', error.message);
      return false;
    }
  }

  addClient(uuid, email = '') {
    const backupPath = this.createBackup();
    
    try {
      const config = this.readConfig();
      
      if (!config.inbounds || config.inbounds.length === 0) {
        throw new Error('No inbounds found in X-Ray config');
      }

      // Добавляем клиента во все inbound'ы
      for (let i = 0; i < config.inbounds.length; i++) {
        const inbound = config.inbounds[i];
        const protocol = inbound.protocol;
        
        if (!inbound.settings) {
          inbound.settings = {};
        }
        
        if (!inbound.settings.clients) {
          inbound.settings.clients = [];
        }
        
        const clients = inbound.settings.clients;
        
        // Проверяем, существует ли клиент
        const existingClient = clients.find(c => {
          if (protocol === 'trojan') {
            return c.password === uuid;
          } else {
            return c.id === uuid;
          }
        });
        
        if (existingClient) {
          console.log(`Client ${uuid} already exists in inbound ${i} (${protocol})`);
          continue;
        }
        
        // Добавляем клиента в зависимости от протокола
        if (protocol === 'vless') {
          // Проверяем, нужен ли flow для Vision (порт 8446)
          const isVision = inbound.port === 8446;
          clients.push({
            id: uuid,
            flow: isVision ? 'xtls-rprx-vision' : '',
            email: email || uuid.substring(0, 8)
          });
        } else if (protocol === 'trojan') {
          clients.push({
            password: uuid,
            email: email || uuid.substring(0, 8)
          });
        } else if (protocol === 'shadowsocks') {
          // SS2022 использует один пароль для всех, не добавляем клиентов
          console.log(`Skipping shadowsocks inbound (uses shared password)`);
          continue;
        }
        
        config.inbounds[i].settings.clients = clients;
      }
      
      this.writeConfig(config);
      
      if (!this.validateConfig()) {
        if (backupPath) {
          execSync(`cp ${backupPath} ${XRAY_CONFIG_PATH}`);
        }
        throw new Error('Invalid X-Ray config after adding client');
      }

      this.restartXray();
      
      console.log(`Client ${uuid} added to all inbounds`);
      return true;
      
    } catch (error) {
      if (backupPath) {
        execSync(`cp ${backupPath} ${XRAY_CONFIG_PATH}`);
      }
      throw error;
    }
  }

  removeClient(uuid) {
    const backupPath = this.createBackup();
    
    try {
      const config = this.readConfig();
      
      if (!config.inbounds || config.inbounds.length === 0) {
        throw new Error('No inbounds found in X-Ray config');
      }

      let removed = false;

      // Удаляем клиента из всех inbound'ов
      for (let i = 0; i < config.inbounds.length; i++) {
        const inbound = config.inbounds[i];
        const protocol = inbound.protocol;
        
        if (!inbound.settings || !inbound.settings.clients) {
          continue;
        }
        
        const clients = inbound.settings.clients;
        const filteredClients = clients.filter(c => {
          if (protocol === 'trojan') {
            return c.password !== uuid;
          } else {
            return c.id !== uuid;
          }
        });
        
        if (clients.length !== filteredClients.length) {
          removed = true;
          config.inbounds[i].settings.clients = filteredClients;
          console.log(`Client ${uuid} removed from inbound ${i} (${protocol})`);
        }
      }
      
      if (!removed) {
        console.log(`Client ${uuid} not found in any inbound`);
        return true;
      }
      
      this.writeConfig(config);
      
      if (!this.validateConfig()) {
        if (backupPath) {
          execSync(`cp ${backupPath} ${XRAY_CONFIG_PATH}`);
        }
        throw new Error('Invalid X-Ray config after removing client');
      }

      this.restartXray();
      
      console.log(`Client ${uuid} removed from all inbounds`);
      return true;
      
    } catch (error) {
      if (backupPath) {
        execSync(`cp ${backupPath} ${XRAY_CONFIG_PATH}`);
      }
      throw error;
    }
  }

  listClients() {
    try {
      const config = this.readConfig();
      
      if (!config.inbounds || config.inbounds.length === 0) {
        return [];
      }

      // Собираем уникальных клиентов из всех inbound'ов
      const clientsMap = new Map();
      
      for (const inbound of config.inbounds) {
        if (!inbound.settings || !inbound.settings.clients) {
          continue;
        }
        
        const protocol = inbound.protocol;
        
        for (const client of inbound.settings.clients) {
          const uuid = protocol === 'trojan' ? client.password : client.id;
          
          if (!clientsMap.has(uuid)) {
            clientsMap.set(uuid, {
              uuid: uuid,
              email: client.email || '',
              protocols: []
            });
          }
          
          clientsMap.get(uuid).protocols.push({
            protocol: protocol,
            port: inbound.port,
            flow: client.flow || ''
          });
        }
      }
      
      return Array.from(clientsMap.values());
    } catch (error) {
      throw new Error(`Failed to list clients: ${error.message}`);
    }
  }
}

export default XrayConfigManager;
