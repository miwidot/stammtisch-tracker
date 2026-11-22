/**
 * Guards app/locales/de.overrides.json.
 *
 * The file is registered in nuxt.config.ts as the second entry of
 * `files: ['de.json', 'de.overrides.json']`, so its values shadow the
 * Crowdin-owned de.json. Nothing validates the key paths at build time:
 * a typo produces a key that silently overrides nothing, and the UI keeps
 * showing the untranslated string with no error anywhere.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
type Tree = { [key: string]: string | Tree };
// Read from disk rather than importing: the i18n build step pre-compiles
// message strings, so an import would hand us message ASTs instead of the
// text these assertions are about.
const localesDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (file: string) => JSON.parse(readFileSync(join(localesDir, file), 'utf-8')) as Tree;
const deOverrides = read('de.overrides.json');
const de = read('de.json');
const en = read('en.json');
function flatten(tree: Tree, prefix = ''): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') out.set(path, value);
    else for (const [k, v] of flatten(value, path)) out.set(k, v);
  }
  return out;
}
const overrides = flatten(deOverrides as Tree);
const source = flatten(en as Tree);
const crowdin = flatten(de as Tree);
// Identical in both languages on purpose: a brand name, and a badge that is
// pure formatting. Everything else matching English means someone pasted the
// source string in and the override does nothing.
const IDENTICAL_BY_DESIGN = new Set([
  'navigation_drawer.brand_name',
  // A trader's name. The override restores the English spelling on purpose —
  // see the Lightkeeper case below.
  'common.kappa_lightkeeper',
  // The trader's name again, on the Kappa tracker tab and the profile card.
  'common.lightkeeper',
  // Project names and a license identifier — none of these have a German
  // form, so the /herkunft page and footer attribution line intentionally
  // reuse the English label.
  'footer.attribution.tracker_label',
  'footer.attribution.license_label',
  // The upstream project's domain name, used as the footer quick-link
  // label pointing at our own /herkunft page — a proper noun, not text to
  // translate.
  'footer.origin_link',
  'page.herkunft.origin.tracker_label',
  'page.herkunft.origin.license_label',
  'page.herkunft.origin.license_file_label',
  // "Credits" is the loanword this app already uses in German
  // (common.credits carries the same English spelling).
  'page.herkunft.origin.credits_label',
  'page.herkunft.related.tarkovtracker',
  'page.herkunft.related.tarkov_data_overlay',
  'page.herkunft.related.tarkov_dev',
  'page.herkunft.related.tarkov_monitor',
  'page.herkunft.related.ratscanner',
]);
describe('de.overrides.json', () => {
  it('overrides only keys that exist in the source locale', () => {
    const orphans = [...overrides.keys()].filter((key) => !source.has(key));
    expect(orphans).toEqual([]);
  });
  it('keeps every placeholder the source string declares', () => {
    const placeholders = (value: string) => (value.match(/\{[a-zA-Z]+\}/g) ?? []).sort();
    const broken = [...overrides].filter(
      ([key, value]) => placeholders(value).join() !== placeholders(source.get(key) ?? '').join()
    );
    expect(broken).toEqual([]);
  });
  it('carries no entry that merely repeats the English source', () => {
    const untranslated = [...overrides]
      .filter(([key]) => !IDENTICAL_BY_DESIGN.has(key))
      .filter(([key, value]) => value === source.get(key));
    expect(untranslated).toEqual([]);
  });
  it('keeps the by-design exceptions honest', () => {
    const stale = [...IDENTICAL_BY_DESIGN].filter((key) => !overrides.has(key));
    expect(stale, 'exception listed for a key the override file no longer has').toEqual([]);
  });
});
describe('reported translation defects', () => {
  // "Reset Failed" is an imperative — reset the failed status. The Crowdin
  // export reads it as a past-tense error report ("resetting has failed"),
  // which is a different statement on a button.
  it('renders common.reset_failed as a command, not an error report', () => {
    expect(crowdin.get('common.reset_failed')).toBe('Zurücksetzen fehlgeschlagen');
    expect(overrides.get('common.reset_failed')).toBe('Fehlgeschlagen zurücksetzen');
  });
  // The task card's action buttons are commands. The Crowdin export renders
  // two of them as something else: a noun ("Fehler" = an error) and a stray
  // adverb reading ("Vollständig markieren" = mark completely).
  it('renders the task card actions as commands', () => {
    expect(crowdin.get('common.fail')).toBe('Fehler');
    expect(overrides.get('common.fail')).toBe('Fehlgeschlagen');
    expect(crowdin.get('common.mark_complete')).toBe('Vollständig markieren');
    expect(overrides.get('common.mark_complete')).toBe('Als abgeschlossen markieren');
  });
  // Trader names are proper nouns. BSG's own German bundle leaves Lightkeeper
  // untranslated (only Jaeger and BTR Driver get German forms), and every other
  // string in this UI writes "Lightkeeper" too. The Crowdin export invented
  // "Lichthalter" for the menu entry alone, so the one place a reader meets the
  // trader in navigation disagreed with everywhere else they meet him.
  it('keeps the Lightkeeper trader name in the menu entry', () => {
    expect(crowdin.get('common.kappa_lightkeeper')).toBe('Kappa & Lichthalter');
    expect(overrides.get('common.kappa_lightkeeper')).toBe('Kappa & Lightkeeper');
  });
  // The Kappa & Lightkeeper tracker page is restored by the fork (FORK.md 3.15). Upstream dropped its
  // page.kappa keys from en.json when it retired the page, so Crowdin stops carrying them: the
  // overrides keep the page German on their own.
  it('translates every key of the restored Kappa tracker page', () => {
    const kappaKeys = [...source.keys()].filter((key) => key.startsWith('page.kappa.'));
    expect(kappaKeys.length).toBeGreaterThan(0);
    for (const key of kappaKeys) {
      expect(overrides.get(key), `${key} has no German override`).toEqual(expect.any(String));
    }
  });
  it('keeps the Lightkeeper trader name on the Kappa tracker tab', () => {
    expect(crowdin.get('common.lightkeeper')).toBe('Leuchtturm');
    expect(overrides.get('common.lightkeeper')).toBe('Lightkeeper');
  });
  // The compact-cards setting is still English in the Crowdin export; the override
  // gives it the same "einklappen" verb the card collapse label uses.
  it('translates the collapse-finished-objectives card setting', () => {
    const path = 'page.tasks.settings.cards.collapse_completed_objectives';
    expect(crowdin.get(path)).toBe(source.get(path));
    expect(overrides.get(path)).toBe('Ziele abgeschlossener Aufgaben einklappen');
  });
  // Collapse and expand are one pair; "erweitern" means extend, not unfold.
  it('pairs the card collapse and expand labels', () => {
    expect(crowdin.get('page.tasks.questcard.expand_task')).toBe('Aufgabe erweitern');
    expect(crowdin.get('page.tasks.questcard.collapse_task')).toBe('Aufgabe einklappen');
    expect(overrides.get('page.tasks.questcard.expand_task')).toBe('Aufgabe ausklappen');
  });
  // The wording the corrections above follow.
  it('follows the hide and expand verbs the bundle already uses', () => {
    expect(crowdin.get('hideout.expand')).toBe('Ausklappen');
    expect(crowdin.get('settings.account_data.hide_username')).toContain('ausblenden');
  });
  // The sibling buttons upstream already got right — these anchor the pattern
  // the two corrections above follow.
  it('matches the phrasing of the buttons that were already correct', () => {
    expect(crowdin.get('page.tasks.questcard.available_button')).toBe('Als verfügbar markieren');
    expect(crowdin.get('page.tasks.questcard.mark_failed')).toBe('Als fehlgeschlagen markieren');
  });
  // The Crowdin export still carries these storyline strings in English. Each one is overridden so
  // the German storyline page and dashboard card read as German throughout.
  it('translates the storyline strings Crowdin leaves in English', () => {
    const paths = [
      'page.dashboard.up_next.storyline.unlocks',
      'page.dashboard.up_next.storyline.objective_hint',
      'page.dashboard.up_next.storyline.choice',
      'page.dashboard.up_next.storyline.choice_hint',
      'page.dashboard.up_next.storyline.review',
      'page.dashboard.up_next.storyline.review_hint',
      'page.dashboard.traders.unlock_via_storyline',
      'page.storyline.chapter_nav_label',
      'page.storyline.chapter_eyebrow',
      'page.storyline.completed_during_tutorial',
      'page.storyline.timeline_unlocks',
      'page.tasks.blockers.trader_story_unlock',
      'page.tasks.requirements.story_alternative',
      'page.tasks.requirements.story_objective',
    ];
    for (const path of paths) {
      expect(crowdin.get(path), `${path} is no longer English in de.json; drop the override`).toBe(
        source.get(path)
      );
      expect(overrides.get(path), `${path} has no German override`).toEqual(expect.any(String));
      expect(overrides.get(path)).not.toBe(source.get(path));
    }
  });
  // Upstream translated the accepted-items popover itself, so the fork no longer overrides it.
  it('leaves the accepted-items popover to the Crowdin translation', () => {
    for (const key of ['any_of_items', 'any_of_items_short', 'view_accepted_items']) {
      const path = `needed_items.${key}`;
      expect(crowdin.get(path)).not.toBe(source.get(path));
      expect(overrides.has(path)).toBe(false);
    }
  });
});
// The German UI is Crowdin's de.json plus this override layer. Keys missing from both fall back
// to English, so an untranslated string shows up as "identical to en.json" in the merged view.
describe('effective German locale', () => {
  const effective = new Map([...crowdin, ...overrides]);
  const sameAsEnglish = [...source.keys()].filter(
    (key) => (effective.get(key) ?? source.get(key)) === source.get(key)
  );
  // The most visible strings: toolbar buttons, the task filter and requirement panels, the
  // blocker lines on locked task cards. A regression here is noticed by every German user at once.
  it('renders the most visible task and filter strings in German', () => {
    const visible = [
      'filter_menu.button',
      'filter_menu.button_active',
      'filter_menu.clear_all',
      'page.tasks.filters.title',
      'page.tasks.filters.types.title',
      'page.tasks.requirements.title',
      'page.tasks.requirements.met_count',
      'page.tasks.requirements.met',
      'page.tasks.requirements.unmet',
      'page.tasks.blockers.trader_story_unlock',
      'page.tasks.blockers.player_level_required',
      'page.tasks.blockers.trader_level_required',
      'page.tasks.trader_sections.loyalty_level',
      'page.tasks.questcard.time_gate',
      'page.tasks.hidden_tasks.section_title',
      'page.needed_items.filters.title',
      'page.needed_items.filters.found_in_raid.title',
      'page.hideout.settings.title',
      'maps.layers.title',
      'maps.extract_requirements.legend_title',
      'settings.data_management.recovery_copies_title',
      'settings.player_level.saved_title',
      'stash_import.title',
      'seo.routes.tasks_traders.title',
    ];
    for (const key of visible) {
      expect(source.has(key)).toBe(true);
      expect(effective.get(key), `${key} is missing in German`).toEqual(expect.any(String));
      expect(effective.get(key), `${key} is still English`).not.toBe(source.get(key));
    }
  });
  // User decision: the trader level reads "Loyalitätsstufe", never the English phrase and never
  // "Ansehensstufe". "Ansehen" stays only where the English says reputation or standing.
  it('words loyalty levels as Loyalitätsstufe', () => {
    expect(overrides.get('page.kappa.row.trader_level')).toBe('{trader} Loyalitätsstufe {level}');
    expect(overrides.get('page.tasks.trader_sections.loyalty_level')).toBe(
      'Loyalitätsstufe {level}'
    );
    expect(overrides.get('page.tasks.blockers.trader_level_required')).toBe(
      'Benötigt Loyalitätsstufe {requirement} bei {trader} (du: {current}).'
    );
    expect([...effective.values()].filter((value) => /Loyalty Level/i.test(value))).toEqual([]);
  });
  it('has no effective German string containing Ansehensstufe', () => {
    const offenders = [...effective].filter(([, value]) => /Ansehensstufe/i.test(value));
    expect(offenders).toEqual([]);
  });
  it('keeps Ansehen for reputation strings', () => {
    expect(overrides.get('page.tasks.requirements.trader_reputation')).toBe(
      '{trader} Ansehen {requirement}'
    );
  });
  // Terminology and form-of-address guard over the EFFECTIVE German strings (Crowdin de.json
  // merged with de.overrides.json), so a Crowdin sync that reintroduces a banned term fails here.
  describe('consistent German terminology and du-form', () => {
    // Polite forms of address are never allowed anywhere.
    const POLITE_FORMS =
      /\b(Ihr|Ihre|Ihrem|Ihren|Ihrer|Ihres|Ihnen)\b|\b[A-Za-zÄÖÜäöü]+(?:en|et|t) Sie\b/;
    // A bare "Sie" is only allowed where it means "they"/"it" (a sentence starting with Sie that
    // refers back to a plural or feminine noun). Each key was checked by hand; anything else
    // starting with "Sie" is the polite pronoun and must be rewritten as du-form.
    const SIE_MEANS_THEY_OR_IT = new Set([
      'progress_save_status.cloud_also_pending_note',
      'page.tasks.questcard.time_gate_tooltip',
      'page.resources.guides.tarkovmonitor.overview',
      'page.account_retention.scope',
      'page.account_retention.exceptions',
      'settings.data_management.bug_report_description',
      'settings.data_management.older_tab_recovery_available',
      'settings.data_management.superseded_other_season',
      'settings.data_management.recovery_copies_sign_in',
      'needed_items.hidden_for_you_hint',
      'stash_import.excess',
    ]);
    const offenders = (test: (key: string, value: string) => boolean) =>
      [...effective].filter(([key, value]) => test(key, value)).map(([key]) => key);
    it('uses du-form: no polite Ihr/Ihnen/"Klicken Sie" forms in any effective string', () => {
      expect(offenders((_key, value) => POLITE_FORMS.test(value))).toEqual([]);
    });
    it('uses du-form: a bare "Sie" only appears in the reviewed allow-list', () => {
      expect(
        offenders((key, value) => /\bSie\b/.test(value) && !SIE_MEANS_THEY_OR_IT.has(key))
      ).toEqual([]);
    });
    it('keeps every allow-listed Sie key real and still containing a Sie', () => {
      for (const key of SIE_MEANS_THEY_OR_IT) {
        expect(effective.get(key), `${key} no longer needs the allow-list`).toMatch(/\bSie\b/);
      }
    });
    it('words the settings page header in du-form', () => {
      expect(effective.get('settings.page_description')).toBe(
        'Verwalte dein Konto, deinen Spielfortschritt und die Einstellungen deiner Anwendung.'
      );
    });
    it('never says Unterschlupf: the hideout is "Hideout" as a feature name, "Versteck" in sentences', () => {
      expect(offenders((_key, value) => /Unterschlupf/i.test(value))).toEqual([]);
      expect(effective.get('omnibar.placeholder')).toBe(
        'Aufgaben, benötigte Gegenstände, Hideout...'
      );
      expect(effective.get('common.hideout')).toBe('Hideout');
    });
    it('says Gegenstand/Gegenstände instead of Artikel, and the nav matches the page text', () => {
      // "Artikel 6" (a legal article number) is not an item.
      // Only keys the UI can reach (present in en.json); de.json still carries a stale
      // Crowdin-only `page.needed_items.view.items` that nothing renders.
      expect(
        offenders((key, value) => source.has(key) && /\bArtikel\b(?!\s*\d)/.test(value))
      ).toEqual([]);
      expect(effective.get('common.needed_items')).toBe('Benötigte Gegenstände');
      expect(effective.get('common.item')).toBe('Gegenstand');
    });
  });
  // The /resources description no longer advertises the hidden TarkovMonitor (FORK.md 3.14).
  it('does not advertise TarkovMonitor in the resources meta description', () => {
    const key = 'seo.routes.resources.description';
    expect(source.get(key)).not.toMatch(/TarkovMonitor/i);
    expect(effective.get(key)).not.toMatch(/TarkovMonitor/i);
    expect(effective.get(key)).not.toBe(source.get(key));
  });
  // German keeps these as they are. Listing them keeps the guard below from flagging them, and
  // makes a newly appearing untranslated key an explicit decision instead of a silent fallback.
  const ENGLISH_ON_PURPOSE = new Set([
    // Loanwords and game terms German players use as-is (Level, Raid, PMC, Scav, Kappa, PvP, PvE,
    // FIR, Hideout, Dashboard, Team, API, Layout, Graph, Overlay, Wiki, Arena, Container).
    // The "Hideout" tab label stays because the navigation uses it too.
    // Proper nouns, brand names, file paths, key formats and pure placeholders follow below.
    // stash_import
    'stash_import.step_intake',
    'stash_import.raid_short_fir',
    'stash_import.found_fir',
    // toast
    'toast.clipboard_copied.description',
    // common
    'common.level',
    'common.hideout',
    'common.pvp',
    'common.pve',
    'common.scav',
    'common.lightkeeper',
    'common.kappa',
    'common.storyline',
    'common.credits',
    'common.streamer_tools',
    'common.prestige',
    'common.timmy',
    'common.dashboard',
    'common.optional',
    'common.lv',
    'common.kappa_lightkeeper',
    'common.lvl_level',
    'common.fir',
    'common.team',
    'common.api',
    // maps
    'maps.extract_requirements.paracord',
    'maps.tooltip_density',
    'maps.cursor_coordinates',
    'maps.factions.pmc',
    'maps.layers.transit',
    // page.dashboard
    'page.dashboard.up_next.storyline.chapter',
    'page.dashboard.up_next.reason.kappa',
    'page.dashboard.traders.rep_progress_label',
    // page.storyline
    'page.storyline.quest_route_unnamed',
    // page.tasks
    'page.tasks.auto_tracking_guide',
    'page.tasks.primary_views.graph',
    'page.tasks.filters.types.kappa',
    'page.tasks.blockers.task_status',
    'page.tasks.requirements.comparison_at_least',
    'page.tasks.requirements.player_level',
    'page.tasks.requirements.task',
    // page.hideout
    'page.hideout.stationcard.requirements.trader',
    // page.needed_items
    'page.needed_items.sort.name',
    'page.needed_items.view.layout',
    'page.needed_items.items_and_needs',
    // page.about
    'page.about.projects.tarkov_dev',
    // page.resources
    'page.resources.meta.windows',
    'page.resources.items.tarkovtracker_org_vs_io.name',
    'page.resources.items.tarkovdev.name',
    'page.resources.items.tarkovmonitor.name',
    'page.resources.items.ratscanner.name',
    'page.resources.items.cultistcircle.name',
    // page.herkunft
    'page.herkunft.origin.tracker_label',
    'page.herkunft.origin.license_label',
    'page.herkunft.origin.license_file_label',
    'page.herkunft.origin.credits_label',
    'page.herkunft.related.tarkovtracker',
    'page.herkunft.related.tarkov_data_overlay',
    'page.herkunft.related.tarkov_dev',
    'page.herkunft.related.tarkov_monitor',
    'page.herkunft.related.ratscanner',
    // footer
    'footer.call_to_action.github',
    'footer.origin_link',
    'footer.attribution.tracker_label',
    'footer.attribution.license_label',
    // navigation_drawer
    'navigation_drawer.brand_name',
    // profile
    'profile.season_short',
    // streamer_tools
    'streamer_tools.metric_label',
    'streamer_tools.platform_obs',
    'streamer_tools.platform_xsplit',
    'streamer_tools.layout_label',
    'streamer_tools.background_transparent',
    'streamer_tools.accent_info',
    'streamer_tools.accent_warning',
    'streamer_tools.resolution_1080',
    'streamer_tools.resolution_1440',
    'streamer_tools.container_label',
    'streamer_tools.colors_text',
    // settings
    'settings.tab_groups.app',
    'settings.interface.maps.objective_colors.palette',
    'settings.game_profile.game_edition_with_value',
    'settings.data_management.prestige_history_option',
    'settings.account_data.subscription_active',
    'settings.prestige.confirm_word',
    'settings.prestige.requirement_source.tarkov_dev',
    'settings.prestige.requirement_source.overlay',
    'settings.prestige.requirement_source.wiki',
    'settings.prestige.requirement_progress',
    'settings.log_import.default_path_value',
    'settings.log_import.session_folder_example_path',
    'settings.tarkov_dev_import.profile_url_placeholder',
    'settings.tarkov_dev_import.profile_url_hint_link',
    'settings.tarkov_dev_import.refetch_mode_arena',
    // needed_items
    'needed_items.progress_format',
    'needed_items.craft.title',
    // oauth
    'oauth.consent.error',
    // prestige
    'prestige.prestige_n',
    // seo
    'seo.site_name',
    'seo.routes.team.title',
  ]);
  // Fork-hidden features: the supporter page and banner, the TarkovMonitor guide link and card.
  const HIDDEN_FEATURE_KEYS = [
    /^page\.supporter\./,
    /^page\.dashboard\.support_banner\./,
    /^page\.resources\.items\.tarkovmonitor\./,
    /^page\.tasks\.auto_tracking_guide$/,
    /^settings\.account_data\.subscription_active$/,
  ];
  it('leaves no visible string untranslated except the listed loanwords', () => {
    const missing = sameAsEnglish
      .filter((key) => !ENGLISH_ON_PURPOSE.has(key) && !IDENTICAL_BY_DESIGN.has(key))
      .filter((key) => !HIDDEN_FEATURE_KEYS.some((pattern) => pattern.test(key)));
    expect(missing).toEqual([]);
  });
  it('keeps the English-on-purpose list honest', () => {
    const stale = [...ENGLISH_ON_PURPOSE].filter((key) => !sameAsEnglish.includes(key));
    expect(stale, 'listed as English but already translated or removed').toEqual([]);
  });
  it('keeps every override value free of leftover English phrasing in the translated set', () => {
    const english = /\b(the|your|with|and|for|from|click|failed|loading)\b/i;
    const leaked = [...overrides]
      .filter(([key, value]) => !IDENTICAL_BY_DESIGN.has(key) && value !== source.get(key))
      .filter(([, value]) => english.test(value.replace(/\{[^}]+\}/g, '')))
      .map(([key]) => key);
    expect(leaked).toEqual([]);
  });
});
