<template>
  <ClientOnly>
    <KappaPage>
      <template #header>
        <PageHeader v-bind="header" class="mb-4" />
      </template>
    </KappaPage>
    <template #fallback>
      <div class="px-3 py-6 sm:px-6">
        <div class="mx-auto max-w-350">
          <PageHeader v-bind="header" class="mb-4" />
        </div>
      </div>
    </template>
  </ClientOnly>
</template>
<script setup lang="ts">
  import PageHeader from '@/components/ui/PageHeader.vue';
  import KappaPage from '@/pages/kappa.vue';
  const { t } = useI18n({ useScope: 'global' });
  const header = computed(() => ({
    title: t('common.kappa_lightkeeper'),
    description: t('page.kappa.subtitle'),
  }));
</script>
