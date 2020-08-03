import { Application } from 'probot';
import MilestoneSetter from './behaviors/MilestoneSetter';
import ReleaseNotifier from './behaviors/ReleaseNotifier';
import VersionBumpMerger from './behaviors/VersionBumpMerger';
import { ConfigManager } from './ConfigManager';
import { setConfigManager, setProbotApp } from './globals';

export = (app: Application): void => {
  setProbotApp(app);
  setConfigManager(new ConfigManager(app));

  const behaviors = [
    MilestoneSetter,
    ReleaseNotifier,
    VersionBumpMerger,
  ];

  behaviors.forEach((Behavior): void => {
    new Behavior(app);
  });
};
