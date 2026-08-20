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

| Abweichung                         | Grund                                                            | Prüfung                                        |
| ---------------------------------- | ---------------------------------------------------------------- | ---------------------------------------------- |
| `NITRO_PRESET=node-server`         | kein Cloudflare                                                  | Build läuft                                    |
| `NODE_ENV=production`              | **zwingend** — sonst Offline-Stub, Supabase im Frontend tot      | HTML enthält `NODE_ENV:"production"`           |
| `CI=true`                          | umgeht den harten Stripe-Env-Guard                               | Build ohne Stripe-Keys                         |
| `SUPABASE_URL` = unsere Domain     | wird zur **Build-Zeit** in die CSP eingebacken                   | `connect-src` enthält unsere Domain + `wss://` |
| `APP_URL` + `API_ALLOWED_HOSTS`    | Host-Allowlist. Falsch = **403 auf allen `/api/*`**              | fremder Host-Header → 403                      |
| `API_TRUST_PROXY=true`             | nginx + Cloudflare davor, sonst ist jede Client-IP die von nginx | —                                              |
| `OVERLAY_URL` → unser Overlay-Fork | deutsche Quest-Inhalte                                           | bekannter Quest-Name auf Deutsch               |

⚠️ **`OVERLAY_URL` muss HTTPS sein — seit 1.73.2 zwingend.** Upstream hat `http:` in `fix/secure-overlay-url` (PR #755) entfernt:

```diff
- const ALLOWED_OVERLAY_PROTOCOLS = ['https:', 'http:'];
+ const OVERLAY_PROTOCOL = 'https:';
```

Ein `http:`-Overlay fällt **still** auf die Upstream-Adresse zurück — keine Fehlermeldung, unsere Übersetzungen sind einfach weg. Zusätzlich: max. 3 Weiterleitungen, Ziele müssen ebenfalls HTTPS sein.

Unser Phase-0-Test lief noch über `http://127.0.0.1:8099` und wäre auf diesem Stand fehlgeschlagen. **Das Overlay muss über HTTPS ausgeliefert werden.**

Genau diese Klasse von Änderung ist der Grund für den Rauchtest unten: sie kam vier Tage nach der Analyse und ohne den Blick in den Upstream-Diff hätten wir sie erst gemerkt, wenn jemand fragt, warum die Quests wieder englisch sind.

### Infrastruktur (ausserhalb dieses Repos)

- nginx-vhost: Same-Origin-Setup, 4 Supabase-Pfade + App auf **einem** Host
- Gesperrt: `/auth/v1/admin`, `/storage/v1/`, `/pg/`, `/graphql/v1`, `/mcp`, Dotfiles
- **`proxy_cache` für `/api/tarkov/*` — PFLICHT**, nicht Optimierung: ohne Cloudflare-Edge geht sonst jeder Request bis zur Quelle (es gibt keine DB-Kopie der Quest-Daten)
- Cloudflare-bewusster HTTPS-Redirect (ein server-Block, sonst Redirect-Schleife)
- Alle Upstream-Ports auf `127.0.0.1`

---

## Kategorie B — Additiv (kostet beim Merge nichts)

Neue Dateien. Routen sind dateibasiert, Komponenten werden automatisch eingebunden.

| Geplant                           | Ort                                                   | Hinweis                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| --------------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Keys-Übersicht                    | `app/pages/keys.vue`, `app/features/stammtisch-keys/` | baut auf vorhandenem `app/utils/taskRequiredKeys.ts` auf                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Kappa-Pfad-Erweiterung            | eigene Seite + Composable                             | `app/features/kappa/useKappaOverview.ts` existiert bereits                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| SSO-Session-Übernahme             | `app/plugins/tracker-handoff.client.ts`               | **erst nach `await $supabase.ready()`** — vorher ist der Client ein Stub. Löst `#tracker_token=` aus dem URL-Fragment (nicht Query — landet nie im Server-Log/Referrer) per `verifyOtp` ein und entfernt ihn danach sofort wieder aus der URL. `app/plugins/supabase.client.ts` musste dafür nicht angefasst werden.                                                                                                                                                                                                                |
| DE-Übersetzungs-Overrides         | `app/locales/de.overrides.json`                       | Datei selbst ist additiv; die Registrierung ist Kategorie C                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Login-Pflicht für die gesamte App | `app/middleware/require-auth.global.ts`               | Globale Route-Middleware, keine `definePageMeta`-Einträge in einzelnen Seiten nötig. Offen bleiben nur `/login` und `/auth/callback` (sonst Redirect-Schleife); **bewusst auch `/profile/[userId]/[mode]` gesperrt** — macht das Profil-Teilen-Feature für Nicht-Eingeloggte unbrauchbar, Owner-Entscheidung. Nutzt denselben `ensureSupabaseReadyForRoute`-Mechanismus wie `app/middleware/auth.ts`, damit weder der Offline-Stub noch der `tracker_token`-Handoff (`app/plugins/tracker-handoff.client.ts`) vorzeitig zuschlagen. |

⚠️ **Eigenes Namenspräfix verwenden** (`Stammtisch*`) — die Auto-Einbindung läuft ohne Pfad-Präfix, gleichnamige Komponenten kollidieren.

---

## Kategorie C — Eingriffe in Upstream-Dateien (kostet bei jedem Merge)

**Diese Liste kurz halten.** Zahlen = Commits in 66 Tagen (Volatilität, Juni–August 2026).

| Datei                                                                                         | Vol.   | Was                                                                                                                                                                                                                                                                                                              | Warum nicht A oder B                                                                                                                                                                                                                                                |
| --------------------------------------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `nuxt.config.ts`                                                                              | **21** | Locale-Registrierung `files: ['de.json','de.overrides.json']`                                                                                                                                                                                                                                                    | Override via `i18n.config.ts` **funktioniert nicht** (getestet: `de.json` gewinnt bei Kollision). Kein anderer Weg gefunden.                                                                                                                                        |
| `nuxt.config.ts`                                                                              | **21** | Branding, Meta, `site.url`, `/supporter`-Redirect                                                                                                                                                                                                                                                                | **TODO prüfen**: möglichst per `useSeoMeta` in einer NEUEN Datei statt hier                                                                                                                                                                                         |
| `nuxt.config.ts`                                                                              | **21** | `runtimeConfig.public.trackerHandoffUrl` (Default `https://dev.tarkov-stammtisch.de/api/tracker/handoff`, override via `NUXT_PUBLIC_TRACKER_HANDOFF_URL`)                                                                                                                                                        | `runtimeConfig` muss in dieser Datei stehen, kein Auslagern möglich                                                                                                                                                                                                 |
| `app/pages/login.vue`                                                                         | 1      | Anbieter-Knöpfe (Twitch/Discord/Google/GitHub, OAuth-Popup-Flow) komplett raus, ein Button navigiert per Voll-Seitenwechsel auf `trackerHandoffUrl`                                                                                                                                                              | Auth ist der eine unvermeidbare Eingriff. `app/composables/useOAuthLogin.ts` dadurch unreferenziert, aber bewusst nicht angefasst (bleibt liegen, wie `Resources` — Löschen wäre ein weiterer, vermeidbarer Eingriff in eine zweite Upstream-Datei)                 |
| `app/shell/AppBar.vue`                                                                        | **7**  | Supporter-Badge + CTA raus, Links ersetzen; Community-Gruppe (Discord/GitHub/Support) und GitHub-Link im More-Menü raus; Login-Button (`NuxtLink to="/login"`) → `<a>` direkt auf `trackerHandoffUrl` (voller Seitenwechsel, fremde Domain)                                                                      | **Minimal-Patch, NICHT Vollübernahme** — die Datei hat ~450 Zeilen fremde Funktionalität                                                                                                                                                                            |
| `app/components/ui/GlobalHelpLauncher.vue`                                                    | 1      | Community-Gruppe (Discord/GitHub) im Hilfe-Menü raus                                                                                                                                                                                                                                                             | separates Menü vom More-Menü in `AppBar.vue`, eigener kleiner Eingriff                                                                                                                                                                                              |
| `app/shell/NavDrawer.vue`                                                                     | 6      | Logo, Marke; "Resources"-Menüpunkt raus (Seite bleibt liegen)                                                                                                                                                                                                                                                    | Vollübernahme vertretbar (~50 Zeilen Logik)                                                                                                                                                                                                                         |
| `app/shell/AppFooter.vue`                                                                     | 2      | Logo, Supporter-Link raus; "Resources"-Link raus (Seite bleibt liegen)                                                                                                                                                                                                                                           | Vollübernahme vertretbar                                                                                                                                                                                                                                            |
| `app/pages/index.vue`                                                                         | 0      | Einbindung von `DashboardMigrationBanner` und `DashboardChangelog` ("Neuigkeiten") raus                                                                                                                                                                                                                          | Upstream-Eigenwerbung (TarkovTracker.io-Umzug) bzw. Upstream-Feature ohne Mehrwert für uns; Komponentendateien bleiben liegen                                                                                                                                       |
| `app/features/drawer/DrawerLinks.vue`                                                         | 2      | eigene Menüpunkte                                                                                                                                                                                                                                                                                                | einzige zentrale Nav-Liste                                                                                                                                                                                                                                          |
| `app/app.config.ts`                                                                           | **0**  | Farb-Mapping                                                                                                                                                                                                                                                                                                     | konfliktfrei                                                                                                                                                                                                                                                        |
| `app/assets/css/tailwind.css`                                                                 | 5      | Farbwerte im `@theme static`                                                                                                                                                                                                                                                                                     | reiner Werte-Patch                                                                                                                                                                                                                                                  |
| `app/utils/theme-colors.ts`                                                                   | 1      | JS-Farbkonstanten                                                                                                                                                                                                                                                                                                | muss mit tailwind.css synchron bleiben (Upstream-Kommentar)                                                                                                                                                                                                         |
| `app/utils/locales.ts`                                                                        | 3      | `SUPPORTED_LOCALES` auf `['de','en']`, `DEFAULT_LOCALE` auf `'de'`                                                                                                                                                                                                                                               | zentrale Liste, von der auch `nuxt.config.ts` ableitet — kein Konfigurations-Hebel vorhanden                                                                                                                                                                        |
| `nuxt.config.ts`                                                                              | **21** | `defaultLocale: 'de'`                                                                                                                                                                                                                                                                                            | siehe unten: `i18n.config.ts` wird überschrieben                                                                                                                                                                                                                    |
| `app/composables/__tests__/i18nHelpers.test.ts` · `app/plugins/__tests__/i18n.client.test.ts` | je 1–2 | Fallback-Erwartung `en` → `de`, plus neuer Test für gespeicherte, nicht mehr unterstützte Sprache                                                                                                                                                                                                                | Upstream-Tests kodieren `en` als Fallback hart                                                                                                                                                                                                                      |
| `app/pages/settings.vue`                                                                      | 0      | Tab-Gruppe "Tools & Integrations" (`api`- und `streamer-tools`-Tab samt Einbindung von `ApiTokensCard`/`StreamerToolsPanel`) komplett raus inkl. Tab-Definitionen, Hash-Routing (`#api`/`#streamer-tools` fallen jetzt auf den Progression-Tab zurück), SEO-Keys; `DiscordLinkCard`-Einbindung im Konto-Tab raus | API-Tokens, Streamer-Tools und Discord-Verknüpfung sind Patreon-/Supporter-Funktionen von Upstream ohne Bezug zu uns; `ApiTokensCard.vue`, `StreamerToolsPanel.vue`, `DiscordLinkCard.vue` bleiben liegen (Löschen erzeugt bei jedem Merge Delete/Modify-Konflikte) |

**⚠️ Zweiter belegter Fall derselben Sackgasse: `app/i18n.config.ts` (0 Commits) taugt NICHT als Ausweichort.**
In `@nuxtjs/i18n@10.6.0`, `dist/runtime/shared/vue-i18n.js`:

```js
options.locale = defaultLocale || options.locale || 'en-US';
```

`defaultLocale` aus `nuxt.config.ts` gewinnt immer, wenn gesetzt. Ein `locale: 'de'` in `i18n.config.ts` wird **still ignoriert** — dasselbe Muster wie bei den Locale-Overrides weiter oben. Beide Male sah die billige Datei nach dem eleganten Weg aus, beide Male war sie es nicht. **Bei i18n-Themen also nicht wieder darauf hoffen.**

**Bewusst NICHT angefasst:** `app/plugins/i18n.client.ts` (Browsersprach-Erkennung). Deutsche Browser bekommen Deutsch, englische Englisch, alles andere fällt jetzt auf **Deutsch** statt Englisch. Die Erkennung auszubauen hätte zwei weitere Dateien und mehr Upstream-Tests gekostet, für einen Effekt, den niemand wollte (Engländern Deutsch aufzwingen).

**Die 10 entfernten Sprachdateien bleiben liegen** (`app/locales/{cs,es,fr,it,ko,pl,pt,ru,uk,zh}.json`) — sie sind Crowdin-verwaltet, Löschen erzeugt bei jedem Merge Delete/Modify-Konflikte. Ungenutzt driften sie kostenlos mit.
| `public/img/logos/*`, Favicons | 0 | Assets ersetzen | — |

**NICHT anfassen:** `app/locales/en.json` (37 Commits) und `app/locales/de.json` (12, Crowdin-verwaltet — unsere Formulierungen würden überschrieben).

### Eigene Migration (additiv zum Upstream-Schema)

| Was                                                                                   | Warum                                                                                                                                |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `ALTER PUBLICATION supabase_realtime ADD TABLE public.teams` und `public.user_system` | fehlt upstream (nur 4 von 6 abonnierten Tabellen registriert). Upstream-Prod hat das offenbar per Dashboard gesetzt, ohne Migration. |

---

## Nach jedem Upstream-Merge: Rauchtest

Die teuren Fehler sind die **stillen**. Ein wiederaufgetauchter Supporter-Link fällt auf; verschwundene deutsche Quest-Texte monatelang nicht.

- [ ] `/auth/v1/admin/users` → **404** (Admin-API öffentlich gesperrt)
- [ ] `/storage/v1/`, `/pg/` → **404**
- [ ] `connect-src` im ausgelieferten Header enthält unsere Domain **+ `wss://`**
- [ ] Ein bekannter Quest-Name kommt auf **Deutsch** (Overlay wirkt — fehlt `$meta.version`, wird es **still** verworfen)
- [ ] Ein bekannter UI-String zeigt unsere Fassung (Locale-Override wirkt)
- [ ] Frischer Besucher ohne Cookie bekommt **Deutsch**
- [ ] Sprachumschalter bietet **nur Deutsch und Englisch**
- [ ] Direkte E-Mail-Registrierung schlägt fehl
- [ ] Kein Supporter-/Stripe-Einstiegspunkt in Kopf-/Fusszeile, `/supporter` leitet um
- [ ] Kein Migrations-Banner und kein "Neuigkeiten"-Block auf der Startseite, kein "Resources" im Menü
- [ ] Kein Supporter-Button neben dem Login, keine Community-Gruppe und kein GitHub-Link im More-Menü noch im Hilfe-Menü
- [ ] In den Einstellungen kein "Tools & Integrations"-Tab, keine Discord-Account-Karte im Konto-Tab
- [ ] Login end-to-end: User anlegen → Token → Session → eigene Daten lesen/schreiben
- [ ] Ohne Login landet man auf jeder Route auf `/login`; mit Login kommt man überall hin
- [ ] Anmelden-Button (AppBar + `/login`) führt zu unserem Login; nach dem Redirect zurück wird der `tracker_token` eingelöst und sofort aus der URL entfernt (nicht in Adresszeile/History sichtbar)
- [ ] Fremde Daten bleiben blockiert (IDOR-Gegenprobe)
- [ ] Realtime: eigener Fortschritt synchronisiert
- [ ] `docker compose ps` → 6 Container, kein Studio

---

## Rückgaben an den Upstream

Wir leben von deren Arbeit. Was allgemein nützlich ist, geht als PR zurück — das ist fair und senkt nebenbei unsere Patch-Last.

Öffentlicher Fork dafür: **`MiwiDots/TarkovTrackerNuxt`** (dieses private Repo kann kein GitHub-Fork sein und keine PRs stellen).

Offene Kandidaten:

- `/api/team/members?teamId=<nicht-UUID>` → **500** statt 400/403. Regex `^[a-zA-Z0-9-]{1,64}$` lässt Nicht-UUIDs durch, PostgREST kippt.
- Fehlende Publication-Einträge für `teams` und `user_system`
- Realtime-Policy auf `teams`: mit `service_role` kommen Events, mit User-Token (sogar dem Owner) nicht — PostgREST liefert die Zeile dagegen problemlos

**Nicht zurückgeben:** alles Stammtisch-Spezifische (Branding, unser SSO, Supporter-Entfernung).

---

## Lizenz

GPL-3.0, **nicht** AGPL. Reiner Selbstbetrieb löst keine Pflicht zur Quelltext-Herausgabe aus. `LICENSE.md` und Copyright-Vermerke bleiben unverändert erhalten.
