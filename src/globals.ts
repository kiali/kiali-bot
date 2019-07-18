import { Application } from 'probot';

let probotApp: Application | null = null;

export function setProbotApp(app: Application) {
  probotApp = app;
}

export function getProbotApp(): Application {
  if (!probotApp) {
    throw new Error('Probot app is unset');
  }
  return probotApp;
}
