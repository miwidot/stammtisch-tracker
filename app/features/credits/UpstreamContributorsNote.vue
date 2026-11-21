<template>
  <section class="bg-surface-900/80 rounded-lg border border-white/10 p-5 sm:p-6 md:col-span-2">
    <h2 class="text-primary-300/80 text-xs font-semibold tracking-widest uppercase">
      {{ t('page.credits.sections.contributors') }}
    </h2>
    <p class="text-surface-300 mt-4 text-sm">
      {{ t('page.credits.contributors.upstream_note') }}
    </p>
    <a
      :href="UPSTREAM_CONTRIBUTORS_URL"
      target="_blank"
      rel="noopener noreferrer"
      class="text-info-400 hover:text-info-300 focus-visible:ring-primary-500 mt-3 inline-flex min-h-11 items-center gap-1.5 rounded text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
    >
      <UIcon name="i-mdi-github" aria-hidden="true" class="h-4 w-4 shrink-0" />
      <span>{{ t('page.credits.contributors.upstream_link') }}</span>
      <span class="sr-only">({{ t('common.opens_in_new_tab') }})</span>
    </a>
  </section>
</template>
<script setup lang="ts">
  import { UPSTREAM_CONTRIBUTORS_URL } from '@/utils/upstreamLinks';
  // Fork: static attribution instead of a server-side GitHub API request (see FORK.md).
  const { t } = useI18n({ useScope: 'global' });
</script>
