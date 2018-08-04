import JiraAPI from 'jira-client';
import { Application } from 'probot';
import * as Handlebars from 'handlebars';

import util from 'util';
import * as fs from 'fs';
const get = util.promisify(require('node-cmd').get);

import tempfile from 'tempfile';

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

export = async (app: Application) => {
  const JiraClient = new JiraAPI({
    protocol: process.env.JIRA_PROTOCOL!,
    host: process.env.JIRA_HOST!,
    port: process.env.JIRA_PORT!,
    username: process.env.JIRA_USERNAME!,
    password: process.env.JIRA_PASSWORD!,
    apiVersion: process.env.JIRA_API_VERSION!
  });

  const project = (await JiraClient.listProjects() as Array<IProject>)
    .find ((project) => project.key === process.env.JIRA_PROJECT!)!;

  const getTemplate = async (context: any, file: string) => {
    const options = context.repo({ path: '.github/' + file });
    const res = await context.github.repos.getContent(options);

    return Buffer.from(res.data.content, 'base64').toString();
  };

  const templates = {
    issues: {
      opened: async (context: any, object: any) => {
        return Handlebars.compile(await getTemplate(context, 'NEW_ISSUE_TEMPLATE.md'))(object);
      }
    }
  };

  const convertToConfluence = async (text: string) => {
    let file = tempfile('.md');

    return new Promise(function(resolve, reject) {
      fs.writeFile(file, text, 'UTF-8', function(err) {
        if (err) reject(err);
        else resolve(file);
      });
    }).then(async () => {
      return await get(`markdown2confluence ${file}`);
    }
    );
  }

  app.on('issues.opened', async (context) => {
    const issue = ((await context.github.issues.get(context.issue()!)) as any).data as IIssue;
    app.log.warn(issue);

    const issueData = {
      fields: {
        project: { id: project.id },
        summary: issue.title,
        description: `This issue was imported from GitHub.\nOriginal link: ${issue.html_url}\n\n${await convertToConfluence(issue.body)}`,
        issuetype: { id: '10001' }
      }
    };

    const jiraIssue = await JiraClient.addNewIssue(issueData);
    const jiraPort = process.env.JIRA_PORT! === '80' ? '' : `:${process.env.JIRA_PORT!}`;
    const jiraUrl = `${process.env.JIRA_PROTOCOL!}://${process.env.JIRA_HOST!}${jiraPort}/browse/${jiraIssue.key}`;

    const response =  { jiraUrl: jiraUrl };
    const params = context.issue({ body: await templates.issues.opened(context, response) });

    await context.github.issues.createComment(params);
  });
}
