import { PullsGetParams, PullsGetResponse } from '@octokit/rest';
import Webhooks from '@octokit/webhooks';
import { Application, Context } from 'probot';
import { GitHubAPI } from 'probot/lib/github';

import { getConfigManager } from '../globals';
import { Behavior } from '../types/generics';

export default class VersionBumpMerger extends Behavior {
  private static LOG_FIELDS = { behavior: 'VersionBumpMerger' };
  private static MERGE_INTENTION_DELAY = 5000;

  public constructor(app: Application) {
    super(app);
    app.on('pull_request.opened', this.prCreatedHandler);
    app.on('check_run.completed', this.checkRunCompletedHandler);
    app.on('status', this.commitStatusChangedHandler);

    app.log.info('VersionBumpMerger behavior is initialized');
  }

  private approvePr = async (api: GitHubAPI, pr: PullsGetResponse): Promise<boolean> => {
    const logFields = { pr_number: pr.number, ...VersionBumpMerger.LOG_FIELDS };

    this.app.log(logFields, `Approving PR#${pr.number}...`);
    const reviewResponse = await api.pulls.createReview({
      owner: pr.base.repo.owner.login,
      repo: pr.base.repo.name,
      number: pr.number,
      event: 'APPROVE',
    });

    if (reviewResponse.status !== 200) {
      this.app.log.warn(logFields, `Cannot approve PR#${pr.number}: HTTP ${reviewResponse.status}`);
      return false;
    }

    return true;
  };

  private checkRunCompletedHandler = async (context: Context<Webhooks.WebhookPayloadCheckRun>): Promise<void> => {
    context.log.trace(VersionBumpMerger.LOG_FIELDS, `Check run #${context.payload.check_run.id} has completed`);

    const check = context.payload.check_run;
    if (check.status !== 'completed' || check.conclusion !== 'success') {
      // If check didn't succeed, no need to merge PR
      context.log.trace(VersionBumpMerger.LOG_FIELDS, `Check run #${check.id} not suceeded yet`);
      return;
    }

    let prParams: PullsGetParams | null = null;
    if (check.pull_requests.length === 0) {
      // If there are no PRs associated with the check, this does not means
      // that there is no PR. We need to query for it.
      context.log.debug(VersionBumpMerger.LOG_FIELDS, `Resort to search PRs for check run #${check.id}`);
      prParams = await this.getPrForCommit(context.github, context.repo(), check.head_sha);
    } else {
      // There is an array of PRs, but we expect only one matching PR. So, just
      // grab the first one in the array.
      context.log.debug(VersionBumpMerger.LOG_FIELDS, `Using attached PR for check run #${check.id}`);
      prParams = context.repo({ pull_number: check.pull_requests[0].number });
    }

    if (prParams) {
      // Merge the PR if possible
      // The merge is "scheduled", to let GitHub checks to settle down
      setTimeout(this.tryMergePr, VersionBumpMerger.MERGE_INTENTION_DELAY, context, prParams);
    } else {
      context.log.trace(VersionBumpMerger.LOG_FIELDS, `No PRs found for check run #${check.id}`);
    }
  };

  private commitStatusChangedHandler = async (context: Context<Webhooks.WebhookPayloadStatus>): Promise<void> => {
    if (context.payload.state !== 'success') {
      // If status is not 'success', no need to do any further actions
      return;
    }

    // Check if there is a PR associated with the commit.
    const prParams = await this.getPrForCommit(context.github, context.repo(), context.payload.sha);
    if (!prParams) {
      // No pull request associated with the commit. Nothing to do.
      return;
    }

    // Status of the commit is "success" and there is a PR associated with it.
    // The PR is potentially mergeable. Schedule the merge intention.
    setTimeout(this.tryMergePr, VersionBumpMerger.MERGE_INTENTION_DELAY, context, prParams);
  };

  private getPrForCommit = async (
    api: GitHubAPI,
    repo: { owner: string; repo: string },
    sha: string,
  ): Promise<PullsGetParams | null> => {
    const results = await api.search.issuesAndPullRequests({
      q: `sha:${sha}+is:pr+is:open`,
    });

    if (results.data.total_count === 0) {
      return null;
    }

    let retVal: PullsGetParams | null = null;
    results.data.items.forEach((item: any) => {
      // We return the PR that is placed in "our" repo.
      // Using the pull request repo URL to identify it.
      if (item.repository_url === `https://api.github.com/repos/${repo.owner}/${repo.repo}`) {
        retVal = { pull_number: item.number, ...repo };
      }
    });

    return retVal;
  };

  private static isValidPr = (pr: Webhooks.WebhookPayloadPullRequestPullRequest | PullsGetResponse): string | null => {
    // Merge automatically only when pull request is created by the kiali-bot
    if (pr.user.login !== process.env.KIALI_BOT_USER) {
      return `Pull #${pr.number} ignored because opener is not the expected user`;
    }

    // Merge automatically only if pull request is preparation for the next version
    if (pr.title !== 'Prepare for next version') {
      return `Pull #${pr.number} ignored because title doesn't indicate preparation for next version`;
    }

    if (pr.merged) {
      return `Pull #${pr.number} ignored because it's already merged`;
    }

    if ((pr as PullsGetResponse).draft) {
      return `Pull #${pr.number} ignored because it's a draft`;
    }

    return null;
  };

  private isPrChecksOk = async (api: GitHubAPI, pr: PullsGetResponse): Promise<boolean> => {
    const logFields = { pr_number: pr.number, ...VersionBumpMerger.LOG_FIELDS };

    const checksResponse = await api.checks.listForRef({
      owner: pr.base.repo.owner.login,
      repo: pr.base.repo.name,
      ref: pr.head.sha,
    });

    if (checksResponse.status !== 200) {
      this.app.log.warn(logFields, `Cannot fetch PR#${pr.number} checks: HTTP ${checksResponse.status}`);
      return false;
    }

    const badChecks: string[] = [];
    checksResponse.data.check_runs.forEach((check) => {
      if (check.status !== 'completed' || check.conclusion !== 'success') {
        badChecks.push(check.name);
      }
    });

    if (badChecks.length > 0) {
      this.app.log(logFields, `Cannot merge PR#${pr.number} yet: checks not succeeded = ${badChecks.join(',')}`);
      return false;
    }

    return true;
  };

  private isPrMergeable = (pr: PullsGetResponse): boolean => {
    const logFields = { pr_number: pr.number, ...VersionBumpMerger.LOG_FIELDS };

    const error = VersionBumpMerger.isValidPr(pr);
    if (error) {
      this.app.log.debug(logFields, error);
      return false;
    }

    if (!pr.mergeable) {
      this.app.log(logFields, `PR#${pr.number} is not mergeable yet`);
      return false;
    }

    return true;
  };

  private isPrStatusOk = async (api: GitHubAPI, pr: PullsGetResponse): Promise<boolean> => {
    const logFields = { pr_number: pr.number, ...VersionBumpMerger.LOG_FIELDS };

    const statusResponse = await api.repos.getCombinedStatusForRef({
      owner: pr.base.repo.owner.login,
      repo: pr.base.repo.name,
      ref: pr.head.sha,
    });

    if (statusResponse.status !== 200) {
      this.app.log.warn(logFields, `Cannot fetch PR#${pr.number} status: HTTP ${statusResponse.status}`);
      return false;
    }

    if (statusResponse.data.total_count === 0) {
      // No status available means that there are no checks.
      // Combined status may not be "success", but if there are no
      // statuses, well... let's assume "success".
      return true;
    }

    if (statusResponse.data.state !== 'success') {
      this.app.log(logFields, `Cannot merge PR#${pr.number} yet: status = ${statusResponse.data.state}`);
      return false;
    }

    return true;
  };

  private prCreatedHandler = async (context: Context<Webhooks.WebhookPayloadPullRequest>): Promise<void> => {
    const pull = context.payload.pull_request;
    context.log.debug(VersionBumpMerger.LOG_FIELDS, `Pull #${pull.number} was just opened`);

    const error = VersionBumpMerger.isValidPr(pull);
    if (error) {
      context.log.debug(VersionBumpMerger.LOG_FIELDS, error);
      return;
    }

    context.log(
      VersionBumpMerger.LOG_FIELDS,
      `Adding comment about automatic merge to recently opened PR#${pull.number}`,
    );
    context.github.issues.createComment(
      context.issue({
        body: 'This pull request will be merged automatically once all checks pass.',
      }),
    );
  };

  private tryMergePr = async (context: Context, pullParams: PullsGetParams): Promise<void> => {
    const api = context.github;
    const logFields = { pr_number: pullParams.pull_number, ...VersionBumpMerger.LOG_FIELDS };

    this.app.log.debug(logFields, `Trying to merge PR#${pullParams.pull_number} automatically`);
    const prResponse = await api.pulls.get(pullParams);

    if (prResponse.status !== 200) {
      this.app.log.warn(logFields, `Cannot fetch PR#${pullParams.pull_number}: HTTP ${prResponse.status}`);
      return;
    }

    const pr = prResponse.data;
    const okToMerge =
      this.isPrMergeable(pr) && (await this.isPrChecksOk(api, pr)) && (await this.isPrStatusOk(api, pr));

    if (okToMerge) {
      (await this.approvePr(api, pr)) && (await this.mergePr(context, pr));
    }
  };

  private mergePr = async (context: Context, pr: PullsGetResponse): Promise<boolean> => {
    const api = context.github;
    const logFields = { pr_number: pr.number, ...VersionBumpMerger.LOG_FIELDS };

    const configs = await getConfigManager().getConfigs(context);

    this.app.log(logFields, `Merging PR#${pr.number}...`);
    const mergeResponse = await api.pulls.merge({
      owner: pr.base.repo.owner.login,
      repo: pr.base.repo.name,
      number: pr.number,
      sha: pr.head.sha,
      merge_method: configs.merge_method,
    });

    this.app.log({ mergeResponse, ...logFields });
    return mergeResponse.status === 200;
  };
}
