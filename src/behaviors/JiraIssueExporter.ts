import * as fs from 'fs'
import * as Handlebars from 'handlebars'
import JiraAPI from 'jira-client'
import { Application, Context } from 'probot'
import tempfile from 'tempfile'
import util from 'util'
import Webhooks from '@octokit/webhooks'
import { Behavior } from '../types/generics'

const get = util.promisify(require('node-cmd').get)

interface IProject {
    self: string,
    id: string,
    key: string,
    name: string
}

interface IIssue {
    title: string,
    body: string,
    html_url: string
}

export default class JiraIssueExporter extends Behavior {
  private JiraClient: JiraAPI;
  private project: IProject;
  private templates = {
    issues: {
      opened: async (context: any, object: any) => {
        return Handlebars.compile(await this.getTemplate(context, 'NEW_ISSUE_TEMPLATE.md'))(object)
      }
    }
  }

  constructor (app: Application) {
    super(app)

    this.JiraClient = new JiraAPI({
      protocol: process.env.JIRA_PROTOCOL!,
      host: process.env.JIRA_HOST!,
      port: process.env.JIRA_PORT!,
      username: process.env.JIRA_USERNAME!,
      password: process.env.JIRA_PASSWORD!,
      apiVersion: process.env.JIRA_API_VERSION!
    })

    this.project = {
      self: '',
      id: '',
      key: '',
      name: ''
    }

    const listPromise = this.JiraClient.listProjects()
    listPromise.then((response) => {
      const projects = response as Array<IProject>
      this.project = projects.find((project) => project.key === process.env.JIRA_PROJECT!)!
      app.on('issues.opened', this.exportToJira)
    })
  }

  private async convertToConfluence (text: string) {
    let file = tempfile('.md')

    return new Promise(function (resolve, reject) {
      fs.writeFile(file, text, 'UTF-8', function (err) {
        if (err) reject(err)
        else resolve(file)
      })
    }).then(async () => {
      return get(`markdown2confluence ${file}`)
    })
  }

  private async exportToJira (context: Context<Webhooks.WebhookPayloadIssues>) {
    const issue = ((await context.github.issues.get(context.issue()!)) as any).data as IIssue
    this.app.log.warn(issue)

    const issueData = {
      fields: {
        project: { id: this.project.id },
        summary: issue.title,
        description: `This issue was imported from GitHub.\nOriginal link: ${issue.html_url}\n\n${await this.convertToConfluence(issue.body)}`,
        issuetype: { id: '10001' }
      }
    }

    const jiraIssue = await this.JiraClient.addNewIssue(issueData)
    const jiraPort = process.env.JIRA_PORT! === '80' ? '' : `:${process.env.JIRA_PORT!}`
    const jiraUrl = `${process.env.JIRA_PROTOCOL!}://${process.env.JIRA_HOST!}${jiraPort}/browse/${jiraIssue.key}`

    const response = { jiraUrl: jiraUrl }
    const params = context.issue({ body: await this.templates.issues.opened(context, response) })

    await context.github.issues.createComment(params)
  }

  private async getTemplate (context: any, file: string) {
    const options = context.repo({ path: '.github/' + file })
    const res = await context.github.repos.getContent(options)

    return Buffer.from(res.data.content, 'base64').toString()
  }
}
