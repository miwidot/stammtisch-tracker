import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { kappaStubs } from '@/features/kappa/__tests__/stubs';
import TrackerSummary from '@/features/kappa/TrackerSummary.vue';
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
const messages: Record<string, string> = {
  'common.available': 'Available',
  'common.failed': 'Failed',
  'common.locked': 'Locked',
  'common.progress': 'Progress',
  'page.kappa.summary.complete': 'complete',
};
vi.mock('vue-i18n', async (importOriginal) => ({
  ...(await importOriginal<typeof import('vue-i18n')>()),
  useI18n: () => ({ t: (key: string) => messages[key] ?? key }),
}));
describe('TrackerSummary', () => {
  it('renders common status labels with display casing', () => {
    const wrapper = mount(TrackerSummary, {
      props: {
        label: 'Kappa',
        total: 10,
        completed: 4,
        failed: 2,
        available: 3,
        locked: 1,
        accent: 'kappa',
      },
      global: { stubs: kappaStubs },
    });
    const stat = (key: string) => wrapper.get(`[data-testid="kappa-stat-${key}"]`);
    expect(stat('available').element.previousElementSibling?.textContent).toBe('Available');
    expect(stat('available').text()).toBe('3');
    expect(stat('locked').element.previousElementSibling?.textContent).toBe('Locked');
    expect(stat('locked').text()).toBe('1');
    expect(stat('failed').element.previousElementSibling?.textContent).toBe('Failed');
    expect(stat('failed').text()).toBe('2');
    expect(stat('completed').text()).toBe('4 / 10 complete');
  });
});
