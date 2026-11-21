<template>
  <GenericCard
    icon="mdi-account-remove-outline"
    icon-color="error"
    highlight-color="error"
    :fill-height="false"
    :title="$t('settings.fork_account_deletion.title')"
    title-classes="text-lg font-semibold"
  >
    <template #content>
      <div class="space-y-3 px-4 py-4" data-testid="stammtisch-account-deletion-notice">
        <p class="text-surface-300 text-sm">
          {{ $t('settings.fork_account_deletion.description') }}
        </p>
        <p class="text-surface-400 text-sm">
          {{ $t('settings.fork_account_deletion.device_hint') }}
        </p>
        <UButton
          :to="accountDeletionUrl"
          target="_blank"
          rel="noopener noreferrer"
          external
          color="error"
          variant="soft"
          icon="i-mdi-open-in-new"
          data-testid="stammtisch-account-deletion-link"
        >
          {{ $t('settings.fork_account_deletion.link') }}
        </UButton>
      </div>
    </template>
  </GenericCard>
</template>
<script setup lang="ts">
  import GenericCard from '@/components/ui/GenericCard.vue';
  // Deleting the account happens on the Stammtisch main site, which removes the tracker account
  // with it (POST /api/fork/account-delete). Upstream's in-app deletion needs a fresh OAuth login
  // that our handoff sign-in cannot provide, so there is deliberately no delete button here.
  const accountDeletionUrl = useRuntimeConfig().public.accountDeletionUrl as string;
</script>
