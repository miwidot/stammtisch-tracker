<template>
  <div class="bg-surface-950 flex min-h-0 flex-1 items-center justify-center px-4 py-8">
    <UCard
      class="bg-surface-850 w-full max-w-md shadow-2xl ring-1 shadow-black/50 ring-white/15"
      :ui="{
        root: 'divide-y-0',
        body: 'p-0 sm:p-0',
        header: 'p-0 sm:px-0',
        footer: 'p-0 sm:px-0',
      }"
      role="article"
      :aria-label="$t('page.login.login_options')"
    >
      <template #header>
        <div class="flex flex-col items-center px-8 pt-8 pb-6 text-center">
          <h1 class="light:text-surface-50 mb-4 text-4xl font-bold tracking-tight text-white">
            {{ $t('common.login') }}
          </h1>
          <p class="text-surface-200 text-lg">
            {{ $t('page.login.subtitle') }}
          </p>
        </div>
      </template>
      <div class="px-8 pb-8">
        <div
          v-if="isOfflineMode"
          class="mb-6 rounded-lg bg-amber-500/10 p-4 ring-1 ring-amber-500/30"
        >
          <div class="flex items-start gap-3">
            <UIcon
              name="i-heroicons-information-circle"
              class="light:text-amber-600 mt-0.5 h-5 w-5 shrink-0 text-amber-400"
            />
            <div>
              <p class="light:text-amber-800 font-medium text-amber-200">
                {{ $t('page.login.offline_mode_title', 'Running in Offline Mode') }}
              </p>
              <p class="light:text-amber-700 mt-1 text-sm text-amber-300/80">
                {{
                  $t(
                    'page.login.offline_mode_description',
                    'Supabase is not configured. Login and sync features are disabled, but you can still use all tracking features locally. See'
                  )
                }}
                <code class="light:text-amber-800 rounded bg-amber-500/20 px-1 text-amber-200">
                  .env.example
                </code>
                {{ $t('page.login.offline_mode_suffix', 'to enable login.') }}
              </p>
            </div>
          </div>
        </div>
        <UButton
          block
          size="xl"
          variant="solid"
          class="flex h-12 w-full items-center justify-center transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
          :disabled="isOfflineMode"
          :aria-label="$t('app_bar.login_aria', 'Log in to your account')"
          @click="redirectToHandoff"
        >
          <UIcon name="i-mdi-account-outline" class="mr-3 h-6 w-6 shrink-0" />
          <span class="font-medium whitespace-nowrap">{{ $t('common.login') }}</span>
        </UButton>
      </div>
      <template #footer>
        <div class="w-full border-t border-white/10 bg-black/20">
          <div class="flex items-center justify-between px-8 py-4">
            <UButton
              to="/privacy"
              target="_blank"
              variant="ghost"
              color="neutral"
              size="sm"
              class="text-surface-500 hover:text-surface-300 transition-colors"
            >
              {{ $t('common.privacy_policy') }}
            </UButton>
            <UButton
              to="/terms-of-service"
              target="_blank"
              variant="ghost"
              color="neutral"
              size="sm"
              class="text-surface-500 hover:text-surface-300 transition-colors"
            >
              {{ $t('common.terms_of_service') }}
            </UButton>
          </div>
        </div>
      </template>
    </UCard>
  </div>
</template>
<script setup lang="ts">
  const { $supabase } = useNuxtApp();
  const isOfflineMode = computed(() => $supabase.isOfflineMode === true);
  const { t } = useI18n({ useScope: 'global' });
  useSeoMeta({
    title: () => t('common.login', 'Login'),
    description: () =>
      t(
        'page.login.meta_description',
        'Sign in to TarkovTracker to sync your progress across devices and collaborate with your team.'
      ),
  });
  const trackerHandoffUrl = useRuntimeConfig().public.trackerHandoffUrl;
  function redirectToHandoff() {
    window.location.href = trackerHandoffUrl;
  }
</script>
