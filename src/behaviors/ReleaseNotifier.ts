import * as Mailjet from 'node-mailjet';
import { Application, Context } from 'probot';
import { WebhookPayloadRelease } from '@octokit/webhooks';
import { Behavior } from '../types/generics';
import { htmlNotification, plainTextNotification } from '../data/ReleaseNotificationMessages';

export default class ReleaseNotifier extends Behavior {
  private static LOG_FIELDS = { behavior: 'ReleaseNotifier' };

  public constructor(app: Application) {
    super(app);
    app.on('release.published', this.releasePublishedHandler);
    app.log.info('ReleaseNotifier behavior is initialized');
  }

  private releasePublishedHandler = async (context: Context<WebhookPayloadRelease>): Promise<void> => {
    const logFields = { release_url: context.payload.release.url, ...ReleaseNotifier.LOG_FIELDS };

    // Act only for:
    // * release entries created in the back-end repository, since this is
    //   the main place in GitHub for tagging the releases,
    // * releases created by kiali-bot,
    // * releases that are not drafts,
    // * releases that are not pre-releases,
    // * major and minor versions (for now, omit notification for patch versions)
    const shouldAct =
      context.payload.repository.name === process.env.BACKEND_REPO_NAME &&
      context.payload.release.author.login === process.env.KIALI_BOT_USER &&
      !context.payload.release.draft &&
      !context.payload.release.prerelease &&
      context.payload.release.tag_name.endsWith('.0');

    if (!shouldAct) {
      this.app.log.trace(logFields, 'Not doing action for the recently published release.');
      return;
    }

    this.sendMailNotification(context.payload.release.tag_name);
  };

  private sendMailNotification = (tagName: string): void => {
    const logFields = { release_tag: tagName, ...ReleaseNotifier.LOG_FIELDS };

    if (!process.env.MJ_APIKEY_PUBLIC || !process.env.MJ_APIKEY_PRIVATE) {
      this.app.log.warn(logFields, 'E-mail notifications are not configured properly.');
      return;
    }

    const mailjetClient = Mailjet.connect(process.env.MJ_APIKEY_PUBLIC, process.env.MJ_APIKEY_PRIVATE);
    const request = mailjetClient.post('send', { version: 'v3.1' }).request({
      Messages: [
        {
          From: {
            Email: process.env.MJ_FROM_ADDRESS,
            Name: process.env.MJ_FROM_NAME,
          },
          To: [
            {
              Email: process.env.MJ_TO_ADDRESS,
              Name: process.env.MJ_TO_NAME,
            },
          ],
          TemplateLanguage: true,
          Subject: `Kiali ${tagName} just released`,
          Variables: {
            version: tagName,
          },
          TextPart: plainTextNotification,
          HTMLPart: htmlNotification,
        },
      ],
    });

    request
      .then(
        (): void => {
          this.app.log.info(logFields, 'New release e-mail notification has been queued.');
        },
      )
      .catch(
        (err): void => {
          this.app.log.error(logFields, 'Failed to send e-mail notification for new release.');
          this.app.log.debug(logFields, err);
        },
      );
  };
}
