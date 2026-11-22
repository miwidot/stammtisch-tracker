// @vitest-environment happy-dom
import { mockNuxtImport } from '@nuxt/test-utils/runtime';
import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { reactive, ref } from 'vue';
import { kappaStubs } from '@/features/kappa/__tests__/stubs';
import KappaPage from '@/pages/kappa.vue';
import type { Task } from '@/types/tarkov';
mockNuxtImport('useI18n', () => () => ({ t: (key: string) => key }));
vi.mock('@/composables/useSharedBreakpoints', () => ({
  useSharedBreakpoints: () => ({ lgAndUp: ref(true), xxlAndUp: ref(true) }),
}));
vi.mock('@/composables/useTaskActions', () => ({
  useTaskActions: () => ({
    markTaskComplete: vi.fn(),
    markTaskUncomplete: vi.fn(),
    markTaskAvailable: vi.fn(),
  }),
}));
const traders = [
  { id: 'prapor', name: 'Prapor', normalizedName: 'prapor' },
  { id: 'jaeger', name: 'Jaeger', normalizedName: 'jaeger' },
  { id: 'fence', name: 'Fence', normalizedName: 'fence' },
];
// The metadata store holds the catalog of the active game mode, so a mode switch replaces this list.
const tasks = reactive<Task[]>([]);
const pvpCatalog: Task[] = [
  { id: 'pvp-kappa', name: 'PvP Kappa Task', kappaRequired: true, trader: traders[0] },
  { id: 'pvp-lk', name: 'PvP Lightkeeper Task', lightkeeperRequired: true, trader: traders[1] },
  { id: 'pvp-collector', name: 'Collector', kappaRequired: true, trader: traders[2] },
];
const pveCatalog: Task[] = [
  { id: 'pve-kappa-a', name: 'PvE Kappa A', kappaRequired: true, trader: traders[0] },
  { id: 'pve-kappa-b', name: 'PvE Kappa B', kappaRequired: true, trader: traders[0] },
];
vi.mock('@/stores/useMetadata', () => ({
  useMetadataStore: () => ({
    tasks,
    sortedTraders: traders,
    editions: [],
    prestigeTaskMap: new Map(),
  }),
}));
vi.mock('@/stores/useTarkov', () => ({
  useTarkovStore: () => ({
    isTaskComplete: () => false,
    isTaskFailed: () => false,
    getPMCFaction: () => 'Any',
    getGameEdition: () => undefined,
    getPrestigeLevel: () => 0,
  }),
}));
vi.mock('@/stores/useProgress', () => ({
  useProgressStore: () => ({
    unlockedTasks: {},
    invalidTasks: {},
    taskEvaluations: {},
    getLevel: () => 15,
  }),
}));
const mountPage = () =>
  mount(KappaPage, {
    global: {
      stubs: kappaStubs,
    },
  });
describe('/kappa page', () => {
  beforeEach(() => {
    tasks.splice(0, tasks.length, ...pvpCatalog);
  });
  it('renders the tracker with its tasks, not the retirement notice', () => {
    const wrapper = mountPage();
    expect(wrapper.text()).not.toContain('page.kappa.retired_title');
    expect(wrapper.text()).not.toContain('page.kappa.retired_description');
    expect(wrapper.find('[data-testid="kappa-tabs"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('PvP Kappa Task');
  });
  it('lists the Kappa set without the Lightkeeper tasks and shows the Collector goal', () => {
    const wrapper = mountPage();
    expect(wrapper.text()).toContain('PvP Kappa Task');
    expect(wrapper.text()).not.toContain('PvP Lightkeeper Task');
    expect(wrapper.text()).toContain('page.kappa.summary.final_goal');
  });
  it('reads the task set from the current catalog, so a PvE catalog shows PvE tasks', () => {
    tasks.splice(0, tasks.length, ...pveCatalog);
    const wrapper = mountPage();
    expect(wrapper.text()).toContain('PvE Kappa A');
    expect(wrapper.text()).toContain('PvE Kappa B');
    expect(wrapper.text()).not.toContain('PvP Kappa Task');
  });
  it('shows the empty state when the catalog has no Kappa task', () => {
    tasks.splice(0, tasks.length);
    const wrapper = mountPage();
    expect(wrapper.get('[data-testid="kappa-empty"]').text()).toContain('page.kappa.empty');
  });
  it('renders each row with its status, level requirement and action button', () => {
    tasks.splice(0, tasks.length, {
      id: 'lvl',
      name: 'Level gated',
      kappaRequired: true,
      minPlayerLevel: 20,
      trader: traders[0],
    });
    const row = mountPage().get('[data-testid="kappa-trader-prapor"] li');
    expect(row.get('[data-testid="kappa-status-badge"]').text()).toMatch(
      /^common\.(available|locked)$/
    );
    expect(row.get('[data-testid="kappa-level-badge"]').text()).toContain('20');
    expect(row.get('[data-testid="kappa-status-action"]').attributes('aria-label')).toContain(
      'Level gated'
    );
  });
});
