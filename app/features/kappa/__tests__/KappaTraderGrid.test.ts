import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { kappaStubs } from '@/features/kappa/__tests__/stubs';
import KappaTraderGrid from '@/features/kappa/KappaTraderGrid.vue';
import type { KappaTraderGroupEntry } from '@/features/kappa/useKappaOverview';
vi.mock('@/composables/useTaskActions', () => ({
  useTaskActions: () => ({
    markTaskComplete: vi.fn(),
    markTaskUncomplete: vi.fn(),
    markTaskAvailable: vi.fn(),
  }),
}));
vi.mock('@/stores/useProgress', () => ({
  useProgressStore: () => ({ getLevel: () => 10 }),
}));
vi.mock('vue-i18n', async (importOriginal) => ({
  ...(await importOriginal<typeof import('vue-i18n')>()),
  useI18n: () => ({ t: (key: string) => key }),
}));
const makeGroups = (n: number): KappaTraderGroupEntry[] =>
  Array.from({ length: n }, (_, i) => ({
    trader: { id: `t${i}`, name: `Trader ${i}`, normalizedName: `trader-${i}` },
    rows: [],
    totalCount: 0,
    completedCount: 0,
  })) as unknown as KappaTraderGroupEntry[];
const mountGrid = (n: number) =>
  mount(KappaTraderGrid, { props: { groups: makeGroups(n) }, global: { stubs: kappaStubs } });
describe('KappaTraderGrid', () => {
  it('renders one column track per trader for 6 traders', () => {
    const wrapper = mountGrid(6);
    const grid = wrapper.get('[data-testid="kappa-trader-grid"]');
    expect(grid.attributes('style')).toContain('repeat(6, minmax(8rem, 1fr))');
    expect(wrapper.findAll('[data-testid^="kappa-trader-t"]')).toHaveLength(6);
  });
  it('follows the trader count for 7 traders', () => {
    const wrapper = mountGrid(7);
    expect(wrapper.get('[data-testid="kappa-trader-grid"]').attributes('style')).toContain(
      'repeat(7, minmax(8rem, 1fr))'
    );
  });
  it('keeps a valid track template with no traders', () => {
    const wrapper = mountGrid(0);
    expect(wrapper.get('[data-testid="kappa-trader-grid"]').attributes('style')).toContain(
      'repeat(1, minmax(8rem, 1fr))'
    );
  });
  it('scrolls inside its own container', () => {
    expect(mountGrid(6).get('[data-testid="kappa-trader-grid-scroller"]').classes()).toContain(
      'overflow-x-auto'
    );
  });
});
