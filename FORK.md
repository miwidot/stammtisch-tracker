# Fork-Abweichungen — Tarkov Stammtisch Quest-Tracker

Privater Fork von [tarkovtracker-org/TarkovTracker](https://github.com/tarkovtracker-org/TarkovTracker) (GPL-3.0). Zugehörig: Daten-Overlay-Fork [`miwidot/stammtisch-tracker-overlay`](https://github.com/miwidot/stammtisch-tracker-overlay) (eigene `FORK.md`), Epic [#1293](https://github.com/miwidot/tarkov-stammtisch/issues/1293).

**Leitgedanke:** So nah wie möglich am Upstream bleiben. Der Sinn des Forks ist, Quest-Sync und Pflege des Upstream-Teams geschenkt zu bekommen. Jede Zeile in deren Dateien bezahlen wir bei **jedem** Merge erneut.

**Stand:** Branch `sync/full-2026-11-21`, Upstream `main` = `432a1dfd` (nach v1.90.0). Diese Datei wurde gegen `git diff --stat upstream/main...HEAD` und den Code abgeglichen (rund 200 Dateien, davon der größte Teil Tests und Binärassets). Liste neu prüfen mit:

```bash
git diff --name-status upstream/main...HEAD | grep -v '__tests__'
```

`RUNBOOK.md` beschreibt Aufbau und Betrieb des Prototyps. Der Einstieg für den Betrieb ist dort Abschnitt 7c ("Übergabe"); die Abweichungen vom Upstream stehen in dieser Datei.

---

## Die drei Kategorien

| Kategorie                                  | Kosten pro Upstream-Merge | Regel                                              |
| ------------------------------------------ | ------------------------- | -------------------------------------------------- |
| **A — Konfiguration** (nicht im Repo-Code) | null                      | Erste Wahl: Umgebungsvariablen, Infrastruktur      |
| **B — Additiv** (neue Dateien)             | null                      | Zweite Wahl: eigene Seiten, Middleware, Utils      |
| **C — Eingriff** (Upstream-Dateien)        | hoch                      | Letzte Wahl, jeder Eintrag braucht eine Begründung |

Vor jedem neuen Eintrag in C prüfen, ob es nicht als A oder B geht. Eigene Komponenten mit Präfix `Stammtisch*` benennen (Auto-Import ohne Pfad-Präfix, gleichnamige Komponenten kollidieren).

---

## 1. Verhalten, das vom Upstream abweicht (Überblick)

| Thema                   | Verhalten bei uns                                                                                                        | Warum                                                                   |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| Login                   | Nur über die Hauptseite (Handoff mit Nonce), keine OAuth-Anbieter, Login-Pflicht für fast alle Routen                    | Ein Konten-System, nicht zwei                                           |
| Sprachen                | nur `de` und `en`, Standard `de`                                                                                         | Zielgruppe; weniger Katalog-Bundles                                     |
| Theme                   | Oliv/Amber statt Upstreams grauer Palette, Light-Theme gesperrt                                                          | Optik der Hauptseite                                                    |
| Rechtstexte             | `/privacy` und `/terms-of-service` leiten per 302 auf die Hauptseite                                                     | Verantwortlicher ist der Stammtisch, nicht Upstream                     |
| Konto löschen           | nur über die Hauptseite, Server-Endpunkt nur für Loopback                                                                | Unsere Nutzer melden sich per OTP an, Upstreams Löschweg verlangt OAuth |
| Supporter/Stripe        | `/supporter` 404, `/api/stripe/*` 404                                                                                    | Wir verkaufen nichts                                                    |
| Indexierung             | `noindex` überall                                                                                                        | Hinter Login, kein SEO-Ziel                                             |
| Ausgehende Verbindungen | Minimal-CSP, Overlay per `file:`, GitHub-API und Twitch-Relay aus, einziger Fremdhost im Browser ist `assets.tarkov.dev` | Datenschutz, keine Abhängigkeit von Drittseiten                         |
| Support-Links           | "Problem melden" und Hilfe zeigen auf unser Discord                                                                      | Upstream-Support kennt unsere Instanz nicht                             |
| Spieldaten              | aus lokalem Verzeichnis (`TARKOV_DATA_DIR`), nicht aus Cloudflare KV                                                     | Kein Cloudflare                                                         |
| Changelog               | `/changelog` zeigt eigene Einträge, GitHub-API aus                                                                       | Spieler sollen unsere Änderungen sehen                                  |
| Inaktivitäts-Cron       | Upstreams `inactive-account-cleanup` ausgeplant                                                                          | Kontenlöschung nur über die Hauptseite                                  |

---

## 2. Kategorie A — Konfiguration

### 2.1 Supabase (`docker/.env`, `docker-compose.yml`; liegt auf dem Server, nicht in diesem Repo)

| Abweichung                                                                                  | Grund                                                                                              |
| ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Discord/Twitch/Google/GitHub nicht als GoTrue-Provider                                      | Login nur über die Hauptseite, sonst doppelte Kontenverwaltung                                     |
| Registrierung gesperrt (`enable_signup`)                                                    | Nur unser System legt User an                                                                      |
| `studio`, `meta`, `storage`, `imgproxy`, `supavisor` entfernt                               | Angriffsfläche und RAM. Nicht offiziell unterstützt: bei jedem Supabase-Update Compose-Diff prüfen |
| `depends_on: studio` aus `api-gw` entfernt, Envoy-Routen `studio`/`meta`/`storage` entfernt | Sonst startet der Stack nicht bzw. `/` zeigt auf Studio                                            |
| `FUNCTIONS_VERIFY_JWT=false`                                                                | Alle Functions prüfen selbst (upstream-konform)                                                    |
| `SUPABASE_ALLOWED_ORIGINS` an den `functions`-Container durchreichen                        | Standard-Compose reicht es nicht durch, sonst hängt CORS allein am Gateway                         |
| Rate-Limit `token_verifications` hochsetzen                                                 | Default 30/5 min pro IP, alle User kommen über dieselbe Proxy-IP                                   |

Erwartung: `docker compose ps` zeigt 6 Container. Weil Storage fehlt, gibt es die Tabellen `storage.objects`/`storage.buckets` nicht (siehe `fork_delete_account`).

### 2.2 App-Umgebung

| Variable                                                                            | Zweck                                                                                                                                                                      |
| ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NITRO_PRESET=node-server`, `NODE_ENV=production`, `CI=true`                        | Kein Cloudflare. `NODE_ENV=production` ist zwingend (sonst Offline-Stub, Supabase im Frontend tot). `CI=true` umgeht den harten Stripe-Env-Guard                           |
| Node `>=24.22.3`                                                                    | Upstream-`engines`                                                                                                                                                         |
| `SUPABASE_URL`                                                                      | Wird zur Build-Zeit in die CSP eingebacken                                                                                                                                 |
| `APP_URL`, `API_ALLOWED_HOSTS` (Laufzeit: `NUXT_API_PROTECTION_ALLOWED_HOSTS`)      | Host-Allowlist. Falsch = 403 auf allen `/api/*`                                                                                                                            |
| `API_TRUST_PROXY=true`                                                              | Nur, wenn nginx `X-Forwarded-For`/`X-Real-IP` selbst setzt, sonst sind Rate-Limits fälschbar                                                                               |
| `NUXT_PUBLIC_TRACKER_HANDOFF_URL`                                                   | Login-Handoff der Hauptseite. In Produktion Pflicht und https, sonst bricht der Start ab                                                                                   |
| `NUXT_PUBLIC_ACCOUNT_DELETION_URL`                                                  | Ziel des Hinweises "Konto löschen" (Standard `https://tarkov-stammtisch.de/profile/settings`)                                                                              |
| `NUXT_FORK_ACCOUNT_DELETE_SECRET`, `NUXT_SUPABASE_SERVICE_KEY`, `NUXT_SUPABASE_URL` | Server-zu-Server-Löschung (Abschnitt 5). Secret mindestens 32 Zeichen, sonst antwortet der Endpunkt 503                                                                    |
| `NUXT_PUBLIC_LEGAL_PRIVACY_URL`, `NUXT_PUBLIC_LEGAL_TERMS_URL`                      | Ziele der Rechtstext-Weiterleitung. Nur https ohne Zugangsdaten, sonst Standard `https://tarkov-stammtisch.de/datenschutz` bzw. `/nutzungsbedingungen`                     |
| `NUXT_PUBLIC_DISCORD_INVITE_URL`                                                    | Discord für "Problem melden". Nur https, sonst `https://discord.gg/tarkovstammtisch`                                                                                       |
| `NUXT_PUBLIC_ALLOW_INDEXING`                                                        | Standard aus (noindex). `true` (Build **und** Laufzeit) stellt Upstreams SEO wieder her                                                                                    |
| `TARKOV_DATA_DIR`                                                                   | Pflicht: absolutes Verzeichnis mit den Spieldaten (Abschnitt 3.7). Ohne Variable antworten alle `/api/tarkov/*` mit 503                                                    |
| `OVERLAY_URL`, `NEUTRAL_OVERLAY_URL`, `OVERLAY_FILE_ROOT`                           | Overlay-Quelle (Abschnitt 4). `OVERLAY_FILE_ROOT` ist das absolute Verzeichnis, unterhalb dessen `file:`-URLs erlaubt sind; ohne Variable bleibt jede `file:`-URL verboten |
| `UPSTREAM_GITHUB_ENABLED`                                                           | Standard aus. `true` holt `/api/changelog` und `/api/contributors` wieder von `api.github.com`                                                                             |
| `NUXT_TWITCH_LIVE_ENDPOINT_ENABLED`                                                 | Standard aus. `/api/twitch/live` antwortet 404 und fragt `gql.twitch.tv` nie. Nur `true` schaltet ein                                                                      |

Deploy-Werte trackerdev (Beispiel): `OVERLAY_URL=file:///home/stammdev/overlay-fork/dist/overlay.json`, `NEUTRAL_OVERLAY_URL=file:///home/stammdev/overlay-fork/dist/overlay-neutral.json`, `OVERLAY_FILE_ROOT=/home/stammdev/overlay-fork/dist`. Der App-Prozess muss die Dateien lesen dürfen.

⚠️ **Cloudflare-Sonderfälle auf node-server:** Host-Allowlist (s. o.), `caches.default` fehlt (kein Edge-Cache, jede Anfrage liest die Platte), Rate-Limiter nur pro Prozess (PM2 single instance), `ASSETS`-Binding fehlt (`/@handle` liefert 503), `PROGRESS_DIAGNOSTICS` aus.

### 2.3 Hosting (nginx, außerhalb dieses Repos)

Der Tracker läuft hinter Cloudflare und nginx; die Sicherheit von Abschnitt 5 und der Rate-Limits hängt an diesen Regeln.

- **Same-Origin-Setup:** vier Supabase-Pfade und die App auf **einem** Host; ein server-Block für 80 und 443 mit Cloudflare-bewusstem Redirect (sonst Schleife); alle Upstream-Ports auf `127.0.0.1`; App auf Port 3101 (fest).
- **Gesperrt (404):** `/auth/v1/admin`, `/storage/v1/`, `/pg/`, `/graphql/v1`, `/mcp`, Dotfiles. Zusätzlich **öffentlich sperren:** `/api/fork`, `/overlay.json`, `/overlay-neutral.json` und `/overlay-fork/`.
- **Echte Client-IP:** nginx setzt `real_ip` aus den Cloudflare-Adressbereichen und **überschreibt** `X-Forwarded-For` und `CF-Connecting-IP` mit `$remote_addr`. Ohne das könnte ein Client diese Header selbst setzen und die Rate-Limits umgehen (zusammen mit `API_TRUST_PROXY=true`).
- gzip für JSON: die App liefert die Spieldaten unkomprimiert. `proxy_cache` für `/api/tarkov/*` ist optional (die Daten kommen von der lokalen Platte, der Handler sendet `Cache-Control: no-store`; ein nginx-Cache braucht `proxy_ignore_headers`).
- **Produzent per Cron** (alle 12 h): `build:catalogs` des Overlay-Repos schreibt ein Verzeichnis, `TARKOV_DATA_DIR` zeigt auf dessen `current`. Fehlschlag und veraltetes `producer-manifest.json` überwachen (der Cron-Wrapper alarmiert per Discord); sonst liefert die App still alte Daten.

Die nginx-Konfiguration liegt nicht im Repo; die genannten Punkte sind eine Soll-Liste, hier **nicht** gegen den Server geprüft.

### 2.4 GitHub Actions (Einstellung im GitHub-Repo, nicht im Code)

Deaktiviert (`disabled_manually`): **Crowdin Sync, Link Check, Precompute Tarkov Data, Release, Stale Issues & PRs, Dependabot Auto Merge.** Wieder einschalten: `gh workflow enable "<Name>" -R miwidot/stammtisch-tracker`. Aktiv: CI, PR Checks, Security, Dependabot Updates, Preview (und `Finalization shadow`).

Vorsicht: `gh` ohne `-R` zielt im Klon auf Upstream (Standard-Remote), nicht auf den Fork.

---

## 3. Abweichungen im Code

### 3.1 Login-Handoff und Login-Pflicht

| Datei                                                                                                                                 | Was                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `app/plugins/tracker-handoff.client.ts` (neu), `app/utils/trackerHandoffState.ts` (neu), `app/composables/useTrackerHandoff.ts` (neu) | Löst `#tracker_token=` aus dem URL-Fragment ein (`verifyOtp`, Typ `email`), **nur mit passendem `tracker_state`**; erst nach `await $supabase.ready()` |
| `app/middleware/require-auth.global.ts` (neu)                                                                                         | Login-Pflicht. Offen: `/login`, `/auth/callback`, `/herkunft`, `/credits`, `/about`. Läuft nicht im Server-Render                                      |
| `app/pages/login.vue`, `app/shell/AppBar.vue`                                                                                         | Anbieter-Knöpfe und OAuth-Popup raus; Anmelden startet `startHandoff()` und navigiert auf `trackerHandoffUrl`                                          |
| `app/utils/runtimeConfig.ts`                                                                                                          | `resolveTrackerHandoffUrl` (Pflicht und https in Produktion)                                                                                           |
| `app/utils/supabaseGuard.ts`                                                                                                          | Fehlender Supabase-Client liefert `failed` statt Absturz im catch-Block                                                                                |
| `app/plugins/06.microsoft-clarity.client.ts`                                                                                          | `tracker_state`/`tracker_token` werden nie aufgezeichnet                                                                                               |

**Nonce gegen Login-CSRF:** Ohne Schutz löst jeder Aufruf mit `#tracker_token=` die Sitzung ein (ein Angreifer könnte ein Opfer in sein Konto einloggen).

1. `startHandoff()` erzeugt 256 Bit Zufall, legt sie in `sessionStorage` dieses Tabs ab (`tt_tracker_handoff_state`) und hängt `?state=<nonce>` an die Handoff-URL.
2. Die Hauptseite spiegelt `state` zurück: `<tracker>/...#tracker_token=<hash>&tracker_state=<nonce>`.
3. Das Plugin liest und löscht den Nonce zuerst, immer, genau einmal; eingelöst wird nur bei Gleichheit. Fehlend/falsch/Replay: kein `verifyOtp`, Fragment entfernt, Warnung ohne Token, Weiterleitung auf `/login`.
4. Besteht schon eine Sitzung, wird nichts eingelöst und nichts gewechselt (stilles Wechseln wäre der Angriff). Konto wechseln heißt erst abmelden.
5. Auf jedem Pfad ist das Fragment danach aus Adresszeile und Router-Zustand entfernt.

Rollout: Hauptseite zuerst, dann Tracker (der alte Tracker ignoriert das zusätzliche Feld; der neue Tracker lehnt Logins ab, solange die Hauptseite noch kein `tracker_state` sendet).

### 3.2 Theme und Branding

| Datei                                                                                         | Was                                                                                                                                                                                                                                                                                                                                                                                            |
| --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/assets/css/tailwind.css`                                                                 | Palette im `@theme static`: Oliv `primary`/`success`, Amber `warning`, gedämpftes `info`/`error`, grünstichige `surface`-Leiter, Hintergrundstapel mit Grunge-Textur. Upstreams `locked`-Leiter ist übernommen                                                                                                                                                                                 |
| `app/app.config.ts`                                                                           | Farb-Mapping; Modal-`wrapper` mit `rounded-none clip-corners corner-decoration`                                                                                                                                                                                                                                                                                                                |
| `DESIGN.md`                                                                                   | **Angepasst, nicht ausgeschlossen:** Front Matter trägt unsere Hex-Werte (`canvas #0a0b09`, `primary #697a3a` …) und den Namen "Tarkov Stammtisch Quest-Tracker". `design:lint` (Teil von `pnpm run lint`) endet mit Exit 0, meldet aber **sechs WCAG-Kontrastwarnungen** (z. B. dunkler Text auf Oliv 4,18:1). Nicht auf Upstreams Palette zurückstellen, nach Merges den Front Matter prüfen |
| `app/__tests__/tailwindTheme.test.ts`                                                         | Regex für HSL-Tokens akzeptiert Dezimalstellen (unsere Palette hat welche)                                                                                                                                                                                                                                                                                                                     |
| `app/utils/forkConfig.ts` (neu), `app/utils/theme.ts`, `AppBar.vue`, `AppPreferencesCard.vue` | `LIGHT_THEME_ENABLED=false` sperrt das Light-Theme. `tests/fork-test-setup.ts` (neu, in `vitest.config.ts` eingebunden) mockt das Flag auf `true`, damit Upstream-Tests unverändert laufen; `*.disabled.test.ts` prüfen den echten Wert                                                                                                                                                        |
| `nuxt.config.ts`                                                                              | Branding: `titleTemplate`, Icons, `manifest.json`, OG/Twitter-Texte ohne Bild, `apple-mobile-web-app-title`, Pre-Hydration-Skeleton mit Oliv-Fallbackfarben                                                                                                                                                                                                                                    |
| `app/shell/AppFooter.vue`                                                                     | **Komplett** eigene Version, `merge=ours` (Abschnitt 6)                                                                                                                                                                                                                                                                                                                                        |
| `app/shell/NavDrawer.vue`, `app/features/drawer/DrawerLinks.vue`                              | Logo `stammtisch-logo.png`; "Ressourcen"-Eintrag raus                                                                                                                                                                                                                                                                                                                                          |
| `app/shell/AppBar.vue`                                                                        | Upstreams Leiste plus: Supporter-Badge/-Menü raus, Discord-/GitHub-Einträge raus, Theme-Knopf nur mit `LIGHT_THEME_ENABLED`                                                                                                                                                                                                                                                                    |
| `app/pages/index.vue`                                                                         | `DashboardMigrationBanner`, `DashboardChangelog`, `DashboardSupportBanner` raus; unsichtbares `<h1>`                                                                                                                                                                                                                                                                                           |
| `app/features/dashboard/DashboardProgressSummary.vue`, `DashboardUpNext.vue`                  | Panels mit `rounded-none clip-corners corner-decoration`                                                                                                                                                                                                                                                                                                                                       |
| `app/pages/settings.vue`                                                                      | Tab "Tools & Integrations" und Discord-Karte raus; `AccountDeletionCard` durch `StammtischAccountDeletionNotice` ersetzt                                                                                                                                                                                                                                                                       |
| `app/features/tasks/TaskCard.vue`                                                             | Kontextmenüpunkt "Datenfehler melden" raus                                                                                                                                                                                                                                                                                                                                                     |
| `public/`                                                                                     | `img/logos/stammtisch-logo.png`, `favicon*`, `apple-touch-icon.png`, `manifest.json`, `og-default.png`, `textures/tarkov-grunge.jpg`, selbst gehostete Overlay-Schriften `fonts/overlay/*`                                                                                                                                                                                                     |
| `app/pages/herkunft.vue` (neu)                                                                | GPL-Herkunft und Lizenzangaben, öffentlich lesbar (Footer-Zeile)                                                                                                                                                                                                                                                                                                                               |

⚠️ **Farbquelle für das Theme: nur die Live-Seite, nie `tarkov-app/app/globals.css`** (dort stehen überschriebene Altwerte).

### 3.3 Sprachen

- `app/utils/locales.ts`: `SUPPORTED_LOCALES = ['de', 'en']`, `DEFAULT_LOCALE = 'de'`. **Die Browser-Sprache entscheidet** (`de` oder `en`), alles andere fällt auf `de`, eine **gespeicherte** Wahl `de`/`en` gewinnt. Ein gespeicherter, nicht mehr angebotener Wert (z. B. `fr`) wird ignoriert und erreicht auch die API nicht (`useLocaleSwitch.ts`).
- Daraus leiten sich ab: Sprachumschalter, i18n-Module in `nuxt.config.ts`, die Katalog-Sprachen (`app/utils/catalogDatasets.ts`, Upstream-Datei, unverändert), `public/llms.txt` und `NEUTRAL_CATALOG_LANGUAGES` in `supabase/functions/admin-cache-purge/cache-targets.ts` (die dortige Liste `TARKOV_LANGUAGES` ist Upstreams API-Liste und bleibt). Doku: `docs/api.md`, `docs/systems/game-data.md`.
- `nuxt.config.ts`: `files: ['de.json','de.overrides.json']`, `defaultLocale: 'de'`. Nach jedem Merge prüfen, dass Upstreams 14er-Liste nicht zurückkommt (`app/utils/__tests__/locales.test.ts` schlägt sonst an). **Eine Änderung der Liste verlangt ein neues Katalog-Release des Produzenten** (Pin in `scripts/producer/tracker.lock.json` des Overlay-Repos nachziehen).
- `app/locales/de.overrides.json` (neu): überschreibt nur, was Crowdin falsch oder gar nicht übersetzt; `de-overrides.test.ts` bewacht Schlüssel und Platzhalter. `app/locales/en.json`: einige neue Schlüssel für unsere Texte.
- `app/utils/forkKeptI18nKeys.ts` (neu): Kommentar-Datei, die `en.json`-Schlüssel nennt, die wir nicht mehr rendern; der Unused-Key-Lint akzeptiert einen Schlüssel, sobald eine Quelldatei ihn erwähnt. Bei neuem Lint-Fehler "is not used in app/" hier ergänzen.
- ⚠️ `app/i18n.config.ts` taugt nicht für die Standardsprache: `@nuxtjs/i18n` nimmt `defaultLocale` aus `nuxt.config.ts`.
- Erster Aufbau: Public-Seiten werden auf `de` vorgerendert, die Sprachwahl läuft erst nach `app:mounted` (Upstream-Plugin `i18n.client.ts`). Ein englischer Browser sieht einen kurzen deutschen Moment (bewusst hingenommen).

### 3.4 Rechtstexte

`/privacy` und `/terms-of-service` antworten per **302** auf `https://tarkov-stammtisch.de/datenschutz` bzw. `/nutzungsbedingungen`.

| Datei                                                                                   | Rolle                                                                                                                                                                                                                 |
| --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/server/middleware/03.fork-legal-redirect.ts` (neu)                                 | Server-Redirect                                                                                                                                                                                                       |
| `app/middleware/legal-redirect.global.ts` (neu)                                         | Client-Navigation                                                                                                                                                                                                     |
| `app/utils/legalLinks.ts` (neu)                                                         | Ziele und Pfaderkennung: tolerant bei Groß-/Kleinschreibung und Schrägstrich am Ende; `/privacy-policy`, `/privacy/x` bleiben unberührt; Ziel nur aus der Konfiguration, **nie aus der Anfrage** (kein Open Redirect) |
| `app/composables/useLegalLinks.ts` (neu), `AnalyticsConsentBanner.vue`, `AppFooter.vue` | Interne Links zeigen direkt auf die Ziele                                                                                                                                                                             |

Die Upstream-Seiten `privacy.vue` und `terms-of-service.vue` bleiben unverändert (kein Merge-Konflikt), werden aber nie gerendert und nicht mehr vorgerendert. Variablen: `NUXT_PUBLIC_LEGAL_PRIVACY_URL`, `NUXT_PUBLIC_LEGAL_TERMS_URL`.

### 3.5 Support- und Upstream-Links

Support/Report-Links gehen an unser Discord (`app/utils/supportLinks.ts`, `app/composables/useDiscordInvite.ts`, `NUXT_PUBLIC_DISCORD_INVITE_URL`): Hilfe-Menü "Problem melden" (`GlobalHelpLauncher.vue`), About (`AboutHelpLinks.vue`, GitHub-Issues- und Security-Zeile entfernt), "Ressource vorschlagen" (`resources/index.vue`), Footer. Attribution, Lizenz und Quelltext bleiben bei Upstream (Footer/Herkunft: GitHub `TarkovTracker`, `LICENSE.md`, `tarkov-data-overlay`; `resourceData.ts`, `SupporterAltPayments.vue`, `public/llms.txt` unberührt).

### 3.6 Supporter und Stripe

`app/middleware/no-supporter-sales.global.ts` (neu): `/supporter` → 404; die Seite ist aus Prerender, Routen und Sitemap genommen (`nuxt.config.ts`). `app/server/middleware/no-stripe-endpoints.ts` (neu): 404 unter `/api/stripe/*`.

### 3.7 Spieldaten aus lokalem Verzeichnis

Upstream liest die Daten nur aus Cloudflare KV. Bei uns: `app/server/plugins/local-tarkov-data.ts`, `app/server/utils/localDirKv.ts`, `scripts/precompute/dir-store.ts` (alle neu) und `--target=dir:/absolut` bzw. `PRECOMPUTE_TARGET` in `scripts/precompute/run.ts` (Konfliktfläche). Aktiv nur mit absolutem `TARKOV_DATA_DIR`. Befüllt wird das Verzeichnis vom Produzenten im Overlay-Repo (`npm run build:catalogs`).

### 3.8 Changelog

`app/server/utils/forkChangelog.ts` (neu, Einträge DE/EN) wird in `app/server/api/changelog.get.ts` eingemischt: der Upstream-Handler heißt dort `buildUpstreamChangelog`, der neue Default-Handler setzt `forkChangelogItems()` davor (Sprache aus `?lang=`), Limit und `hasMore` gelten für die Summe, und er liefert die Einträge auch, wenn GitHub nicht erreichbar ist. `app/pages/changelog.vue` schickt `lang` mit und erkennt deutsche Verben (Hinzugefügt, Verbessert, Aktualisiert, Behoben). Neue Einträge **oben** in `FORK_CHANGELOG_ENTRIES` (Datum `YYYY-MM-DD`, Label und Stichpunkte je `de`/`en`, Klartext für Spieler). Bei Konflikt: Upstream-Handler übernehmen, den Wrapper am Dateiende wieder aufsetzen. **Kein GitHub-API-Aufruf** (siehe 4).

### 3.9 Supabase-URL

`app/server/utils/adminSupabase.ts`: `normalizeSupabaseUrl` ist der einzige Prüfpunkt für `NUXT_SUPABASE_URL` (Konto-Löschung, Profil-/Team-Saisonmodus, Kontoaktivität, Twitch-Konfig, Cache-Purge, Stripe-Checkout). **`http:` ist nur für Loopback erlaubt** (`127.0.0.0/8`, `localhost`, `[::1]`, Prüfung `isLoopbackHostname` in `app/server/utils/loopbackHost.ts`), weil der Server Supabase auf derselben Maschine anspricht (`http://127.0.0.1:8200`). Alles andere bleibt https-only, URLs mit Zugangsdaten werden immer abgelehnt. Dezimal-/Hex-Schreibweisen (`2130706433`) normalisiert der URL-Parser zu `127.0.0.1` und gelten als Loopback; `0.0.0.0`, `127.0.0.1.evil.com`, `localhost.evil.com` und IPv4-gemappte IPv6 fallen durch. Tests: `adminSupabaseUrl.test.ts`, `forkAccountDelete.test.ts`.

### 3.10 Indexierung

Überall `noindex`:

- `X-Robots-Tag: noindex, nofollow` auf jeder Antwort (`routeRules` in `nuxt.config.ts` für Statisches, `app/server/middleware/02.fork-indexing-policy.ts` für Dynamisches).
- `<meta name="robots" content="noindex, nofollow">` auf jeder Seite, auch vorgerenderten. Per-Route-SEO (`app/composables/useRouteSeo.ts`, `app/server/plugins/route-seo.ts`) läuft durch `applyIndexingPolicy` (`app/utils/indexingPolicy.ts`): ohne `canonical`, `og:url`, JSON-LD. Kein hreflang.
- `public/robots.txt`: `User-agent: *`, `Disallow: /`. Kein `sitemap.xml` (`sitemap.enabled` ohne Schalter `false`).
- Schalter `NUXT_PUBLIC_ALLOW_INDEXING=true` (Build und Laufzeit) stellt Upstreams Verhalten wieder her; vorher SEO-Texte und `SEO_ORIGIN` in `routeSeo.ts` auf unsere Marke bringen. Bewusst unberührt: `public/llms.txt` (nur die Locale-Zeile angepasst) und das statische `og:url`.

### 3.11 Ausgehende Verbindungen

Grundsatz: Der Fork redet nur mit Hosts, die er braucht. **Der einzige externe Host im Browser ist `assets.tarkov.dev`.** Alles andere ist aus oder per Standard abgeschaltet und hat einen Test (Commit `4f735ef8`).

| Was                | Wie                                                                                                                                                                                                                                                                                           | Datei / Test                                                                                                                   |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| CSP                | Minimal: Cloudflare Web Analytics, Google Analytics, Clarity, Google Fonts, Iconify-API, `tarkovtracker.github.io`, `raw.githubusercontent.com`, `*.supabase.co` raus; `font-src 'self'`. Den Cloudflare-Beacon setzt der Edge ein: im Dashboard "Web Analytics" für die Hostnamen abschalten | `app/utils/csp.ts`, `csp.test.ts`                                                                                              |
| Overlay lesen      | `OVERLAY_URL`/`NEUTRAL_OVERLAY_URL` per `file:` (Abschnitt 4)                                                                                                                                                                                                                                 | `overlaySource.ts`, `overlay.ts`, `neutralOverlay.ts`                                                                          |
| Kappa-Overlay      | `app/server/api/streamer/[userId]/[mode]/kappa.get.ts` nutzt `fetchOverlay()` (konfigurierte Quelle, gemeinsamer Cache) statt fester Upstream-URL; `OVERLAY_TOKEN` geht weiter nur an GitHub                                                                                                  | `kappa.test.ts`                                                                                                                |
| Overlay-Schriften  | selbst gehostet (`public/fonts/overlay/*`), nicht Google Fonts                                                                                                                                                                                                                                | `app/server/routes/overlay/kappa/[userId]/[mode].get.ts`, `csp.ts`                                                             |
| GitHub-API         | Nur mit `UPSTREAM_GITHUB_ENABLED=true`. Sonst: `/api/changelog` liefert nur unsere Einträge, die Seite verlinkt Upstream-Releases statisch; `/credits` zeigt einen Link auf die Upstream-Mitwirkenden (`UpstreamContributorsNote.vue`, `app/utils/upstreamLinks.ts`)                          | `changelog.get.ts`, `contributors.get.ts`, `credits.vue`, `changelog.vue`                                                      |
| Bild-Proxy `/_ipx` | `image.domains` nur `assets.tarkov.dev`. About-Avatare als Monogramm, Credits ohne Avatar, Video-Platzhalter ohne YouTube-Vorschaubild (erst der Klick lädt `youtube-nocookie.com`)                                                                                                           | `nuxt.config.ts`, `AboutMemberCard.vue`, `teamMembers.ts`, `creditSections.ts`, `useContributors.ts`, `ResourceVideoEmbed.vue` |
| `/api/twitch/live` | 404, solange `NUXT_TWITCH_LIVE_ENDPOINT_ENABLED` nicht `true` ist                                                                                                                                                                                                                             | `app/server/api/twitch/live.get.ts`                                                                                            |
| Icons              | `icon.fallbackToApi: false` und `icon.serverBundle: 'local'` (sonst holt 'auto' die Sets von cdn.jsdelivr.net); `/api/_nuxt_icon/*` ist öffentlich (`INVARIANT_PUBLIC_ROUTES` in `api-protection.ts`), damit anonyme Besucher nicht auf 401 laufen                                            | `nuxt.config.ts`, `app/server/middleware/api-protection.ts`                                                                    |
| Karten-SVG         | Kein Fallback auf `tarkovtracker.github.io`, nur `assets.tarkov.dev`                                                                                                                                                                                                                          | `app/utils/mapCoordinates.ts`, `useLeafletMap.ts`                                                                              |

**Bleibt bewusst:** `assets.tarkov.dev` (Browser und Bild-Proxy), `json.tarkov.dev` (Task-Metadaten, nur der Produzent im Overlay-Repo), `players.tarkov.dev` (Profil-Import auf Nutzeraktion), die eigene Domain samt Supabase, die Hauptseite für den Login-Handoff, `youtube-nocookie.com` und `player.twitch.tv` nur nach Klick bzw. wenn das Feature eingeschaltet wird. `img-src https:` bleibt breit, weil der Avatar der Hauptseite von beliebigen Hosts kommen kann.

### 3.12 TarkovMonitor-Link auf der Aufgabenseite

`app/features/tasks/TaskPageHeader.vue`: der Link "Automatic quest tracking with TarkovMonitor" hinter der Seitenbeschreibung (Slot `description-link`) wird nicht gerendert. Der i18n-Schlüssel `page.tasks.auto_tracking_guide` und die Ressourcenseite `/resources/tarkovmonitor` bleiben unberührt. Test: `app/features/tasks/__tests__/TaskPageHeader.test.ts`.

### 3.13 "..."-Menü in der oberen Leiste

`app/shell/AppBar.vue`: der "..."-Knopf (Überlaufmenü, Label `common.more`) wird auf allen Breiten nicht gerendert (`OVERFLOW_MENU_ENABLED=false` in `app/utils/forkConfig.ts`). Damit nichts unerreichbar wird, zeigt die Leiste auf jeder Breite direkt: Sprachwahl und Hilfe (bei Upstream erst ab 1620 bzw. 1280 px). Die Aktivitäts-Glocke bleibt ab 561 px sichtbar und entfällt auf schmalen Mobilgeräten (560 px und weniger). Damit Suchfeld und Knöpfe auch bei schmaler Leiste nicht überlappen, haben die Seitenspalten des Grids `minmax(max-content,1fr)`, das Suchfeld schrumpft zuerst (unter 561 px wie bisher zum Icon). Test: `app/shell/__tests__/AppBar.overflow.test.ts`; `AppBar.disabled.test.ts` setzt das Flag auf `true`, weil es den Menüinhalt prüft.

### 3.14 TarkovMonitor aus dem Ressourcenbereich ausgeblendet

`app/features/resources/resourceData.ts`: der Eintrag `tarkovmonitor` bleibt im Upstream-Block stehen, `RESOURCES` filtert ihn über `FORK_HIDDEN_RESOURCE_SLUGS` heraus. Damit verschwindet die Karte auf `/resources`, die Route steht nicht mehr in `PUBLIC_SEO_ROUTES` (kein Prerender, kein Sitemap-Eintrag), und `/resources/tarkovmonitor` antwortet über die bestehende Prüfung in `app/pages/resources/[slug].vue` mit einem echten 404 (wie jeder unbekannte Slug; kein Redirect, weil die Seite hier nicht existiert). `public/llms.txt` verweist nicht mehr auf die Anleitung, die Smoke-Skripte unter `scripts/preview/smoke/` und die Testfixtures nutzen RatScanner. Die Beschreibung `seo.routes.resources.description` nennt TarkovMonitor nicht mehr (en.json direkt geändert, weil es für en keine Override-Datei gibt; de steht in `de.overrides.json`). Unberührt: die übrigen Locale-Texte, der Verwandte-Projekte-Link auf `/herkunft` und `page.tasks.auto_tracking_guide`. Beim Sync: kommt ein neuer Eintrag in `RESOURCES`, ändert sich nichts an der Filterung. Test: `app/features/resources/__tests__/tarkovmonitorHidden.test.ts`.

### 3.15 Kappa- und Lightkeeper-Tracker bleibt

Upstream hat die Seite `/kappa` mit #1534 (`d71384c2`, 2026-11-21) zu einem Hinweis "retired" umgebaut. Unsere Community nutzt sie aktiv, deshalb haben wir den Commit zurückgenommen (`git revert`) und die Seite wieder an den aktuellen Code angeschlossen. Aufgabenmengen kommen weiter aus dem aktuellen Katalog (`metadataStore.tasks`, Flags `kappaRequired` / `lightkeeperRequired`), PvP und PvE folgen dem aktiven Spielmodus. Profil-Fortschritt und Streamer-Overlay waren nie betroffen.

Dateien, die wir jetzt besitzen:

- `app/pages/kappa.vue` (Upstream: Hinweisseite), `app/features/seo-pages/kappa.vue` (Wrapper), `app/features/kappa/*` (`useKappaOverview.ts`, `KappaTaskRow.vue`, `KappaTraderColumn.vue`, `KappaTraderSelector.vue`, `TrackerSummary.vue`) samt Tests
- `app/features/drawer/DrawerLinks.vue`: Eintrag Kappa & Lightkeeper nach Team (Icon `i-mdi-trophy`); `nuxt.config.ts`: `'/kappa': 'kappa'` in `wrappers`
- `app/locales/en.json`: `page.kappa.*` (Upstream hat die Schlüssel entfernt); `app/locales/de.overrides.json`: `page.kappa.*` und `common.lightkeeper` ("Lightkeeper" statt Crowdin-"Leuchtturm"), damit die Seite deutsch bleibt, auch wenn Crowdin die Schlüssel verliert
- `public/llms.txt` (Eintrag), `docs/architecture.md` (Zeile `kappa/`)
- Fußzeile: unverändert. `AppFooter.vue` ist komplett eigen und hatte nie eine Tracker-Linkliste, es gibt dort nichts wiederherzustellen.
- `KappaTaskRow.vue`: Statuslabel nutzt `common.completed` statt `common.complete`, weil unser Override von `common.complete` ("Abschließen") ein Knopf-Imperativ ist.

Beim Sync beachten:

- Merge-Konflikte in `app/pages/kappa.vue`, `DrawerLinks.vue`, `nuxt.config.ts`, `en.json`: unsere Fassung behalten, Upstream-Änderungen am Rest übernehmen. `app/utils/routeSeo.ts`, `scripts/preview/smoke/seo.smoke.mjs` und `tests/` führen `/kappa` upstream weiter (Titel "Kappa & Lightkeeper Tracker").
- Upstream-Änderungen an Stores und Aufgabenform (`useMetadata`, `useProgress`, `useTarkov`, `Task`-Typ, `isTaskCounted`/`isTaskRelevant`, `sortTasksByProgression`, `useTaskActions`, `useSharedBreakpoints`) brechen `useKappaOverview.ts` zuerst; die Tests in `app/features/kappa/__tests__/` und `app/pages/__tests__/kappa.page.test.ts` zeigen das.
- Fällt `kappaRequired` / `lightkeeperRequired` upstream weg oder ändert die Form, ist die Seite leer: Seite und Profil (`ProfileProgression.vue`) gemeinsam anpassen.
- Farb-Tokens `kappa-*` / `lightkeeper-*` in `tailwind.css` und `app.config.ts` nicht entfernen (Seite, Dashboard, Overlay).
- Neue Schlüssel unter `page.kappa.*` in `en.json` brauchen einen Eintrag in `de.overrides.json` (`de-overrides.test.ts` prüft das).
- Tests: `app/pages/__tests__/kappa.page.test.ts`, `app/features/drawer/__tests__/DrawerLinks.test.ts`, `app/features/kappa/__tests__/*`, `app/locales/__tests__/de-overrides.test.ts`.

### 3.16 Instanzname in Titeln und Manifesten

Der Seitenname kommt aus **einer** Konstante: `app/utils/siteBrand.ts` (`SITE_NAME = 'Tarkov Stammtisch'`, `SITE_TITLE_SUFFIX`). Daraus leiten sich ab: `titleTemplate`, `og:site_name`, `og:title`/`twitter:title` und `apple-mobile-web-app-title` in `nuxt.config.ts`, die Social-Titel-Kürzung in `app/utils/routeSeo.ts` (`previewTitle`) sowie der Rückfallwert dort.

Weil JSON nichts importieren kann, steht der Name zusätzlich als Text in `app/locales/en.json` und `de.json`: `seo.site_name`, alle Suffixe `· Tarkov Stammtisch` unter `seo.routes.*.title`, in `de.json` außerdem `navigation_drawer.brand_name`. `public/manifest.json` und `public/manifest.webmanifest` tragen `name` bzw. `short_name` fest. `tests/fork-branding.test.ts` prüft, dass beides zusammenpasst und dass kein `TarkovTracker.org` im gerenderten Head steht.

Bewusst **unverändert** (Herkunft, Lizenz oder Upstream-Inhalt): Fußzeile und `/herkunft` (`footer.origin_link`, Attribution), die Ressourcenführer über TarkovTracker.org/.io samt Kategorie- und Teamtexten, `page.about.*` (Upstream-Team), Titel von `/supporter` (liefert 404) und `/resources/tarkovtracker_org_vs_io`, Rechtstexte (`privacy.vue`, `terms-of-service.vue`, werden nie gerendert), `SEO_ORIGIN` (kleingeschriebene Upstream-Domain nur in Canonical/JSON-LD, die bei `noindex` entfallen), die zwölf nicht angebotenen Sprachdateien. **Nach jedem Upstream-Merge:** neue `seo.routes.*.title` mit `· TarkovTracker.org` in `en.json`/`de.json` auf unseren Namen setzen; `fork-branding.test.ts` schlägt sonst an.

Das Streamer-Kappa-Overlay (`app/server/routes/overlay/kappa/[userId]/[mode].get.ts`, die einzige Overlay-Route) nennt in der Zeile "Powered by" ebenfalls `SITE_NAME` (Tagline im HTML und die Kartenzeile im Skript) und verlinkt nichts. Die Seite wird serverseitig als englisches HTML ausgeliefert, es gibt dort keine Locale-Schlüssel. Test: `app/server/routes/overlay/kappa/__tests__/route.test.ts`.

Tests: `tests/fork-branding.test.ts`, `tests/route-seo.test.ts`.

### 3.16 Datenfingerabdruck für den Client-Cache

Upstream hält Spieldaten im IndexedDB-Cache `tarkov-tracker-cache` 12 Stunden und prüft sonst nur `cache-meta` (Admin-Purge). Eine Übersetzungs- oder Produzentenänderung ohne Purge und ohne neues Overlay-Tag blieb deshalb bis zu 12 Stunden unsichtbar.

Ablauf:

- Server: `GET /api/tarkov/data-fingerprint` (`app/server/api/tarkov/data-fingerprint.get.ts`, `app/server/utils/dataFingerprint.ts`) liefert `{ data: { fingerprint } }`, einen auf 32 Zeichen gekürzten SHA-256 über: Zielverzeichnis von `TARKOV_DATA_DIR` (Release-Name) samt Inhalt des Katalog-Manifests, Inhalt der Quellen `OVERLAY_URL` und `NEUTRAL_OVERLAY_URL` (gleiche Validierung wie `overlay.ts`/`neutralOverlay.ts`, Datei oder HTTP) und Nuxt-Build-ID. Nichts davon (Pfade, URLs) verlässt den Server. Antwort 5 s im Speicher und per `Cache-Control: public, max-age=5`; Overlay-Quellen werden lokal 5 s, über das Netz 60 s gemerkt. Ist eine Quelle unlesbar, bleibt ihr letzter guter Hash stehen.
- Client: `app/utils/dataFingerprint.ts` fragt höchstens einmal pro 60 s (Timeout 2,5 s, auch ein Fehlschlag zählt). `getCachedData` und `setCachedData` in `app/utils/tarkovCache.ts` warten darauf; Einträge tragen das Feld `fingerprint`. Fehlt es (altes Format) oder weicht es ab, gilt der Eintrag als abgelaufen und wird neu geladen. Schlägt die Abfrage fehl, wird der Cache weiter benutzt und per `logger.warn` vermerkt.
- `app/plugins/data-fingerprint.client.ts` prüft bei Tabfokus und `visibilitychange` (gleicher Throttle). Ändert sich der Wert während einer Sitzung, lädt `metadataStore.initialize({ forceRefresh: true })` die Daten neu.
- TTL-Override: `runtimeConfig.public.tarkovDataCacheTtlMs`, Env `NUXT_PUBLIC_TARKOV_DATA_CACHE_TTL_MS` (Millisekunden). Leer/ungesetzt: Upstream-12h. `0`: nichts wird gespeichert und nichts aus dem Cache geliefert. Positiver Wert: begrenzt die TTL neuer und vorhandener Einträge. Laufzeitwert, kein Rebuild, nur Neustart des Prozesses.

Dateien: `app/utils/dataFingerprint.ts`, `app/plugins/data-fingerprint.client.ts`, `app/server/utils/dataFingerprint.ts`, `app/server/api/tarkov/data-fingerprint.get.ts` (alle neu); `app/utils/tarkovCache.ts`, `nuxt.config.ts` (ein Schlüssel in `public`), `app/server/utils/overlay.ts` und `neutralOverlay.ts` (je `export` vor der Standard-URL-Konstante).

Beim Sync beachten:

- Ändert Upstream `getCachedData`/`setCachedData`, die `// Fork:`-Blöcke in `tarkovCache.ts` behalten. Beide rufen `checkDataFingerprint()` auf; ohne den Aufruf ist das Verhalten wieder 12 h.
- Die Namen `DEFAULT_OVERLAY_URL` und `DEFAULT_URL` müssen aus `overlay.ts` bzw. `neutralOverlay.ts` exportiert bleiben.
- Tests: `app/utils/__tests__/dataFingerprint.cache.test.ts`, `app/server/utils/__tests__/dataFingerprint.test.ts`, `app/server/api/tarkov/__tests__/data-fingerprint.get.test.ts`.

---

## 4. Overlay-Quelle (`OVERLAY_URL`)

`app/server/utils/overlaySource.ts` (neu) entscheidet, woher das Overlay gelesen wird. Erlaubt:

- `https:`
- `http:` **nur Loopback** (gleiche Prüfung wie in 3.9)
- `file:` auf eine reguläre `*.json`-Datei **unterhalb von `OVERLAY_FILE_ROOT`**: Pfad liegt lexikalisch **und** nach `realpath` darin (Symlinks führen nicht hinaus), max. 64 MiB, kein Host, keine Zugangsdaten

Warum `file:`: Der nginx-vhost antwortet nur auf Namen; ein `fetch` auf `http://127.0.0.1/` träfe den Default-Server oder eine https-Weiterleitung, also wieder Cloudflare.

⚠️ **Alles andere fällt still auf die Upstream-Adresse zurück** (kein Fehler, unsere Übersetzungen sind weg). Zugangsdaten in der URL sind verboten; max. 3 Weiterleitungen, Ziele ebenfalls https. Ebenfalls still verworfen wird ein Overlay **ohne `$meta.version`**. Das Neutral-Sidecar `overlay-neutral.json` muss neben dem Overlay liegen, sonst fehlen unsere `$strings` im Client.

---

## 5. Kontolöschung nur über die Hauptseite

Upstream verlangt für das Löschen im Tracker (#1446) eine OAuth-Anmeldung der letzten 5 Minuten. Unsere Nutzer melden sich per `verifyOtp` an (Methode `otp`), das Löschen im Tracker kann für sie nie gelingen. Deshalb: **gelöscht wird nur auf der Hauptseite**, das Tracker-Konto wird mitgelöscht.

- **Oberfläche:** Einstellungen → Konto zeigt `app/features/settings/StammtischAccountDeletionNotice.vue` (Hinweis plus Link, Schlüssel `settings.fork_account_deletion.*`), keinen Knopf. Upstreams `AccountDeletionCard` und die `account-delete`-Function bleiben unverändert im Repo, sind aber nicht eingebunden. Ziel: `NUXT_PUBLIC_ACCOUNT_DELETION_URL`.
- **Endpunkt:** `POST /api/fork/account-delete` mit `Authorization: Bearer <NUXT_FORK_ACCOUNT_DELETE_SECRET>` und `{"userId":"<supabase-uuid>"}`.
  - `app/server/middleware/01.fork-account-delete.ts` (läuft vor `api-protection`, daher `01.`), `app/server/utils/forkAccountDelete.ts`.
  - **Loopback-only-Gate** `app/server/utils/loopbackOnly.ts`: die TCP-Gegenstelle (`socket.remoteAddress`) muss Loopback sein (`127.0.0.0/8`, `::1`, `::ffff:127.x`) **und** keiner der Weiterleitungs-Header darf vorhanden sein (`X-Forwarded-For`, `X-Real-IP`, `CF-Connecting-IP`, `Forwarded`, `X-Forwarded-Host`, `X-Forwarded-Proto`, `True-Client-IP`, auch leer). Sonst **404, noch vor Secret-Prüfung und Rate-Limit**; Pfad-Varianten (Schrägstrich, Groß-/Kleinschreibung, Kodierung) ebenfalls 404. nginx verbindet auch von 127.0.0.1, setzt aber immer Weiterleitungs-Header, deshalb erreicht öffentlicher Verkehr den Endpunkt nie. `API_TRUST_PROXY` spielt keine Rolle.
  - Die Hauptseite **muss `http://127.0.0.1:3101/api/fork/account-delete` direkt aufrufen**, ohne Proxy und ohne Weiterleitungs-Header. Zusätzlich `/api/fork` im nginx öffentlich sperren.
  - Antworten: 200 gelöscht; 200 `not_found` (idempotent, zählt als Erfolg, denn ein 502 oder Timeout kann trotzdem committed haben); 409 `in_progress` (Lease belegt, später wiederholen); 409 `storage_owner` (Konto besitzt Storage-Daten, nicht wiederholen); 401/403/400/413/405; 429 (mehr als 20 Anfragen pro Minute und Adresse, `Retry-After`); 502 fehlgeschlagen (zurückgerollt, geloggt); 503 nicht konfiguriert. Falsche Secrets werden höchstens einmal pro Minute geloggt.
- **SQL:** Migration `20261121140000_fork_admin_delete_account.sql`, Funktion `fork_delete_account(uuid)`, nur `service_role`. Folgt Upstreams `retry_account_deletion`: Job-Lease, Teams übergeben, Events und API-Zählung löschen, `auth.users` löschen (Rest kaskadiert), Job abschließen, eine Transaktion. Die Storage-Prüfung (Konten mit Objekten/Buckets ablehnen) läuft über dynamisches SQL hinter **`to_regclass`**, weil es auf unserem Stack keine Storage-Tabellen gibt. pgTAP: `supabase/tests/database/fork_admin_delete_account.test.sql`, `plan(25)`.
- **Hauptseite (`tarkov-app`, hier nicht geändert):** muss vor dem Löschen des `User`-Eintrags den Endpunkt mit `QuestTrackerAccount.supabaseUserId` aufrufen und die Mapping-Zeile erst nach 200 (`deleted` oder `not_found`) verlieren; bei 409/502/Netzfehler nicht als erledigt melden, wiederholen (#1294). Ohne Mapping-Zeile entfällt der Aufruf.

### Inaktivitäts-Cron abgeschaltet

Upstreams wöchentlicher Cron `inactive-account-cleanup` (löscht nach sechs Monaten ohne Aktivität; Migration `20260930003202`) würde unsere Mapping-Zeile ins Leere zeigen lassen. Die Fork-Migration `20261121150000_fork_disable_inactive_account_cleanup.sql` plant ihn aus (idempotent, Upstream-Datei unverändert; pgTAP `fork_disable_inactive_account_cleanup.test.sql`). Bleiben dürfen `account-activity-snapshot`, `account-deletion-retry` (beendet nur bereits angeforderte Löschungen) und `owner-only-team-cleanup` (löscht Teams, keine Konten). **Nach jedem Upstream-Merge prüfen**, ob eine neue Migration den Job wieder einplant: `SELECT jobname FROM cron.job;` darf `inactive-account-cleanup` nicht zeigen.

---

## 6. Eigene Migrationen und DB-Stand

| Migration / Eingriff                                                                       | Warum                                                                                                     |
| ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| `20261121140000_fork_admin_delete_account.sql`                                             | `fork_delete_account(uuid)`, siehe Abschnitt 5                                                            |
| `20261121150000_fork_disable_inactive_account_cleanup.sql`                                 | plant `inactive-account-cleanup` aus                                                                      |
| `ALTER PUBLICATION supabase_realtime ADD TABLE public.teams` (**nicht im Repo**, von Hand) | Fehlt upstream. `user_system` steht seit `20260830120000_secure_team_realtime_channels.sql` upstream drin |

Ob die beiden Migrationen auf dem laufenden Server angewendet sind, lässt sich aus dem Repo nicht ablesen: auf dem Server prüfen.

---

## 7. Kategorie C — Eingriffe in Upstream-Dateien (Merge-Hotspots)

Diese Dateien konfliktieren am ehesten; Einzelheiten stehen in den Abschnitten oben.

| Datei                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Eingriff (Abschnitt)                                                                                                                                                                                                                                                                                                                                                                               |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `nuxt.config.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Locales, Branding, `runtimeConfig`, Indexierungsschalter, `icon`/`image`, `/supporter` aus Prerender (3.2, 3.3, 3.10, 3.11)                                                                                                                                                                                                                                                                        |
| `app/utils/locales.ts`, `app/utils/csp.ts`, `app/utils/runtimeConfig.ts`, `app/utils/theme.ts`, `app/utils/mapCoordinates.ts`, `app/utils/tarkovApiFetch.ts`, `app/utils/supabaseGuard.ts`                                                                                                                                                                                                                                                                                                                  | 3.3, 3.11, 3.1, 3.2. `tarkovApiFetch.ts`: eine Zeile, Cast `as T` am `$fetch`-Ergebnis (ohne Sitemap-Modul ändern sich die Nitro-Routentypen, der Typecheck bricht sonst)                                                                                                                                                                                                                          |
| `app/assets/css/tailwind.css`, `app/app.config.ts`, `DESIGN.md`                                                                                                                                                                                                                                                                                                                                                                                                                                             | Theme (3.2)                                                                                                                                                                                                                                                                                                                                                                                        |
| `app/shell/AppBar.vue`, `NavDrawer.vue`, `AppFooter.vue`, `app/features/drawer/DrawerLinks.vue`                                                                                                                                                                                                                                                                                                                                                                                                             | Navigation (3.2); `AppFooter.vue` komplett eigen                                                                                                                                                                                                                                                                                                                                                   |
| `app/pages/index.vue`, `login.vue`, `settings.vue`, `credits.vue`, `changelog.vue`, `resources/index.vue`                                                                                                                                                                                                                                                                                                                                                                                                   | 3.1, 3.2, 3.5, 3.8                                                                                                                                                                                                                                                                                                                                                                                 |
| `app/server/api/changelog.get.ts`, `contributors.get.ts`, `twitch/live.get.ts`, `streamer/[userId]/[mode]/kappa.get.ts`                                                                                                                                                                                                                                                                                                                                                                                     | 3.8, 3.11                                                                                                                                                                                                                                                                                                                                                                                          |
| `app/server/utils/overlay.ts`, `neutralOverlay.ts`, `adminSupabase.ts`, `serveProfileShell.ts`, `app/server/middleware/api-protection.ts`, `app/server/plugins/route-seo.ts`, `app/server/routes/overlay/kappa/[userId]/[mode].get.ts`                                                                                                                                                                                                                                                                      | 3.9, 3.10, 3.11, 4. `serveProfileShell.ts`: `tracker_state`/`tracker_token` werden nicht aufgezeichnet                                                                                                                                                                                                                                                                                             |
| `app/components/ui/GlobalHelpLauncher.vue`, `app/features/about/AboutHelpLinks.vue`, `AboutMemberCard.vue`, `teamMembers.ts`, `app/features/credits/creditSections.ts`, `useContributors.ts`, `app/features/resources/ResourceVideoEmbed.vue`, `app/features/settings/AppPreferencesCard.vue`, `app/features/tasks/TaskCard.vue`, `app/features/dashboard/*` (2 Dateien), `app/components/analytics/AnalyticsConsentBanner.vue`, `app/composables/useLeafletMap.ts`, `useLocaleSwitch.ts`, `useRouteSeo.ts` | 3.2, 3.4, 3.5, 3.11                                                                                                                                                                                                                                                                                                                                                                                |
| `scripts/precompute/run.ts`, `supabase/functions/admin-cache-purge/cache-targets.ts` (+ `.deno.test.ts`)                                                                                                                                                                                                                                                                                                                                                                                                    | 3.7, 3.3                                                                                                                                                                                                                                                                                                                                                                                           |
| `package.json`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | **eine Zeile:** `postinstall` = `NODE_ENV=development nuxt prepare`. `pnpm-lock.yaml` ist Upstreams, nie von Hand mergen (`pnpm install --lockfile-only` muss ohne Diff laufen)                                                                                                                                                                                                                    |
| `.env.example`, `vitest.config.ts`, `.gitattributes`, `public/llms.txt`, `public/robots.txt`, `docs/api.md`, `docs/systems/game-data.md`                                                                                                                                                                                                                                                                                                                                                                    | Variablen, Test-Setup, Merge-Treiber, Locale-/Robots-Texte                                                                                                                                                                                                                                                                                                                                         |
| `.github/dependabot.yml`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | gelöscht (bei Merge-Konflikt: Löschung behalten)                                                                                                                                                                                                                                                                                                                                                   |
| Angepasste Upstream-Tests                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | `AppBar.test.ts`, `AppBar.disabled.test.ts`, `index.page.test.ts`, `settings.page*.test.ts`, `i18nHelpers.test.ts`, `i18n.client.test.ts` (Fallback `de`), `mapCoordinates.test.ts`, `runtimeConfig.test.ts`, `nuxtSecurityConfig.test.ts`, `tests/route-seo*.test.ts` (angemeldeter Nutzer wegen Login-Pflicht), `catalog-release.test.ts`, `check-overlay.test.ts`, `cache-targets.deno.test.ts` |

### Merge-Treiber `merge=ours`

Für `app/shell/AppFooter.vue` (gehört zu 100 % uns) steht in `.gitattributes` `merge=ours`. Das Attribut allein reicht: der Treiber muss **pro Klon** aktiviert sein, sonst ersetzt ein Upstream-Merge die Datei lautlos:

```bash
git config merge.ours.driver true     # schreibt in die lokale .git/config
git config --get merge.ours.driver    # muss "true" liefern
```

### Nicht mehr abweichend (Upstream hat es übernommen oder abgelöst)

User-Agent aus App-URL (Upstream #914), Profil-Import-Fix (Upstream #848, Route mit #1537 umgebaut), teamId-UUID-Validierung (#756), Kappa-/Lightkeeper-Übersetzungen (Seite entfiel mit #1534), Community-Gruppe im Hilfe-Menü (Upstream hat sie selbst entfernt), `THEME_COLORS` (Konstante upstream entfernt, Palette nur noch in `tailwind.css`), `wrangler.toml` `APP_URL` (auf node-server ohne Wirkung). Die deutschen Overlay-Übersetzungen sind seit den PRs #280/#281 upstream (siehe Overlay-Fork).

---

## 8. Nach jedem Upstream-Merge: Rauchtest

Die teuren Fehler sind die stillen (verschwundene deutsche Texte, tote Spieldaten).

- [ ] `/auth/v1/admin/users`, `/storage/v1/`, `/pg/` → 404; `docker compose ps` → 6 Container
- [ ] `connect-src` im Header enthält unsere Domain **+ `wss://`**; sonst keine Fremdhosts außer `assets.tarkov.dev`
- [ ] **Spieldaten:** `/api/tarkov/bootstrap`, `tasks-core?lang=de&gameMode=regular`, `hideout`, `items-lite`, `strings?lang=de` → 200 (nicht 503)
- [ ] Bekannter Quest-Name auf **Deutsch** (Overlay wirkt; `producer-manifest.json` frisch)
- [ ] Locale-Override wirkt; frischer Besucher mit deutschem Browser bekommt Deutsch (`<html lang="de">`), englischer Browser Englisch, z. B. `fr` fällt auf Deutsch
- [ ] Direkte E-Mail-Registrierung schlägt fehl
- [ ] **Login end-to-end:** Anmelden führt zur Hauptseite, danach wird `tracker_token` eingelöst und sofort aus der URL entfernt; ohne passendes `tracker_state` kein Login; Abmelden funktioniert
- [ ] Ohne Login landet man außer auf `/login`, `/auth/callback`, `/herkunft`, `/credits`, `/about` überall auf `/login`
- [ ] `/supporter` → 404, `/api/stripe/*` → 404, kein Supporter-Einstieg in Kopf-/Fußzeile
- [ ] Kein Migrations-Banner, kein "Neuigkeiten", kein Support-Banner, kein "Ressourcen", keine Discord-/GitHub-Einträge in der Leiste; Einstellungen ohne "Tools & Integrations", im Konto-Tab nur der Löschen-Hinweis
- [ ] **Kontolöschung:** direkter Loopback-Aufruf ohne Header → 401 ohne Secret, 403 mit falschem; mit `X-Forwarded-For` → 404; unbekannte UUID → 200 `not_found`
- [ ] `/privacy` und `/terms-of-service` → 302 auf die Hauptseite
- [ ] **Keine Indexierung:** `X-Robots-Tag: noindex, nofollow` auf `/`, `/about`, `/login`, `/robots.txt`; vorgerendertes HTML mit `meta robots`, ohne `canonical` und `ld+json`; `robots.txt` = `Disallow: /`; kein `sitemap.xml`
- [ ] `/api/twitch/live` → 404; `/changelog` zeigt unsere Einträge ohne GitHub-Zugriff
- [ ] "Problem melden" öffnet unser Discord
- [ ] `SELECT jobname FROM cron.job;` ohne `inactive-account-cleanup`
- [ ] Optik: dunkel, grünstichig, Oliv (nicht braun/neon); Grunge-Textur; Dialoge und große Dashboard-Panels mit abgeschrägten Ecken; Footer mit unseren Links und Herkunft-Zeile; Favicon, `/apple-touch-icon.png`, `/manifest.json` sind unsere
- [ ] `pnpm run lint` (inkl. `design:lint`: Exit 0, sechs Kontrastwarnungen erwartet)

---

## 9. Rückgaben an den Upstream

Öffentlicher Fork dafür: `MiwiDots/TarkovTrackerNuxt` (remote `fork`; dieses private Repo kann keine PRs stellen). Remotes hier: `origin` = `miwidot/stammtisch-tracker` (hier pushen), `upstream` = tarkovtracker-org (**nie pushen**), `fork` = MiwiDots (nur für Upstream-PRs).

Offene Kandidaten: fehlender Publication-Eintrag für `teams`; ein Node-Pfad für die Spieldaten (Verzeichnis statt KV, unsicher ob gewollt); der Hinweis, dass `account-delete` (#1446) Anmeldungen ohne OAuth dauerhaft ausschließt; Realtime-Policy auf `teams` (mit `service_role` kommen Events, mit User-Token nicht). **Nicht zurückgeben:** alles Stammtisch-Spezifische (Branding, SSO, Supporter-Entfernung).

## Lizenz

GPL-3.0, nicht AGPL. Reiner Selbstbetrieb löst keine Pflicht zur Quelltext-Herausgabe aus. `LICENSE.md` und Copyright-Vermerke bleiben erhalten.
