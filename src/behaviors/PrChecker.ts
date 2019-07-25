import moment from 'moment';
import {
  WebhookPayloadCheckRun,
  WebhookPayloadCheckRunCheckRun,
  WebhookPayloadPullRequest,
  WebhookPayloadPullRequestReview,
} from '@octokit/webhooks';
import { PullsListReviewsResponseItem } from '@octokit/rest';
import { Application, Context } from 'probot';
import { GitHubAPI } from 'probot/lib/github';
import { Behavior } from '../types/generics';
import { checkResponseStatus, checkResponseWith } from '../utils/OctokitUtils';
import { getOrQueryPrsForCommit } from '../utils/PrQueries';
import { UserOrUserList } from '../ConfigManager';
import { getConfigManager } from '../globals';

interface ReviewStatuses {
  [key: string]: string;
}

export default class PrChecker extends Behavior {
  private static LOG_FIELDS = { behavior: 'PrChecker' };
  public static CHECK_NAME = 'Kiali - PR';
  public static OUTPUT_TITLE = 'Workflow checks';

  public constructor(app: Application) {
    super(app);

    // Events that should trigger the checks
    app.on('pull_request.opened', this.pullRequestEventHandler);
    app.on('pull_request.reopened', this.pullRequestEventHandler);
    app.on('check_run.rerequested', this.checkRerequestedHandler);
    app.on('pull_request_review.dismissed', this.pullRequestReviewEventHandler);
    app.on('pull_request_review.submitted', this.pullRequestReviewEventHandler);

    // Watch when checks should begin running
    app.on('check_run.created', this.doChecks);

    app.log.info('PrChecker behavior is initialized');
  }

  private checkRerequestedHandler = async (context: Context<WebhookPayloadCheckRun>): Promise<void> => {
    // Proceed only if the app owns the check and is a check of the current behavior
    if (!this.isOwnedCheckRun(context.payload.check_run)) {
      return;
    }

    this.app.log.debug(PrChecker.LOG_FIELDS, 'Queuing new PR checks (check run re-requested)');
    this.createCheckRun(context.github, context.repo({ head_sha: context.payload.check_run.head_sha }));
  };

  private pullRequestEventHandler = async (context: Context<WebhookPayloadPullRequest>): Promise<void> => {
    if (!(await this.areChecksEnabled(context))) {
      context.log.trace('Not running checks, because checker is disabled');
      return;
    }

    this.app.log.debug(PrChecker.LOG_FIELDS, `Queuing new PR checks (PR ${context.payload.pull_request.number})`);
    return this.createCheckRun(context.github, context.repo({ head_sha: context.payload.pull_request.head.sha }));
  };

  private pullRequestReviewEventHandler = async (context: Context<WebhookPayloadPullRequestReview>): Promise<void> => {
    // Bot actions are ignored
    //   This is to avoid blocking VersionBumpMerger behavior (and generating a loop)
    if (context.isBot) {
      context.log.debug(`Ignoring review action in PR ${context.payload.pull_request.number} (ignoring bots)`);
      return;
    }

    if (!(await this.areChecksEnabled(context))) {
      context.log.trace('Not running checks, because checker is disabled');
      return;
    }

    const logFields = { pr_number: context.payload.pull_request.number, ...PrChecker.LOG_FIELDS };

    // In case required approvals list indicates that only one user is mandatory:
    //   Mark checks as successful if submitted review is approved and user is
    //   from required approvals list.
    if (
      (context.payload.action === 'edited' || context.payload.action === 'submitted') &&
      context.payload.review.state === 'approved'
    ) {
      try {
        const requiredApprovals = await this.findRequiredApprovals(context);
        if (requiredApprovals.length === 1) {
          const requiredReviews = requiredApprovals[0];

          if (requiredReviews.includes(context.payload.sender.login)) {
            this.app.log.debug(logFields, `Creating successfull check (PR ${context.payload.pull_request.number})`);

            const response = await context.github.checks.create(
              context.repo({
                name: PrChecker.CHECK_NAME,
                head_sha: context.payload.pull_request.head.sha,
                status: 'completed' as 'completed',
                conclusion: 'success' as 'success',
                completed_at: moment().toISOString(),
              }),
            );

            checkResponseStatus(
              response,
              201,
              `Failed to create green check_run after approval of PR#${
                context.payload.pull_request.number
              }. A normal check_run will be queued.`,
              logFields,
            );
          }
        }

        // If review is approved, it is safe if further checks don't run.
        // It won't change the result of the check.
        return;
      } catch {
        // In case of an exception, enqueue a normal check.
      }
    }

    // ...else, enqueue a check run.
    this.app.log.debug(logFields, `Queuing new PR checks (PR ${context.payload.pull_request.number})`);
    return this.createCheckRun(context.github, context.repo({ head_sha: context.payload.pull_request.head.sha }));
  };

  private createCheckRun = async (
    api: GitHubAPI,
    commit: { owner: string; repo: string; head_sha: string },
  ): Promise<void> => {
    try {
      const response = await api.checks.create({
        status: 'queued' as 'queued',
        name: PrChecker.CHECK_NAME,
        ...commit,
      });
      checkResponseStatus(response, 201, `Failed to create check run`, {
        head_sha: commit.head_sha,
        ...PrChecker.LOG_FIELDS,
      });
    } catch (e) {
      // Well... this could be "critical". No checks will happen if this fails.
      throw e;
    }
  };

  private doChecks = async (context: Context<WebhookPayloadCheckRun>): Promise<void> => {
    const logFields = { sha: context.payload.check_run.head_sha, ...PrChecker.LOG_FIELDS };

    // Proceed only if the app owns the check and is a check of the current behavior
    if (!this.isOwnedCheckRun(context.payload.check_run)) {
      return;
    }

    // Proceed only if check run is queued
    if (context.payload.check_run.status !== 'queued') {
      this.app.log.debug(logFields, 'Created check run is not "queued". Not running checks.');
      return;
    }

    try {
      const pull_requests = await getOrQueryPrsForCommit(
        context.github,
        context.repo(),
        context.payload.check_run.head_sha,
        context.payload.check_run.pull_requests,
      );

      // PRs opened by bot should always pass
      //   This is to avoid blocking VersionBumpMerger behavior (and generating a loop)
      for (const pr of pull_requests) {
        const fullPr = await context.github.pulls.get(
          context.repo({
            number: pr.number,
          }),
        );
        checkResponseWith(fullPr, { logFields: { phase: 'check bot', ...logFields } });
        if (fullPr.data.user.login === process.env.KIALI_BOT_USER) {
          this.app.log.info(PrChecker.LOG_FIELDS, 'Not doing checks on PR because it is owned by the bot user.');
          return this.markBotPrAsOk(context);
        }
      }

      // Mark check as in-progress
      const inProgressUpdate = context.repo({
        check_run_id: context.payload.check_run.id,
        status: 'in_progress' as 'in_progress',
        started_at: moment().toISOString(),
      });
      checkResponseWith(await context.github.checks.update(inProgressUpdate), {
        logFields: { phase: 'Mark in_progress', ...logFields },
      });

      // Resolve reviews status
      const requiredApprovals = await this.findRequiredApprovals(context);

      // If approvals list is empty, just mark as success
      let conclusion = 'failure' as 'failure' | 'success';
      if (requiredApprovals.length > 0) {
        const prReviews: ReviewStatuses = {};
        for await (const pr of pull_requests) {
          const listReviewsParams = context.repo({
            pull_number: pr.number,
          });
          const getReviewsParams = context.github.pulls.listReviews.endpoint.merge(listReviewsParams);
          for await (const reviews of context.github.paginate.iterator(getReviewsParams)) {
            checkResponseWith(reviews, { logFields: { phase: 'resolve reviews', ...logFields } });
            for (const val of reviews.data as PullsListReviewsResponseItem[]) {
              prReviews[val.user.login] = val.state;
            }
          }
        }

        // Check if all required approvals are done
        const anyApprovedTest = (approvals: string[]): boolean =>
          approvals.some((user): boolean => prReviews[user] !== undefined && prReviews[user] === 'APPROVED');

        if (requiredApprovals.every(anyApprovedTest)) {
          conclusion = 'success';
        }
      } else {
        this.app.log.trace(PrChecker.LOG_FIELDS, 'Marking as success because reviewers list is empty');
        conclusion = 'success';
      }

      const inProgressFinish = context.repo({
        check_run_id: context.payload.check_run.id,
        status: 'completed' as 'completed',
        conclusion: conclusion,
        completed_at: moment().toISOString(),
        output: {
          title: PrChecker.OUTPUT_TITLE,
          summary: PrChecker.getSummaryMsg(conclusion, pull_requests[0].number, requiredApprovals),
        },
      });
      checkResponseWith(await context.github.checks.update(inProgressFinish), {
        logFields: { phase: 'mark complete', ...logFields },
      });
    } catch {
      this.app.log.error(logFields, 'Error performing check_run');
    }
  };

  private markBotPrAsOk = async (context: Context<WebhookPayloadCheckRun>): Promise<void> => {
    const inProgressFinish = context.repo({
      check_run_id: context.payload.check_run.id,
      status: 'completed' as 'completed',
      conclusion: 'success' as 'success',
      completed_at: moment().toISOString(),
    });
    checkResponseWith(await context.github.checks.update(inProgressFinish), {
      logFields: { sha: context.payload.check_run.head_sha, ...PrChecker.LOG_FIELDS },
    });
  };

  private findRequiredApprovals = async (context: Context): Promise<string[][]> => {
    const configs = await getConfigManager().getConfigs(context);

    if (configs.checks && configs.checks.pull_requests && configs.checks.pull_requests.required_approvals) {
      // Normalize to 2-D array
      if (typeof configs.checks.pull_requests.required_approvals === 'string') {
        return [[configs.checks.pull_requests.required_approvals]];
      }

      const approvals: UserOrUserList[] = configs.checks.pull_requests.required_approvals;
      return approvals.map((value): string[] => (typeof value === 'string' ? [value] : value));
    }

    return [];
  };

  private isOwnedCheckRun = (checkRun: WebhookPayloadCheckRunCheckRun): boolean => {
    if (checkRun.app.id !== Number(process.env.APP_ID) || checkRun.name !== PrChecker.CHECK_NAME) {
      this.app.log.trace(PrChecker.LOG_FIELDS, `Check run ${checkRun.id} not owned by this behavior`);
      return false;
    }

    return true;
  };

  private areChecksEnabled = async (context: Context): Promise<boolean> => {
    const configs = await getConfigManager().getConfigs(context);

    let isEnabled =
      configs.checks !== undefined &&
      (configs.checks.enabled === undefined || configs.checks.enabled === true) &&
      configs.checks.pull_requests !== undefined &&
      (configs.checks.pull_requests.enabled === undefined || configs.checks.pull_requests.enabled === true) &&
      configs.checks.pull_requests.required_approvals !== undefined;

    return isEnabled;
  };

  private static getSummaryMsg(conclusion: string, prNumber: number, mandatoryReviewers: string[][]): string {
    if (conclusion === 'success') {
      return `The pull request #${prNumber} has passed the workflow checks.`;
    } else {
      const mandatoryReviewersText = mandatoryReviewers.map(users =>
        users.length === 1 ? `user _${users[0]}_` : `one of these users: _${users.join(', ')}_`,
      );

      return (
        `The pull request #${prNumber} hasn't been approved by the ` +
        'mandatory reviewers. At the moment of the validation, ' +
        'the mandatory reviewers were:\n\n' +
        `* ${mandatoryReviewersText.join('\n* and ')}`
      );
    }
  }
}
