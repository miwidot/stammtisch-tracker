import { describe, expect, it } from 'vitest';
import { isLoopbackAddress } from '@/server/utils/loopbackOnly';
describe('isLoopbackAddress', () => {
  it.each(['127.0.0.1', '127.255.255.255', '::1', '::ffff:127.0.0.1'])('accepts %s', (a) => {
    expect(isLoopbackAddress(a)).toBe(true);
  });
  it.each([
    undefined,
    null,
    '',
    '0.0.0.0',
    '10.0.0.1',
    '::ffff:10.0.0.1',
    '127.0.0.01',
    '127.0.0.300',
    '::2',
    'localhost',
  ])('rejects %j', (a) => {
    expect(isLoopbackAddress(a as string | undefined)).toBe(false);
  });
});
