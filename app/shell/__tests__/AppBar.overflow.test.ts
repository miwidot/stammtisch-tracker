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
vi.mock('@/utils/forkConfig', () => ({
  LIGHT_THEME_ENABLED: false,
  OVERFLOW_MENU_ENABLED: false,
}));
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
const createMetadataStore = () =>
  reactive({
    loading: false,
    hideoutLoading: false,
    updateLanguageAndGameMode: vi.fn(),
    fetchAllData: vi.fn(async () => {}),
    hasCriticalLocaleCache: vi.fn(async () => true),
  });
const mockMetadataStore = createMetadataStore();
const mockPreferencesStore = {
  getStreamerMode: false,
  getLocaleOverride: 'en' as string | null,
  setLocaleOverride: vi.fn(),
};
const mockTarkovStore = {
  getCurrentGameMode: vi.fn(() => 'pvp'),
  getDisplayName: vi.fn(() => ''),
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
const appBarWidthRef = ref(1700);
const drawerRailRef = ref(false);
beforeEach(() => {
  appBarWidthRef.value = 1700;
  drawerRailRef.value = false;
  windowWidthRef.value = 1280;
});
vi.mock('@vueuse/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@vueuse/core')>()),
  useElementSize: () => ({ width: appBarWidthRef }),
  useWindowSize: () => ({
    width: windowWidthRef,
  }),
}));
vi.mock('@/composables/useKeybinds', () => ({
  useKeybinds: vi.fn(),
}));
// AppBar loads these through `defineAsyncComponent`. A VTU `stub` replaces what renders but does
// not stop the async loader, so the real ActivityLogPanel still pulls `@nuxt/ui` Badge and the
// generated `virtual:nuxt:...ui/badge.ts` theme module. Under parallel workers that import can
// resolve after this file's environment is torn down, failing the run with
// `EnvironmentTeardownError`. Mocking the modules keeps the loader short of `@nuxt/ui` entirely.
vi.mock('@/shell/ActivityLogPanel.vue', () => ({
  default: { name: 'ActivityLogPanel', template: '<div />' },
}));
vi.mock('@/features/omnibar/AppSearch.vue', () => ({
  default: {
    name: 'AppSearch',
    props: ['shortcutParts', 'keyShortcuts'],
    template:
      '<div data-testid="app-search" :data-shortcut="shortcutParts.join(\'+\')" :data-aria="keyShortcuts" />',
  },
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
    get drawerRail() {
      return drawerRailRef.value;
    },
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
mockNuxtImport('useSkillCalculation', () => () => mockSkillCalculation);
mockNuxtImport('useToast', () => () => mockToast);
mockNuxtImport('useRuntimeConfig', () => () => ({
  public: {
    trackerHandoffUrl: 'https://dev.tarkov-stammtisch.de/api/tracker/handoff',
  },
}));
const mountAppBar = async () => {
  const { default: AppBar } = await import('@/shell/AppBar.vue');
  return mount(AppBar, {
    global: {
      stubs: {
        ActivityLogPanel: true,
        AppTooltip: {
          template: '<span><slot /></span>',
        },
        GlobalHelpLauncher: {
          props: ['open', 'showTrigger', 'reference'],
          template:
            '<div data-testid="global-help-launcher" :data-open="String(open)" :data-direct="String(showTrigger)" :data-anchored="String(Boolean(reference))" />',
        },
        NuxtLink: {
          template: '<a><slot /></a>',
        },
        ProgressSaveStatusIndicator: true,
        SignOutConfirmModal: true,
        UButton: {
          props: ['icon', 'disabled', 'loading'],
          emits: ['click'],
          template:
            '<button :data-icon="icon" :disabled="disabled || undefined" @click="$emit(\'click\')"><slot /></button>',
        },
        UDropdownMenu: {
          props: { items: Array, content: Object, modal: { type: Boolean, default: true } },
          data: () => ({ expandedSubmenu: '', preventedCloseFocus: false }),
          methods: {
            selectItem(
              item: { onSelect?: () => void },
              content?: { onCloseAutoFocus?: (event: Event) => void }
            ) {
              item.onSelect?.();
              const event = new Event('close-auto-focus', { cancelable: true });
              content?.onCloseAutoFocus?.(event);
              return event.defaultPrevented;
            },
          },
          template: `<div data-dropdown-menu :data-modal="String(modal)" :data-prevented-close-focus="String(preventedCloseFocus)"><slot /><template v-for="(group, groupIndex) in (items || [])" :key="groupIndex"><template v-for="item in group" :key="item.label"><button type="button" :disabled="item.disabled" :data-menu-item="item.label" :data-to="item.to" :data-target="item.target" :data-rel="item.rel" :data-checked="item.type === 'checkbox' ? String(Boolean(item.checked)) : undefined" :data-locale-item="item.type === 'checkbox' ? '' : undefined" @click="item.children ? expandedSubmenu = item.label : preventedCloseFocus = selectItem(item, content)">{{ item.label }}</button><div v-if="item.children && expandedSubmenu === item.label" data-submenu><template v-for="(children, childGroupIndex) in item.children" :key="childGroupIndex"><button v-for="child in children" :key="child.label" type="button" :disabled="child.disabled" :data-menu-item="child.label" :data-checked="String(Boolean(child.checked))" @click="child.onSelect?.()">{{ child.label }}</button></template></div></template></template></div>`,
        },
        UIcon: {
          props: ['name'],
          template: '<i :class="name" />',
        },
        UKbd: true,
        UPopover: {
          props: ['open', 'reference'],
          template:
            '<div data-testid="activity-popover" :data-open="String(open)" :data-anchored="String(Boolean(reference))"><slot /><slot name="content" /></div>',
        },
      },
    },
  });
};
describe('AppBar overflow menu hidden (fork)', () => {
  beforeEach(() => {
    windowWidthRef.value = 1280;
    mockIsLightThemeRef.value = false;
  });
  it.each([1700, 1400, 1000, 560, 311])(
    'does not render the "..." button or its menu at app bar width %i',
    async (width) => {
      appBarWidthRef.value = width;
      const wrapper = await mountAppBar();
      expect(wrapper.find('button[data-icon="i-lucide-ellipsis"]').exists()).toBe(false);
      expect(wrapper.find('button[aria-label="common.more"]').exists()).toBe(false);
      // Overflow entries (help, activity, locale submenu) must not be offered as menu items.
      expect(wrapper.find('[data-menu-item="app_bar.help_community_aria"]').exists()).toBe(false);
      expect(wrapper.find('[data-menu-item="common.activity_log"]').exists()).toBe(false);
      expect(wrapper.find('[data-menu-item="settings.locale"]').exists()).toBe(false);
      wrapper.unmount();
    }
  );
  it('still renders the activity bell, help launcher, locale menu and account button', async () => {
    appBarWidthRef.value = 1700;
    mockSupabase.user.loggedIn = true;
    const wrapper = await mountAppBar();
    expect(wrapper.find('button[data-icon="i-lucide-bell"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="global-help-launcher"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="app-locale-menu"]').exists()).toBe(true);
    expect(wrapper.find('button[aria-label="navigation_drawer.account_menu"]').exists()).toBe(true);
    mockSupabase.user.loggedIn = false;
    wrapper.unmount();
  });
});
