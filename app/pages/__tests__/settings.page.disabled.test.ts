// @vitest-environment nuxt
// Fork decision (LIGHT_THEME_ENABLED = false in app/utils/forkConfig.ts): the theme selector is
// unreachable, so AppearanceCard is never rendered on the preferences tab. This file mocks the
// real (disabled) flag value, overriding the global setup default (tests/fork-test-setup.ts,
// LIGHT_THEME_ENABLED=true) that lets app/pages/__tests__/settings.page.test.ts keep exercising
// upstream's original enabled-AppearanceCard behavior unmodified.
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import SettingsPage from '@/pages/settings.vue';
vi.mock('@/utils/forkConfig', () => ({ LIGHT_THEME_ENABLED: false }));
const { mockFns, mockState } = vi.hoisted(() => ({
  mockState: {
    isLoggedIn: false,
    isAdmin: false,
    gameEdition: 1,
    gameMode: 'pvp',
    prestigeLevel: 0,
    routeHash: '',
    routePath: '/settings',
  },
  mockFns: {
    setGameEdition: vi.fn(),
    syncPvpPrestigeLevel: vi.fn(),
    resetPvPData: vi.fn(),
    resetPvEData: vi.fn(),
    resetAllData: vi.fn(),
    routerReplace: vi.fn(),
    seoMeta: vi.fn(),
  },
}));
mockNuxtImport('useToast', () => () => ({
  add: vi.fn(),
}));
mockNuxtImport('useRouter', () => () => ({
  replace: mockFns.routerReplace,
  resolve: vi.fn(() => ({ href: '/' })),
  beforeEach: vi.fn(),
  beforeResolve: vi.fn(),
  onError: vi.fn(),
  afterEach: vi.fn(),
}));
mockNuxtImport('useRoute', () => () => ({
  get path() {
    return mockState.routePath;
  },
  query: {},
  get hash() {
    return mockState.routeHash;
  },
}));
mockNuxtImport('useSeoMeta', () => mockFns.seoMeta);
vi.mock('@/stores/useMetadata', () => ({
  useMetadataStore: () => ({
    editions: [{ value: 1, title: 'Standard' }],
  }),
}));
vi.mock('@/stores/useSystemStore', () => ({
  useSystemStore: () => ({
    get isAdmin() {
      return mockState.isAdmin;
    },
  }),
  useSystemStoreWithSupabase: () => ({
    hasInitiallyLoaded: ref(true),
  }),
}));
vi.mock('@/stores/useTarkov', () => ({
  useTarkovStore: () => ({
    get currentGameMode() {
      return mockState.gameMode;
    },
    getCurrentGameMode: () => mockState.gameMode,
    getGameEdition: () => mockState.gameEdition,
    setGameEdition: mockFns.setGameEdition,
    getPvPProgressData: () => ({ prestigeLevel: mockState.prestigeLevel }),
    syncPvpPrestigeLevel: mockFns.syncPvpPrestigeLevel,
    resetPvPData: mockFns.resetPvPData,
    resetPvEData: mockFns.resetPvEData,
    resetAllData: mockFns.resetAllData,
  }),
}));
vi.mock('@/features/settings/useDataManagementSession', () => ({
  useDataManagementSession: () => ({
    backup: {},
    eftLogs: {},
    tarkovDev: {},
  }),
}));
vi.mock('vue-i18n', async (importOriginal) => ({
  ...(await importOriginal<typeof import('vue-i18n')>()),
  useI18n: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));
const defaultGlobalStubs = {
  AccountDeletionCard: { template: '<div data-testid="account-deletion-card" />' },
  // Deliberately NOT stubbed: AppearanceCard. If the v-if gate ever regresses and the real
  // component renders, a missing dependency (e.g. useTheme's Nuxt state) would surface as a
  // mount error rather than silently passing a `data-testid` stub check.
  DataManagementCard: {
    props: ['session', 'view'],
    template:
      '<div :data-has-session="session ? \'true\' : \'false\'" :data-testid="`data-management-card-${view}`" />',
  },
  DisplayNameCard: { template: '<div data-testid="display-name-card" />' },
  NuxtLink: { template: '<a><slot /></a>' },
  SelectMenuFixed: {
    props: ['modelValue', 'items'],
    emits: ['update:modelValue'],
    template:
      '<select data-testid="u-select" @change="$emit(\'update:modelValue\', Number($event.target.value))"><option v-for="opt in (items || [])" :key="opt.value ?? opt" :value="opt.value ?? opt">{{ opt.label || opt }}</option></select>',
  },
  'i18n-t': { template: '<span><slot /><slot name="word" /></span>' },
  ExperienceCard: { template: '<div data-testid="experience-card" />' },
  GeneralPreferencesCard: { template: '<div data-testid="general-preferences-card" />' },
  KeybindsCard: { template: '<div data-testid="keybinds-card" />' },
  MapSettingsCard: { template: '<div data-testid="map-settings-card" />' },
  PrestigeCard: { template: '<div data-testid="prestige-card" />' },
  ProfileSharingCard: { template: '<div data-testid="profile-sharing-card" />' },
  ResetProgressCard: { template: '<div data-testid="reset-progress-card" />' },
  SkillsCard: { template: '<div id="skills" data-testid="skills-card" />' },
  UAlert: true,
  UBadge: true,
  UButton: {
    props: ['disabled'],
    emits: ['click'],
    template:
      '<button data-testid="u-button" :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
  },
  UIcon: true,
  UInput: true,
  UModal: true,
  TaskDisplayCard: { template: '<div data-testid="task-display-card" />' },
  UTabs: {
    props: ['items', 'modelValue'],
    emits: ['update:modelValue'],
    template: `
      <div data-testid="tabs">
        <button
          v-for="item in (items || [])"
          :key="item.value"
          type="button"
          :data-testid="'tab-' + item.value"
          @click="$emit('update:modelValue', item.value)"
        >
          {{ item.label }}
        </button>
      </div>
    `,
  },
  USelectMenu: {
    props: ['modelValue', 'items', 'options'],
    emits: ['update:modelValue'],
    template:
      '<select data-testid="u-select" @change="$emit(\'update:modelValue\', Number($event.target.value))"><option v-for="opt in (items || options || [])" :key="opt.value ?? opt" :value="opt.value ?? opt">{{ opt.label || opt.title || opt }}</option></select>',
  },
  UTooltip: { template: '<span><slot /></span>' },
};
const configureMockState = (
  options: {
    routeHash?: string;
    routePath?: string;
  } = {}
) => {
  mockState.routeHash = options.routeHash ?? '';
  mockState.routePath = options.routePath ?? '/settings';
};
describe('settings page theme card disabled (fork: light theme unreachable)', () => {
  beforeEach(() => {
    configureMockState();
    vi.clearAllMocks();
  });
  const globalConfig = {
    stubs: defaultGlobalStubs,
    mocks: { $t: (key: string) => key },
  };
  it('does not render the appearance/theme card on the preferences tab', async () => {
    configureMockState({ routePath: '/preferences' });
    const wrapper = await mountSuspended(SettingsPage, {
      global: globalConfig,
    });
    await vi.dynamicImportSettled();
    expect(wrapper.find('[data-testid="general-preferences-card"]').exists()).toBe(true);
    expect(wrapper.find('input[type="radio"][name="theme-mode-selection"]').exists()).toBe(false);
    expect(wrapper.text()).not.toContain('settings.appearance.theme_light');
  });
});
