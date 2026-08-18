import { vi } from 'vitest';

/** Chainable thenable used to stub Mongoose Query objects. */
export function mockQuery<T>(result: T) {
  const query: Record<string, unknown> = {};
  const self = () => query;
  query.select = vi.fn(self);
  query.sort = vi.fn(self);
  query.limit = vi.fn(self);
  query.skip = vi.fn(self);
  query.populate = vi.fn(self);
  query.lean = vi.fn(self);
  query.then = (resolve: (value: T) => unknown, reject?: (reason: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  query.catch = (reject: (reason: unknown) => unknown) => Promise.resolve(result).catch(reject);
  return query;
}

export function mockFind<T>(result: T) {
  return vi.fn(() => mockQuery(result));
}

export function mockFindOne<T>(result: T) {
  const fn = vi.fn(() => mockQuery(result));
  return fn;
}
