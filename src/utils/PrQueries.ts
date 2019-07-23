import { PullsGetParams } from '@octokit/rest';
import { GitHubAPI } from 'probot/lib/github';
import { Repo } from '../types/OctokitInterface';
import { checkResponseStatus } from './OctokitUtils';

export async function getOrQueryPrsForCommit(
  api: GitHubAPI,
  repo: Repo,
  sha: string,
  pull_requests?: PullsGetParams[],
): Promise<PullsGetParams[]> {
  if (pull_requests && pull_requests.length > 0) {
    return pull_requests;
  }

  const query = api.search.issuesAndPullRequests.endpoint.merge({
    q: `sha:${sha}+is:pr`,
  });

  let retVal: PullsGetParams[] = [];
  for await (const page of api.paginate.iterator(query)) {
    checkResponseStatus(page);
    for (const item of page.data) {
      // We return the PR that is placed in "our" repo.
      // Using the pull request repo URL to identify it.
      if (item.repository_url === `https://api.github.com/repos/${repo.owner}/${repo.repo}`) {
        retVal.push({ number: Number(item.number), ...repo });
      }
    }
  }

  return retVal;
}
