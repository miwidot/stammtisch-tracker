<template>
  <UContainer class="px-4 py-10 sm:px-6 sm:py-14">
    <div class="mx-auto flex w-full max-w-3xl flex-col gap-10">
      <header class="border-surface-700/60 mx-auto w-full max-w-2xl border-b pb-8 text-center">
        <h1 class="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          {{ t('page.herkunft.title') }}
        </h1>
      </header>
      <section :class="sectionClasses" aria-labelledby="herkunft-origin-heading">
        <h2
          id="herkunft-origin-heading"
          class="text-primary-300/80 text-xs font-semibold tracking-widest uppercase"
        >
          {{ t('page.herkunft.origin.heading') }}
        </h2>
        <p class="text-surface-300 mt-4 text-sm leading-relaxed">
          <i18n-t keypath="page.herkunft.origin.intro" scope="global">
            <template #tracker>
              <a
                href="https://github.com/tarkovtracker-org/TarkovTracker"
                :class="linkClasses"
                target="_blank"
                rel="noopener noreferrer"
              >
                {{ t('page.herkunft.origin.tracker_label') }}
                <span class="sr-only">({{ t('common.opens_in_new_tab') }})</span>
              </a>
            </template>
          </i18n-t>
        </p>
        <p class="text-surface-300 mt-3 text-sm leading-relaxed">
          {{ t('page.herkunft.origin.operator') }}
        </p>
        <p class="text-surface-300 mt-3 text-sm leading-relaxed">
          <i18n-t keypath="page.herkunft.origin.license" scope="global">
            <template #license>
              <a
                href="https://www.gnu.org/licenses/gpl-3.0.html"
                :class="linkClasses"
                target="_blank"
                rel="noopener noreferrer"
              >
                {{ t('page.herkunft.origin.license_label') }}
                <span class="sr-only">({{ t('common.opens_in_new_tab') }})</span>
              </a>
            </template>
            <template #license_file>
              <a
                href="https://github.com/tarkovtracker-org/TarkovTracker/blob/main/LICENSE.md"
                :class="linkClasses"
                target="_blank"
                rel="noopener noreferrer"
              >
                {{ t('page.herkunft.origin.license_file_label') }}
                <span class="sr-only">({{ t('common.opens_in_new_tab') }})</span>
              </a>
            </template>
          </i18n-t>
        </p>
        <p class="text-surface-300 mt-3 text-sm leading-relaxed">
          <i18n-t keypath="page.herkunft.origin.attribution" scope="global">
            <template #credits>
              <NuxtLink to="/credits" :class="linkClasses">
                {{ t('page.herkunft.origin.credits_label') }}
              </NuxtLink>
            </template>
          </i18n-t>
        </p>
      </section>
      <section :class="sectionClasses" aria-labelledby="herkunft-changes-heading">
        <h2
          id="herkunft-changes-heading"
          class="text-primary-300/80 text-xs font-semibold tracking-widest uppercase"
        >
          {{ t('page.herkunft.changes.heading') }}
        </h2>
        <p class="text-surface-300 mt-4 text-sm leading-relaxed">
          {{ t('page.herkunft.changes.intro') }}
        </p>
        <ul class="text-surface-300 mt-3 list-disc space-y-1 pl-5 text-sm leading-relaxed">
          <li>{{ t('page.herkunft.changes.item_translation') }}</li>
          <li>{{ t('page.herkunft.changes.item_auth') }}</li>
          <li>{{ t('page.herkunft.changes.item_branding') }}</li>
          <li>{{ t('page.herkunft.changes.item_hosting') }}</li>
        </ul>
        <p class="text-surface-300 mt-3 text-sm leading-relaxed">
          <i18n-t keypath="page.herkunft.changes.source" scope="global">
            <template #source>
              <a
                href="https://github.com/miwidot/stammtisch-tracker"
                :class="linkClasses"
                target="_blank"
                rel="noopener noreferrer"
              >
                {{ t('page.herkunft.changes.source_label') }}
                <span class="sr-only">({{ t('common.opens_in_new_tab') }})</span>
              </a>
            </template>
          </i18n-t>
        </p>
      </section>
      <section :class="sectionClasses" aria-labelledby="herkunft-related-heading">
        <h2
          id="herkunft-related-heading"
          class="text-primary-300/80 text-xs font-semibold tracking-widest uppercase"
        >
          {{ t('page.herkunft.related.heading') }}
        </h2>
        <ul class="text-surface-300 mt-4 list-disc space-y-1 pl-5 text-sm leading-relaxed">
          <li v-for="project in relatedProjects" :key="project.href">
            <a :href="project.href" target="_blank" rel="noopener noreferrer" :class="linkClasses">
              {{ t(project.labelKey) }}
              <span class="sr-only">({{ t('common.opens_in_new_tab') }})</span>
            </a>
          </li>
        </ul>
      </section>
    </div>
  </UContainer>
</template>
<script setup lang="ts">
  const { t } = useI18n({ useScope: 'global' });
  const herkunftTitle = computed(() => t('page.herkunft.title'));
  const herkunftDescription = computed(() => t('page.herkunft.description'));
  useSeoMeta({
    title: herkunftTitle,
    description: herkunftDescription,
    ogTitle: herkunftTitle,
    ogDescription: herkunftDescription,
    twitterTitle: herkunftTitle,
    twitterDescription: herkunftDescription,
  });
  const sectionClasses = 'bg-surface-900/80 rounded-lg border border-white/10 p-5 sm:p-6';
  const linkClasses =
    'text-info-400 hover:text-info-300 focus-visible:ring-primary-500 rounded underline transition-colors focus-visible:ring-2 focus-visible:outline-none';
  interface RelatedProject {
    href: string;
    labelKey: string;
  }
  const relatedProjects: RelatedProject[] = [
    {
      href: 'https://github.com/tarkovtracker-org/TarkovTracker',
      labelKey: 'page.herkunft.related.tarkovtracker',
    },
    {
      href: 'https://github.com/tarkovtracker-org/tarkov-data-overlay',
      labelKey: 'page.herkunft.related.tarkov_data_overlay',
    },
    {
      href: 'https://github.com/the-hideout/tarkov-dev',
      labelKey: 'page.herkunft.related.tarkov_dev',
    },
    {
      href: 'https://github.com/the-hideout/TarkovMonitor',
      labelKey: 'page.herkunft.related.tarkov_monitor',
    },
    {
      href: 'https://github.com/RatScanner/RatScanner',
      labelKey: 'page.herkunft.related.ratscanner',
    },
    {
      href: 'https://github.com/miwidot/stammtisch-tracker',
      labelKey: 'page.herkunft.related.our_fork',
    },
  ];
</script>
