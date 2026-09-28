import { AppError, CLIENT_ERROR_CODES, ERROR_CODES, friendlyMessages, isRelayErrorCode } from '../errors';

describe('error codes', () => {
  it('has a friendly message for every relay and client code', () => {
    for (const code of [...ERROR_CODES, ...CLIENT_ERROR_CODES]) {
      expect(friendlyMessages[code]).toEqual(expect.any(String));
      expect(friendlyMessages[code].length).toBeGreaterThan(0);
    }
  });

  it('recognises relay codes only', () => {
    expect(isRelayErrorCode('RATE_LIMITED')).toBe(true);
    expect(isRelayErrorCode('OFFLINE')).toBe(false);
    expect(isRelayErrorCode(42)).toBe(false);
  });

  it('exposes the friendly message and request id on AppError', () => {
    const error = new AppError('NOT_FOOD', 'req-1');
    expect(error.friendlyMessage).toBe(friendlyMessages.NOT_FOOD);
    expect(error.requestId).toBe('req-1');
  });
});
