import { describe, expect, it } from 'vitest';
import * as teamMembersModule from '@/features/about/teamMembers';
import { memberLink, membersByGroup, teamMembers } from '@/features/about/teamMembers';
describe('teamMembers roster', () => {
  it('keeps a stable group order: core first, then support, then partners', () => {
    const groups = teamMembers.map((member) => member.group);
    const firstSupport = groups.indexOf('support');
    const firstPartner = groups.indexOf('partner');
    expect(groups.indexOf('core')).toBe(0);
    expect(firstSupport).toBeGreaterThan(-1);
    expect(firstPartner).toBeGreaterThan(firstSupport);
  });
  it('lists every roster id exactly once', () => {
    const ids = teamMembers.map((member) => member.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('partners expose a project URL and label', () => {
    for (const partner of membersByGroup('partner')) {
      expect(partner.projectUrl).toMatch(/^https:\/\//);
      expect(partner.projectLabelKey).toBeTruthy();
    }
  });
  it('uses i18n keys for roles, never raw copy', () => {
    for (const member of teamMembers) {
      expect(member.roleKey).toMatch(/^page\.about\.roles\./);
    }
  });
  it('exposes no avatar URL helper, so no member can trigger a remote image request', () => {
    expect('memberAvatarUrl' in teamMembersModule).toBe(false);
    expect(JSON.stringify(teamMembers)).not.toMatch(/\.(png|jpe?g|webp)\b/);
  });
  it('links members to GitHub profiles or partner projects', () => {
    const dysekt = teamMembers.find((member) => member.id === 'dysektai');
    expect(memberLink(dysekt!)).toEqual({
      href: 'https://github.com/dysektai',
      icon: 'i-mdi-github',
      labelKey: 'page.about.github_profile',
    });
    const razzmatazz = teamMembers.find((member) => member.id === 'razzmatazz');
    expect(memberLink(razzmatazz!)).toEqual({
      href: 'https://tarkov.dev/',
      icon: 'i-mdi-open-in-new',
      labelKey: 'page.about.projects.tarkov_dev',
    });
    expect(memberLink(dioFixture())).toBeNull();
  });
});
const dioFixture = () => {
  const dio = teamMembers.find((member) => member.id === 'dio');
  if (!dio) throw new Error('roster changed: dio missing');
  return dio;
};
