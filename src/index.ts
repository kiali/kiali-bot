import { Application } from 'probot'
import MilestoneSetter from './behaviors/MilestoneSetter'
import VersionBumpMerger from './behaviors/VersionBumpMerger'
// import JiraIssueExporter from './behaviors/JiraIssueExporter'

export = (app: Application) => {
  const behaviors = [
    // JiraIssueExporter,
    MilestoneSetter,
    VersionBumpMerger
  ]

  behaviors.forEach((Behavior) => {
    new Behavior(app) // eslint-disable-line no-new
  })
}
