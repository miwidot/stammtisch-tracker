<template>
  <footer class="border-surface-800 border-t">
    <div class="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 md:grid-cols-3 lg:px-8">
      <div class="min-w-0">
        <div class="light:text-surface-50 flex items-center gap-2 text-base font-medium text-white">
          <UIcon name="i-mdi-shield" class="text-primary-400 h-5 w-5 shrink-0" />
          <span>Tarkov Stammtisch</span>
        </div>
        <p class="text-surface-400 mt-3 text-sm leading-relaxed">
          Die deutsche Escape from Tarkov Community - PVE/PVP/Arena. Gemeinsam durch Tarkov - Von
          Spielern, für Spieler.
        </p>
      </div>
      <div class="min-w-0">
        <h3 class="text-surface-200 text-sm font-semibold">Quick Links</h3>
        <ul class="mt-3 space-y-2 text-sm">
          <li v-for="link in quickLinks" :key="link.href">
            <a
              :href="link.href"
              :target="link.external ? '_blank' : undefined"
              :rel="link.external ? 'noopener noreferrer' : undefined"
              class="text-surface-400 transition-colors"
              :class="link.pink ? 'hover:text-pink-400' : 'hover:text-primary-400'"
            >
              {{ link.label }}
            </a>
          </li>
          <li>
            <NuxtLink
              to="/herkunft"
              class="text-surface-400 hover:text-primary-400 transition-colors"
            >
              {{ t('footer.origin_link') }}
            </NuxtLink>
          </li>
        </ul>
      </div>
      <div class="min-w-0">
        <h3 class="text-surface-200 text-sm font-semibold">Rechtliches</h3>
        <ul class="mt-3 space-y-2 text-sm">
          <li v-for="link in legalLinks" :key="link.href">
            <a
              :href="link.href"
              class="text-surface-400 transition-colors"
              :class="link.pink ? 'hover:text-pink-400' : 'hover:text-primary-400'"
            >
              {{ link.label }}
            </a>
          </li>
        </ul>
      </div>
    </div>
    <div class="border-surface-800 border-t">
      <div class="mx-auto max-w-7xl px-4 py-4 text-center sm:px-6 lg:px-8">
        <p class="text-surface-400 text-xs">
          &copy; {{ currentYear }} Tarkov Stammtisch. Alle Rechte vorbehalten.
        </p>
        <p class="text-surface-500 mt-1 text-xs">
          Escape from Tarkov ist eine eingetragene Marke von Battlestate Games Limited. Diese
          Website steht in keiner Verbindung zu Battlestate Games.
        </p>
        <p class="text-surface-500 mt-1 text-xs">
          <i18n-t keypath="footer.attribution.line" scope="global">
            <template #tracker>
              <a
                href="https://github.com/tarkovtracker-org/TarkovTracker"
                target="_blank"
                rel="noopener noreferrer"
                class="hover:text-primary-400 underline transition-colors"
              >
                {{ t('footer.attribution.tracker_label') }}
              </a>
            </template>
            <template #license>
              <a
                href="https://www.gnu.org/licenses/gpl-3.0.html"
                target="_blank"
                rel="noopener noreferrer"
                class="hover:text-primary-400 underline transition-colors"
              >
                {{ t('footer.attribution.license_label') }}
              </a>
            </template>
            <template #source>
              <a
                href="https://github.com/miwidot/stammtisch-tracker"
                target="_blank"
                rel="noopener noreferrer"
                class="hover:text-primary-400 underline transition-colors"
              >
                {{ t('footer.attribution.source_label') }}
              </a>
            </template>
          </i18n-t>
        </p>
      </div>
    </div>
  </footer>
</template>
<script setup lang="ts">
  const { t } = useI18n({ useScope: 'global' });
  const currentYear = new Date().getFullYear();
  const quickLinks = [
    { href: 'https://tarkov-stammtisch.de/community', label: 'Über uns' },
    { href: 'https://tarkov-stammtisch.de/konvoi', label: 'Konvoi System' },
    { href: 'https://tarkov-stammtisch.de/streamers', label: 'Streamer' },
    { href: 'https://tarkov-stammtisch.de/for-streamers', label: 'Für Streamer' },
    { href: 'https://discord.gg/tarkovstammtisch', label: 'Discord Server', external: true },
    { href: 'https://tarkov-stammtisch.de/spenden', label: 'Spenden ❤️', pink: true },
  ];
  const legalLinks = [
    { href: 'https://tarkov-stammtisch.de/regeln', label: 'Discord Regeln' },
    { href: 'https://tarkov-stammtisch.de/impressum', label: 'Impressum' },
    { href: 'https://tarkov-stammtisch.de/datenschutz', label: 'Datenschutzerklärung' },
    { href: 'https://tarkov-stammtisch.de/nutzungsbedingungen', label: 'Nutzungsbedingungen' },
    { href: 'https://tarkov-stammtisch.de/danke', label: 'Danke ❤️', pink: true },
  ];
</script>
