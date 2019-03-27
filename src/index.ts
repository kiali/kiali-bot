import { Application } from 'probot'
import JiraIssueExporter from './behaviors/JiraIssueExporter'

export = (app: Application) => {
  const behaviors = [
    JiraIssueExporter
  ]

  behaviors.forEach((Behavior) => {
    new Behavior(app)
  })
}
