<template>
  <ul class="flex flex-col">
    <li v-for="resource in helpResources" :key="resource.href">
      <a
        v-if="resource.external"
        :href="resource.href"
        target="_blank"
        rel="noopener noreferrer"
        :class="linkClasses"
      >
        <UIcon :name="resource.icon" aria-hidden="true" class="h-4 w-4 shrink-0" />
        <span>{{ t(resource.labelKey) }}</span>
        <span class="sr-only">({{ t('common.opens_in_new_tab') }})</span>
      </a>
      <NuxtLink v-else :to="resource.href" :class="linkClasses">
        <UIcon :name="resource.icon" aria-hidden="true" class="h-4 w-4 shrink-0" />
        <span>{{ t(resource.labelKey) }}</span>
      </NuxtLink>
    </li>
  </ul>
</template>
<script setup lang="ts">
  const { t } = useI18n({ useScope: 'global' });
  interface HelpResource {
    href: string;
    icon: string;
    labelKey: string;
    external: boolean;
  }
  const helpResources: HelpResource[] = [
    {
      href: useDiscordInvite(),
      icon: 'i-mdi-discord',
      labelKey: 'page.about.help.discord_support',
      external: true,
    },
    {
      href: '/credits',
      icon: 'i-mdi-heart-outline',
      labelKey: 'page.about.help.credits_link',
      external: false,
    },
  ];
  const linkClasses =
    'text-info-400 hover:text-info-300 focus-visible:ring-primary-500 inline-flex min-h-11 items-center gap-2 rounded text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none';
</script>
