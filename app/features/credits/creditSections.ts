import type { CreditMember } from '@/features/credits/types';
export interface CreditSection {
  key: string;
  members: CreditMember[];
  fullWidth?: boolean;
  compact?: boolean;
}
const githubProfile = (username: string) => `https://github.com/${username}`;
const githubMember = (name: string, username: string): CreditMember => ({
  name,
  link: githubProfile(username),
});
const sortMembers = (members: CreditMember[]) =>
  [...members].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
export const staticCreditSections: CreditSection[] = [
  {
    key: 'original_creator',
    members: [githubMember('Thaddeus', 'thaddeus')],
    fullWidth: true,
  },
  {
    key: 'beta_testers',
    members: sortMembers([
      githubMember('Adealia', 'adealia'),
      { name: 'Dio' },
      { name: 'GanjaManNL' },
      githubMember('Giribaldi_TTV', 'giribaldittv'),
      { name: 'LS4Tonio' },
      { name: 'Medivha' },
      { name: 'MrBreachie' },
      { name: 'mike' },
      { name: 'RuiApostolo' },
    ]),
    fullWidth: true,
    compact: true,
  },
];
