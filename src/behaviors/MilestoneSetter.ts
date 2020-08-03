import { Application, Context } from 'probot';
import { GitHubAPI } from 'probot/lib/github';
import { LoggerWithTarget } from 'probot/lib/wrap-logger';
import { IssuesGetMilestoneResponse, PullsGetParams } from '@octokit/rest';
import Webhooks from '@octokit/webhooks';
import { Behavior } from '../types/generics';
import { getCurrentSprintEndDate } from '../utils/SprintDates';

export default class MilestoneSetter extends Behavior {
  private static LOG_FIELDS = { behavior: 'MilestoneSetter' };

  public constructor(app: Application) {
    super(app);
    app.on('pull_request.closed', this.prClosedHandler);
    app.log.info('MilestoneSetter behavior is initialized');
  }

  private assignMilestone = async (api: GitHubAPI, prParams: PullsGetParams): Promise<void> => {
    const logFields = { pr_number: prParams.pull_number, ...MilestoneSetter.LOG_FIELDS };
    this.app.log.debug(logFields, `Setting milestone to PR#${prParams.pull_number}...`);

    const prResponse = await api.pulls.get(prParams);
    if (prResponse.data.milestone !== null) {
      this.app.log.info(logFields, `Not setting milestone to PR#${prParams.pull_number}, because it already has one`);
      return;
    }

    const milestone = await this.resolveMilestoneToSet(api, prParams);
    if (milestone === null) {
      return;
    }

    const response = await api.issues.update({
      owner: prParams.owner,
      repo: prParams.repo,
      milestone: milestone.number,
      issue_number: prParams.pull_number,
    });

    if (response.status !== 200) {
      this.app.log.error(logFields, `Cannot set milestone to PR#${prParams.pull_number}: HTTP ${prResponse.status}`);
    } else {
      this.app.log(logFields, `PR#${prParams.pull_number} milestoned to ${milestone.number} = ${milestone.title}`);
    }
  };

  private getOrCreateMilestone = async (
    api: GitHubAPI,
    prParams: PullsGetParams,
    version: string,
  ): Promise<IssuesGetMilestoneResponse | null> => {
    const logFields = { pr_number: prParams.pull_number, repo: prParams.repo, ...MilestoneSetter.LOG_FIELDS };

    // Check if milestone already exists
    const milestonesResponse = await api.issues.listMilestonesForRepo({
      owner: prParams.owner,
      repo: prParams.repo,
      direction: 'desc',
      sort: 'due_on',
      state: 'open',
    });

    if (milestonesResponse.status !== 200) {
      this.app.log.error(logFields, `Unable to fetch milestones: HTTP ${milestonesResponse.status}`);
      return null;
    }

    const milestone = milestonesResponse.data.find((item): boolean => item.title === version);
    if (milestone) {
      this.app.log.debug(logFields, `Using existent milestone ${version} with number ${milestone.number}`);
      return milestone;
    }

    // If milestone does not exist, create it.
    const createMilestoneResponse = await api.issues.createMilestone({
      owner: prParams.owner,
      repo: prParams.repo,
      due_on: getCurrentSprintEndDate().format(),
      title: version,
      state: 'open',
    });

    if (createMilestoneResponse.status !== 201) {
      this.app.log.error(logFields, `Unable to create milestone ${version}: HTTP ${milestonesResponse.status}`);
      return null;
    }

    this.app.log.debug(
      logFields,
      `Milestone ${version} was created with number ${createMilestoneResponse.data.number}`,
    );
    return createMilestoneResponse.data;
  };

  private prClosedHandler = async (context: Context<Webhooks.WebhookPayloadPullRequest>): Promise<void> => {
    const pr = context.payload.pull_request;
    context.log.debug(MilestoneSetter.LOG_FIELDS, `Pull #${pr.number} was just closed`);

    if (MilestoneSetter.shouldAssignMilestone(context.log, pr)) {
      const prParams = context.repo({ pull_number: pr.number });
      this.assignMilestone(context.github, prParams);
    }
  };

  private resolveBackendMilestone = async (
    api: GitHubAPI,
    prParams: PullsGetParams,
  ): Promise<IssuesGetMilestoneResponse | null> => {
    const logFields = { pr_number: prParams.pull_number, repo: prParams.repo, ...MilestoneSetter.LOG_FIELDS };

    // Get main Makefile to find the current version in it.
    const contentsResponse = await api.repos.getContents({
      owner: prParams.owner,
      repo: prParams.repo,
      path: 'Makefile',
    });

    if (contentsResponse.status !== 200) {
      this.app.log.error(
        logFields,
        `Cannot determine milestone for PR#${prParams.pull_number}. Unable to get Makefile: HTTP ${contentsResponse.status}`,
      );
      return null;
    }

    const contents = Array.isArray(contentsResponse.data) ? '' : (contentsResponse.data.content as string);
    const buff = Buffer.from(contents, 'base64');
    const file = buff.toString('utf8');

    // Find the version string
    const matches = file.match(/[\s\S]VERSION \?= v(.*)/);
    if (matches === null || matches.length === 0) {
      this.app.log.error(
        logFields,
        `Cannot determine milestone for PR#${prParams.pull_number}: Version string not found in Makefile`,
      );
      return null;
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const versionString = matches.pop()!.replace('-SNAPSHOT', '');
    return this.getOrCreateMilestone(api, prParams, 'v' + versionString);
  };

  private resolveFrontendMilestone = async (
    api: GitHubAPI,
    prParams: PullsGetParams,
  ): Promise<IssuesGetMilestoneResponse | null> => {
    const logFields = { pr_number: prParams.pull_number, repo: prParams.repo, ...MilestoneSetter.LOG_FIELDS };

    // Get main Makefile to find the current version in it.
    const contentsResponse = await api.repos.getContents({
      owner: prParams.owner,
      repo: prParams.repo,
      path: 'package.json',
    });

    if (contentsResponse.status !== 200) {
      this.app.log.error(
        logFields,
        `Cannot determine milestone for PR#${prParams.pull_number}. Unable to get package.json: HTTP ${contentsResponse.status}`,
      );
      return null;
    }

    const contents = Array.isArray(contentsResponse.data) ? '' : (contentsResponse.data.content as string);
    const buff = Buffer.from(contents, 'base64');
    const file = buff.toString('utf8');

    try {
      const parsedJson = JSON.parse(file);
      return this.getOrCreateMilestone(api, prParams, 'v' + parsedJson.version);
    } catch {
      this.app.log.error(
        logFields,
        `Cannot determine milestone for PR#${prParams.pull_number} because parsing of package.json has failed`,
      );
    }

    return null;
  };

  private resolveMilestoneToSet = async (
    api: GitHubAPI,
    prParams: PullsGetParams,
  ): Promise<IssuesGetMilestoneResponse | null> => {
    if (prParams.repo === process.env.BACKEND_REPO_NAME) {
      return this.resolveBackendMilestone(api, prParams);
    } else if (prParams.repo === process.env.FRONTEND_REPO_NAME) {
      return this.resolveFrontendMilestone(api, prParams);
    }

    const logFields = { pr_number: prParams.pull_number, repo: prParams.repo, ...MilestoneSetter.LOG_FIELDS };
    this.app.log.error(logFields, `Unexpected repository name for PR#${prParams.pull_number}`);
    return null;
  };

  private static shouldAssignMilestone = (
    log: LoggerWithTarget,
    pr: Webhooks.WebhookPayloadPullRequestPullRequest,
  ): boolean => {
    // Don't assign milestone if PR was not merged.
    if (!pr.merged) {
      log.info(
        MilestoneSetter.LOG_FIELDS,
        `Not assigning milestone to PR#${pr.number} because it was not fully merged.`,
      );
      return false;
    }

    // Don't assign milestone to bot PRs
    if (pr.user.login === process.env.KIALI_BOT_USER) {
      log.info(
        MilestoneSetter.LOG_FIELDS,
        `Not assigning milestone to PR#${pr.number} because it is owned by the bot user.`,
      );
      return false;
    }

    // Don't assign milestone to PRs that are not merged into master branch
    if (pr.base.ref !== 'master') {
      log.info(
        MilestoneSetter.LOG_FIELDS,
        `Not assigning milestone to PR#${pr.number} because base branch is not master.`,
      );
      return false;
    }

    return true;
  };
}
