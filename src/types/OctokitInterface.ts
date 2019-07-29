export interface Repo {
  owner: string;
  repo: string;
}

export class UnexpectedResponseError extends Error {
  public readonly actualStatusCode: number;
  public readonly expectedStatusCode: number;

  public constructor(actualStatusCode: number, expectedStatusCode: number, ...params: string[]) {
    super(...params);

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, UnexpectedResponseError);
    }

    this.actualStatusCode = actualStatusCode;
    this.expectedStatusCode = expectedStatusCode;
    this.name = 'UnexpectedResponseError';
  }
}
