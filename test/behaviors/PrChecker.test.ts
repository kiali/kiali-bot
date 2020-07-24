import nock from 'nock';
import { Probot } from 'probot';
import kialiBot from '../../src';
import PrChecker from '../../src/behaviors/PrChecker';

import configYml from '../fixtures/response.kiali.yml.json';
import emptyConfigYml from '../fixtures/response.empty.kiali.yml.json';
import configYmlTwoMandatory from '../fixtures/pr_checker/response.kiali.yml.two_mandatory.json';
import searchIssuesResult from '../fixtures/pr_checker/response.search_issues.b86f1.json';
import getPr38Result from '../fixtures/pr_checker/response.get_pr38.json';
import getPr38BotResult from '../fixtures/pr_checker/response.get_pr38_bot.json';
import getPr38ReviewsApprovedResult from '../fixtures/pr_checker/response.get_reviews_pr38.approved.json';
import getPr38ReviewsNotApprovedResult from '../fixtures/pr_checker/response.get_reviews_pr38.not_approved.json';

import prOpenedPayload from '../fixtures/event.owner.pull_request.opened.json';
import prReopenedPayload from '../fixtures/event.owner.pull_request.reopened.json';
import prReviewSubmittedPayload from '../fixtures/pr_checker/event.fork.pr_review.submitted.json';
import prBotReviewSubmittedPayload from '../fixtures/pr_checker/event.bot.pr_review.submitted.json';
import prApprovedReviewSubmittedPayload from '../fixtures/pr_checker/event.fork.pr_review.approved.json';
import prApprovedOptionalSubmittedPayload from '../fixtures/pr_checker/event.fork.pr_review.approved_optional.json';
import checkRunCreatedPayload from '../fixtures/pr_checker/event.owner.check_run.created.json';
import notOwnedCheckRunCreatedPayload from '../fixtures/pr_checker/event.owner.check_run.created_not_owned.json';
import nonCheckerCheckRunCreatedPayload from '../fixtures/pr_checker/event.owner.check_run.created_not_checker.json';
import nonQueuedCheckRunCreatedPayload from '../fixtures/pr_checker/event.owner.check_run.created_not_queued.json';

nock.disableNetConnect();

describe('Pull request checker', () => {
  let probot: Probot;

  beforeEach(() => {
    probot = new Probot({ id: 123, githubToken: 'test' });
    probot.load(kialiBot);
    nock.cleanAll();
  });

  test('enqueues a check_run when pull request is opened', async () => {
    const scope = nock('https://api.github.com');

    scope.get('/repos/dummyOwner/useless/contents/.github/kiali.yml').reply(200, configYml);

    let createRunRequest: any;
    scope
      .post('/repos/dummyOwner/useless/check-runs', (body: any) => {
        createRunRequest = body;
        return true;
      })
      .reply(201, {});

    // Send opened event
    return probot.receive({ name: 'pull_request', id: '123', payload: prOpenedPayload }).then(() => {
      scope.done();
      expect(createRunRequest).toMatchObject({
        status: 'queued',
        name: PrChecker.CHECK_NAME,
        head_sha: prOpenedPayload.pull_request.head.sha,
      });
    });
  });

  test('enqueues a check_run when pull request is re-opened', async () => {
    const scope = nock('https://api.github.com');

    scope.get('/repos/dummyOwner/useless/contents/.github/kiali.yml').reply(200, configYml);

    let createRunRequest: any;
    scope
      .post('/repos/dummyOwner/useless/check-runs', (body: any) => {
        createRunRequest = body;
        return true;
      })
      .reply(201, {});

    // Send opened event
    return probot.receive({ name: 'pull_request', id: '123', payload: prReopenedPayload }).then(() => {
      scope.done();
      expect(createRunRequest).toMatchObject({
        status: 'queued',
        name: PrChecker.CHECK_NAME,
        head_sha: prReopenedPayload.pull_request.head.sha,
      });
    });
  });

  test('enqueues a check_run when non-approved review is submitted', async () => {
    const scope = nock('https://api.github.com');

    scope.get('/repos/dummyOwner/useless/contents/.github/kiali.yml').reply(200, configYml);

    let createRunRequest: any;
    scope
      .post('/repos/dummyOwner/useless/check-runs', (body: any) => {
        createRunRequest = body;
        return true;
      })
      .reply(201, {});

    // Send review event
    return probot.receive({ name: 'pull_request_review', id: '123', payload: prReviewSubmittedPayload }).then(() => {
      scope.done();
      expect(createRunRequest).toMatchObject({
        status: 'queued',
        name: PrChecker.CHECK_NAME,
        head_sha: prReviewSubmittedPayload.pull_request.head.sha,
      });
    });
  });

  test('does nothing if a review is submitted by a bot', async () => {
    const scope = nock('https://api.github.com');

    scope
      .get('/repos/dummyOwner/useless/contents/.github/kiali.yml')
      .reply(200, configYml)
      .get(/.*/)
      .reply(200, '')
      .post(/.*/)
      .reply(200, '')
      .put(/.*/)
      .reply(200, '')
      .head(/.*/)
      .reply(200, '')
      .delete(/.*/)
      .reply(200, '')
      .patch(/.*/)
      .reply(200, '');

    // Send review event
    return probot.receive({ name: 'pull_request_review', id: '123', payload: prBotReviewSubmittedPayload }).then(() => {
      expect(scope.pendingMocks()).toHaveLength(7);
    });
  });

  test('creates passed check_run if an approved review is submitted with only one mandatory review', async () => {
    const scope = nock('https://api.github.com');

    scope.get('/repos/dummyOwner/useless/contents/.github/kiali.yml').reply(200, configYml);

    let createRunRequest: any;
    scope
      .post('/repos/dummyOwner/useless/check-runs', (body: any) => {
        createRunRequest = body;
        return true;
      })
      .reply(201, {});

    // Send review event
    return probot
      .receive({ name: 'pull_request_review', id: '123', payload: prApprovedReviewSubmittedPayload })
      .then(() => {
        scope.done();
        expect(createRunRequest).toMatchObject({
          status: 'completed',
          name: PrChecker.CHECK_NAME,
          conclusion: 'success',
          head_sha: prApprovedReviewSubmittedPayload.pull_request.head.sha,
        });
      });
  });

  test('does nothing if a non-mandatory approved review is submitted', async () => {
    const scope = nock('https://api.github.com');

    scope.get('/repos/dummyOwner/useless/contents/.github/kiali.yml').reply(200, configYml);

    // Send review event
    return probot
      .receive({ name: 'pull_request_review', id: '123', payload: prApprovedOptionalSubmittedPayload })
      .then(() => {
        scope.done();
      });
  });

  test('does nothing if created check_run is not owned by the app', async () => {
    const scope = nock('https://api.github.com');

    scope
      .get(/.*/)
      .reply(200, '')
      .post(/.*/)
      .reply(200, '')
      .put(/.*/)
      .reply(200, '')
      .head(/.*/)
      .reply(200, '')
      .delete(/.*/)
      .reply(200, '')
      .patch(/.*/)
      .reply(200, '');

    // Send review event
    return probot.receive({ name: 'check_run', id: '123', payload: notOwnedCheckRunCreatedPayload }).then(() => {
      expect(scope.pendingMocks()).toHaveLength(6);
    });
  });

  test('does nothing if created check_run is not owned by the checker', async () => {
    const scope = nock('https://api.github.com');

    scope
      .get(/.*/)
      .reply(200, '')
      .post(/.*/)
      .reply(200, '')
      .put(/.*/)
      .reply(200, '')
      .head(/.*/)
      .reply(200, '')
      .delete(/.*/)
      .reply(200, '')
      .patch(/.*/)
      .reply(200, '');

    // Send review event
    return probot.receive({ name: 'check_run', id: '123', payload: nonCheckerCheckRunCreatedPayload }).then(() => {
      expect(scope.pendingMocks()).toHaveLength(6);
    });
  });

  test('does nothing if created check_run is not in queued state', async () => {
    const scope = nock('https://api.github.com');

    scope
      .get(/.*/)
      .reply(200, '')
      .post(/.*/)
      .reply(200, '')
      .put(/.*/)
      .reply(200, '')
      .head(/.*/)
      .reply(200, '')
      .delete(/.*/)
      .reply(200, '')
      .patch(/.*/)
      .reply(200, '');

    // Send review event
    return probot.receive({ name: 'check_run', id: '123', payload: nonQueuedCheckRunCreatedPayload }).then(() => {
      expect(scope.pendingMocks()).toHaveLength(6);
    });
  });

  test('checks succeed if the only mandatory reviewer have approved', async () => {
    const scope = nock('https://api.github.com');

    scope.get('/repos/dummyOwner/useless/contents/.github/kiali.yml').reply(200, configYml);

    scope
      .get('/search/issues')
      .query({ q: `sha:${checkRunCreatedPayload.check_run.head_sha} is:pr` })
      .reply(200, searchIssuesResult);

    scope.get('/repos/dummyOwner/useless/pulls/38').reply(200, getPr38Result);
    scope.get('/repos/dummyOwner/useless/pulls/38/reviews').reply(200, getPr38ReviewsApprovedResult);

    const checkRunUpdate: any[] = [];
    scope
      .patch(`/repos/dummyOwner/useless/check-runs/${checkRunCreatedPayload.check_run.id}`, (body: any) => {
        checkRunUpdate.push(body);
        return true;
      })
      .twice()
      .reply(200, {});

    // Send review event
    return probot.receive({ name: 'check_run', id: '123', payload: checkRunCreatedPayload }).then(() => {
      scope.done();

      // First check-run update should be 'in-progress'
      expect(checkRunUpdate[0]).toMatchObject({
        status: 'in_progress',
        started_at: expect.any(String),
      });

      // First check-run update should be 'completed'
      expect(checkRunUpdate[1]).toMatchObject({
        status: 'completed',
        conclusion: 'success',
        completed_at: expect.any(String),
      });
    });
  });

  test('checks fails if the only mandatory reviewer have not approved', async () => {
    const scope = nock('https://api.github.com');

    scope.get('/repos/dummyOwner/useless/contents/.github/kiali.yml').reply(200, configYml);

    scope
      .get('/search/issues')
      .query({ q: `sha:${checkRunCreatedPayload.check_run.head_sha} is:pr` })
      .reply(200, searchIssuesResult);

    scope.get('/repos/dummyOwner/useless/pulls/38').reply(200, getPr38Result);
    scope.get('/repos/dummyOwner/useless/pulls/38/reviews').reply(200, getPr38ReviewsNotApprovedResult);

    const checkRunUpdate: any[] = [];
    scope
      .patch(`/repos/dummyOwner/useless/check-runs/${checkRunCreatedPayload.check_run.id}`, (body: any) => {
        checkRunUpdate.push(body);
        return true;
      })
      .twice()
      .reply(200, {});

    // Send review event
    return probot.receive({ name: 'check_run', id: '123', payload: checkRunCreatedPayload }).then(() => {
      scope.done();

      // First check-run update should be 'in-progress'
      expect(checkRunUpdate[0]).toMatchObject({
        status: 'in_progress',
        started_at: expect.any(String),
      });

      // First check-run update should be 'completed' but failed
      expect(checkRunUpdate[1]).toMatchObject({
        status: 'completed',
        conclusion: 'failure',
        completed_at: expect.any(String),
      });
    });
  });

  test('checks fails if a mandatory reviewer have not approved', async () => {
    const scope = nock('https://api.github.com');

    scope.get('/repos/dummyOwner/useless/contents/.github/kiali.yml').reply(200, configYmlTwoMandatory);

    scope
      .get('/search/issues')
      .query({ q: `sha:${checkRunCreatedPayload.check_run.head_sha} is:pr` })
      .reply(200, searchIssuesResult);

    scope.get('/repos/dummyOwner/useless/pulls/38').reply(200, getPr38Result);
    scope.get('/repos/dummyOwner/useless/pulls/38/reviews').reply(200, getPr38ReviewsApprovedResult);

    const checkRunUpdate: any[] = [];
    scope
      .patch(`/repos/dummyOwner/useless/check-runs/${checkRunCreatedPayload.check_run.id}`, (body: any) => {
        checkRunUpdate.push(body);
        return true;
      })
      .twice()
      .reply(200, {});

    // Send review event
    return probot.receive({ name: 'check_run', id: '123', payload: checkRunCreatedPayload }).then(() => {
      scope.done();

      // First check-run update should be 'in-progress'
      expect(checkRunUpdate[0]).toMatchObject({
        status: 'in_progress',
        started_at: expect.any(String),
      });

      // First check-run update should be 'completed' but failed
      expect(checkRunUpdate[1]).toMatchObject({
        status: 'completed',
        conclusion: 'failure',
        completed_at: expect.any(String),
      });
    });
  });

  test('checks succeed if pull request is opened by the bot user', async () => {
    const scope = nock('https://api.github.com').log(console.log);

    scope
      .get('/search/issues')
      .query({ q: `sha:${checkRunCreatedPayload.check_run.head_sha} is:pr` })
      .reply(200, searchIssuesResult);

    scope.get('/repos/dummyOwner/useless/pulls/38').reply(200, getPr38BotResult);

    let checkRunUpdate: any;
    scope
      .patch(`/repos/dummyOwner/useless/check-runs/${checkRunCreatedPayload.check_run.id}`, (body: any) => {
        checkRunUpdate = body;
        return true;
      })
      .reply(200, {});

    // Send review event
    return probot.receive({ name: 'check_run', id: '123', payload: checkRunCreatedPayload }).then(() => {
      scope.done();

      expect(checkRunUpdate).toMatchObject({
        status: 'completed',
        conclusion: 'success',
        completed_at: expect.any(String),
      });
    });
  });

  describe('if checker is disabled', () => {
    test('does not create a check_run when pull request is opened', async () => {
      const scope = nock('https://api.github.com');

      scope.get('/repos/dummyOwner/useless/contents/.github/kiali.yml').reply(200, emptyConfigYml);

      // This should not be called
      scope.post(/.*/).reply(201, {});

      // Send opened event
      return probot.receive({ name: 'pull_request', id: '123', payload: prOpenedPayload }).then(() => {
        expect(scope.isDone()).toBeFalsy();
        expect(scope.pendingMocks()).toHaveLength(1);
      });
    });

    test('does not create a check_run when pull request is re-opened', async () => {
      const scope = nock('https://api.github.com');

      scope.get('/repos/dummyOwner/useless/contents/.github/kiali.yml').reply(200, emptyConfigYml);

      // This should not be called
      scope.post(/.*/).reply(201, {});

      // Send opened event
      return probot.receive({ name: 'pull_request', id: '123', payload: prReopenedPayload }).then(() => {
        expect(scope.isDone()).toBeFalsy();
        expect(scope.pendingMocks()).toHaveLength(1);
      });
    });

    test('does not create a check_run when non-approved review is submitted', async () => {
      const scope = nock('https://api.github.com');

      scope.get('/repos/dummyOwner/useless/contents/.github/kiali.yml').reply(200, emptyConfigYml);

      // This should not be called
      scope.post(/.*/).reply(201, {});

      // Send review event
      return probot.receive({ name: 'pull_request_review', id: '123', payload: prReviewSubmittedPayload }).then(() => {
        expect(scope.isDone()).toBeFalsy();
        expect(scope.pendingMocks()).toHaveLength(1);
      });
    });
  });
});
