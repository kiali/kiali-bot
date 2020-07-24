import { PullsGetParams } from '@octokit/rest';
import { GitHubAPI } from 'probot/lib/github';
import { Repo } from '../types/OctokitInterface';
import { checkResponseStatus } from './OctokitUtils';
import { getProbotApp } from '../globals';

export async function getOrQueryPrsForCommit(
  api: GitHubAPI,
  repo: Repo,
  sha: string,
  pull_requests?: PullsGetParams[],
): Promise<PullsGetParams[]> {
  // TODO: Remove all logs in this function

  if (pull_requests && pull_requests.length > 0) {
    getProbotApp().log.debug(`Commit ${sha} has PRs. Returning what was received in argument.`);
    return pull_requests;
  }

  const query = api.search.issuesAndPullRequests.endpoint.merge({
    q: `sha:${sha}+is:pr`,
  });

  let retVal: PullsGetParams[] = [];
  getProbotApp().log.debug(`Searching PRs for commit ${sha}.`);
  for await (const page of api.paginate.iterator(query)) {
    checkResponseStatus(page);
    for (const item of page.data) {
      getProbotApp().log.debug(`Commit ${sha} has PR ${item.url}.`);
      // We return the PR that is placed in "our" repo.
      // Using the pull request repo URL to identify it.
      if (item.repository_url === `https://api.github.com/repos/${repo.owner}/${repo.repo}`) {
        getProbotApp().log.debug(`Commit ${sha} has PR ${item.url} which is returned by getOrQueryPrsForCommit.`);
        retVal.push({ pull_number: Number(item.number), ...repo });
      }
    }
  }

  return retVal;
}
