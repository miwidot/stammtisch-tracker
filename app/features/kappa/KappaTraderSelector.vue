<template>
  <nav
    :aria-label="t('page.kappa.trader_selector.label', 'Select Trader')"
    class="w-full scrollbar-thin overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch]"
  >
    <div
      class="bg-surface-900 flex w-max min-w-full gap-1 rounded-lg border border-white/12 px-3 py-3 shadow-sm sm:px-4"
    >
      <UButton
        v-for="group in groups"
        :key="group.trader.id"
        type="button"
        variant="ghost"
        color="neutral"
        size="sm"
        :aria-pressed="modelValue === group.trader.id"
        :class="['gap-2', ...getPickerTabClass(modelValue === group.trader.id)]"
        @click="$emit('update:modelValue', group.trader.id)"
      >
        <div class="bg-surface-800 h-8 w-8 shrink-0 overflow-hidden rounded-full">
          <img
            v-if="group.trader.imageLink"
            :src="group.trader.imageLink"
            :alt="group.trader.name"
            class="h-full w-full object-cover"
            loading="lazy"
          />
          <UIcon v-else name="i-mdi-account-circle" class="text-surface-500 h-full w-full" />
        </div>
        <span class="text-xs font-medium whitespace-nowrap">{{ group.trader.name }}</span>
        <span
          :class="[
            'light:text-surface-50 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs font-bold text-white tabular-nums',
            getStatusBadgeClass('neutral', group.totalCount),
          ]"
        >
          {{ group.completedCount }}/{{ group.totalCount }}
        </span>
      </UButton>
    </div>
  </nav>
</template>
<script setup lang="ts">
  import { getPickerTabClass, getStatusBadgeClass } from '@/utils/statusTones';
  import type { KappaTraderGroupEntry } from '@/features/kappa/useKappaOverview';
  defineProps<{
    modelValue: string;
    groups: KappaTraderGroupEntry[];
  }>();
  defineEmits<{
    'update:modelValue': [value: string];
  }>();
  const { t } = useI18n({ useScope: 'global' });
</script>
