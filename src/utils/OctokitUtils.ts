import { Octokit } from 'probot';
import { UnexpectedResponseError } from '../types/OctokitInterface';
import { getProbotApp } from '../globals';

interface CheckResponseOptions {
  expectedStatus?: number;
  errorMsg?: string;
  logFields?: Record<string, unknown>;
}

const defaultExpectedResponseCode = 200;

export function checkResponseStatus(
  response: Octokit.Response<unknown>,
  expectedStatus: number = defaultExpectedResponseCode,
  errorMsg?: string,
  logFields?: Record<string, unknown>,
): void {
  if (response.status !== expectedStatus) {
    const errorMessage = errorMsg
      ? errorMsg
      : `Unexpected response from GitHub: ${response.status} (expected = ${expectedStatus})`;

    if (logFields) {
      getProbotApp().log.warn(logFields, errorMessage);
    } else {
      getProbotApp().log.warn(errorMessage);
    }
    throw new UnexpectedResponseError(response.status, expectedStatus, errorMessage);
  }
}

export function checkResponseWith(response: Octokit.Response<unknown>, options: CheckResponseOptions): void {
  const copyOptions: CheckResponseOptions = { ...options };
  if (!copyOptions.expectedStatus) {
    copyOptions.expectedStatus = defaultExpectedResponseCode;
  }
  return checkResponseStatus(response, copyOptions.expectedStatus, copyOptions.errorMsg, copyOptions.logFields);
}
