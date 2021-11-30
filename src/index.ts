import { Probot } from 'probot';
import MilestoneSetter from './behaviors/MilestoneSetter';
import VersionBumpMerger from './behaviors/VersionBumpMerger';
import { ConfigManager } from './ConfigManager';
import { setConfigManager, setProbotApp } from './globals';

export = (app: Probot): void => {
  setProbotApp(app);
  setConfigManager(new ConfigManager(app));

  const behaviors = [MilestoneSetter, VersionBumpMerger];

  behaviors.forEach((Behavior): void => {
    new Behavior(app);
  });
};
