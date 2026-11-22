<template>
  <UBadge
    v-if="minLevel"
    size="xs"
    :color="levelMet ? 'success' : 'error'"
    variant="soft"
    class="shrink-0 text-[11px] tabular-nums"
    data-testid="kappa-level-badge"
    :aria-label="ariaLabel"
    :title="title"
  >
    {{ t('common.lv', 'Lv') }} {{ minLevel }}
  </UBadge>
</template>
<script setup lang="ts">
  import { useProgressStore } from '@/stores/useProgress';
  import type { Task } from '@/types/tarkov';
  const props = defineProps<{ task: Task }>();
  const { t } = useI18n({ useScope: 'global' });
  const progressStore = useProgressStore();
  const playerLevel = computed(() => progressStore.getLevel('self'));
  const minLevel = computed(() => {
    const level = props.task.minPlayerLevel ?? 0;
    return level > 1 ? level : null;
  });
  const levelMet = computed(() => minLevel.value == null || playerLevel.value >= minLevel.value);
  const ariaLabel = computed(() => {
    if (minLevel.value == null) return undefined;
    const params = { required: minLevel.value, current: playerLevel.value };
    return levelMet.value
      ? t(
          'page.kappa.row.level_met_aria',
          params,
          `Required level ${params.required}, you are level ${params.current}`
        )
      : t(
          'page.kappa.row.level_unmet_aria',
          params,
          `Requires level ${params.required}, you are level ${params.current}`
        );
  });
  const title = computed(() => {
    if (minLevel.value == null) return undefined;
    return t(
      'page.kappa.row.level_title',
      { required: minLevel.value, current: playerLevel.value },
      `Required level ${minLevel.value} (you are ${playerLevel.value})`
    );
  });
</script>
