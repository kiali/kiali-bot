import { Probot } from 'probot';

export abstract class Behavior {
  protected app: Probot;

  protected constructor(app: Probot) {
    this.app = app;
  }
}
