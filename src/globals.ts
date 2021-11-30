import { Probot } from 'probot';
import { ConfigManager } from './ConfigManager';

let probotApp: Probot | null = null;
let configManager: ConfigManager | null = null;

export function setProbotApp(app: Probot): void {
  probotApp = app;
}

export function setConfigManager(configMgr: ConfigManager): void {
  configManager = configMgr;
}

export function getProbotApp(): Probot {
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
