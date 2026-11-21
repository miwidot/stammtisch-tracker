# Fork-Abweichungen — Tarkov Stammtisch

Dieses Repo ist ein **privater Fork** von [tarkovtracker-org/TarkovTracker](https://github.com/tarkovtracker-org/TarkovTracker) (GPL-3.0).

**Leitgedanke:** So nah wie möglich am Upstream bleiben. Der ganze Sinn des Forks ist, den Quest-Sync und die Pflege des Upstream-Teams geschenkt zu bekommen. Jede Zeile, die wir in deren Dateien ändern, bezahlen wir bei **jedem** Merge erneut.

Referenz-Analyse: [Epic #1293](https://github.com/miwidot/tarkov-stammtisch/issues/1293)

---

## Die drei Kategorien — nach Wiederanwendungskosten

| Kategorie                                       | Kosten pro Upstream-Merge | Regel                                                                                |
| ----------------------------------------------- | ------------------------- | ------------------------------------------------------------------------------------ |
| **A — Konfiguration** (unsere eigenen Dateien)  | **null**                  | Erste Wahl. Upstream fasst diese Dateien nie an, Konflikt unmöglich.                 |
| **B — Additiv** (neue Dateien von uns)          | **null**                  | Zweite Wahl. Eigene Seiten, Komponenten, Endpunkte.                                  |
| **C — Eingriff** (Änderung in Upstream-Dateien) | **hoch**                  | Letzte Wahl. Jeder Eintrag hier braucht eine Begründung, warum A und B nicht gingen. |

**Vor jedem neuen Eintrag in C: prüfen, ob es nicht doch als A oder B geht.**

Stand dieser Liste: Voll-Sync auf Upstream `432a1dfd` (nach v1.90.0, 2026-11-21), Branch `sync/full-2026-11-21`. Davor: 61 Commits Abstand zu Merge-Basis `e8cf23dd2` (v1.81.1).

---

## Kategorie A — Konfiguration (kostet beim Merge nichts)

Liegt ausserhalb des Upstream-Codes. Kein Merge-Konflikt möglich.

### Supabase (`docker/.env`, `docker-compose.yml` — unsere Kopie)

| Abweichung                                                               | Grund                                                                                                                            | Prüfung                                   |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| Discord/Twitch/Google/GitHub **nicht** als GoTrue-Provider konfigurieren | Login läuft ausschliesslich über unser Hauptsystem. Zwei Anmeldewege = doppelte Kontenverwaltung + Weg an unserem System vorbei. | Login-Seite zeigt „unsupported provider"  |
| Registrierung sperren (`enable_signup`)                                  | Nur unser System darf User anlegen                                                                                               | Direkte E-Mail-Registrierung schlägt fehl |
| `studio`, `meta`, `storage`, `imgproxy`, `supavisor` entfernt            | Angriffsfläche + RAM. **Nicht offiziell unterstützt** → bei jedem Supabase-Update Compose-Diff prüfen                            | `docker compose ps` zeigt 6 Container     |
| `depends_on: studio` aus `api-gw` entfernt                               | sonst startet der Stack nicht                                                                                                    | siehe oben                                |
| Envoy-Cluster/Routen `studio`/`meta`/`storage` entfernt                  | Catch-all `/` würde sonst auf Studio zeigen                                                                                      | `/pg/`, `/storage/v1/` → 404              |
| `analytics`/`vector` nicht zuladen                                       | ist ohnehin nicht Default (`COMPOSE_FILE=docker-compose.yml`)                                                                    | —                                         |
| `FUNCTIONS_VERIFY_JWT=false`                                             | alle Functions authentifizieren selbst (upstream-konform)                                                                        | —                                         |
| `SUPABASE_ALLOWED_ORIGINS` an den `functions`-Container durchreichen     | **wird vom Standard-Compose NICHT durchgereicht** — sonst hängt CORS allein am Gateway                                           | Preflight liefert unsere Origin           |
| Rate-Limit `token_verifications` hochsetzen                              | Default 30/5min **pro IP** — alle User kommen über dieselbe Proxy-IP                                                             | Login unter Last                          |

### App-Umgebung (`proto.env` / Deploy-Env)

| Abweichung                                                                            | Grund                                                                                                                                                                                        | Prüfung                                           |
| ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `NITRO_PRESET=node-server`                                                            | kein Cloudflare                                                                                                                                                                              | Build läuft                                       |
| `NODE_ENV=production`                                                                 | **zwingend** — sonst Offline-Stub, Supabase im Frontend tot                                                                                                                                  | HTML enthält `NODE_ENV:"production"`              |
| `CI=true`                                                                             | umgeht den harten Stripe-Env-Guard                                                                                                                                                           | Build ohne Stripe-Keys                            |
| Node `>=24.22.3`                                                                      | Upstream-`engines`; lokale 24.22.1 reicht nur mit Warnung                                                                                                                                    | `node -v` auf Server und Produzent                |
| `SUPABASE_URL` = unsere Domain                                                        | wird zur **Build-Zeit** in die CSP eingebacken                                                                                                                                               | `connect-src` enthält unsere Domain + `wss://`    |
| `APP_URL` + `API_ALLOWED_HOSTS`                                                       | Host-Allowlist. Falsch = **403 auf allen `/api/*`**. Zur Laufzeit: `NUXT_API_PROTECTION_ALLOWED_HOSTS`                                                                                       | fremder Host-Header → 403                         |
| `API_TRUST_PROXY=true`                                                                | nur wenn nginx `X-Forwarded-For`/`X-Real-IP` überschreibt, sonst sind Rate-Limits fälschbar                                                                                                  | —                                                 |
| `NUXT_PUBLIC_TRACKER_HANDOFF_URL`                                                     | Login-Handoff, in Produktion Pflicht und https (sonst bricht der Start ab)                                                                                                                   | Login-Knopf zeigt auf Stammtisch                  |
| `NUXT_PUBLIC_ACCOUNT_DELETION_URL`                                                    | Ziel des Hinweises "Konto löschen" (Default `https://tarkov-stammtisch.de/profile/settings`)                                                                                                 | Link in Einstellungen → Konto                     |
| `NUXT_FORK_ACCOUNT_DELETE_SECRET` + `NUXT_SUPABASE_SERVICE_KEY` + `NUXT_SUPABASE_URL` | Server-zu-Server-Löschung durch die Hauptseite (siehe Kategorie B). Secret >= 32 Zeichen, sonst antwortet der Endpunkt 503                                                                   | `POST /api/fork/account-delete` ohne Header → 401 |
| `TARKOV_DATA_DIR`                                                                     | **Pflicht seit #1499/#1503:** Spieldaten kommen nur aus Cloudflare KV; auf node-server liefert unser Plugin sie aus diesem Verzeichnis. Ohne Variable antworten alle `/api/tarkov/*` mit 503 | `/api/tarkov/bootstrap` → 200                     |
| `OVERLAY_URL` (+ `NEUTRAL_OVERLAY_URL`)                                               | unser Overlay-Fork, **https**; das Neutral-Sidecar `overlay-neutral.json` muss daneben liegen. Fehlt es, fehlen unsere `$strings` im Client                                                  | bekannter Quest-Name auf Deutsch                  |

⚠️ **`OVERLAY_URL` muss HTTPS sein — seit 1.73.2 zwingend.** Ein `http:`-Overlay fällt **still** auf die Upstream-Adresse zurück (privates Repo, 404, keine Fehlermeldung). Zusätzlich: max. 3 Weiterleitungen, Ziele ebenfalls HTTPS.

⚠️ **Cloudflare-Sonderfälle auf node-server** (Details im Spike-Bericht): Host-Allowlist (s. o.), `caches.default` fehlt (kein Edge-Cache, jede Anfrage liest die Platte), Rate-Limiter nur pro Prozess (PM2 single instance), `ASSETS`-Binding fehlt (`/@handle` liefert 503), `PROGRESS_DIAGNOSTICS` aus.

### Infrastruktur (ausserhalb dieses Repos)

- nginx-vhost: Same-Origin-Setup, 4 Supabase-Pfade + App auf **einem** Host
- Gesperrt: `/auth/v1/admin`, `/storage/v1/`, `/pg/`, `/graphql/v1`, `/mcp`, Dotfiles
- `/api/fork/account-delete` **nur für die Hauptseite** erreichbar machen (IP-Allowlist oder interner Weg); das Secret schützt zusätzlich
- gzip für JSON im nginx: die App liefert die Spieldaten unkomprimiert
- **`proxy_cache` für `/api/tarkov/*` ist kein Muss mehr:** die Daten kommen aus dem lokalen Verzeichnis. Seit #1503 antwortet der Handler `Cache-Control: no-store`; ein nginx-Cache braucht dafür `proxy_ignore_headers`
- **Produzent per Cron/Timer** (alle 12 h): `build:catalogs` des Overlay-Repos schreibt in ein Verzeichnis, `TARKOV_DATA_DIR` zeigt auf dessen `current`. Fehlschlag und veraltetes `producer-manifest.json` überwachen; die App liefert sonst still alte Daten (kein 7-Tage-Ablauf wie bei KV)
- Cloudflare-bewusster HTTPS-Redirect (ein server-Block, sonst Redirect-Schleife)
- Alle Upstream-Ports auf `127.0.0.1`

---

## Kategorie B — Additiv (kostet beim Merge nichts)

Neue Dateien. Routen sind dateibasiert, Komponenten werden automatisch eingebunden.

| Was                                           | Ort                                                                                                                                                                                                                      | Hinweis                                                                                                                                                                                                                                                                                                                             |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SSO-Session-Übernahme                         | `app/plugins/tracker-handoff.client.ts`                                                                                                                                                                                  | **erst nach `await $supabase.ready()`**; löst `#tracker_token=` aus dem URL-Fragment ein (`verifyOtp`, Typ `email`). Tests laufen auch gegen den echten supabase-js-Client und den Owner-Fence-Storage (`tracker-handoff.session.test.ts`)                                                                                          |
| Login-Pflicht für die gesamte App             | `app/middleware/require-auth.global.ts`                                                                                                                                                                                  | Offen bleiben `/login`, `/auth/callback`, `/herkunft`, `/credits`, `/about`. Behandelt alle drei Antworten von `ensureSupabaseReadyForRoute` (`ready`/`callback_pending`/`failed`) ausdrücklich und läuft **nicht** im Server-Render (öffentliche SEO-Seiten werden beim Build vorgerendert, dort gibt es keinen Supabase-Client)   |
| Supporter-Seite sperren                       | `app/middleware/no-supporter-sales.global.ts`; `/supporter` ist aus Prerender und Sitemap genommen (`nuxt.config.ts`)                                                                                                    | 404 statt Weiterleitung                                                                                                                                                                                                                                                                                                             |
| Stripe-Endpunkte sperren                      | `app/server/middleware/no-stripe-endpoints.ts`                                                                                                                                                                           | 404 unter `/api/stripe/*`                                                                                                                                                                                                                                                                                                           |
| Herkunft-Seite + Footer-Zeile                 | `app/pages/herkunft.vue`, `app/shell/AppFooter.vue`                                                                                                                                                                      | GPL-Pflichtangaben, öffentlich lesbar                                                                                                                                                                                                                                                                                               |
| Light-Theme gesperrt                          | `app/utils/forkConfig.ts` (`LIGHT_THEME_ENABLED=false`), `tests/fork-test-setup.ts`                                                                                                                                      | Das Flag greift in `theme.ts`, `AppBar.vue`, `AppPreferencesCard.vue`. Die globale Test-Einrichtung mockt es auf `true`, damit Upstream-Tests unverändert laufen; `*.disabled.test.ts` prüfen den echten Wert                                                                                                                       |
| DE-Übersetzungs-Overrides                     | `app/locales/de.overrides.json`                                                                                                                                                                                          | Datei additiv, Registrierung in `nuxt.config.ts` ist C. Überschreibt nur, was Crowdin falsch oder gar nicht übersetzt; `de-overrides.test.ts` bewacht Schlüssel und Platzhalter                                                                                                                                                     |
| Konto löschen: Hinweis statt Knopf            | `app/features/settings/StammtischAccountDeletionNotice.vue` (+ i18n `settings.fork_account_deletion.*`)                                                                                                                  | Siehe Abschnitt "Kontolöschung"                                                                                                                                                                                                                                                                                                     |
| Konto löschen: Server-Pfad für die Hauptseite | `app/server/middleware/01.fork-account-delete.ts`, `app/server/utils/forkAccountDelete.ts`, Migration `20261121140000_fork_admin_delete_account.sql`, pgTAP `supabase/tests/database/fork_admin_delete_account.test.sql` | `POST /api/fork/account-delete`, Bearer-Secret. Läuft vor `api-protection`, deshalb `01.` im Namen                                                                                                                                                                                                                                  |
| Spieldaten aus lokalem Verzeichnis            | `app/server/plugins/local-tarkov-data.ts`, `app/server/utils/localDirKv.ts`, `scripts/precompute/dir-store.ts` (+ `--target=dir:` in `scripts/precompute/run.ts`, 29 Zeilen C)                                           | Ersatz für das Cloudflare-KV-Binding `TARKOV_DATA`. Aktiv nur mit absolutem `TARKOV_DATA_DIR`. Konfliktfläche ist `run.ts`                                                                                                                                                                                                          |
| i18n-Lint-Brücke                              | `app/utils/forkKeptI18nKeys.ts`                                                                                                                                                                                          | Kommentar-Datei, die `en.json`-Schlüssel nennt, die wir nicht mehr rendern (eigener Footer, Handoff-Login, entfernte Supporter-/Community-Stellen). Der Unused-Key-Lint akzeptiert einen Schlüssel, sobald eine Quelldatei ihn erwähnt, so bleibt `en.json` unangetastet. Bei neuem Lint-Fehler "is not used in app/" hier ergänzen |
| Assets                                        | `public/img/logos/stammtisch-logo.png`, `public/favicon*.png`, `public/apple-touch-icon.png`, `public/manifest.json`, `public/og-default.png`, `public/textures/tarkov-grunge.jpg`, `public/fonts/overlay/*`             | Kopien aus `tarkov-app/public/`; Overlay-Schriften selbst gehostet (`csp.ts`, `overlay/kappa/[userId]/[mode].get.ts`)                                                                                                                                                                                                               |

⚠️ **Eigenes Namenspräfix verwenden** (`Stammtisch*`) — die Auto-Einbindung läuft ohne Pfad-Präfix, gleichnamige Komponenten kollidieren.

---

## Kategorie C — Eingriffe in Upstream-Dateien (kostet bei jedem Merge)

**Diese Liste kurz halten.** Sie ist nach dem Voll-Sync die reale Liste (`git diff upstream/main HEAD`).

| Datei                                                                        | Was                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `nuxt.config.ts`                                                             | Locale-Registrierung `de` mit `files: ['de.json','de.overrides.json']`, `defaultLocale: 'de'`; Branding (`titleTemplate`, Icons, `manifest.json`, OG/Twitter-Texte ohne Bild, `apple-mobile-web-app-title`); `runtimeConfig` (`trackerHandoffUrl`, `accountDeletionUrl`, `forkAccountDeleteSecret`); Pre-Hydration-Skeleton mit Oliv-Fallbackfarben (`--shell-bar-h` von Upstream übernommen); `/supporter` aus Prerender, Routen und Sitemap |
| `app/utils/locales.ts`                                                       | **eine Zeile:** `DEFAULT_LOCALE = 'de'`. `SUPPORTED_LOCALES` bleibt Upstreams Liste (14 Sprachen), weil die Katalog-Sprachpakete des Produzenten davon abgeleitet sind und `check-overlay` genau 13 verlangt. Der Sprachumschalter zeigt daher alle Sprachen; Browser mit unterstützter Sprache bekommen diese, alles andere Deutsch                                                                                                          |
| `app/assets/css/tailwind.css`                                                | Palette im `@theme static` (HSL + OKLCH): Oliv `primary`/`success`, Amber `warning`, gedämpftes `info`/`error`, grünstichige `surface`-Leiter, Tarkov-Hintergrundstapel mit Grunge-Textur. Upstreams `locked`-Leiter (neu in v1.88) ist übernommen                                                                                                                                                                                            |
| `DESIGN.md`                                                                  | **Angepasst, nicht ausgeschlossen:** Front Matter trägt unsere Hex-Werte (`canvas #0a0b09`, `primary #697a3a`, …) und den Namen "Tarkov Stammtisch Quest-Tracker". `pnpm run design:lint` endet mit Exit 0, meldet aber sechs WCAG-Kontrast-Warnungen (z. B. dunkler Text auf Oliv 4,18:1). Nicht zurück auf Upstreams Neon-Grün stellen                                                                                                      |
| `app/__tests__/tailwindTheme.test.ts`                                        | Regex für HSL-Tokens akzeptiert Dezimalstellen (unsere Palette hat welche)                                                                                                                                                                                                                                                                                                                                                                    |
| `app/app.config.ts`                                                          | Farb-Mapping; Modal-`wrapper` bekommt `rounded-none clip-corners corner-decoration`                                                                                                                                                                                                                                                                                                                                                           |
| `app/shell/AppBar.vue`                                                       | **Upstreams neue Leiste (#1538)** plus: Supporter-Badge und -Menüeintrag raus, Discord-/GitHub-Einträge raus, Login-Knopf ist ein Link auf `trackerHandoffUrl`, Theme-Knopf nur mit `LIGHT_THEME_ENABLED`                                                                                                                                                                                                                                     |
| `app/shell/NavDrawer.vue`                                                    | Upstreams Sidebar (#1536); nur Logo `stammtisch-logo.png`. Der frühere "Mehr/Einstellungen"-Block ist entfallen (Einstellungen steht jetzt in `DrawerLinks`)                                                                                                                                                                                                                                                                                  |
| `app/features/drawer/DrawerLinks.vue`                                        | "Ressourcen"-Eintrag raus (Seite bleibt liegen)                                                                                                                                                                                                                                                                                                                                                                                               |
| `app/shell/AppFooter.vue`                                                    | **Komplett** eigene Stammtisch-Version (`merge=ours`, siehe unten)                                                                                                                                                                                                                                                                                                                                                                            |
| `app/pages/login.vue`                                                        | Anbieter-Knöpfe und OAuth-Popup raus; ein Knopf navigiert per Voll-Seitenwechsel auf `trackerHandoffUrl`                                                                                                                                                                                                                                                                                                                                      |
| `app/pages/index.vue`                                                        | `DashboardMigrationBanner`, `DashboardChangelog`, `DashboardSupportBanner` raus; sichtbarkeitsfreies `<h1>` im Stammtisch-Ton                                                                                                                                                                                                                                                                                                                 |
| `app/features/dashboard/DashboardProgressSummary.vue`, `DashboardUpNext.vue` | Panel bekommt `rounded-none clip-corners corner-decoration` (frühere Hero-Karte `DashboardNextActions` gibt es upstream nicht mehr)                                                                                                                                                                                                                                                                                                           |
| `app/pages/settings.vue`                                                     | Tabs "Tools & Integrations" (`api`, `streamer-tools`), Discord-Karte raus; `AccountDeletionCard` durch `StammtischAccountDeletionNotice` ersetzt                                                                                                                                                                                                                                                                                              |
| `app/features/settings/AppPreferencesCard.vue`                               | Theme-Zeile (samt Trenner) nur mit `LIGHT_THEME_ENABLED`                                                                                                                                                                                                                                                                                                                                                                                      |
| `app/features/tasks/TaskCard.vue`                                            | Kontextmenüpunkt "Datenfehler melden" raus                                                                                                                                                                                                                                                                                                                                                                                                    |
| `app/utils/theme.ts`                                                         | Light-Theme-Sperre über `forkConfig`                                                                                                                                                                                                                                                                                                                                                                                                          |
| `app/utils/runtimeConfig.ts`                                                 | `resolveTrackerHandoffUrl` (Pflicht und https in Produktion)                                                                                                                                                                                                                                                                                                                                                                                  |
| `app/utils/csp.ts`, `app/server/routes/overlay/kappa/[userId]/[mode].get.ts` | Overlay-Schriften selbst gehostet statt Google Fonts                                                                                                                                                                                                                                                                                                                                                                                          |
| `package.json`                                                               | **eine Zeile:** `postinstall` = `NODE_ENV=development nuxt prepare`. Rest und `pnpm-lock.yaml` sind Upstreams, Lockfile nie von Hand mergen (`pnpm install --lockfile-only` muss ohne Diff laufen)                                                                                                                                                                                                                                            |
| `.gitattributes`, `.env.example`, `vitest.config.ts`                         | Merge-Treiber, Handoff-Variablen, Setup-Datei `tests/fork-test-setup.ts`                                                                                                                                                                                                                                                                                                                                                                      |
| `.github/dependabot.yml`                                                     | gelöscht (bei Merge-Konflikt: Löschung behalten)                                                                                                                                                                                                                                                                                                                                                                                              |
| Tests                                                                        | Upstream-Tests angepasst, wo unsere Abweichung sie berührt: `AppBar.test.ts` (ohne Supporter/Community, mit Handoff-Link), `AppBar.disabled.test.ts`, `index.page.test.ts`, `settings.page*.test.ts`, `i18nHelpers.test.ts` und `i18n.client.test.ts` (Fallback `de`), `tests/route-seo-navigation.test.ts` (angemeldeter Nutzer, wegen Login-Pflicht), `de-overrides.test.ts`                                                                |

**⚠️ Farbquelle für das Theme: NUR die Live-Seite, NIEMALS `tarkov-app/app/globals.css`.** Dort stehen überschriebene Altwerte.

**⚠️ `app/i18n.config.ts` taugt NICHT als Ausweichort für die Standardsprache.** `@nuxtjs/i18n` nimmt `defaultLocale` aus `nuxt.config.ts` und ignoriert `locale` aus `i18n.config.ts` still.

**Erster Aufbau (Locale):** Public-Seiten werden in der Standardsprache (`de`) vorgerendert, die Sprachbestimmung läuft erst nach `app:mounted` (`app/plugins/i18n.client.ts`, Upstream). Deutsche Browser sehen daher von Anfang an Deutsch; ein englischer Browser sieht einen kurzen deutschen Moment vor dem Wechsel zu Englisch. Das ist hingenommen, nicht behoben.

### Gestrichene Abweichungen (Upstream hat sie übernommen oder abgelöst)

| Abweichung                                                  | Grund                                                                                                                                                        |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| User-Agent aus App-URL (`userAgent.ts`)                     | Upstream #914 ist unsere Änderung, seine Version ist strenger                                                                                                |
| Profil-Import-Fix (`hasMaterializedProgress`)               | Upstream #848; die Route wurde mit #1537 komplett umgebaut                                                                                                   |
| teamId-UUID-Validierung                                     | Upstream #756                                                                                                                                                |
| Kappa-/Lightkeeper-Übersetzungen                            | Kappa-Seite entfiel mit #1534; weitere Overrides entfernt, weil Upstream die Schlüssel entfernt oder selbst übersetzt hat (Annahme-Popover, `any_of_items*`) |
| Community-Gruppe im Hilfe-Menü                              | Upstream hat sie selbst entfernt. **Offen:** "Problem melden" im Hilfe-Menü öffnet noch ein Issue bei `tarkovtracker-org/TarkovTracker`                      |
| `THEME_COLORS` in `theme-colors.ts`                         | Upstream hat die Konstante entfernt; die Palette lebt nur noch in `tailwind.css`                                                                             |
| `wrangler.toml` `APP_URL`                                   | Cloudflare-Konfiguration, auf node-server ohne Wirkung; Upstream-Test verlangt Gleichheit                                                                    |
| Geplant, nie gebaut: Keys-Übersicht, Kappa-Pfad-Erweiterung | Grundlage entfallen (#1534)                                                                                                                                  |

---

## Kontolöschung (Entscheidung: Option B)

Upstream verlangt für das Löschen im Tracker (#1446) eine OAuth-Anmeldung der letzten 5 Minuten (`amr.method === 'oauth'`). Unsere Nutzer melden sich über `verifyOtp` an, ihre Methode ist `otp`. **Das Löschen im Tracker kann für sie nie gelingen.** Entscheidung: gelöscht wird **ausschließlich auf der Hauptseite**, das Tracker-Konto wird dabei mitgelöscht.

- **Tracker-Oberfläche:** Einstellungen → Konto zeigt `StammtischAccountDeletionNotice` (Hinweis und Link zur Hauptseite, DE/EN). Es gibt keinen Knopf, der nie funktionieren kann. Upstreams `AccountDeletionCard` und `account-delete`-Funktion bleiben unverändert im Repo, sind aber nicht eingebunden.
- **Server-Pfad:** `POST /api/fork/account-delete` mit `Authorization: Bearer <NUXT_FORK_ACCOUNT_DELETE_SECRET>` und `{"userId":"<supabase-uuid>"}`. Antworten: 200 gelöscht, 200 `not_found` (idempotent), 409 Lease belegt (später wiederholen), 401/403/400/413/405, 502 fehlgeschlagen (vollständig zurückgerollt, geloggt), 503 nicht konfiguriert. Die Datenbankfunktion `fork_delete_account` folgt Upstreams SQL-Pfad (`retry_account_deletion`): Job-Lease, Teams übergeben, Events und API-Zählung löschen, `auth.users` löschen (Rest kaskadiert), Job abschließen. Eine Transaktion.
- **Hauptseite (`tarkov-app`, hier nicht geändert):** muss vor dem Löschen des `User`-Eintrags dieses Endpunkt mit `QuestTrackerAccount.supabaseUserId` aufrufen und die Mapping-Zeile erst nach 200 (`deleted` oder `not_found`) verlieren. Bei 409/502/Netzfehler: Löschung nicht als erledigt melden, wiederholen (Retry/Job, #1294). Gibt es keine Mapping-Zeile, entfällt der Aufruf.
- **Ungeklärt:** Upstreams Cron `inactive-account-cleanup` (Migration `20260930003202`) löscht Tracker-Konten nach sechs Monaten Inaktivität. Das Mapping auf der Hauptseite zeigt dann ins Leere; der Handoff muss "Supabase-User nicht gefunden" als "neu anlegen" behandeln.

---

## Eigene Migrationen (additiv zum Upstream-Schema)

| Was                                                                                        | Warum                                                                                                                             |
| ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| `20261121140000_fork_admin_delete_account.sql` (im Repo)                                   | `fork_delete_account(uuid)` für die Hauptseite, nur `service_role`. **Nicht angewendet.**                                         |
| `ALTER PUBLICATION supabase_realtime ADD TABLE public.teams` (**nicht im Repo**, von Hand) | fehlt upstream. `user_system` steht seit `20260830120000_secure_team_realtime_channels.sql` upstream drin und braucht nichts mehr |

---

## Merge-Treiber (`merge=ours`)

Für Dateien, die zu 100% uns gehören und bei denen wir Upstream-Änderungen NIE übernehmen wollen (aktuell nur `app/shell/AppFooter.vue`), ist in `.gitattributes` `merge=ours` gesetzt. Das Attribut allein reicht nicht — der Treiber muss **pro Clone/Checkout** lokal aktiviert werden:

```bash
git config merge.ours.driver true
```

Ohne diesen Befehl ignoriert Git das Attribut stillschweigend und ein Upstream-Merge überschreibt die Datei ganz normal — kein Fehler, keine Warnung, einfach der alte Footer wieder da. Das muss auf **jedem** Server/Checkout gesetzt werden, der jemals einen Upstream-Merge durchführt (insbesondere stammdev, falls dort gemerged wird). Der Befehl schreibt in die lokale (nicht versionierte) `.git/config` und kann daher nicht mit ausgeliefert werden.

Prüfen: `git config --get merge.ours.driver` muss `true` liefern.

## Nach jedem Upstream-Merge: Rauchtest

Die teuren Fehler sind die **stillen**. Ein wiederaufgetauchter Supporter-Link fällt auf; verschwundene deutsche Quest-Texte oder tote Spieldaten monatelang nicht.

- [ ] `/auth/v1/admin/users` → **404** (Admin-API öffentlich gesperrt)
- [ ] `/storage/v1/`, `/pg/` → **404**
- [ ] `connect-src` im ausgelieferten Header enthält unsere Domain **+ `wss://`**
- [ ] **Spieldaten:** `/api/tarkov/bootstrap`, `tasks-core?lang=de&gameMode=regular`, `hideout`, `items-lite`, `strings?lang=de` → **200** (nicht 503 "Catalog snapshot unavailable")
- [ ] Ein bekannter Quest-Name kommt auf **Deutsch** (Overlay wirkt — fehlt `$meta.version`, wird es **still** verworfen; `x-catalog-release`/`producer-manifest.json` ist frisch)
- [ ] Ein bekannter UI-String zeigt unsere Fassung (Locale-Override wirkt)
- [ ] Frischer Besucher mit deutschem Browser bekommt **Deutsch**, `<html lang="de">`
- [ ] Direkte E-Mail-Registrierung schlägt fehl
- [ ] Kein Supporter-/Stripe-Einstiegspunkt in Kopf-/Fusszeile und Menü, `/supporter` → 404-Seite
- [ ] Kein Migrations-Banner, kein "Neuigkeiten", kein Support-Banner auf der Startseite, kein "Ressourcen" im Menü, kein doppeltes "Einstellungen"
- [ ] Keine Discord-/GitHub-Einträge in der Kopfleiste und im More-Menü
- [ ] In den Einstellungen kein "Tools & Integrations"-Tab, keine Discord-Account-Karte, im Konto-Tab **nur der Löschen-Hinweis** (kein Knopf)
- [ ] **Login end-to-end:** Anmelden-Knopf (Kopfleiste + `/login`) führt zu unserem Login, nach dem Redirect wird `tracker_token` eingelöst und sofort aus der URL entfernt, Nutzer ist angemeldet, eigene Daten lesen/schreiben; Abmelden funktioniert
- [ ] Ohne Login landet man auf jeder Route außer `/login`, `/auth/callback`, `/herkunft`, `/credits`, `/about` auf `/login`
- [ ] **Kontolöschung:** `POST /api/fork/account-delete` ohne Header → 401, falsches Secret → 403, unbekannte UUID → 200 `not_found`
- [ ] Fremde Daten bleiben blockiert (IDOR-Gegenprobe)
- [ ] Realtime: eigener Fortschritt synchronisiert
- [ ] `docker compose ps` → 6 Container, kein Studio
- [ ] Seite ist dunkel-grünstichig mit gedämpftem Militär-Oliv (nicht braun, nicht blaustichig-neon) — Hintergrund, Karten, Buttons, Sidebar, aktive Menüpunkte, Fortschrittsbalken; Grunge-Textur sichtbar, Dialoge mit abgeschrägten Ecken
- [ ] Footer zeigt unsere Links (Über uns/Konvoi/Streamer/Discord/Spenden, Impressum/Datenschutz/…) und die Herkunft-Zeile
- [ ] Seitenleiste zeigt "Tarkov Stammtisch" (Logo + Markenname)
- [ ] Favicon, `/apple-touch-icon.png`, `/manifest.json` sind unsere
- [ ] **Offen (SEO):** Vorgerenderte öffentliche Seiten (`/`, `/about`, `/tasks`, …) tragen Upstreams Titel, Beschreibung, `canonical` auf `tarkovtracker.org` und `robots: index, follow` (`routeSeo.ts`, `SEO_ORIGIN`). Link-Vorschau von `/` zeigt "TarkovTracker.org". Nur `/login` und andere Client-Seiten tragen unsere Meta
- [ ] Große Dashboard-Panels (Fortschritts-Übersicht, "Als Nächstes") haben abgeschrägte Ecken

---

## Rückgaben an den Upstream

Wir leben von deren Arbeit. Was allgemein nützlich ist, geht als PR zurück — das ist fair und senkt nebenbei unsere Patch-Last.

Öffentlicher Fork dafür: **`MiwiDots/TarkovTrackerNuxt`** (dieses private Repo kann kein GitHub-Fork sein und keine PRs stellen).

Offene Kandidaten:

- Fehlender Publication-Eintrag für `teams` (`user_system` ist upstream erledigt)
- Ein Node-Pfad für die Spieldaten (Verzeichnis statt Cloudflare-KV): unser Plugin ist klein und isoliert, upstream aber Cloudflare-zentriert — unsicher, ob gewollt
- Der Hinweis, dass `account-delete` (#1446) Anmeldungen ohne OAuth, etwa OTP, dauerhaft ausschließt
- Realtime-Policy auf `teams`: mit `service_role` kommen Events, mit User-Token (sogar dem Owner) nicht — PostgREST liefert die Zeile dagegen problemlos

**Nicht zurückgeben:** alles Stammtisch-Spezifische (Branding, unser SSO, Supporter-Entfernung).

---

## Lizenz

GPL-3.0, **nicht** AGPL. Reiner Selbstbetrieb löst keine Pflicht zur Quelltext-Herausgabe aus. `LICENSE.md` und Copyright-Vermerke bleiben unverändert erhalten.
