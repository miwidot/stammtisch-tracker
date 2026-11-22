<template>
  <UButton
    size="xs"
    variant="soft"
    :color="config.color"
    :icon="config.icon"
    class="shrink-0"
    :aria-pressed="row.status === 'complete'"
    :aria-label="label"
    :disabled="row.status === 'locked'"
    data-testid="kappa-status-action"
    @click="onToggle"
  />
</template>
<script setup lang="ts">
  import { useTaskActions } from '@/composables/useTaskActions';
  import type { KappaRowEntry, KappaTaskStatus } from '@/features/kappa/useKappaOverview';
  const props = withDefaults(
    defineProps<{
      row: KappaRowEntry;
      /** Icon shown while the task is still open; the final goal uses a flag. */
      availableIcon?: string;
    }>(),
    { availableIcon: 'i-mdi-check' }
  );
  const { t } = useI18n({ useScope: 'global' });
  const taskRef = computed(() => props.row.task);
  const { markTaskComplete, markTaskUncomplete, markTaskAvailable } = useTaskActions(
    () => taskRef.value
  );
  const STATUS_STYLE: Record<
    KappaTaskStatus,
    { color: 'success' | 'error' | 'neutral'; icon: string }
  > = {
    complete: { color: 'success', icon: 'i-mdi-check-bold' },
    failed: { color: 'error', icon: 'i-mdi-close-thick' },
    locked: { color: 'neutral', icon: 'i-mdi-lock' },
    available: { color: 'neutral', icon: '' },
  };
  const config = computed(() => {
    const style = STATUS_STYLE[props.row.status];
    return style.icon ? style : { ...style, icon: props.availableIcon };
  });
  const label = computed(() => {
    const name = props.row.task.name ?? props.row.task.id;
    switch (props.row.status) {
      case 'complete':
        return t('page.kappa.row.action_uncomplete', 'Mark uncomplete') + `: ${name}`;
      case 'failed':
        return t('page.kappa.row.action_reset_failed', 'Reset failed') + `: ${name}`;
      case 'locked':
        return t('common.locked', 'Locked') + `: ${name}`;
      default:
        return t('common.mark_complete', 'Mark complete') + `: ${name}`;
    }
  });
  function onToggle() {
    if (props.row.status === 'locked') return;
    if (props.row.status === 'complete' || props.row.status === 'failed') {
      markTaskUncomplete();
      return;
    }
    if (props.row.status === 'available') {
      markTaskComplete();
      return;
    }
    markTaskAvailable();
  }
</script>
