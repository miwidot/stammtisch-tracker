<template>
  <AppTooltip :text="tooltipText">
    <div
      class="flex min-w-0 items-start gap-2 rounded-md border px-2.5 py-2 transition-colors"
      :class="tileClasses"
      :data-status="row.status"
    >
      <KappaStatusAction :row="row" />
      <div class="min-w-0 flex-1">
        <NuxtLink
          :to="taskHref"
          class="text-link hover:text-link-hover block text-sm leading-snug font-medium wrap-break-word no-underline"
          :class="{ 'line-through opacity-70': row.status === 'complete' }"
        >
          {{ row.task.name || row.task.id }}
        </NuxtLink>
        <div class="mt-1 flex flex-wrap items-center gap-1.5">
          <UBadge
            size="xs"
            :color="statusColor"
            variant="soft"
            class="shrink-0 text-[11px]"
            data-testid="kappa-status-badge"
          >
            {{ statusLabel }}
          </UBadge>
          <KappaLevelBadge :task="row.task" />
          <UIcon
            v-if="row.task.lightkeeperRequired && !row.task.kappaRequired"
            name="i-mdi-lighthouse"
            class="text-lightkeeper h-4 w-4 shrink-0"
            aria-hidden="true"
          />
        </div>
      </div>
    </div>
  </AppTooltip>
</template>
<script setup lang="ts">
  import AppTooltip from '@/components/ui/AppTooltip.vue';
  import KappaLevelBadge from '@/features/kappa/KappaLevelBadge.vue';
  import KappaStatusAction from '@/features/kappa/KappaStatusAction.vue';
  import { useProgressStore } from '@/stores/useProgress';
  import type { KappaRowEntry } from '@/features/kappa/useKappaOverview';
  const props = defineProps<{ row: KappaRowEntry }>();
  const { t } = useI18n({ useScope: 'global' });
  const progressStore = useProgressStore();
  const playerLevel = computed(() => progressStore.getLevel('self'));
  const taskHref = computed(() => `/tasks?task=${props.row.task.id}`);
  const minLevel = computed(() => {
    const level = props.row.task.minPlayerLevel ?? 0;
    return level > 1 ? level : null;
  });
  const traderLevelLabel = computed(() => {
    const reqs = props.row.task.traderLevelRequirements;
    if (!reqs?.length) return null;
    const primary = reqs[0];
    if (!primary?.trader?.name) return null;
    return t(
      'page.kappa.row.trader_level',
      { trader: primary.trader.name, level: primary.level },
      `${primary.trader.name} Lv${primary.level}`
    );
  });
  const statusLabel = computed(() => {
    switch (props.row.status) {
      case 'complete':
        return t('common.completed', 'Completed');
      case 'failed':
        return t('common.failed', 'Failed');
      case 'locked':
        return t('common.locked', 'Locked');
      default:
        return t('common.available', 'Available');
    }
  });
  const statusColor = computed(() => {
    switch (props.row.status) {
      case 'complete':
        return 'success' as const;
      case 'failed':
        return 'error' as const;
      case 'locked':
        return 'neutral' as const;
      default:
        return 'primary' as const;
    }
  });
  const tooltipText = computed(() => {
    const parts: string[] = [props.row.task.name ?? props.row.task.id];
    parts.push(`(${statusLabel.value})`);
    if (minLevel.value != null) {
      parts.push(
        t(
          'page.kappa.row.level_summary',
          { required: minLevel.value, current: playerLevel.value },
          `Lv ${minLevel.value} (you ${playerLevel.value})`
        )
      );
    }
    if (traderLevelLabel.value) parts.push(traderLevelLabel.value);
    if (props.row.task.factionName) parts.push(props.row.task.factionName);
    if (props.row.task.map?.name) parts.push(props.row.task.map.name);
    if (props.row.lockedBy) {
      const blocker = props.row.lockedBy.name ?? props.row.lockedBy.id;
      parts.push(t('page.kappa.row.locked_by', { task: blocker }, `Requires: ${blocker}`));
    }
    return parts.join(' · ');
  });
  const tileClasses = computed(() => {
    switch (props.row.status) {
      case 'complete':
        return 'border-success-500/30 bg-success-500/5 hover:bg-success-500/10';
      case 'failed':
        return 'border-error-500/30 bg-error-500/5 hover:bg-error-500/10';
      case 'locked':
        return 'border-white/5 bg-surface-900/30';
      default:
        return 'border-white/10 bg-surface-900/40 hover:bg-white/5';
    }
  });
</script>
