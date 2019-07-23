import { Application, Context } from 'probot';
import getConfig from 'probot-config';
import { WebhookPayloadPush } from '@octokit/webhooks';
import { getProbotApp } from './globals';

const DEFAULT_CONFIG = {};

export type UserOrUserList = string | string[];

interface Configs {
  checks?: {
    enabled?: boolean;
    pull_requests?: {
      enabled?: boolean;
      required_approvals?: UserOrUserList | UserOrUserList[];
    };
  };
}

interface ConfigsPerRepo {
  [repoName: string]: {
    request: Promise<Configs> | null;
    yaml: Configs;
  };
}

export class ConfigManager {
  private configs: ConfigsPerRepo;

  public constructor(app: Application) {
    app.on('push', this.pushHandler);
    this.configs = {};
  }

  private pushHandler = async (context: Context<WebhookPayloadPush>): Promise<void> => {
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
      .then((configs: Configs) => {
        this.configs[repoStr] = { yaml: configs, request: null };
        getProbotApp().log.trace(`Fetched configs for repository ${repoStr}: ${JSON.stringify(configs, null, 2)}`);
        return configs;
      })
      .catch(e => {
        getProbotApp().log.error(`Failed to get config for repository ${repoStr}`);
        return Promise.reject(e);
      });
    this.configs[repoStr] = { yaml: {}, request: cfgRequest };

    return cfgRequest;
  };
}
