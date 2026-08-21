# Runbook — Prototyp-Aufbau und Betrieb

**Zweck:** Dieses Dokument beschreibt den kompletten Aufbau so, dass jemand ohne Vorwissen ihn nachvollziehen, reparieren oder neu errichten kann. Es ersetzt bewusst das Gedächtnis einer Arbeitssitzung.

Stand: **2026-08-21** · App-Version 1.73.2 · Analyse + Entscheidungen: [Epic #1293](https://github.com/miwidot/tarkov-stammtisch/issues/1293) · Abweichungen: [FORK.md](./FORK.md) · Daten-Overlay: eigenes Repo mit eigenem FORK.md (siehe §2)

---

## 1. Worum es geht

Der eigene Quest-Tracker von Tarkov Stammtisch ist durch den BSG-Umbau des Quest-Systems (Level-Limits aufgelöst, Punktesystem) kaputt. Statt ihn neu zu bauen, übernehmen wir [tarkovtracker.org](https://github.com/tarkovtracker-org/TarkovTracker) (GPL-3, Nuxt 4 SPA + Supabase) als Fork, betreiben ihn selbst und legen einen möglichst kleinen Patch darüber: eigenes Theme, eigene Navbar, **unser Login**, eigene Zusatz-Features, deutsche Quest-Übersetzungen.

**Warum das trägt:** Upstream speichert Quest-Definitionen gar nicht — es gibt keine Quest-Tabelle und keinen Sync-Job. Die Daten kommen zur Laufzeit aus `json.tarkov.dev` durch eine Cache-Pipeline. Deshalb überstehen sie Spielumbauten mit punktuellen Adapter-Fixes, während unser DB-Schema daran zerbrochen ist. Details in #1293.

**Lizenz:** GPL-3.0, **nicht** AGPL. Reiner Selbstbetrieb löst keine Pflicht zur Quelltext-Herausgabe aus.

---

## 2. Repos

**Drei Repos gehören zusammen** — wer hier weitermacht, sollte alle drei kennen:

| Repo                                    | Zweck                                               | Sichtbarkeit |
| --------------------------------------- | --------------------------------------------------- | ------------ |
| `miwidot/stammtisch-tracker`            | Tracker-App, unser Arbeits-Fork (**dieses Repo**)   | privat       |
| `miwidot/stammtisch-tracker-overlay`    | **Spieldaten-Overlay** — deutsche Quest-Korrekturen | privat       |
| `miwidot/tarkov-stammtisch`             | unser Hauptsystem (Login, SSO-Brücke)               | privat       |
| `MiwiDots/TarkovTrackerNuxt`            | nur für PRs zurück an TarkovTracker                 | öffentlich   |
| `tarkovtracker-org/TarkovTracker`       | Upstream der App (GPL-3)                            | öffentlich   |
| `tarkovtracker-org/tarkov-data-overlay` | Upstream des Overlays (**MIT**)                     | öffentlich   |

**Warum ein separater öffentlicher Fork:** Ein privates Repo kann kein GitHub-Fork eines öffentlichen sein und keine PRs upstream stellen. Der öffentliche Fork existierte bereits und wird ausschliesslich für Rückgaben benutzt.

> ⚠️ **„Overlay" bedeutet drei verschiedene Dinge.** Das **Spieldaten-Overlay** (eigenes Repo, Quest-Korrekturen als JSON). Das **Theme** des Trackers (Farben, in diesem Repo in `tailwind.css`/`app.config.ts`). Und die **OBS-Overlays** für Streams auf der Hauptseite. Nicht verwechseln.

### Das Spieldaten-Overlay (eigenes Repo, eigenes FORK.md)

Der Tracker unterstützt **genau eine** Overlay-Quelle. Zeigt `OVERLAY_URL` auf eine eigene Datei, ist das Upstream-Overlay **komplett weg** — gemessen: Task-Anzahl sprang 487 → 517, weil ~30 per `disabled: true` gefilterte Tasks zurückkamen, und alle 211 Korrekturen fehlten.

Deshalb der zweite Fork: `src/overrides/locales/de.json5` ist eine **neue Datei**, die upstream nicht existiert → Konflikt unmöglich. Der Build sammelt sie automatisch ein (keine Sprach-Allowlist).

```bash
git clone git@github.com:miwidot/stammtisch-tracker-overlay.git
cd stammtisch-tracker-overlay && npm install
npm run build          # -> dist/overlay.json (211 Korrekturen + unser Deutsch)
npm run check-overrides # was hat Upstream inzwischen selbst gefixt?
```

**Faustregel:** „Der deutsche Text ist falsch" → unser Fork. „Die Daten sind falsch" → PR an Upstream (MIT, unkompliziert).

### Remotes in diesem Repo

```bash
origin    git@github.com:miwidot/stammtisch-tracker.git
upstream  https://github.com/tarkovtracker-org/TarkovTracker.git
```

### Upstream nachziehen

```bash
git fetch upstream
git merge upstream/main          # danach FORK.md-Rauchtest durchgehen!
git push origin main
```

Erster Durchlauf (2026-08-20): 28 Commits, 1111 Zeilen, **null Konflikte**.

---

## 3. Prototyp auf stammdev

Öffentlich: **https://trackerdev.tarkov-stammtisch.de**

### Übersicht

```
Internet -> Cloudflare -> nginx (stammdev)
                            |
    /auth/v1/ /rest/v1/ /functions/v1/ /realtime/v1/  -> 127.0.0.1:8200  (Supabase-Gateway)
    alles andere                                       -> 127.0.0.1:3101  (Nuxt-App)
```

**Same-Origin mit Absicht:** App und Supabase teilen sich einen Host, getrennt nur über Pfade. Spart die zweite Subdomain, vermeidet Cross-Origin-Freigaben komplett, halbiert die Angriffsfläche. Kollisionsgeprüft — die App hat `/auth/callback`, wir proxien `/auth/v1/`.

### Verzeichnisse auf stammdev

| Pfad                                   | Inhalt                                                             |
| -------------------------------------- | ------------------------------------------------------------------ |
| `~/tracker-build-proto/TarkovTracker`  | Clone dieses Forks (origin = unser Repo)                           |
| `~/tracker-build-proto/proto.env`      | Build-/Laufzeit-Envs                                               |
| `~/tracker-build-proto/start-proto.sh` | Startskript (sourced `proto.env`)                                  |
| `~/tracker-build-proto/app.log`        | Laufzeit-Log                                                       |
| `~/supabase-proto/supabase-src/docker` | Supabase-Stack (Compose-Projekt `supaproto`)                       |
| `~/supabase-proto/*.mjs`               | Testskripte (`e2e2.mjs` = Login-E2E, `rt4/rt5/rt6.mjs` = Realtime) |
| `*.orig` neben Compose/Envoy-Dateien   | Originale vor unseren Kürzungen                                    |

### App steuern

```bash
# Status
ssh stammdev "ss -tlnp | grep 3101; tail -5 ~/tracker-build-proto/app.log"

# Neu bauen (nach git pull)
ssh stammdev "cd ~/tracker-build-proto/TarkovTracker && source ~/tracker-build-proto/proto.env && npx nuxt build"

# Neu starten — WICHTIG: PID über den Port ermitteln, nicht per Pfad-Muster
ssh stammdev "ss -tlnp | grep 3101"          # PID ablesen
ssh stammdev "kill <PID>; sleep 3"
ssh stammdev "cd ~/tracker-build-proto && setsid nohup ./start-proto.sh > app.log 2>&1 < /dev/null &"
```

⚠️ **Port 3101 ist fix** — der nginx-Upstream zeigt fest dorthin.

⚠️ **`pkill -f 'tracker-build-proto/...'` funktioniert NICHT.** Der Prozess läuft mit _relativer_ Kommandozeile (`node .output/server/index.mjs`), das Muster trifft ihn nicht. Symptom, wenn man es trotzdem so macht: der alte Prozess läuft weiter und hält Port 3101, der neue kann nicht binden und stirbt still. Die Seite antwortet dann mit **200**, liefert aber das HTML des _alten_ Builds — dessen JS-Dateien nach dem Rebuild nicht mehr existieren. Im Browser: **komplett leere Seite**, im `app.log` ein Schwall `ENOENT ... .output/public/_nuxt/<hash>.js`, und der Entry-Chunk liefert über Cloudflare **520**.

Schnelltest, ob genau das vorliegt:

```bash
curl -s https://trackerdev.tarkov-stammtisch.de/ | grep -oE 'src="/_nuxt/[A-Za-z0-9_-]+\.js"' | head -1
# den gefundenen Pfad abrufen — 200 = gesund, 520/500 = alter Prozess serviert altes HTML
```

### Supabase steuern

```bash
ssh stammdev "cd ~/supabase-proto/supabase-src/docker && docker compose -p supaproto ps"
ssh stammdev "cd ~/supabase-proto/supabase-src/docker && docker compose -p supaproto logs -f auth"
ssh stammdev "cd ~/supabase-proto/supabase-src/docker && docker compose -p supaproto up -d"

# vollstaendig entfernen (inkl. Daten!)
ssh stammdev "cd ~/supabase-proto/supabase-src/docker && docker compose -p supaproto down -v"
```

### Deploy-Key

Der Clone auf stammdev zieht aus dem **privaten** Repo über einen dedizierten, **read-only** Deploy-Key:

- Key: `~/.ssh/id_tracker_fork` · SSH-Host-Alias: `github-tracker`
- Remote-URL: `git@github-tracker:miwidot/stammtisch-tracker.git`

⚠️ **Ein GitHub-Deploy-Key darf nur an EINEM Repo hängen.** Die bereits vorhandenen Keys auf stammdev sind für `tarkov-stammtisch` vergeben — deshalb der eigene Key. Symptom bei falschem Key: `ERROR: Repository not found` (heisst „keine Berechtigung", nicht „existiert nicht").

---

## 4. Supabase-Minimalstack

**6 Container** statt der 11 des Standard-Setups:

```
db · api-gw (envoy) · auth · rest · realtime · functions
```

**Entfernt und warum:**

| Weg                    | Grund                                                                                                                                |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `studio`               | Admin-UI mit `service_role`-Rechten, nur Basic-Auth-geschützt — und die Basic-Auth sitzt am Gateway, nicht am Studio. Owner-Vorgabe. |
| `meta`                 | existiert nur für Studio                                                                                                             |
| `storage` + `imgproxy` | `git grep "storage.from("` = 0 Treffer, Avatare kommen aus OAuth-Metadaten                                                           |
| `supavisor`            | kein Dienst verbindet darüber, die App hat gar keinen Postgres-Treiber. Nebeneffekt: Host-Ports 5432/6543 verschwinden.              |
| `analytics` + `vector` | seit einiger Zeit ohnehin nicht mehr im Default-Compose (liegen im Logs-Overlay)                                                     |

⚠️ **Beim Neuaufbau zwingend:** `depends_on: studio` aus dem Service `api-gw` entfernen. Sonst startet der Stack nicht (Kette `studio -> api-gw -> functions`). Ausserdem Cluster/Routen `studio`/`meta`/`storage` aus `volumes/api/envoy/cds.yaml` und `lds.template.yaml` streichen.

⚠️ **Reihenfolge beim Neuaufbau:** `utils/generate-keys.sh` + `utils/add-new-auth-keys.sh` **vor** dem Ausdünnen laufen lassen — das zweite Skript ändert auch `docker-compose.yml`.

⚠️ **Ports binden per Default auf 0.0.0.0.** Explizit `127.0.0.1:` davorsetzen (`API_GW_HTTP_PORT=127.0.0.1:8200`).

### Migrationen

112 Stück, angewendet per `psql` im db-Container. **Eine Sonderbehandlung nötig:**
`20260804043344_add_seasonal_team_index_concurrently.sql` beginnt mit `-- supabase:disable-transaction` — eine Direktive, die nur die Supabase-CLI versteht. Mit `psql --single-transaction` bricht sie:

```
ERROR: CREATE INDEX CONCURRENTLY cannot run inside a transaction block
```

→ Diese eine Datei ohne `--single-transaction` fahren.

**Reihenfolge:** Stack hoch → `auth` healthy abwarten (sonst existiert `auth.users` nicht) → migrieren → Functions deployen → App bauen.

`pg_cron`, `hypopg`, `index_advisor` sind im Image enthalten und vorgeladen — keine Zusatzarbeit.

### Fehlende Publication-Einträge (eigene Migration nötig)

Upstream registriert nur 4 der 6 abonnierten Tabellen für Live-Updates. **`teams` und `user_system` fehlen:**

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.teams;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_system;
```

### Edge Functions

Kein Sync-Mechanismus. Dateien nach `volumes/functions/<name>/` kopieren, **zentrale** `deno.jsonc`-Importmap pflegen (per-Function-`deno.json` ignoriert der Router), dann `docker compose restart functions`.
Nötig sind 6: `team-create`, `team-join`, `team-leave`, `team-kick`, `account-delete`, `token-create`.

---

## 5. Konfiguration — die Fallstricke, die still zuschlagen

| Env                             | Ohne sie passiert                                                                                    |
| ------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `NODE_ENV=production`           | Client fällt in den **Offline-Stub**, Supabase im Frontend komplett tot                              |
| `APP_URL` + `API_ALLOWED_HOSTS` | **403 auf allen `/api/*`** — Default fällt auf `tarkovtracker.org` zurück                            |
| `SUPABASE_URL` (Build-Zeit!)    | CSP wird beim Bauen erzeugt → Browser blockt REST **und** WebSocket                                  |
| `API_TRUST_PROXY=true`          | jede Client-IP ist die von nginx → IP-Rate-Limits wertlos                                            |
| `CI=true`                       | Production-Build wirft wegen fehlender Stripe-Keys                                                   |
| `SUPABASE_ALLOWED_ORIGINS`      | wird vom Standard-Compose **nicht** an `functions` durchgereicht; CORS hängt sonst allein am Gateway |
| `OVERLAY_URL`                   | **muss HTTPS sein** (seit 1.73.2), sonst **stiller** Fallback auf Upstream                           |

**Merksatz:** Diese App ist eine SPA mit `ssr: false`. Sehr viel wird **beim Bauen** eingebacken, nicht zur Laufzeit gelesen. Adressänderung = Neubau, nicht Neustart.

### nginx

⚠️ **Kein separater Port-80-Block mit blindem `return 301 https://`** — hinter Cloudflare ergibt das eine Redirect-Schleife (`ERR_TOO_MANY_REDIRECTS`), weil CF die Origin-Verbindung über HTTP aufbaut. Stattdessen ein server-Block für 80+443 mit bedingtem Redirect über `$http_cf_visitor` / `$http_x_forwarded_proto` (Muster aus `devstamm.conf`).

Zertifikat: `/etc/nginx/ssl/cf.pem` — dasselbe wie die anderen Subdomains, ohne Hostnamen-Einträge, wird von Cloudflare nicht geprüft. **Kein certbot nötig.**

Gesperrt (404): `/auth/v1/admin`, `/storage/v1/`, `/pg/`, `/graphql/v1`, `/mcp`, Dotfiles, `.env`/`.key`/`.pem`/`.sql`/`.bak`.

⚠️ **`/auth/v1/admin` ist öffentlich gesperrt.** Unser Login-Weg nutzt die Admin-API — der läuft serverseitig direkt gegen `127.0.0.1:8200`, an nginx vorbei. Das ist Absicht und das Muster für die spätere Anbindung.

**Noch offen:** `proxy_cache` für `/api/tarkov/*` ist **Pflicht**, nicht Optimierung. Ohne Cloudflare-Edge-Cache geht sonst jeder Request bis `json.tarkov.dev` durch (es gibt keine DB-Kopie), Worst-Case-Budget ~55 s pro Route.

---

## 6. Der Login-Weg (bewiesen)

Discord/Twitch sind im selbstgehosteten GoTrue **absichtlich nicht konfiguriert** — der Login läuft ausschliesslich über unser Hauptsystem. Zwei Anmeldewege wären doppelte Kontenverwaltung und ein Weg an uns vorbei.

**Warum es nicht anders geht:** Deren Schema hat Fremdschlüssel direkt auf `auth.users` und 19 Tabellen mit Row Level Security auf `auth.uid()`. Eine „fremd ausgestellte" Session ohne echten `auth.users`-Eintrag ist wertlos — jeder Schreibzugriff verletzt den Fremdschlüssel. Selbstsignierte JWTs und Third-Party-Auth scheiden damit aus.

**Der Weg, der funktioniert** (praktisch verifiziert, ohne SMTP):

1. `auth.admin.createUser()` — serverseitig, service_role, gegen `127.0.0.1:8200`
2. `auth.admin.generateLink({ type: 'magiclink' })` → `hashed_token`, **kein Mailversand**
3. Client: `auth.verifyOtp({ token_hash, type: 'magiclink' })` → echte Session mit Access- und Refresh-Token

Danach feuert der Trigger `on_auth_user_created`, die Fremdschlüssel halten, `auth.uid()` stimmt, Refresh funktioniert.

**Auflagen:**

- Der `hashed_token` ist ein Account-Takeover-Primitive: einmalig, kurze TTL, an unsere Session gebunden, nie in URLs die geloggt werden
- `service_role`-Key ausschliesslich serverseitig
- Rate-Limit `token_verifications` hochsetzen (Default 30 / 5 min **pro IP** — alle User kommen über dieselbe Proxy-IP)
- Zuordnung über eigene Mapping-Tabelle bei uns, **nicht über E-Mail raten**
- `user_metadata` (name, avatar_url) beim Anlegen selbst befüllen, sonst bleibt die UI leer

Testskript: `~/supabase-proto/e2e2.mjs`

---

## 7. Deutsche Quest-Inhalte

Deutsche Quest-Texte laufen bereits durch deren Pipeline (`tasks_de` mit `tasks_en` als Fallback, per JSONPath gemerged). Unsere Overrides setzen auf der **Overlay-Ebene** direkt danach an:

```
OVERLAY_URL -> unsere Overlay-JSON (HTTPS!)
```

Struktur:

```json
{
  "$meta": { "version": "stammtisch-1" },
  "locales": { "de": { "tasks": { "<taskId>": { "name": "..." } } } }
}
```

⚠️ **`$meta.version` ist Pflicht.** Fehlt sie, wird das komplette Overlay **still verworfen** — keine Fehlermeldung, die Übersetzungen sind einfach weg.
⚠️ **Nur HTTPS**, max. 3 Weiterleitungen, Ziele ebenfalls HTTPS (seit 1.73.2).

**UI-Strings** (nicht Quest-Inhalte) gehen **nicht** in `app/locales/de.json` — die ist Crowdin-verwaltet und überschreibt uns bei jedem Merge. Stattdessen eine eigene Datei über die Locale-Registrierung in `nuxt.config.ts`:

```ts
files: code === 'de' ? ['de.json', 'de.overrides.json'] : [`${code}.json`];
```

Der Weg über `app/i18n.config.ts` **funktioniert nicht** (getestet: neue Schlüssel überleben, bei Kollision gewinnt `de.json`).

Deren `de.json` ist zu ~30 % unübersetzt (563 von 1886 Schlüsseln identisch mit Englisch).

---

## 7b. Stand der Umstellung (2026-08-21)

**Fertig und live auf stammdev:**

- Tracker läuft unter `trackerdev.tarkov-stammtisch.de`, Theme/Branding/Footer in unserem Design
- **Login durchgehend:** Stammtisch-Konto → Tracker, kein zweiter Login. Im Browser verifiziert.
- **Login-Pflicht** für die ganze App (nur `/login` und `/auth/callback` offen)
- Nur DE/EN, Deutsch als Fallback
- Supporter/Community/GitHub/Resources/Migrations-Banner/„Neuigkeiten" entfernt
- Settings: „Tools & Integrations" und Discord-Karte raus
- **Alter Tracker im Hauptsystem ausgebaut** — 112 Dateien, 31.715 Zeilen. Alte Pfade leiten auf den neuen Tracker.

**Bewusst NICHT gemacht:**

- **Prisma-Modelle des alten Trackers stehen noch** (`TarkovQuest`, `TarkovProfile`, `TarkovQuestProgress`, `QuestKeyProgress`, `QuestTeam`, `QuestTeamMember`, `QuestContent`). Auf stammlive liegen dort **echte Nutzerdaten**: 338 Profile, 35.812 Fortschritts-Einträge, 15 Teams, 691 Schlüssel-Einträge.
  Würde man die Modelle entfernen, löscht der nächste `prisma db push` die Tabellen. `--accept-data-loss` ist projektweit hart gesperrt.
  **Sicherung existiert:** `stammlive:~/backup-tracker-20260820-190203.sql` (14 MB, alle 7 Tabellen, verifiziert).
  Der Schema-Rückbau ist ein **eigener, bewusster Schritt** mit eigener Freigabe.
- `TarkovQuest` wird weiterhin per Cron befüllt (`lib/tarkov-tracker/sync-quests.ts`, aufgerufen aus `src/discordbot/services/cronManager.ts`) — die Zahlen auf der Quest-Info-Seite hängen daran.

**Noch nie produktiv gelaufen:** Der Tracker läuft ausschliesslich als Prototyp auf stammdev.

---

## 8. Bekannte offene Punkte

### Vor einem Produktivgang zwingend

| Punkt                                 | Warum                                                                                                                                                                                     |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`proxy_cache` für `/api/tarkov/*`** | **Pflicht, nicht Optimierung.** Ohne Cloudflare-Edge geht jeder Request bis `json.tarkov.dev` — es gibt keine DB-Kopie der Quest-Daten. Dokumentiertes Worst-Case-Budget ~55 s pro Route. |
| **Produktions-Host entscheiden**      | stammlive ist zu knapp (1,7 GB wirklich frei, 4 GB Swap belegt, mysqld hält 9,8 GB). stammdev hat reichlich. Ggf. an #1000 koppeln.                                                       |
| **`wrangler.toml` `APP_URL`**         | zeigt auf `trackerdev…` — vor Produktivgang auf die Live-Domain, sonst zeigen Vorschau-Links in die Entwicklungsumgebung                                                                  |
| **`OVERLAY_URL` auf unser Overlay**   | aktuell noch die Test-Datei aus Phase 0; muss auf das gebaute `dist/overlay.json` aus dem Overlay-Fork zeigen (**HTTPS zwingend**)                                                        |

### Funktionale Baustellen

| Punkt                                                    | Stand                                                                                                                                                                                                                                                                       |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`teams`-Realtime liefert an User-Tokens keine Events** | Isoliert bewiesen: `service_role` 3/3, User-Token (sogar der Owner) 0/3. Die Policy ruft `private.can_access_team()`; PostgREST liest die Zeile problemlos, Realtimes eigene RLS-Auswertung verwirft sie still. Betrifft Team-Metadaten, **nicht** den eigenen Fortschritt. |
| **Realtime-Subscribe-Race (~2 s)**                       | `SUBSCRIBED` kommt bevor Realtime an Postgres hängt. Mutationen im Fenster gehen verloren → Client muss nach `SUBSCRIBED` **aktiv nachladen**.                                                                                                                              |
| **`ProfileSharingCard` ausblenden**                      | bietet einen Teilen-Link an, der durch die Login-Pflicht für Ausgeloggte nicht mehr funktioniert                                                                                                                                                                            |
| **Analytics-Einwilligung**                               | der einzige Wiedereinstieg lag im ersetzten Footer (`useAnalyticsConsent().openPreferences()`) — ersatzlos weg                                                                                                                                                              |
| **Schema-Rückbau alter Tracker**                         | siehe 7b — eigener Schritt, Sicherung liegt bereit                                                                                                                                                                                                                          |
| **Migration der 338 Nutzer**                             | offen, ob/wie alter Fortschritt mitgenommen wird. Der Tracker hat Import-Wege (`useTarkovDevImport`, `useEftLogsImport`, Data-Backup).                                                                                                                                      |
| **#1294 Löschkonzept**                                   | Supabase-Account beim User-Delete mitlöschen (DSGVO)                                                                                                                                                                                                                        |

## 9. Rückgaben an Upstream

Wir leben von deren Arbeit. Was allgemein nützlich ist, geht als PR zurück — fair, und es senkt unsere Patch-Last.

- **PR #756** (offen): `teamId` wurde als beliebiger 1-64-Zeichen-String akzeptiert, obwohl die Spalte UUID ist → PostgREST-400 wurde zu einem **500**. Jetzt UUID-Validierung vor der Abfrage.
- Offene Kandidaten: die fehlenden Publication-Einträge, die `teams`-Realtime-Policy, der Geschwister-Regex in `app/composables/api/useEdgeFunctions.ts`.

**Nicht zurückgeben:** Branding, unser SSO, Supporter-Entfernung.

---

## 10. Wenn etwas kaputt ist

| Symptom                                          | Erste Vermutung                                                                                        |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| `ERR_TOO_MANY_REDIRECTS`                         | nginx-Redirect nicht Cloudflare-bewusst (§5)                                                           |
| `502 Bad Gateway`                                | App-Prozess tot oder auf falschem Port (muss 3101 sein)                                                |
| Seite lädt, aber keine Daten                     | CSP enthält die falsche Supabase-Adresse → Neubau nötig, nicht Neustart                                |
| 403 auf allen `/api/*`                           | `APP_URL`/`API_ALLOWED_HOSTS` stimmt nicht                                                             |
| Login geht nicht, alles sieht ok aus             | `NODE_ENV` ist nicht `production` → Offline-Stub                                                       |
| Quests plötzlich englisch                        | Overlay still verworfen: `$meta.version` fehlt, oder URL ist `http:`                                   |
| **Komplett leere Seite trotz HTTP 200**          | alter Prozess lebt noch, serviert HTML des alten Builds → PID über `ss -tlnp \| grep 3101` killen (§3) |
| `Repository not found` beim Pull                 | Deploy-Key (§3)                                                                                        |
| Migration bricht bei `CREATE INDEX CONCURRENTLY` | die `disable-transaction`-Datei (§4)                                                                   |
