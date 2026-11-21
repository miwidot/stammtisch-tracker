import type { ChangelogItem } from '@/types/changelog';
/**
 * Fork-only: our own changelog entries, shown on /changelog on top of upstream's GitHub releases.
 * Upstream never touches this file, so entries survive upstream syncs. Add new entries at the
 * top, newest first. Plain language for players, no internals. Bullets that start with an
 * English or German verb (Added/Hinzugefügt, Updated/Aktualisiert, Improved/Verbessert,
 * Fixed/Behoben) get the matching badge; all others show the neutral "Changed" badge.
 */
export type ForkChangelogLocale = 'de' | 'en';
interface ForkChangelogEntry {
  date: string;
  label: Record<ForkChangelogLocale, string>;
  bullets: Record<ForkChangelogLocale, readonly string[]>;
}
export const FORK_CHANGELOG_ENTRIES: readonly ForkChangelogEntry[] = [
  {
    date: '2026-11-22',
    label: { de: 'Bitte Einstellungen prüfen', en: 'Please check your settings' },
    bullets: {
      de: [
        'Die automatische Level-Berechnung gibt es nicht mehr, ebenso den XP-Abgleich in den Einstellungen. Dein gespeichertes Level bleibt erhalten, wird aber nicht mehr aus deiner Erfahrung berechnet. Wenn du die Automatik genutzt hast: Prüfe dein Level und stelle es bei Bedarf selbst ein, per Klick auf die Level-Zahl in der linken Leiste oder unter Einstellungen > Fortschritt.',
        'Die Hideout-Optionen „Bereit zum Bauen zuerst sortieren“ und „Fertige Stationen einklappen“ wurden entfernt, es gibt dafür keinen Ersatz. Wenn du sie eingeschaltet hattest, sind sie jetzt aus.',
        'Dein Quest- und Hideout-Fortschritt bleibt vollständig erhalten.',
      ],
      en: [
        'Automatic level calculation is gone, and so is the XP adjustment in the settings. Your saved level is kept, but it is no longer worked out from your experience. If you used the automatic mode, please check your level and set it yourself if needed, by clicking the level number in the left sidebar or under Settings > Progression.',
        'The hideout options "Sort ready to build first" and "Collapse completed stations" were removed and have no replacement. If you had them switched on, they are off now.',
        'All your task, hideout and other progress stays fully intact.',
      ],
    },
  },
  {
    date: '2026-11-22',
    label: { de: 'Stammtisch-Update', en: 'Stammtisch update' },
    bullets: {
      de: [
        'Aktualisiert auf die neueste TarkovTracker-Version (1.90). Das Stammtisch-Design und die Farben bleiben, wie sie sind',
        'Hinzugefügt: Etagen-Hinweise, Extract-Voraussetzungen und ein Schalter für Transit-Orte auf den Karten. Die Karten merken sich, welche Ebenen du ausgeblendet hast',
        'Hinzugefügt: Aufgaben lassen sich aus den Listen ausblenden. Benötigte Gegenstände ignorieren die Ziele ausgeblendeter Aufgaben',
        'Verbessert: Aufgabenkarten sind übersichtlicher, mit einfacheren Aktionen, verständlichen Voraussetzungen, Erklärungen zu Händlerstufen, Waffen-Bauteilen und Wartezeiten. Die Händleransicht ist nach den Aufgabengruppen des Spiels gegliedert',
        'Hinzugefügt: Nächste Schritte und Freischalt-Hinweise für die Storyline, mit einer Kapitelleiste im Stil des Spiels',
        'Hinzugefügt: Suche direkt in der oberen Leiste und eine kompakte „Als Nächstes“-Liste auf der Startseite',
        'Hinzugefügt: Prestige im PvE-Modus. Dein Fortschritt wird zuverlässiger gespeichert und synchronisiert, auch bei sehr großen Datenmengen',
        'Verbessert: Der Import aus den EFT-Logs unterscheidet jetzt Spielmodi und Quest-Zustände',
        'Verbessert: Die Anmeldung über dein Stammtisch-Konto ist sicherer. Du musst nichts tun',
        'Aktualisiert: „Problem melden“ und die Discord-Links führen jetzt zum Stammtisch-Discord',
        'Aktualisiert: Datenschutz und Nutzungsbedingungen verweisen auf die Seiten des Stammtischs. Dein Konto löschst du in den Kontoeinstellungen auf tarkov-stammtisch.de',
      ],
      en: [
        'Updated to the latest TarkovTracker version (1.90). The Stammtisch design and colours stay as they are',
        'Added floor hints, extract requirements and a transit locations toggle on the maps. The maps remember which layers you hid',
        'Added the option to hide tasks from your task lists. Needed items ignore the objectives of hidden tasks',
        'Improved task cards with simpler actions, plain-language requirements, explanations of trader tiers, weapon build parts and time gates. The trader view is split by in-game task group',
        'Added Storyline next steps and unlock guidance, with an in-game style chapter list',
        'Added search right in the top bar and a compact "Up next" list on the start page',
        'Added prestige for PvE. Your progress now saves and syncs more reliably, even with very large amounts of data',
        'Improved the EFT log import, which now tells game modes and quest states apart',
        'Improved the login with your Stammtisch account, which is now more secure. You do not need to do anything',
        'Updated "Report a problem" and the Discord links, which now lead to the Stammtisch Discord',
        'Updated privacy and terms to point to the Stammtisch pages. You delete your account in the account settings on tarkov-stammtisch.de',
      ],
    },
  },
];
export const parseForkChangelogLocale = (value: unknown): ForkChangelogLocale => {
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === 'string' && raw.trim().toLowerCase().startsWith('de') ? 'de' : 'en';
};
export const forkChangelogItems = (locale: ForkChangelogLocale): ChangelogItem[] =>
  FORK_CHANGELOG_ENTRIES.map((entry) => ({
    date: entry.date,
    label: entry.label[locale],
    bullets: [...entry.bullets[locale]],
  }));
