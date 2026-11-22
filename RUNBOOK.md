# Runbook — Prototyp-Aufbau und Betrieb

**Zweck:** Dieses Dokument beschreibt den kompletten Aufbau so, dass jemand ohne Vorwissen ihn nachvollziehen, reparieren oder neu errichten kann. Es ersetzt bewusst das Gedächtnis einer Arbeitssitzung.

Stand: **2026-11-22** (Betrieb: §7c; Abschnitte 3 bis 5 sind der Aufbau von 2026-08) · App: Upstream nach v1.90.0 · Analyse + Entscheidungen: [Epic #1293](https://github.com/miwidot/tarkov-stammtisch/issues/1293) · Abweichungen: [FORK.md](./FORK.md) · Daten-Overlay: eigenes Repo mit eigenem FORK.md (siehe §2)

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
| `MiwiDots/tarkov-data-overlay`          | nur für PRs zurück an das Overlay (Remote `mirror`) | öffentlich   |
| `tarkovtracker-org/TarkovTracker`       | Upstream der App (GPL-3)                            | öffentlich   |
| `tarkovtracker-org/tarkov-data-overlay` | Upstream des Overlays (**MIT**)                     | öffentlich   |

**Warum ein separater öffentlicher Fork:** Ein privates Repo kann kein GitHub-Fork eines öffentlichen sein und keine PRs upstream stellen. Der öffentliche Fork existierte bereits und wird ausschliesslich für Rückgaben benutzt.

> ⚠️ **„Overlay" bedeutet drei verschiedene Dinge.** Das **Spieldaten-Overlay** (eigenes Repo, Quest-Korrekturen als JSON). Das **Theme** des Trackers (Farben, in diesem Repo in `tailwind.css`/`app.config.ts`). Und die **OBS-Overlays** für Streams auf der Hauptseite. Nicht verwechseln.

### Das Spieldaten-Overlay (eigenes Repo, eigenes FORK.md)

Der Tracker unterstützt **genau eine** Overlay-Quelle. Zeigt `OVERLAY_URL` auf eine eigene Datei, ist das Upstream-Overlay **komplett weg** — gemessen: Task-Anzahl sprang 487 → 517, weil ~30 per `disabled: true` gefilterte Tasks zurückkamen, und alle 211 Korrekturen fehlten.

Deshalb der zweite Fork. `src/overrides/locales/de.json5` war anfangs eine **neue Datei** — seit PR #280/#281 gehoert sie **upstream mit**, unser Deutsch liegt also dort. Der Build sammelt sie automatisch ein (keine Sprach-Allowlist).

⚠️ Damit sind Konflikte in dieser Datei nicht mehr ausgeschlossen. Rein kosmetische Umformatierungen darin kosten bei jedem Merge — eine Kommentar-Vereinheitlichung erzeugte 17 Konflikte, von denen zwei stillschweigend Inhalte zurueckdrehten.

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

| Pfad                                                | Inhalt                                                                                                     |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `~/tracker-build-proto/TarkovTracker-sync-20261121` | aktueller Clone dieses Forks (origin = unser Repo); der alte `TarkovTracker` liegt unbenutzt daneben (§7c) |
| `~/tracker-build-proto/proto.env`                   | Build-/Laufzeit-Envs                                                                                       |
| `~/tracker-build-proto/start-proto.sh`              | Startskript (sourced `proto.env`)                                                                          |
| `~/tracker-build-proto/app.log`                     | Laufzeit-Log                                                                                               |
| `~/supabase-proto/supabase-src/docker`              | Supabase-Stack (Compose-Projekt `supaproto`)                                                               |
| `~/supabase-proto/*.mjs`                            | Testskripte (`e2e2.mjs` = Login-E2E, `rt4/rt5/rt6.mjs` = Realtime)                                         |
| `*.orig` neben Compose/Envoy-Dateien                | Originale vor unseren Kürzungen                                                                            |

### App steuern

```bash
# Status
ssh stammdev "ss -tlnp | grep 3101; tail -5 ~/tracker-build-proto/app.log"

# Neu bauen (nach git pull)
ssh stammdev "cd ~/tracker-build-proto/TarkovTracker-sync-20261121 && source ~/tracker-build-proto/proto.env && CI=true pnpm run build"

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

# NIE ausfuehren: `down -v` loescht den Stack samt Daten. Container und Volumes werden nicht geloescht (§7c); Anhalten per `stop`.
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

| Env                             | Ohne sie passiert                                                                                                         |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV=production`           | Client fällt in den **Offline-Stub**, Supabase im Frontend komplett tot                                                   |
| `APP_URL` + `API_ALLOWED_HOSTS` | **403 auf allen `/api/*`** — Default fällt auf `tarkovtracker.org` zurück                                                 |
| `SUPABASE_URL` (Build-Zeit!)    | CSP wird beim Bauen erzeugt → Browser blockt REST **und** WebSocket                                                       |
| `API_TRUST_PROXY=true`          | jede Client-IP ist die von nginx → IP-Rate-Limits wertlos                                                                 |
| `CI=true`                       | Production-Build wirft wegen fehlender Stripe-Keys                                                                        |
| `SUPABASE_ALLOWED_ORIGINS`      | wird vom Standard-Compose **nicht** an `functions` durchgereicht; CORS hängt sonst allein am Gateway                      |
| `OVERLAY_URL`                   | **https, http nur Loopback oder `file:` unter `OVERLAY_FILE_ROOT`** (FORK.md §4), sonst **stiller** Fallback auf Upstream |

**Merksatz:** Diese App ist eine SPA mit `ssr: false`. Sehr viel wird **beim Bauen** eingebacken, nicht zur Laufzeit gelesen. Adressänderung = Neubau, nicht Neustart.

### nginx

⚠️ **Kein separater Port-80-Block mit blindem `return 301 https://`** — hinter Cloudflare ergibt das eine Redirect-Schleife (`ERR_TOO_MANY_REDIRECTS`), weil CF die Origin-Verbindung über HTTP aufbaut. Stattdessen ein server-Block für 80+443 mit bedingtem Redirect über `$http_cf_visitor` / `$http_x_forwarded_proto` (Muster aus `devstamm.conf`).

Zertifikat: `/etc/nginx/ssl/cf.pem` — dasselbe wie die anderen Subdomains, ohne Hostnamen-Einträge, wird von Cloudflare nicht geprüft. **Kein certbot nötig.**

Gesperrt (404): `/auth/v1/admin`, `/storage/v1/`, `/pg/`, `/graphql/v1`, `/mcp`, Dotfiles, `.env`/`.key`/`.pem`/`.sql`/`.bak`.

⚠️ **`/auth/v1/admin` ist öffentlich gesperrt.** Unser Login-Weg nutzt die Admin-API — der läuft serverseitig direkt gegen `127.0.0.1:8200`, an nginx vorbei. Das ist Absicht und das Muster für die spätere Anbindung.

**`proxy_cache` für `/api/tarkov/*`:** früher Pflicht (Daten kamen zur Laufzeit von `json.tarkov.dev`), heute optional: die Spieldaten liegen im lokalen Verzeichnis `TARKOV_DATA_DIR` (§7c, FORK.md §2.3).

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
OVERLAY_URL -> unsere Overlay-JSON (https oder file:, siehe §7c)
```

Struktur:

```json
{
  "$meta": { "version": "stammtisch-1" },
  "locales": { "de": { "tasks": { "<taskId>": { "name": "..." } } } }
}
```

⚠️ **`$meta.version` ist Pflicht.** Fehlt sie, wird das komplette Overlay **still verworfen** — keine Fehlermeldung, die Übersetzungen sind einfach weg.
⚠️ **https, http nur auf Loopback oder `file:` unter `OVERLAY_FILE_ROOT`** (FORK.md §4); bei https max. 3 Weiterleitungen, Ziele ebenfalls https.

**UI-Strings** (nicht Quest-Inhalte) gehen **nicht** in `app/locales/de.json` — die ist Crowdin-verwaltet und überschreibt uns bei jedem Merge. Stattdessen eine eigene Datei über die Locale-Registrierung in `nuxt.config.ts`:

```ts
files: code === 'de' ? ['de.json', 'de.overrides.json'] : [`${code}.json`];
```

Der Weg über `app/i18n.config.ts` **funktioniert nicht** (getestet: neue Schlüssel überleben, bei Kollision gewinnt `de.json`).

Deren `de.json` ist zu ~30 % unübersetzt (563 von 1886 Schlüsseln identisch mit Englisch).

---

## 7a. Wie Quest-Daten fliessen — und was bei Spielupdates mit dem Fortschritt passiert

> Am Code verifiziert (2026-08-21), nicht angenommen. Das ist der wichtigste Unterschied zu unserem alten Tracker.

### Es gibt keinen Quest-Sync

Upstream hat **keine Quest-Tabelle und keinen Sync-Job**. Alle 19 DB-Tabellen halten ausschliesslich _User_-Zustand (Fortschritt, Teams, Einstellungen, Admin). Quest-Definitionen werden **nie persistiert**.

Der Weg der Daten:

```
json.tarkov.dev  (statische JSON, pro gameMode)
      ↓  on-demand, keine Hintergrundjobs
/api/tarkov/tasks-core|-objectives|-rewards          (Nitro-Server-Routen)
      ↓  Sprach-Merge: tasks_<lang> + tasks_en als Fallback, per JSONPath
      ↓  Overlay drüber (unser Fork -> OVERLAY_URL)
      ↓  Cache: 12 h Standard (CACHE_TTL_DEFAULT=43200)
      ↓         24 h Item-Katalog (CACHE_TTL_EXTENDED=86400)
Client (Pinia-Stores + IndexedDB)
```

**Konsequenz:** Neue Spieldaten sind spätestens nach Ablauf der Cache-Zeit da. Nichts muss angestossen werden, es gibt keinen Job der schiefgehen kann.

### Fortschritt ist reines Nachschlagewerk

Gespeichert wird in `user_progress` / `user_game_mode_progress` als **JSONB**: `taskCompletions` und `taskObjectives`, jeweils als Map, gekeyt auf Task- bzw. Objective-**ID**.

**Der entscheidende Mechanismus:** Die Auswertung iteriert über die **aktuellen Tasks** aus der Live-Quelle (`metadataStore.tasks` → `relevantTasks`) und schlägt den gespeicherten Stand darin **nach**. Nicht umgekehrt.

Belegt in `app/composables/useDashboardStats.ts` (Nenner = `relevantTasks.value.filter(...).length`) und `app/stores/useProgress.ts` (`for (const task of metadataStore.tasks)`).

### Was bei einem Spielupdate passiert

| BSG ändert …                            | Verhalten                                                                       |
| --------------------------------------- | ------------------------------------------------------------------------------- |
| Quest **entfernt**                      | fällt aus dem Nenner; gespeicherter Eintrag wird nie mehr gelesen               |
| Quest **neu**                           | erscheint als offen im Nenner                                                   |
| **Ziele geändert** (neue Objective-IDs) | neue IDs starten offen, alte werden ignoriert → Quest wird wieder unvollständig |
| Quest per Overlay **deaktiviert**       | verschwindet aus der Liste wie ein entfernter                                   |

**Es gibt strukturell nichts, das den Fortschritt verfälschen könnte** — weil kein Prozess ihn anfasst. Die aktuellen Daten gewinnen immer.

> **Genau das war beim alten Tracker anders.** Dort standen Quests in unserer DB, und ein Sync, der Objectives änderte, hat die Completion-Rechnung still verfälscht. Deshalb sah der alte Plan (#1215) ein eigenes Ticket „Progress reconciliation on sync" vor. **Der Fork braucht das strukturell nicht.**

### Was bleibt: verwaiste Einträge

Wird eine Quest entfernt, bleibt ihr Eintrag im JSONB liegen — er wird nur nie wieder gelesen. Es gibt **keine** Bereinigung dafür.

Der Trigger `sanitize_user_progress_row` (Migration `20260215160000`) normalisiert die **Struktur** der Payload und entfernt unbekannte Top-Level-Felder — er räumt **keine** verwaisten Task-/Objective-IDs weg. _(Verifiziert; dass die Waisen dadurch harmlos, aber dauerhaft sind, ist die logische Folge — nicht separat gemessen.)_

Praktisch unkritisch: es sind ein paar Bytes pro entfallener Quest. Falls es je stört, wäre eine batched Bereinigung in einem Wartungsfenster der Weg — die Migration selbst weist explizit auf dieses Muster hin.

### Repariert wird nur eines: fehlgeschlagene Quest-Zweige

`app/stores/useTarkov.ts` enthält `clearFailedTaskObjectives()` — wenn eine Quest als „failed" markiert ist, werden deren Objective-Häkchen zurückgesetzt, und veraltete Failed-Flags ohne gültige Ursache werden gelöscht. Das ist Zweig-Logik (sich gegenseitig ausschliessende Quests), nicht Datenabgleich.

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

**Stand damals:** nur Prototyp auf stammdev. Seit 2026-10-23 läuft auf stammlive ein Live-Tracker (alter Codestand); der Produktivgang des neuen Stands steht in §7c.

---

## 7c. ÜBERGABE — Stand 2026-11-22

> Wer hier neu einsteigt: **dieser Abschnitt zuerst.** Er beschreibt, wie der Tracker heute betrieben wird. Was vom Upstream abweicht und warum, steht in [FORK.md](./FORK.md) (am 2026-11-21 gegen den Code neu geschrieben, Commit `e6b06487`); das wird hier nicht wiederholt. Die Abschnitte 3 bis 5 sind der Aufbau von 2026-08 und werden dort, wo sie sich mit diesem Abschnitt widersprechen, hier übersteuert.

### Überblick

| Repo                                                                      | Zweck                                                                  |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `miwidot/stammtisch-tracker` (privat, dieses Repo, `FORK.md`)             | die Tracker-App, Branch `sync/full-2026-11-21` (Upstream nach v1.90.0) |
| `miwidot/stammtisch-tracker-overlay` (privat, eigenes `FORK.md`)          | das **Daten-Overlay** plus der Katalog-Erzeuger (Produzent)            |
| `MiwiDots/TarkovTrackerNuxt`, `MiwiDots/tarkov-data-overlay` (öffentlich) | nur Spiegel für Pull Requests an Upstream, nie als Betriebsquelle      |

**„Overlay" heißt hier das Daten-Overlay**: JSON mit Korrekturen an den Quest-/Item-Daten von tarkov.dev. Nicht das Theme des Trackers und nicht die OBS-Overlays der Hauptseite (siehe §2).

Der Tracker läuft in **zwei getrennten Umgebungen**:

|             | trackerdev (stammdev)                                                                | live (stammlive)                                                                           |
| ----------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| Host        | `trackerdev.tarkov-stammtisch.de`                                                    | `tracker.tarkov-stammtisch.de`                                                             |
| App-Prozess | `setsid nohup ~/tracker-build-proto/start-proto.sh`, **nicht pm2**, `127.0.0.1:3101` | pm2 `quest-tracker`, Skript `~/tracker/start-tracker.sh`, Env `live.env`, `127.0.0.1:3101` |
| Checkout    | `~/tracker-build-proto/TarkovTracker-sync-20261121`                                  | `~/tracker/TarkovTracker` (`main`, Stand 2026-09-24, **noch alter Code**)                  |
| Env-Datei   | `~/tracker-build-proto/proto.env`                                                    | `~/tracker/live.env`                                                                       |
| Supabase    | Docker-Compose-Projekt `supaproto`, Gateway `127.0.0.1:8200`                         | eigener Stack `supalive`, Gateway `127.0.0.1:8200`                                         |

Auf stammdev liegt der alte Checkout `~/tracker-build-proto/TarkovTracker` (Stand `fd5e854`) weiter daneben, läuft aber nicht. **Docker-Container und -Volumes werden nie gelöscht** (kein `down -v`, kein `rm`, kein `prune`); Rückbau geht über `stop`/`start`. Im Compose-Verzeichnis liegt ein `reset.sh` von Upstream, das den Stack wischt: nie ausführen.

### trackerdev: Laufzeit

```bash
# Status
ssh stammdev "ss -tlnp | grep 3101; tail -5 ~/tracker-build-proto/app.log"
# Neustart: PID über den Port ermitteln (§3), killen, dann
ssh stammdev "cd ~/tracker-build-proto && setsid nohup ./start-proto.sh > app.log 2>&1 < /dev/null &"
```

Build im neuen Checkout: `source ../proto.env && CI=true NODE_ENV=production NITRO_PRESET=node-server pnpm run build` (pnpm 11.14.0 über corepack, Node `>=24.22.3`). Adressänderungen brauchen einen Neubau, keinen Neustart (§5). Nach dem Klonen einmal `git config merge.ours.driver true` (FORK.md §7).

Env-**Namen** in `proto.env` (Werte nie ins Dokument): `NODE_ENV`, `NITRO_PRESET`, `CI`, `NODE_OPTIONS`, `APP_URL`, `API_ALLOWED_HOSTS`, `NUXT_API_PROTECTION_ALLOWED_HOSTS`, `API_TRUST_PROXY`, `API_REQUIRE_AUTH`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `NUXT_SUPABASE_URL`, `NUXT_SUPABASE_SERVICE_KEY`, `NUXT_PUBLIC_TRACKER_HANDOFF_URL`, `NUXT_PUBLIC_ACCOUNT_DELETION_URL`, `NUXT_FORK_ACCOUNT_DELETE_SECRET`, `TARKOV_DATA_DIR`, `OVERLAY_URL`, `NEUTRAL_OVERLAY_URL`, `OVERLAY_FILE_ROOT`, `SUPA_ENV`. Bedeutung jeder Variable: FORK.md §2.2. Live nutzt dieselben Namen plus `OVERLAY_CACHE_BUSTER`.

### Overlay

- Der App-Server liest das Overlay per **`file://`** (kein HTTP, kein Umweg über Cloudflare): `OVERLAY_URL`, `NEUTRAL_OVERLAY_URL`, `OVERLAY_FILE_ROOT` (Regeln: FORK.md §4). Der App-Prozess muss die Dateien lesen dürfen.
- Checkout `~/overlay-fork` (Remote über den Deploy-Key-Alias `github-overlay`), Dateien in `dist/`: `overlay.json` und `overlay-neutral.json`.
- **Nicht öffentlich ausgeliefert:** nginx antwortet auf `/overlay.json`, `/overlay-neutral.json` und `/overlay-fork/` mit 404.
- **Vorsicht:** Der Produzent baut neu und überschreibt die in Git geführten `dist/overlay*.json`. Der Checkout ist deshalb im Normalfall schmutzig. Vor einem `git pull` zuerst `git status` prüfen und `git checkout -- dist/` (Overlay-FORK.md: „`dist/` fassen wir nicht an"), sonst bricht der Pull ab oder der Merge verhakt sich.
- **Version:** `git tag --merged HEAD --list 'v*'` (höchste Zahl). Fehlen die Upstream-Tags, wird eine viel zu niedrige Version gebaut. Die Tags `fork-2026-08/*` sind Sicherungen unserer alten August-Tags und zählen nicht.
- Die App cached das Overlay 1 h im Prozess (`OVERLAY_CACHE_BUSTER` erzwingt sofort), der Browser zusätzlich 12 h in IndexedDB (§10, „Zwei Caches").

### Produzent (Spieldaten)

Die App liest Quests, Items, Hideout und Strings aus `TARKOV_DATA_DIR` (zeigt auf `current`), nicht aus Cloudflare KV. Den Inhalt erzeugt der Produzent aus dem Overlay und `json.tarkov.dev` (Ablauf: Overlay-FORK.md „Katalog-Erzeuger").

- Cron-Wrapper `~/tracker-build-proto/run-producer.sh` ruft `scripts/producer/cron-run.sh` des Overlay-Repos:
  - `run` alle 12 h um :17, `check-age` stündlich um :47 (Alarm bei Release älter als 30 h).
  - Schreibt `~/tracker-data/releases/<id>` und hängt den Symlink `current` atomar um; behält 4 Releases.
  - Vor jedem Lauf `git fetch --tags origin`.
  - **Versions-Wächter:** Liegt die gebaute Version unter der des aktiven Releases, Exit-Code 3, `current` bleibt unberührt. Bewusster Rückschritt nur mit `PRODUCER_ALLOW_VERSION_REGRESSION=1`.
  - `PRODUCER_APP_URL` (öffentlicher https-Ursprung) bestimmt den User-Agent gegenüber `json.tarkov.dev`; auf stammdev die trackerdev-Adresse.
  - Das Verzeichnis `current` wird ohne App-Neustart gelesen.
- Den Tracker-Code für den Lauf holt der Produzent am Pin `scripts/producer/tracker.lock.json`; auf stammdev mit `TRACKER_REPO=git@github-tracker:miwidot/stammtisch-tracker.git` (der Standard-Key gehört zu einem anderen Repo). Alte Tracker-Checkouts (rund 1 GB je Pin) räumt nichts automatisch weg.
- **Nie über Sonntag 03:45 hinweg einen Batch laufen lassen** (siehe Migrationen: der Inaktivitäts-Cron würde dort laufen, bevor er ausgeplant ist). Ebenso nicht um 04:30 (täglicher `account-deletion-retry`).
- Fehlschlag oder veraltetes `producer-manifest.json`: Discord-Alarm. Sonst liefert die App still alte Daten.

### nginx (beide Umgebungen)

Soll-Zustand (FORK.md §2.3 ist die Quelle; hier die Betriebsregeln):

- `real_ip` aus den Cloudflare-Adressbereichen; in **jedem** Proxy-Block `X-Forwarded-For` und `CF-Connecting-IP` mit `$remote_addr` überschreiben. Sonst lassen sich IP-Rate-Limits per direktem Aufruf des Origins fälschen (`API_TRUST_PROXY=true`). Der Origin ist an Cloudflare vorbei erreichbar.
- `/api/fork` öffentlich sperren (404).
- Overlay-Blöcke: `/overlay.json`, `/overlay-neutral.json`, `/overlay-fork/` liefern 404.
- Einspielen (die sudo-Schritte macht der User): Sicherungskopie der Konfiguration anlegen, dann `install -o root -g root -m 644 <neue Datei> /etc/nginx/sites-enabled/<vhost>.conf`, dann `nginx -t && systemctl reload nginx`. Rückbau genauso mit der Sicherungskopie. Die Sicherung liegt **außerhalb** von `sites-enabled`, sonst lädt nginx sie mit.
- **Nach dem Reload prüfen, dass die Worker neu gestartet sind** (Prozessstartzeit der `nginx: worker`-Prozesse). Ein vergessener Reload ist schon einmal passiert: die Datei war neu, der Dienst lief mit der alten Konfiguration.

### Kontolöschung

Nur über die Hauptseite (Hintergrund und Antworten: FORK.md §5).

- Die Hauptseite ruft `http://127.0.0.1:3101/api/fork/account-delete` über `TRACKER_INTERNAL_URL` mit `TRACKER_ACCOUNT_DELETE_SECRET`; Gegenstück im Tracker ist `NUXT_FORK_ACCOUNT_DELETE_SECRET`. Beide Werte müssen gleich sein, mindestens 32 Zeichen, nie im Repo oder Log.
- **Loopback-Gate:** von außen oder mit irgendeinem Proxy-Header 404, ohne Secret 401. `TRACKER_INTERNAL_URL` darf nicht die öffentliche Adresse sein.
- `NUXT_PUBLIC_ACCOUNT_DELETION_URL` verweist Nutzer auf die Profil-Einstellungen der Hauptseite (auf dev die dev-Hauptseite, nicht die Live-Adresse).
- Der Inaktivitäts-Cron `inactive-account-cleanup` ist deaktiviert (Fork-Migration `20261121150000`).
- **Offen:** Die Hauptseite ruft den Endpunkt im Code noch nicht auf (#1294, Plan: `app/api/user/delete-account` und `app/api/admin/users/[id]`).

### Migrationen

Es gibt keine Tracking-Tabelle: welche Migration angewendet ist, lässt sich nur aus dem Schema ablesen, und beide Stacks stehen unterschiedlich.

1. **Backup zuerst**, mit Zeitstempel in `~/backups/`: `pg_dumpall` als SQL (Cluster samt Rollen), `pg_dump -Fc` der Datenbank `postgres`, und ein `tgz` von `volumes/functions`. Größe, Kopf-/Fußzeile und `pg_restore -l` prüfen; eine Kopie von stammlive zusätzlich auf den Mac holen.
2. **Zuerst feststellen, was schon fehlt**, nicht nur die neuen Dateien zählen. Beispiel: `20260912085531` war auf stammdev nie angewendet und brach `fork_delete_account`; auf stammlive fehlte dieselbe Datei samt `20260912085904`.
3. Der Reihe nach anwenden, bei **erstem Fehler abbrechen** (`ON_ERROR_STOP=1`, kein Weiterlaufen). Neues Verzeichnis im Container (nicht das alte mitlaufen lassen), als Benutzer `postgres`. Besonderheit: `-- supabase:disable-transaction`-Dateien ohne `--single-transaction` (§4).
4. Danach pgTAP der Fork-Dateien (`supabase/tests/database/fork_*.test.sql`) und Rauchprüfungen: `cron.job` ohne `inactive-account-cleanup`, `fork_delete_account(<zufällige uuid>)` liefert `not_found`.
5. **Nie** Optionen verwenden, die Daten verwerfen. Rückbau: zuerst vorwärts reparieren; echte Rücknahme nur aus dem Dump, und dann zusammen mit der alten App (die RPCs wandern in `private`, die alte App läuft auf dem neuen Schema nicht).

Der Edge-Functions-Satz ist getrennt zu pflegen: `_shared`, `team-create`, `team-join`, `team-leave`, `team-disband`, `team-kick`, `token-create` nach `volumes/functions/` kopieren (überschreiben, nichts löschen), `shared/team-create-error` in die zentrale `deno.jsonc` eintragen, dann Container `functions` neu starten.

Bekannter Lärm: `account-deletion-retry` schlägt täglich fehl (`storage.objects` gibt es auf unserem Stack nicht; auf stammdev seit 2026-10-14). Harmlos, solange es keine Löschjobs gibt; offen ist, ob wir das abstellen.

### Prüfung nach jedem Deploy

- [ ] `/` liefert 200; der Einstiegs-Chunk aus `/` (§3, Schnelltest) auch (200, nicht 520)
- [ ] `/api/fork/*` von außen: 404
- [ ] `/overlay.json`, `/overlay-neutral.json`, `/overlay-fork/` von außen: 404
- [ ] `/api/tarkov/extract-requirements` zeigt `dataOverlay.version` (erwartete Version) und `sourceUrl` mit `file://`
- [ ] `/api/tarkov/strings?lang=de` liefert Deutsch; `bootstrap` und `tasks-core?lang=de` 200 (nicht 503)
- [ ] Ausgehende Verbindungen des App-Prozesses (`ss -tnp`) nur Loopback plus `assets.tarkov.dev`/`tarkov.dev`; im Browser kein `static.cloudflareinsights.com` (der Cloudflare-Edge setzt es ein, im Dashboard „Web Analytics" für den Host abschalten)
- [ ] Danach FORK.md §8 (Rauchtest) durchgehen

### Produktivgang (stammlive)

Stand der Untersuchung (nur lesend): live läuft der **alte** Tracker (80 Nutzer), das Schema ist hinter dem Code. Reihenfolge:

1. **Backup anlegen.** Auf stammlive existiert noch **kein** Supabase-Backup (das tägliche Skript sichert nur MySQL). Ohne verifiziertes, auf den Mac kopiertes Backup nichts weiter.
2. **Hauptseite zuerst:** PR dev→main mit dem State-Nonce-Login muss live sein, bevor der Tracker umgestellt wird, sonst wird jeder Login abgelehnt (FORK.md §3.1). Merge nur nach ausdrücklicher Freigabe, danach Deploy.
3. **Trockenlauf** der Migrationen auf einem Dump des Live-Stands (lokal beim User). **42 Migrationen** stehen aus (2 nie angewendete aus dem 2026-09-24-Stand, 38 Upstream, 2 Fork); der trackerdev-Lauf mit 14 beweist dafür nichts. Zielstand einfrieren (feste Commit-SHA, gepusht), dieselbe SHA vorher auf trackerdev geprüft.
4. Node auf `>=24.22.3` (stammlive läuft mit 24.22.1; derselbe Node versorgt die pm2-Prozesse der Hauptseite, danach `deploy.sh main --all` über `tarkov-deploy`). Der Live-Code selbst verlangt weniger, `engines` des Zielstands aber 24.22.3.
5. **nginx** auf Live-Stand der Härtung bringen: `proxy_set_header CF-Connecting-IP $remote_addr` und `X-Forwarded-For $remote_addr` in den App-/Auth-/Functions-Blöcken (der globale `real_ip` existiert dort schon), `/api/fork` sperren, Overlay-Blöcke (heute liefert live `/overlay.json` aus einer Kopie und kennt `/overlay-neutral.json` nicht).
6. **Produzent-Cron** auf stammlive (Wrapper mit Live-Pfaden und „LIVE"-Kennzeichnung im Alarm), Overlay-Checkout vorher bereinigen (schmutziges `dist/`, fremde pnpm-Dateien).
7. Neuer Checkout, Build mit niedriger Priorität außerhalb der Stoßzeit (Swap ist belegt), `live.env` um die neuen Namen ergänzen (neues Secret, **nicht** der Dev-Wert), App- und Functions-Umstellung im Wartungsfenster, nicht über Sonntag 03:45 oder 04:30.
8. **noindex** bleibt, bis entschieden ist, ob Live indexiert werden soll (`NUXT_PUBLIC_ALLOW_INDEXING` nicht setzen).
9. **Die Dev-Secrets vor dem Livegang rotieren** und auf Live eigene, neue Werte verwenden.
10. Tägliches Supabase-Backup einrichten, Prüfliste oben auf der Live-Adresse.

**Offene Entscheidungen** (nicht entschieden, nicht annehmen):

- Wartet Live, bis trackerdev dieselbe SHA einige Tage lief?
- Live indexierbar oder noindex?
- Overlay-Auslieferung live: nginx auf `overlay-fork/dist/*` oder Kopierschritt erweitern? (Seit dem `file://`-Weg ist das nur noch die Frage, wo die App liest; öffentlich bleibt 404.)
- Kontolöschung der Hauptseite (#1294) im selben Promotion-PR wie der State-Nonce oder getrennt?
- Auslaufen lassen oder abstellen: die täglichen `account-deletion-retry`-Fehler.
- Tägliches `pg_dumpall` für beide Supabase-Stacks (Vorschlag, nicht eingerichtet).
- Verwaiste Edge Function `team-members` auf live später entfernen (nur mit ausdrücklichem OK).
- App auf stammdev dauerhaft per `setsid nohup` oder auf pm2 wie live.

### Übersetzungsarbeit (Verfahren, Stand 2026-08, Zahlen nicht neu geprüft)

Unser Deutsch liegt bei Upstream (`tarkovtracker-org/tarkov-data-overlay`, PR #280/#281); der Overlay-Fork trägt keine Daten- oder Übersetzungsänderungen mehr (Overlay-FORK.md). Neue Übersetzungen und Datenkorrekturen gehen als PR an Upstream (über den Spiegel). Werkzeuge:

```bash
npm run status:locale de   # offen je Händler, Drift, wirkungslose Overrides
npm run check-overrides    # was hat upstream inzwischen selbst gefixt
npm run wiki:compare -- --all --cache   # tarkov.dev gegen das Wiki
npx vitest run             # u.a. Dubletten-Wächter und die Korrektur-Kopplung
```

**Die Falle, die zweimal zugeschlagen hat:** Eine Übersetzung folgt dem **korrigierten** Englisch, nicht dem der API. `overrides/tasks.json5` ersetzt falsches Englisch (One-Way Ticket: API „any target", korrekt 15 Kopfschuss-Kills). Eine Drift-Prüfung gegen das rohe Bundle meldet solche Einträge fälschlich als veraltet. Heute wendet die Prüfung die Datenkorrekturen vorher an, und `tests/locale-follows-corrections.test.ts` schlägt an, wenn ein `// Was:` einer Korrektur widerspricht (deckt nur die vorhandenen Überschneidungen ab).

**`wiki:compare` ist ein Kandidatenfinder, kein Fehlerbericht.** Rund ein Sechstel sind gescheiterte Zuordnungen, `trustsWiki` steht bei allen auf `true`, Level- und XP-Abweichungen sind systematisch (vermutlich veraltete Wiki-Abschnitte). Gezielte Fragen lohnen, z. B. „Ziele mit abweichender Anzahl".

**Escort:** Der Tracker zeigte neun Ziele, das Spiel hat acht. Der Fehler sitzt in `the-hideout/tarkov-data-manager` (`data/changed_quests.json`, handgepflegtes 9. Ziel); unser Overlay macht es per `optional: true` unschädlich. Suppressions sind kein Auslieferungsmechanismus (stehen nicht im gebauten `overlay.json`), und `disabled` gibt es nur auf Task-Ebene. PR the-hideout/tarkov-data-manager#859 war approved, aber durch deren Automatisierung blockiert; den Override erst entfernen, wenn `check-overrides` ihn als überflüssig meldet. Aktueller Stand des PR nicht neu geprüft.

**„Glory to CPSU" steht zweimal da:** zwei echte Tasks (`639135b0…47d7` aus dem Spiel raus, `64f5aac4…14c2` aktuell). Den Namenskonflikt erzeugt eine upstream-Datenkorrektur in `overrides/tasks.json5` (Commit `045c943`), die den englischen Namen **über** das deutsche Bundle legt (Korrekturen wirken vor den Locale-Overlays). **Lehre:** vor dem Flicken in `de.json5` prüfen, ob `overrides/tasks.json5` denselben Task anfasst, sonst versteckt ein Locale-Override den eigentlichen Fehler dauerhaft. Sauberer Weg: die Umbenennung upstream zurückziehen, noch nicht gemeldet.

Der Übersetzungsstand ändert sich laufend; aktuelle Zahlen liefert `status:locale de`, nicht dieses Dokument.

---

## 8. Bekannte offene Punkte

### Vor einem Produktivgang zwingend

| Punkt                                 | Warum                                                                                                                                                                                                                                                    |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`proxy_cache` für `/api/tarkov/*`** | **Nicht mehr Pflicht:** die Spieldaten kommen aus dem lokalen Verzeichnis, nicht zur Laufzeit von `json.tarkov.dev` (FORK.md §2.3).                                                                                                                      |
| **Produktions-Host**                  | entschieden: stammlive (dort läuft der Live-Tracker schon, Swap belegt, Build mit niedriger Priorität, §7c). Früher: stammlive ist zu knapp (1,7 GB wirklich frei, 4 GB Swap belegt, mysqld hält 9,8 GB). stammdev hat reichlich. Ggf. an #1000 koppeln. |
| **`wrangler.toml` `APP_URL`**         | ohne Wirkung auf node-server (FORK.md §7), entfällt                                                                                                                                                                                                      |
| **`OVERLAY_URL` auf unser Overlay**   | erledigt auf trackerdev (`file://`, §7c); auf live noch alte Kopie `overlay/overlay.json`                                                                                                                                                                |

### Funktionale Baustellen

| Punkt                                                    | Stand                                                                                                                                                                                                                                                                       |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`teams`-Realtime liefert an User-Tokens keine Events** | Isoliert bewiesen: `service_role` 3/3, User-Token (sogar der Owner) 0/3. Die Policy ruft `private.can_access_team()`; PostgREST liest die Zeile problemlos, Realtimes eigene RLS-Auswertung verwirft sie still. Betrifft Team-Metadaten, **nicht** den eigenen Fortschritt. |
| **Realtime-Subscribe-Race (~2 s)**                       | `SUBSCRIBED` kommt bevor Realtime an Postgres hängt. Mutationen im Fenster gehen verloren → Client muss nach `SUBSCRIBED` **aktiv nachladen**.                                                                                                                              |
| **`ProfileSharingCard` ausblenden**                      | bietet einen Teilen-Link an, der durch die Login-Pflicht für Ausgeloggte nicht mehr funktioniert                                                                                                                                                                            |
| **Analytics-Einwilligung**                               | der einzige Wiedereinstieg lag im ersetzten Footer (`useAnalyticsConsent().openPreferences()`) — ersatzlos weg                                                                                                                                                              |
| **Schema-Rückbau alter Tracker**                         | siehe 7b — eigener Schritt, Sicherung liegt bereit                                                                                                                                                                                                                          |
| **Migration der 338 Nutzer**                             | offen, ob/wie alter Fortschritt mitgenommen wird. Der Tracker hat Import-Wege (`useTarkovDevImport`, `useEftLogsImport`, Data-Backup).                                                                                                                                      |
| **#1294 Löschkonzept**                                   | Tracker-Seite fertig (§7c); die Hauptseite ruft den Endpunkt noch nicht auf                                                                                                                                                                                                 |

## 9. Rückgaben an Upstream

Wir leben von deren Arbeit. Was allgemein nützlich ist, geht als PR zurück — fair, und es senkt unsere Patch-Last.

- **PR #756** (offen): `teamId` wurde als beliebiger 1-64-Zeichen-String akzeptiert, obwohl die Spalte UUID ist → PostgREST-400 wurde zu einem **500**. Jetzt UUID-Validierung vor der Abfrage.
- Offene Kandidaten: die fehlenden Publication-Einträge, die `teams`-Realtime-Policy, der Geschwister-Regex in `app/composables/api/useEdgeFunctions.ts`.

**Nicht zurückgeben:** Branding, unser SSO, Supporter-Entfernung.

---

## 10. Wenn etwas kaputt ist

| Symptom                                                                            | Erste Vermutung                                                                                        |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `ERR_TOO_MANY_REDIRECTS`                                                           | nginx-Redirect nicht Cloudflare-bewusst (§5)                                                           |
| `502 Bad Gateway`                                                                  | App-Prozess tot oder auf falschem Port (muss 3101 sein)                                                |
| Seite lädt, aber keine Daten                                                       | CSP enthält die falsche Supabase-Adresse → Neubau nötig, nicht Neustart                                |
| 403 auf allen `/api/*`                                                             | `APP_URL`/`API_ALLOWED_HOSTS` stimmt nicht                                                             |
| Login geht nicht, alles sieht ok aus                                               | `NODE_ENV` ist nicht `production` → Offline-Stub                                                       |
| Quests plötzlich englisch                                                          | Overlay still verworfen: `$meta.version` fehlt, oder URL ist `http:`                                   |
| **Komplett leere Seite trotz HTTP 200**                                            | alter Prozess lebt noch, serviert HTML des alten Builds → PID über `ss -tlnp \| grep 3101` killen (§3) |
| **Overlay-Änderung im Browser nicht sichtbar, obwohl die App neu gestartet wurde** | **Zweiter Cache im Browser**, nicht der Server. Siehe unten.                                           |

### Zwei Caches, nicht einer

Der 1-Stunden-Cache aus §7c ist der **Prozessspeicher der App** — der fällt beim Neustart. Davon
unabhängig legt der Client die Quest-Daten in **IndexedDB** ab: Datenbank `tarkov-tracker-cache`,
**TTL 12 Stunden** (`app/utils/tarkovCache.ts`, verwendet in `app/stores/useMetadata.ts`).

Ein Neustart hilft dagegen nicht, ein hartes Neuladen auch nicht (das leert nur den HTTP-Cache).

```
javascript:indexedDB.deleteDatabase('tarkov-tracker-cache');location.reload();
```

Als Lesezeichen ablegen — das ist der Entwicklungs-Weg. Einen Abschalt-Schalter gibt es nicht:
keine Env, keine Runtime-Config, kein Knopf. `forceRefresh` wird zwar durch den Store gereicht,
aber von keiner Komponente ausgelöst.

**Erst prüfen, welche Schicht klemmt**, bevor irgendwas neu gestartet wird:

```bash
ssh stammdev "curl -s 'http://127.0.0.1:3101/api/tarkov/tasks-objectives?lang=de' | grep -c '<deutscher Text>'"
```

Liefert das >0, ist der Server sauber und der Browser hält die alten Daten.

### Zwei Upstream-Fehler, bewusst NICHT lokal gepatcht

Beide in Dateien, die bei uns byte-identisch mit upstream sind — ein Patch wäre Kategorie C:

| Fehler                                                                                                                                                                                                                                           | Datei                             | Volatilität              | Stand                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------- | ------------------------ | ------------------------ |
| Cache-Schlüssel enthält nur die handgepflegte Konstante `json-v3`, nichts aus den Daten → Overlay-Änderungen sind bis zu 12 h unsichtbar. Der Server schickt `X-Overlay-Version` + `X-Overlay-Sha256` bereits mit, der Client ignoriert sie.     | `app/stores/useMetadata.ts`       | 5 Commits / 66 Tage      | offen, Upstream-Kandidat |
| `taskRequirements[].task.name` wird nicht übersetzt — `adaptTaskRef` greift den Namen roh ab, an der Übersetzungsschicht vorbei. Reproduzierbar ohne Overlay: Teil 4 ist upstream deutsch, erscheint in der „Benötigt:"-Zeile trotzdem englisch. | `app/server/utils/tarkov-json.ts` | **10 Commits / 66 Tage** | offen, Upstream-Kandidat |

Entscheidung 2026-08-21: **nicht lokal patchen.** Der zweite sitzt in der volatilsten Datei des
Projekts; ein Eingriff dort brächte dauerhaft Merge-Konflikte für einen fremden Fehler.
| `Repository not found` beim Pull | Deploy-Key (§3) |
| Migration bricht bei `CREATE INDEX CONCURRENTLY` | die `disable-transaction`-Datei (§4) |
