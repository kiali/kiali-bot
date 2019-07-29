import { Application } from 'probot';
import { ConfigManager } from './ConfigManager';

let probotApp: Application | null = null;
let configManager: ConfigManager | null = null;

export function setProbotApp(app: Application): void {
  probotApp = app;
}

export function setConfigManager(configMgr: ConfigManager): void {
  configManager = configMgr;
}

export function getProbotApp(): Application {
  if (!probotApp) {
    throw new Error('Probot app is unset');
  }
  return probotApp;
}

export function getConfigManager(): ConfigManager {
  if (!configManager) {
    throw new Error('ConfigManager is unset');
  }
  return configManager;
}
