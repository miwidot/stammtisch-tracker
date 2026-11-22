import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { kappaStubs } from '@/features/kappa/__tests__/stubs';
import KappaTaskRow from '@/features/kappa/KappaTaskRow.vue';
import type { KappaRowEntry } from '@/features/kappa/useKappaOverview';
const markTaskComplete = vi.fn();
const markTaskUncomplete = vi.fn();
const markTaskAvailable = vi.fn();
vi.mock('@/composables/useTaskActions', () => ({
  useTaskActions: () => ({ markTaskComplete, markTaskUncomplete, markTaskAvailable }),
}));
vi.mock('@/stores/useProgress', () => ({
  useProgressStore: () => ({ getLevel: () => 10 }),
}));
vi.mock('vue-i18n', async (importOriginal) => ({
  ...(await importOriginal<typeof import('vue-i18n')>()),
  useI18n: () => ({
    t: (key: string, paramsOrFallback?: unknown, fallback?: string) => {
      if (key === 'common.failed' || key === 'common.completed' || key === 'common.complete') {
        return key;
      }
      return (typeof paramsOrFallback === 'string' ? paramsOrFallback : fallback) ?? key;
    },
  }),
}));
const row = (status: KappaRowEntry['status']): KappaRowEntry => ({
  task: { id: 'task-1', name: 'Test task', minPlayerLevel: 15 },
  status,
  isInvalid: false,
});
describe('KappaTaskRow', () => {
  it('renders the title-cased failed status from common translations', () => {
    const wrapper = mount(KappaTaskRow, {
      props: { row: row('failed') },
      global: { stubs: kappaStubs },
    });
    expect(wrapper.get('button').attributes('aria-label')).toBe('Reset failed: Test task');
    expect(wrapper.get('[data-tooltip]').attributes('data-tooltip')).toContain('common.failed');
  });
  it('labels a finished task with the status word, not the Complete button label', () => {
    const wrapper = mount(KappaTaskRow, {
      props: { row: row('complete') },
      global: { stubs: kappaStubs },
    });
    const tooltip = wrapper.get('[data-tooltip]').attributes('data-tooltip');
    expect(tooltip).toContain('(common.completed)');
    expect(tooltip).not.toContain('(common.complete)');
  });
});
describe('KappaTaskRow content', () => {
  const mountRow = (status: KappaRowEntry['status']) =>
    mount(KappaTaskRow, { props: { row: row(status) }, global: { stubs: kappaStubs } });
  it.each([
    ['available', 'Available', 'primary'],
    ['complete', 'common.completed', 'success'],
    ['failed', 'common.failed', 'error'],
    ['locked', 'Locked', 'neutral'],
  ] as const)('shows a visible %s status chip', (status, label, color) => {
    const badge = mountRow(status).get('[data-testid="kappa-status-badge"]');
    expect(badge.text()).toBe(label);
    expect(badge.attributes('data-color')).toBe(color);
  });
  it('marks the level requirement as unmet when the player is below it', () => {
    const badge = mountRow('available').get('[data-testid="kappa-level-badge"]');
    expect(badge.text()).toContain('15');
    expect(badge.attributes('data-color')).toBe('error');
  });
  it('hides the level chip for tasks without a real requirement', () => {
    const wrapper = mount(KappaTaskRow, {
      props: {
        row: { ...row('available'), task: { id: 't', name: 'No level', minPlayerLevel: 1 } },
      },
      global: { stubs: kappaStubs },
    });
    expect(wrapper.find('[data-testid="kappa-level-badge"]').exists()).toBe(false);
  });
  it('runs the matching action from the button and ignores locked rows', async () => {
    markTaskComplete.mockClear();
    markTaskUncomplete.mockClear();
    await mountRow('available').get('button').trigger('click');
    expect(markTaskComplete).toHaveBeenCalledTimes(1);
    await mountRow('complete').get('button').trigger('click');
    await mountRow('failed').get('button').trigger('click');
    expect(markTaskUncomplete).toHaveBeenCalledTimes(2);
    const locked = mountRow('locked').get('button');
    expect(locked.attributes('disabled')).toBeDefined();
    await locked.trigger('click');
    expect(markTaskComplete).toHaveBeenCalledTimes(1);
  });
});
