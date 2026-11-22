<template>
  <section
    class="bg-surface-900 rounded-lg border border-white/12 px-3 py-3 shadow-sm sm:px-4"
    data-testid="kappa-summary"
  >
    <div class="flex flex-wrap items-center gap-x-6 gap-y-2">
      <div class="flex items-center gap-2">
        <UIcon
          :name="accent === 'kappa' ? 'i-mdi-trophy' : 'i-mdi-lighthouse'"
          class="h-5 w-5 shrink-0"
          :class="accent === 'kappa' ? 'text-kappa-400' : 'text-lightkeeper-400'"
          aria-hidden="true"
        />
        <h2 class="text-surface-100 text-sm font-semibold">
          {{ label }} {{ t('common.progress') }}
        </h2>
        <span class="text-surface-50 text-lg font-bold tabular-nums">{{ displayPercent }}%</span>
        <span class="text-surface-400 text-xs tabular-nums" data-testid="kappa-stat-completed">
          {{ completed }} / {{ total }} {{ t('page.kappa.summary.complete') }}
        </span>
      </div>
      <dl class="flex flex-wrap items-baseline gap-x-6 gap-y-1 text-sm">
        <div v-for="stat in stats" :key="stat.key" class="flex items-baseline gap-1.5">
          <dt class="text-surface-400">{{ stat.label }}</dt>
          <dd
            class="text-surface-100 font-semibold tabular-nums"
            :data-testid="`kappa-stat-${stat.key}`"
          >
            {{ stat.value }}
          </dd>
        </div>
      </dl>
    </div>
    <DashboardProgressBar
      :percentage="barWidth"
      :color="completed === total && total > 0 ? 'success' : 'primary'"
      :aria-label="`${label} ${t('common.progress')}`"
      class="mt-3"
    />
    <div
      v-if="collector"
      class="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border px-3 py-2.5"
      :class="milestoneClasses"
      data-testid="kappa-final-goal"
    >
      <div class="bg-surface-800 h-8 w-8 shrink-0 overflow-hidden rounded-full">
        <img
          v-if="collector.task.trader?.imageLink"
          :src="collector.task.trader.imageLink"
          :alt="collector.task.trader?.name"
          class="h-full w-full object-cover"
          loading="lazy"
        />
        <UIcon v-else name="i-mdi-account-circle" class="text-surface-500 h-full w-full" />
      </div>
      <div class="min-w-0 flex-1">
        <span class="text-surface-400 block text-[10px] font-bold tracking-wider uppercase">
          {{ t('page.kappa.summary.final_goal') }}
        </span>
        <div class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <NuxtLink
            :to="taskHref"
            class="text-link hover:text-link-hover min-w-0 text-sm font-semibold wrap-break-word no-underline"
            :class="{ 'line-through opacity-70': collector.status === 'complete' }"
          >
            {{ collector.task.name }}
          </NuxtLink>
          <KappaLevelBadge :task="collector.task" />
        </div>
      </div>
      <KappaStatusAction :row="collector" available-icon="i-mdi-flag-checkered" />
    </div>
  </section>
</template>
<script setup lang="ts">
  import DashboardProgressBar from '@/features/dashboard/DashboardProgressBar.vue';
  import KappaLevelBadge from '@/features/kappa/KappaLevelBadge.vue';
  import KappaStatusAction from '@/features/kappa/KappaStatusAction.vue';
  import type { KappaRowEntry, KappaTabKey } from '@/features/kappa/useKappaOverview';
  const { t } = useI18n({ useScope: 'global' });
  const props = defineProps<{
    label: string;
    total: number;
    completed: number;
    failed: number;
    available: number;
    locked: number;
    accent: KappaTabKey;
    collector?: KappaRowEntry | null;
  }>();
  const taskHref = computed(() =>
    props.collector ? `/tasks?task=${props.collector.task.id}` : ''
  );
  const stats = computed(() => [
    { key: 'available', label: t('common.available'), value: props.available },
    { key: 'locked', label: t('common.locked'), value: props.locked },
    { key: 'failed', label: t('common.failed'), value: props.failed },
  ]);
  // Never reads 100% until every task is done.
  const displayPercent = computed(() => {
    if (props.total === 0) return 0;
    if (props.completed === props.total) return 100;
    return Math.min(99, Math.round((props.completed / props.total) * 100));
  });
  const barWidth = computed(() => {
    if (props.total === 0) return 0;
    return Math.round((props.completed / props.total) * 100);
  });
  const milestoneClasses = computed(() => {
    switch (props.collector?.status) {
      case 'complete':
        return 'border-success-500/30 bg-success-500/5';
      case 'failed':
        return 'border-error-500/30 bg-error-500/5';
      case 'locked':
        return 'border-white/5 bg-surface-800/50';
      default:
        return 'border-white/10 bg-surface-800/50';
    }
  });
</script>
