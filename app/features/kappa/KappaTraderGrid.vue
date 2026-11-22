<template>
  <!-- Own scroll container: when the tracks cannot reach their minimum width, this scrolls, never the page. -->
  <div class="overflow-x-auto" data-testid="kappa-trader-grid-scroller">
    <div
      class="grid items-start gap-2"
      :style="{ gridTemplateColumns }"
      data-testid="kappa-trader-grid"
    >
      <KappaTraderColumn v-for="group in groups" :key="group.trader.id" :group="group" />
    </div>
  </div>
</template>
<script setup lang="ts">
  import KappaTraderColumn from '@/features/kappa/KappaTraderColumn.vue';
  import type { KappaTraderGroupEntry } from '@/features/kappa/useKappaOverview';
  /**
   * Minimum width of one trader column. 8rem (128px) lets 6 traders fit in the ~830px content area
   * of a 1440px window with the sidebar open; with 7 traders the grid scrolls inside its own
   * container below roughly 950px of available width.
   */
  const MIN_COLUMN_WIDTH = '8rem';
  const props = defineProps<{
    groups: KappaTraderGroupEntry[];
  }>();
  const gridTemplateColumns = computed(
    () => `repeat(${Math.max(props.groups.length, 1)}, minmax(${MIN_COLUMN_WIDTH}, 1fr))`
  );
</script>
