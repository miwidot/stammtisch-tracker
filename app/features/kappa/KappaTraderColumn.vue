<template>
  <section
    class="bg-surface-800 border-surface-400/10 flex min-w-0 flex-col overflow-hidden rounded-lg border shadow-sm"
    :data-testid="`kappa-trader-${group.trader.id}`"
  >
    <header
      class="border-b border-white/10 px-3 py-2.5"
      :class="{ 'bg-success-500/5': allComplete }"
    >
      <div class="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <div class="bg-surface-900 h-8 w-8 shrink-0 overflow-hidden rounded-full">
          <img
            v-if="group.trader.imageLink"
            :src="group.trader.imageLink"
            :alt="group.trader.name"
            class="h-full w-full object-cover"
            loading="lazy"
          />
          <UIcon v-else name="i-mdi-account-circle" class="text-surface-500 h-full w-full" />
        </div>
        <h2 class="text-surface-100 min-w-0 flex-1 basis-16 truncate text-sm font-semibold">
          {{ group.trader.name }}
        </h2>
        <span class="text-surface-400 shrink-0 text-xs tabular-nums">
          {{ group.completedCount }} / {{ group.totalCount }} · {{ percent }}%
        </span>
      </div>
      <DashboardProgressBar
        :percentage="percent"
        :color="allComplete ? 'success' : 'primary'"
        size="sm"
        :aria-label="group.trader.name"
        class="mt-2"
      />
    </header>
    <ol class="flex flex-col gap-1.5 p-2">
      <li v-for="row in group.rows" :key="row.task.id">
        <KappaTaskRow :row="row" />
      </li>
    </ol>
  </section>
</template>
<script setup lang="ts">
  import DashboardProgressBar from '@/features/dashboard/DashboardProgressBar.vue';
  import KappaTaskRow from '@/features/kappa/KappaTaskRow.vue';
  import type { KappaTraderGroupEntry } from '@/features/kappa/useKappaOverview';
  const props = defineProps<{
    group: KappaTraderGroupEntry;
  }>();
  const percent = computed(() => {
    if (props.group.totalCount === 0) return 0;
    return Math.round((props.group.completedCount / props.group.totalCount) * 100);
  });
  const allComplete = computed(
    () => props.group.totalCount > 0 && props.group.completedCount === props.group.totalCount
  );
</script>
