import { describe, expect, it } from 'vitest';
import { isLoopbackHostname, normalizeSupabaseUrl } from '@/server/utils/adminSupabase';
describe('normalizeSupabaseUrl', () => {
  it.each([
    ['https://abc.supabase.co', 'https://abc.supabase.co'],
    ['https://abc.supabase.co/', 'https://abc.supabase.co'],
    ['  https://abc.supabase.co/?x=1#frag ', 'https://abc.supabase.co'],
    ['http://127.0.0.1:8200', 'http://127.0.0.1:8200'],
    ['http://127.0.0.1:8200/', 'http://127.0.0.1:8200'],
    ['http://127.1.2.3:8200', 'http://127.1.2.3:8200'],
    ['http://localhost:8200', 'http://localhost:8200'],
    ['http://LOCALHOST:8200', 'http://localhost:8200'],
    ['http://[::1]:8200', 'http://[::1]:8200'],
    ['http://127.0.0.1:8200/?a=b#c', 'http://127.0.0.1:8200'],
    // The URL parser canonicalizes these to a real 127.0.0.1, which is what fetch connects to.
    ['http://2130706433:8200', 'http://127.0.0.1:8200'],
    ['http://0x7f000001:8200', 'http://127.0.0.1:8200'],
    ['http://127.1:8200', 'http://127.0.0.1:8200'],
    ['https://127.0.0.1:8200', 'https://127.0.0.1:8200'],
  ])('accepts %s', (input, expected) => {
    expect(normalizeSupabaseUrl(input)).toBe(expected);
  });
  it.each([
    undefined,
    null,
    42,
    {},
    [],
    '',
    '   ',
    'not a url',
    '127.0.0.1:8200',
    'http://abc.supabase.co',
    'http://example.com',
    'http://10.0.0.5:8200',
    'http://192.168.1.10',
    'http://127.0.0.1.evil.com',
    'http://localhost.evil.com',
    'http://evil.com/127.0.0.1',
    'http://127.0.0.1@evil.com',
    'http://localhost@evil.com',
    'http://evil.com#@127.0.0.1',
    'http://user:pw@127.0.0.1:8200',
    'http://user@localhost',
    'https://user:pw@abc.supabase.co',
    'http://0.0.0.0:8200',
    'http://0:8200',
    'http://[::]:8200',
    'http://[::ffff:127.0.0.1]:8200',
    'http://[::ffff:10.0.0.1]:8200',
    'http://localhost.:8200',
    'http://127.0.0.1.:8200x',
    'http://%31%32%37.0.0.1.evil.com',
    'ftp://127.0.0.1',
    'ws://127.0.0.1:8200',
    'file:///etc/passwd',
    'javascript:alert(1)',
    'data:text/plain,hi',
  ])('rejects %j', (input) => {
    expect(normalizeSupabaseUrl(input)).toBe('');
  });
});
describe('isLoopbackHostname', () => {
  it.each(['localhost', '127.0.0.1', '127.255.255.255', '[::1]'])('true for %s', (host) => {
    expect(isLoopbackHostname(host)).toBe(true);
  });
  it.each([
    '',
    '0.0.0.0',
    '128.0.0.1',
    '126.0.0.1',
    'localhost.evil.com',
    '127.0.0.1.evil.com',
    '::1',
    'evil.localhost',
  ])('false for %j', (host) => {
    expect(isLoopbackHostname(host)).toBe(false);
  });
});
