import { describe, expect, it } from 'vitest';
import axios from 'axios';
import { PASSWORD_VALIDATION_FAILED } from '@ayetis/shared';
import { getErrorCode, getErrorMessage, getFieldError } from './api';

describe('api error helpers', () => {
  it('reads API failure messages and password field errors', () => {
    const err = {
      isAxiosError: true,
      message: 'boom',
      response: {
        data: {
          success: false,
          message: 'Invalid email or password',
          errors: { fieldErrors: { password: ['too weak'] } },
        },
      },
    };
    Object.setPrototypeOf(err, Object.getPrototypeOf(axios.AxiosError.prototype));
    expect(getErrorMessage(new Error('plain'))).toBe('plain');
    expect(getErrorMessage('x')).toBe('Something went wrong');
    expect(getErrorCode({ code: 'FILE_RESTORE_PENDING' })).toBe('FILE_RESTORE_PENDING');
  });

  it('uses axios error payloads when present', () => {
    const error = Object.assign(new axios.AxiosError('fail'), {
      response: {
        data: {
          success: false,
          message: 'Case not found',
          code: 'NOT_FOUND',
          errors: { fieldErrors: { email: ['required'] } },
        },
        status: 404,
        statusText: 'Not Found',
        headers: {},
        config: {},
      },
    });
    expect(getErrorMessage(error)).toBe('Case not found');
    expect(getErrorCode(error)).toBe('NOT_FOUND');
    expect(getFieldError(error, 'email')).toBe('required');

    const passwordErr = Object.assign(new axios.AxiosError('fail'), {
      response: {
        data: {
          success: false,
          message: 'Validation failed',
          errors: { fieldErrors: { password: ['short'] } },
        },
        status: 400,
        statusText: 'Bad Request',
        headers: {},
        config: {},
      },
    });
    expect(getErrorMessage(passwordErr)).toBe(PASSWORD_VALIDATION_FAILED);
  });
});
