import { Application } from 'probot'
import VersionBumpMerger from './behaviors/VersionBumpMerger'
// import JiraIssueExporter from './behaviors/JiraIssueExporter'

export = (app: Application) => {
  const behaviors = [
    // JiraIssueExporter,
    VersionBumpMerger
  ]

  behaviors.forEach((Behavior) => {
    new Behavior(app)
  })
}
