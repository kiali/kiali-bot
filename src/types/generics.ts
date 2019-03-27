import { Application } from 'probot'

export abstract class Behavior {
    protected app: Application;

    constructor (app: Application) {
      this.app = app
    }
}
