<template>
  <div class="min-h-full overflow-x-hidden">
    <div class="px-3 py-6 sm:px-6">
      <div class="mx-auto max-w-350 space-y-3 sm:space-y-4">
        <slot name="header" />
        <StatusTabBar
          v-model="activeTabKey"
          :tabs="tabItems"
          :group-label="t('common.kappa_lightkeeper')"
          data-testid="kappa-tabs"
        />
        <TrackerSummary
          :label="tabLabel"
          :total="totals.total"
          :completed="totals.completed"
          :failed="totals.failed"
          :available="totals.available"
          :locked="totals.locked"
          :accent="activeTab"
          :collector="collectorRow"
        />
        <KappaLoadingState v-if="isLoading" />
        <UAlert
          v-else-if="totals.total === 0"
          icon="i-mdi-clipboard-search"
          color="primary"
          variant="soft"
          :title="t('page.kappa.empty', 'No tasks for this list yet.')"
        />
        <div
          v-else-if="lgAndUp"
          class="grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] items-start gap-3"
        >
          <KappaTraderColumn
            v-for="group in groupedByTraderWithoutFence"
            :key="group.trader.id"
            :group="group"
          />
        </div>
        <template v-else>
          <KappaTraderSelector v-model="selectedTraderId" :groups="groupedByTraderWithoutFence" />
          <KappaTraderColumn v-if="selectedTraderGroup" :group="selectedTraderGroup" />
        </template>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
  import StatusTabBar from '@/components/ui/StatusTabBar.vue';
  import { useSharedBreakpoints } from '@/composables/useSharedBreakpoints';
  import KappaLoadingState from '@/features/kappa/KappaLoadingState.vue';
  import KappaTraderColumn from '@/features/kappa/KappaTraderColumn.vue';
  import KappaTraderSelector from '@/features/kappa/KappaTraderSelector.vue';
  import TrackerSummary from '@/features/kappa/TrackerSummary.vue';
  import { useKappaOverview, type KappaTabKey } from '@/features/kappa/useKappaOverview';
  import { useMetadataStore } from '@/stores/useMetadata';
  import type { StatusTabItem } from '@/utils/statusTones';
  const { t } = useI18n({ useScope: 'global' });
  const { lgAndUp } = useSharedBreakpoints();
  const activeTab = ref<KappaTabKey>('kappa');
  const selectedTraderId = ref<string>('');
  const { totals: kappaTotals } = useKappaOverview(() => 'kappa');
  const { totals: lightkeeperTotals } = useKappaOverview(() => 'lightkeeper');
  const { totals, groupedByTraderWithoutFence, collectorRow } = useKappaOverview(
    () => activeTab.value
  );
  watch(
    groupedByTraderWithoutFence,
    (groups) => {
      if (groups.length > 0 && !groups.some((g) => g.trader.id === selectedTraderId.value)) {
        selectedTraderId.value = groups[0]!.trader.id;
      }
    },
    { immediate: true }
  );
  const selectedTraderGroup = computed(() =>
    groupedByTraderWithoutFence.value.find((g) => g.trader.id === selectedTraderId.value)
  );
  const tabLabel = computed(() =>
    activeTab.value === 'kappa' ? t('common.kappa') : t('common.lightkeeper')
  );
  const tabItems = computed<StatusTabItem<KappaTabKey>[]>(() => [
    {
      label: t('common.kappa'),
      value: 'kappa',
      count: kappaTotals.value.total,
      icon: 'i-mdi-trophy',
      tone: 'neutral',
    },
    {
      label: t('common.lightkeeper'),
      value: 'lightkeeper',
      count: lightkeeperTotals.value.total,
      icon: 'i-mdi-lighthouse',
      tone: 'neutral',
    },
  ]);
  const metadataStore = useMetadataStore();
  const isLoading = computed(() => Boolean(metadataStore.loading) && totals.value.total === 0);
  const activeTabKey = computed({
    get: () => activeTab.value,
    set: (val: KappaTabKey) => {
      activeTab.value = val;
    },
  });
</script>
