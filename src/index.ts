import { Application } from 'probot';
import PrChecker from './behaviors/PrChecker';
import MilestoneSetter from './behaviors/MilestoneSetter';
import ReleaseNotifier from './behaviors/ReleaseNotifier';
import VersionBumpMerger from './behaviors/VersionBumpMerger';
// import JiraIssueExporter from './behaviors/JiraIssueExporter'
import {ConfigManager} from "./ConfigManager";
import {setConfigManager, setProbotApp} from './globals';

export = (app: Application): void => {
  setProbotApp(app);
  setConfigManager(new ConfigManager(app));

  // TODO: Restore
  const behaviors = [
    // JiraIssueExporter,
    PrChecker,
    // MilestoneSetter,
    // ReleaseNotifier,
    // VersionBumpMerger,
  ];

  behaviors.forEach(Behavior => {
    new Behavior(app);
  });
};
