import { describe, expect, it } from 'vitest';
import { DEFAULT_DISCORD_INVITE_URL, resolveDiscordInviteUrl } from '@/utils/supportLinks';
describe('resolveDiscordInviteUrl', () => {
  it('defaults to the Stammtisch invite', () => {
    expect(DEFAULT_DISCORD_INVITE_URL).toBe('https://discord.gg/tarkovstammtisch');
  });
  it.each([
    ['https://discord.gg/abc123', 'https://discord.gg/abc123'],
    ['  https://discord.gg/abc123  ', 'https://discord.gg/abc123'],
    ['https://discord.com/invite/abc123', 'https://discord.com/invite/abc123'],
  ])('accepts the Discord invite %j', (value, expected) => {
    expect(resolveDiscordInviteUrl(value)).toBe(expected);
  });
  it.each([
    undefined,
    null,
    '',
    '   ',
    42,
    'not a url',
    'http://discord.gg/abc',
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'https://evil.example/discord.gg/abc',
    'https://discord.gg.evil.example/abc',
    'https://evil.example/?u=https://discord.gg/abc',
    'https://discord.gg/',
    'https://discord.com/channels/1/2',
  ])('falls back for the unusable value %j', (value) => {
    expect(resolveDiscordInviteUrl(value)).toBe(DEFAULT_DISCORD_INVITE_URL);
  });
});
