// @vitest-environment happy-dom
// Fork decision (LIGHT_THEME_ENABLED = false in app/utils/forkConfig.ts): the light theme is
// unreachable in this fork, so AppBar must never render either toggle control. This file mocks
// the real (disabled) flag value, overriding the global setup default (tests/fork-test-setup.ts,
// LIGHT_THEME_ENABLED=true) that lets app/shell/__tests__/AppBar.test.ts keep exercising
// upstream's original enabled-toggle behavior unmodified.
import { mockNuxtImport } from '@nuxt/test-utils/runtime';
import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { reactive, ref } from 'vue';
vi.mock('@/utils/forkConfig', () => ({ LIGHT_THEME_ENABLED: false }));
const localeRef = ref('en');
const setLocale = vi.fn(async (value: string) => {
  localeRef.value = value;
});
const mockSupabase = {
  user: {
    id: '',
    loggedIn: false,
    photoURL: '',
    displayName: '',
    username: '',
  },
  signOut: vi.fn(),
};
const mockToast = {
  add: vi.fn(),
};
const mockSkillCalculation = {
  migrateLegacySkillOffsets: vi.fn(),
};
const supporterTierRef = ref<string | null>(null);
const mockUseSupporter = vi.fn(() => ({
  activeTier: supporterTierRef,
}));
const mockMetadataStore = reactive({
  loading: false,
  hideoutLoading: false,
  updateLanguageAndGameMode: vi.fn(),
  fetchAllData: vi.fn(async () => {}),
});
const mockPreferencesStore = {
  getStreamerMode: false,
  getLocaleOverride: 'en' as string | null,
  setLocaleOverride: vi.fn(),
};
const routeState = reactive({
  name: 'tasks',
  params: {} as Record<string, unknown>,
});
const mockTarkovStore = {
  getCurrentGameMode: vi.fn(() => 'pvp'),
  getDisplayName: vi.fn(() => ''),
  getModeDisplayName: vi.fn((): string | null => null),
  getPvEProgressData: vi.fn((): { displayName: string | null } => ({ displayName: null })),
  getPvPProgressData: vi.fn((): { displayName: string | null } => ({ displayName: null })),
};
vi.mock('vue-i18n', async (importOriginal) => ({
  ...(await importOriginal<typeof import('vue-i18n')>()),
  useI18n: () => ({
    availableLocales: ['en', 'de', 'fr'],
    locale: localeRef,
    setLocale,
    t: (key: string) => key,
    te: () => false,
  }),
}));
const windowWidthRef = ref(1280);
vi.mock('@vueuse/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@vueuse/core')>()),
  useWindowSize: () => ({
    width: windowWidthRef,
  }),
}));
vi.mock('@/composables/useKeybinds', () => ({
  useKeybinds: vi.fn(),
}));
vi.mock('@/shell/ActivityLogPanel.vue', () => ({
  default: { name: 'ActivityLogPanel', template: '<div />' },
}));
vi.mock('@/features/omnibar/Omnibar.vue', () => ({
  default: { name: 'Omnibar', template: '<div />' },
}));
const mockThemeModeRef = ref<'dark' | 'light'>('dark');
const mockIsLightThemeRef = ref(false);
const mockToggleThemeMode = vi.fn();
vi.mock('@/composables/useTheme', () => ({
  useTheme: () => ({
    themeMode: mockThemeModeRef,
    isLightTheme: mockIsLightThemeRef,
    setThemeMode: vi.fn(),
    toggleThemeMode: mockToggleThemeMode,
  }),
}));
vi.mock('@/composables/useSupporter', () => ({
  useSupporter: () => mockUseSupporter(),
}));
vi.mock('@/stores/useActivityLogStore', () => ({
  useActivityLogStore: () => ({
    unreadCount: 0,
    hasUnread: false,
    allEntries: [],
    markAllAsRead: vi.fn(),
    clearLog: vi.fn(),
  }),
}));
vi.mock('@/stores/useApp', () => ({
  useAppStore: () => ({
    mobileDrawerExpanded: false,
    drawerRail: false,
    toggleMobileDrawerExpanded: vi.fn(),
    toggleDrawerRail: vi.fn(),
    setMobileDrawerExpanded: vi.fn(),
  }),
}));
vi.mock('@/stores/useMetadata', () => ({
  useMetadataStore: () => mockMetadataStore,
}));
vi.mock('@/stores/usePreferences', () => ({
  usePreferencesStore: () => mockPreferencesStore,
}));
vi.mock('@/stores/useTarkov', () => ({
  useTarkovStore: () => mockTarkovStore,
}));
vi.mock('@/utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));
mockNuxtImport('useNuxtApp', () => () => ({
  $supabase: mockSupabase,
}));
mockNuxtImport('useRoute', () => () => ({
  ...routeState,
}));
mockNuxtImport('useSkillCalculation', () => () => mockSkillCalculation);
mockNuxtImport('useToast', () => () => mockToast);
mockNuxtImport('useRuntimeConfig', () => () => ({
  public: {
    trackerHandoffUrl: 'https://dev.tarkov-stammtisch.de/api/tracker/handoff',
  },
}));
const SelectMenuFixedStub = {
  props: ['items', 'modelValue'],
  emits: ['update:modelValue'],
  template:
    '<label data-testid="select-menu-fixed"><slot name="leading" /><select v-bind="$attrs" :value="modelValue" @change="$emit(\'update:modelValue\', $event.target.value)"><option v-for="item in (items || [])" :key="item.value" :value="item.value">{{ item.label }}</option></select></label>',
};
const mountAppBar = async () => {
  const { default: AppBar } = await import('@/shell/AppBar.vue');
  return mount(AppBar, {
    global: {
      stubs: {
        ActivityLogPanel: true,
        AppTooltip: {
          template: '<span><slot /></span>',
        },
        DiscordIcon: true,
        GlobalHelpLauncher: {
          template: '<div data-testid="global-help-launcher" />',
        },
        NuxtLink: {
          template: '<a><slot /></a>',
        },
        Omnibar: true,
        SelectMenuFixed: SelectMenuFixedStub,
        UButton: {
          props: ['icon'],
          emits: ['click'],
          template: '<button :data-icon="icon" @click="$emit(\'click\')"><slot /></button>',
        },
        UDropdownMenu: {
          props: ['items'],
          template:
            '<div><slot /><template v-for="(group, groupIndex) in (items || [])" :key="groupIndex"><button v-for="item in group" :key="item.label" type="button" :data-menu-item="item.label" @click="item.onSelect?.()">{{ item.label }}</button></template></div>',
        },
        UIcon: {
          props: ['name'],
          template: '<i :class="name" />',
        },
        UKbd: true,
        UPopover: {
          template: '<div><slot /><slot name="content" /></div>',
        },
      },
    },
  });
};
describe('AppBar theme toggle disabled (fork: light theme unreachable)', () => {
  beforeEach(() => {
    windowWidthRef.value = 1280;
    routeState.name = 'tasks';
    routeState.params = {};
    mockThemeModeRef.value = 'dark';
    mockIsLightThemeRef.value = false;
    mockToggleThemeMode.mockClear();
  });
  it('does not render the header theme toggle button', async () => {
    const wrapper = await mountAppBar();
    expect(wrapper.find('button[data-icon="i-heroicons-sun"]').exists()).toBe(false);
    expect(wrapper.find('button[data-icon="i-heroicons-moon"]').exists()).toBe(false);
    wrapper.unmount();
  });
  it('does not include a theme item in the mobile More dropdown', async () => {
    const wrapper = await mountAppBar();
    const moreMenuItems = wrapper.findAll('[data-menu-item]');
    const labels = moreMenuItems.map((el) => el.attributes('data-menu-item'));
    expect(labels).not.toContain('app_bar.switch_to_light_theme');
    expect(labels).not.toContain('app_bar.switch_to_dark_theme');
    wrapper.unmount();
  });
  it('never calls toggleThemeMode since no control can trigger it', async () => {
    const wrapper = await mountAppBar();
    expect(mockToggleThemeMode).not.toHaveBeenCalled();
    wrapper.unmount();
  });
});
