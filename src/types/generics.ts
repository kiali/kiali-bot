import { Application } from 'probot';

export abstract class Behavior {
  protected app: Application;

  protected constructor(app: Application) {
    this.app = app;
  }
}
