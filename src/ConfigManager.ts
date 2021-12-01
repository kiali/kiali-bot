import { Context, Probot } from 'probot';
import getConfig from 'probot-config';
import { getProbotApp } from './globals';

const DEFAULT_CONFIG: Configs = {
  merge_method: 'merge',
};

export type UserOrUserList = string | string[];

interface Configs {
  checks?: {
    enabled?: boolean;
    pull_requests?: {
      enabled?: boolean;
      required_approvals?: UserOrUserList | UserOrUserList[];
    };
  };

  // Method for merging pull requests.
  // Reference: https://docs.github.com/en/free-pro-team@latest/rest/reference/pulls#merge-a-pull-request
  merge_method: 'merge' | 'squash' | 'rebase';
}

interface ConfigsPerRepo {
  [repoName: string]: {
    request: Promise<Configs> | null;
    yaml: Configs;
  };
}

export class ConfigManager {
  private configs: ConfigsPerRepo;

  public constructor(app: Probot) {
    app.on('push', this.pushHandler);
    this.configs = {};
  }

  private pushHandler = async (context: Context<'push'>): Promise<void> => {
    // Only listen for changes in master branch.
    if (context.payload.ref !== 'refs/heads/master') {
      return;
    }

    // Invalidate configs.
    context.log.info(`Invalidating configs due to push in master branch of ${context.repo().repo} repository`);
    this.configs = {};
  };

  public getConfigs = (context: Context): Promise<Configs> => {
    const { owner, repo } = context.repo();
    const repoStr = `${owner}/${repo}`;

    if (this.configs[repoStr]) {
      // If configs are already being fetched, reuse that request
      const request = this.configs[repoStr].request;
      if (request !== null) {
        return request;
      }

      // Else, assume that configs are already fetched.
      context.log.trace(`Using configs already loaded for ${repoStr}`);
      return Promise.resolve(this.configs[repoStr].yaml);
    }

    // Fetch configs if not already fetched.
    context.log.info(`Fetching configs for ${repoStr}`);

    const cfgRequest = getConfig<Configs>(context, 'kiali.yml', DEFAULT_CONFIG)
      .then(
        (configs: Configs): Configs => {
          this.configs[repoStr] = { yaml: configs, request: null };
          return configs;
        },
      )
      .catch(
        (e): Promise<Configs> => {
          getProbotApp().log.error(`Failed to get config for repository ${repoStr}`);
          return Promise.reject(e);
        },
      );
    this.configs[repoStr] = { yaml: DEFAULT_CONFIG, request: cfgRequest };

    return cfgRequest;
  };
}
