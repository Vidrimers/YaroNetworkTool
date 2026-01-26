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
      
      if (!config.inbounds || !config.inbounds[0] || !config.inbounds[0].settings) {
        throw new Error('Invalid X-Ray config structure');
      }

      const clients = config.inbounds[0].settings.clients || [];
      
      const existingClient = clients.find(c => c.id === uuid);
      if (existingClient) {
        console.log(`Client ${uuid} already exists in X-Ray config`);
        return true;
      }

      clients.push({
        id: uuid,
        flow: '',
        email: email || uuid.substring(0, 8)
      });

      config.inbounds[0].settings.clients = clients;
      
      this.writeConfig(config);
      
      if (!this.validateConfig()) {
        if (backupPath) {
          execSync(`cp ${backupPath} ${XRAY_CONFIG_PATH}`);
        }
        throw new Error('Invalid X-Ray config after adding client');
      }

      this.restartXray();
      
      console.log(`Client ${uuid} added to X-Ray config`);
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
      
      if (!config.inbounds || !config.inbounds[0] || !config.inbounds[0].settings) {
        throw new Error('Invalid X-Ray config structure');
      }

      const clients = config.inbounds[0].settings.clients || [];
      const filteredClients = clients.filter(c => c.id !== uuid);
      
      if (clients.length === filteredClients.length) {
        console.log(`Client ${uuid} not found in X-Ray config`);
        return true;
      }

      config.inbounds[0].settings.clients = filteredClients;
      
      this.writeConfig(config);
      
      if (!this.validateConfig()) {
        if (backupPath) {
          execSync(`cp ${backupPath} ${XRAY_CONFIG_PATH}`);
        }
        throw new Error('Invalid X-Ray config after removing client');
      }

      this.restartXray();
      
      console.log(`Client ${uuid} removed from X-Ray config`);
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
      
      if (!config.inbounds || !config.inbounds[0] || !config.inbounds[0].settings) {
        return [];
      }

      return config.inbounds[0].settings.clients || [];
    } catch (error) {
      throw new Error(`Failed to list clients: ${error.message}`);
    }
  }
}

export default XrayConfigManager;
