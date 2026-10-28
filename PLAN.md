# Plan: Paneel, open-source Stream Deck-alternatief (telefoon als deck, Mac/Windows als host)

Status: v0.4, 27 oktober 2026. Alle keuzes zijn gemaakt (hoofdstuk 2); fase 1 (spike) is af en
fase 2 (MVP) is grotendeels gebouwd. Voortgang en de openstaande punten staan in hoofdstuk 12.

## 1. Doel en positionering

Een Stream Deck is een raster visuele knoppen waarbij één druk een hele handeling op de
computer uitvoert: sneltoets, app starten, OBS-scene wisselen, script draaien. De waarde:

1. Eén druk is een hele handeling, zonder sneltoetsen te onthouden.
2. Visuele knoppen (icoon, label, status) gegroepeerd in profielen per app of taak.
3. Snel en betrouwbaar, ook midden in een stream of montage.

Doelgroep begon bij streamers, is nu breder: videomontage, live-productie, fotobewerking en
algemene productiviteit. Elgato's eigen telefoon-app (Stream Deck Mobile) is precies dit
idee: gratis met 6 knoppen, Pro (tot 64 knoppen) voor $2,99/maand of $49,99 eenmalig.

Ons product: hetzelfde idee, open source, zonder abonnement, met een goede editor die op de
desktop én op de telefoon werkt en altijd in sync is. Extra: ontwikkelaarsgerichte acties
zoals een Claude- of Codex-skill starten met één druk.

Fasering van het doel: eerst eigen gebruik (testfase, Android + Mac), daarna open product.

## 2. Besluiten tot nu toe

| Onderwerp     | Besluit                                                                                                                          |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Verbinding    | Wi-Fi/lokaal netwerk primair (WebSocket), USB-tethering als kabel-alternatief, Bluetooth niet (zie 4)                            |
| Host-backend  | Go. Geen Encore voor de host (zie 6); Encore blijft optie voor latere cloud-diensten                                             |
| Desktop-shell | Wails v3.0.0 (Go + webview, native tray) met Angular-frontend; terugval naar v2 of headless als v3 tegenvalt                     |
| Frontend      | Angular 22, standalone components, signals, Tailwind v4 (conventies uit hvs-nx-monorepo)                                         |
| Mobiel        | Dezelfde Angular-app, responsive (telefoon en tablet), verpakt met Capacitor. Android eerst, iOS later met dezelfde code         |
| Editor        | Zowel op desktop als telefoon, één gedeelde Angular-editor-lib, host is bron van waarheid en pusht wijzigingen naar alle clients |
| Repo          | Nx-monorepo, pnpm, opzet afgekeken van hvs-nx-monorepo                                                                           |
| Licentie      | MIT                                                                                                                              |
| Toestellen    | Eén telefoon per desktop in fase 1                                                                                               |
| Distributie   | Mac buiten de App Store (genotariseerde DMG), Windows-installer                                                                  |

## 3. Referentieproducten (samenvatting)

| Product                                   | Verbinding                                           | Prijs                            | Wat we overnemen                                                        |
| ----------------------------------------- | ---------------------------------------------------- | -------------------------------- | ----------------------------------------------------------------------- |
| Elgato Stream Deck Mobile                 | Wi-Fi, USB (iOS)                                     | Gratis 6 knoppen, Pro abonnement | Profielen, folders, multi-actions, "Smart Profiles" per actieve app     |
| Touch Portal                              | Wi-Fi (netwerkscan + IP-fallback), USB (Win+Android) | Gratis 4x2, Pro eenmalig         | Pages, variabelen ("Values"), events                                    |
| Macro Deck 3 (open source, C#)            | Wi-Fi via QR-code, web-client/PWA + native apps      | Gratis, companion-app betaald    | Host serveert een web-client; gesigneerde plugin-store                  |
| Deckboard                                 | Wi-Fi (IP of QR)                                     | Pro $4,99                        | GIF-knoppen, eenvoud                                                    |
| OpenDeck (open source, Tauri/Rust/Svelte) | hardware                                             | Gratis                           | Draait Elgato-plugins via OpenAction; bewijs dat Go/Rust + web-UI werkt |
| Bitfocus Companion                        | hardware                                             | Gratis                           | Browser-editor                                                          |

Lessen: niemand gebruikt Bluetooth; de host voert altijd de acties uit en bezit de
configuratie; verwachte functies zijn profielen, pagina's, multi-actions, iconen/GIF's,
automatisch profiel wisselen, OBS. Ergernissen: runtime-afhankelijkheden (Java, .NET),
firewall-gedoe, abonnementen.

## 4. Verbinding

### Wi-Fi botst niet met internet

Telefoon en laptop hangen aan dezelfde router. Die router geeft beide internet én laat ze
elkaar lokaal bereiken. Er is dus geen conflict: de deck-verbinding is gewoon extra verkeer
op het netwerk dat je toch al gebruikt. Concurrenten werken allemaal zo.

Situaties waarin het wél misgaat, met oplossing:

| Situatie                                      | Probleem                                       | Oplossing                                                                                                                                                           |
| --------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Gast- of kantoor-Wi-Fi met "client isolation" | Toestellen zien elkaar niet                    | Telefoon-hotspot: laptop verbindt met de hotspot van de telefoon. Beide hebben dan internet via de telefoon en zitten op hetzelfde lokale netwerk. Of USB-tethering |
| Laptop op VPN                                 | Sommige VPN's blokkeren lokaal verkeer         | VPN "allow local network" aanzetten, of USB-tethering                                                                                                               |
| Laptop bekabeld, telefoon op Wi-Fi            | Werkt meestal; sommige routers scheiden VLAN's | IP/QR-fallback, anders hotspot                                                                                                                                      |
| mDNS geblokkeerd                              | Automatische ontdekking faalt                  | QR-code met IP, poort en pincode                                                                                                                                    |

### USB zonder extra drivers: USB-tethering

Android (zonder ontwikkelaarsopties) en iOS (Personal Hotspot via kabel) kunnen "USB-
tethering" aanzetten. De laptop krijgt dan een netwerkinterface via de kabel en de telefoon is
direct bereikbaar op dat subnet. Ons protocol verandert niet; alleen de ontdekking moet dat
subnet meenemen. Dit is de aanbevolen "kabel-modus" en vereist geen ADB en geen eigen
USB-code. ADB-reverse (Android) blijft een optie voor ontwikkelaars.

### Bluetooth: niet doen

Telefoon-als-Bluetooth-toetsenbord is onmogelijk op iOS (Apple blokkeert HID), en zou op Android
alleen toetsen kunnen sturen: geen apps starten, geen scripts, geen iconen terug. BLE als
datatransport heeft te weinig bandbreedte voor iconen, werkt op iOS alleen betrouwbaar met de
app op de voorgrond, en is gevoelig voor Wi-Fi-storing. Het protocol blijft transport-
onafhankelijk, dus BLE kan later als experiment, maar het staat niet op de roadmap.

## 5. Architectuur

```
+------------------------ Desktop host (Go, Wails v3) -----------------------+
|  Tray/menubalk-app, autostart                                              |
|  +-------------------+   +----------------------+   +--------------------+ |
|  | Angular UI        |<->| Core (Go)            |<->| Action runners     | |
|  | - editor          |   | - config store       |   | - keyboard/media   | |
|  | - deck-preview    |   |   (JSON op schijf)   |   |   (robotgo)        | |
|  | (via Wails-       |   | - actie-engine       |   | - app/url/file     | |
|  |  bindings)        |   | - pairing + auth     |   | - shell/terminal   | |
|  +-------------------+   | - WebSocket-server   |   | - http             | |
|                          | - mDNS-advertise     |   | - (later) OBS,     | |
|                          | - static server      |   |   plugins          | |
|                          |   (PWA-deck)         |   +--------------------+ |
|                          +-----------+----------+                          |
+--------------------------------------|-------------------------------------+
                                       | Deck Protocol (JSON over WebSocket, TLS optioneel)
                   mDNS _deck._tcp  +  QR (ip:poort:pincode)  +  USB-tethering-subnet
                                       |
+-------------------- Telefoon/tablet (Angular + Capacitor) ------------------+
|  Deck-weergave (raster, iconen, status, haptics, scherm aan)               |
|  Editor (zelfde lib als desktop)                                           |
|  Fallback: zelfde app als PWA, geserveerd door de host (geen installatie)  |
+----------------------------------------------------------------------------+
```

Kernprincipes:

- **Host is de bron van waarheid.** Configuratie, iconen en uitvoering leven op de desktop.
  Clients cachen layout en iconen op hash en zijn direct bruikbaar na verbinden.
- **Editor-sync.** Elke wijziging (desktop of telefoon) gaat als commando naar de host; de host
  past toe, verhoogt een versienummer en broadcast `configChanged` naar alle clients. Clients
  tonen de wijziging optimistisch en rollen terug bij afwijzing. Eén telefoon per host maakt
  conflicten zeldzaam; versienummer vangt de rest.
- **Transport-onafhankelijk protocol.** Berichten: `hello`, `auth`, `layout`, `asset`,
  `press`, `release`, `state`, `switchPage`, `configCommand`, `configChanged`.
  TypeScript-types in `libs/protocol`, Go-structs ernaast; één JSON-schema als contract.
- **Beveiliging.** De host voert willekeurige commando's uit, dus: pairing met pincode uit de
  QR-code, per toestel een token, alleen luisteren op lokale interfaces, optioneel TLS met
  self-signed certificaat (nodig voor PWA-features zoals Wake Lock in de browser).

Datamodel: `Profile` (hoofdcategorie, optioneel gekoppeld aan een app) → `Page` (raster
rijen x kolommen) → `Button` (positie, icoon, label, stijl, states) → `Action[]` (gesorteerd,
met delays). Iconen: upload PNG/JPG/GIF/SVG, Phosphor-iconenset (al in hvs gebruikt), emoji,
tekst, achtergrondkleur.

Platformvalkuilen (inplannen):

- macOS: toetsen simuleren vereist Accessibility-toestemming en een niet-gesandboxte app.
  Onboarding moet naar Systeeminstellingen leiden; "test toets"-knop in de UI.
- Windows: UIPI laat toetsen naar admin-vensters stilletjes vallen. Optie "host als
  administrator starten". Code signing tegen SmartScreen.
- Android: multicast-lock voor mDNS, batterij-optimalisatie uitzetten voor de app, scherm aan
  via keep-awake-plugin.
- iOS (later): Local Network-prompt pas bij eerste verbinding; `NSBonjourServices` en
  `NSLocalNetworkUsageDescription` verplicht.

## 6. Techniekkeuzes en onderbouwing

**Go in plaats van Rust.** Rust heeft met Tauri en enigo een iets rijper desktop-ecosysteem,
maar Go is hier volwaardig: Wails v3 is op 26 oktober 2026 stabiel uitgebracht (native tray,
menu's, meerdere vensters), robotgo (laatste release 7 oktober 2026) simuleert toetsen en
muis op Mac/Windows/Linux, en WebSocket/mDNS-bibliotheken zijn volwassen. Rust biedt geen
voordeel dat tegen de bestaande Go-kennis uit hvs opweegt.

**Geen Encore voor de host.** Encore is gebouwd voor cloud-API's: `encore run` start Postgres,
Pub/Sub en een dashboard, en deployment gaat via Docker-images. Een lokale tray-app die
toetsen indrukt past daar niet in. Plain Go met de standaardbibliotheek plus een paar packages
is kleiner en makkelijker te distribueren. Encore blijft een goede keuze als er later een
cloud-dienst komt (profielen delen, community-store, telemetry).

**Wails v3-risico.** Versie 3.0.0 is één dag oud. Terugvalopties zonder architectuurwijziging:
Wails v2 (stabiel, tray via `fyne.io/systray`), of de host headless draaien en de Angular-UI in
de browser openen. De Go-core en de Angular-apps veranderen daar niet door; alleen de shell.

**Angular op mobiel via Capacitor.** Capacitor pakt de Angular-build in een Android/iOS-app en
geeft toegang tot native functies via plugins: keep-awake, haptics, barcode-scanner (QR),
zeroconf (mDNS). Dezelfde build draait als PWA vanaf de host, handig voor een tweede toestel
of als nul-installatie-test.

Go-packages (voorlopig): `github.com/go-vgo/robotgo` (input), `nhooyr.io/websocket` of
`github.com/gorilla/websocket`, `github.com/grandcat/zeroconf` (mDNS), `github.com/skip2/go-qrcode`
(QR), `fyne.io/systray` (alleen bij Wails v2-fallback). Actieve-app-detectie voor Smart Profiles:
robotgo `ActiveName`/`ActivePid`.

## 7. Monorepo-opzet (afgekeken van hvs-nx-monorepo)

Overnemen uit hvs: Nx 24, Angular 22, pnpm (alleen), Node 24 via `.nvmrc`, `go.work` in de
root met `nx:run-commands`-targets per Go-project, Tailwind v4, Vitest, Playwright, ESLint-
flat-config, Prettier, Husky + lint-staged, commitlint (Conventional Commits, zonder Jira-
ticket), tags `type:`/`scope:`/`lang:go`, `AGENTS.md` per domein.

```
paneel/
  apps/
    host/            Go: core, WebSocket-server, action runners, Wails-main   [lang:go]
    desktop/         Angular-UI die in het Wails-venster draait (editor + preview)
    mobile/          Angular + Capacitor (deck + editor), responsive, Android eerst
    mobile-e2e/      Playwright tegen de PWA-variant
  libs/
    protocol/        Berichttypes en JSON-schema; Go-structs in apps/host/protocol
    deck-ui/         Rasterweergave, knopcomponent, iconen (gedeeld desktop/mobiel)
    editor/          Editor-flows: knoppen, acties, iconen, profielen (gedeeld)
    host-client/     WebSocket-client, reconnect, cache, sync-state (signals)
    ui/              Basiscomponenten, Tailwind-tokens (eventueel uit hvs geleend)
  tools/
    scripts/         build/sign/notarize, Capacitor-helpers
  go.work
  nx.json, package.json, pnpm-workspace.yaml, tsconfig.base.json
  AGENTS.md, CLAUDE.md, README.md, PLAN.md
```

Go in Nx: `apps/host/project.json` met targets `serve` (`wails3 dev`), `build` (`wails3 build`),
`test` (`go test ./...`), `lint` (`golangci-lint`), inputs op `goSources` zoals in hvs.

## 8. Functies per fase

### Fase 1: spike (bewijs dat het werkt)

- Go-host drukt op Mac een sneltoets in en start een app; Windows idem (VM of tweede machine).
- Angular-pagina op de Android-telefoon met één knop, via WebSocket, via mDNS gevonden.
- Latentie meten (doel onder 100 ms druk-tot-actie op hetzelfde Wi-Fi).
- Wails v3-venster met tray werkt op macOS.

### Fase 2: MVP (eigen gebruik)

- Datamodel en opslag op schijf; profielen, pagina's, knoppen, multi-actions met delays.
- Editor (desktop + telefoon, in sync): raster met drag & drop, icoon kiezen/uploaden,
  Phosphor-iconen, emoji, kleur, label; acties toevoegen en ordenen.
- Acties: sneltoets, tekst typen, app/URL/bestand openen, shell-commando, mediatoetsen,
  wachttijd, naar profiel/pagina, en de ontwikkelaarsactie (zie hieronder).
- Pairing (QR + pincode + token), reconnect, deck-cache, haptics, scherm aan.
- Tray-app, autostart, onboarding voor Accessibility (Mac) en firewall (Windows).
- Capacitor Android-build (sideload/APK), PWA-fallback.
- Installers: genotariseerde DMG, Windows-installer.

**Ontwikkelaarsactie "Run in terminal / AI-skill".** Drie varianten, instelbaar per knop:

1. Open de terminal-app (Terminal, iTerm2, Windows Terminal, kies in instellingen) in een
   werkmap en voer een commando uit, bijvoorbeeld `claude "/review"` of `codex "..."`.
   Je ziet het resultaat in de terminal zelf.
2. Typ tekst in het actieve venster (bijv. `/commit` + Enter in een al open Claude Code-sessie).
3. Headless uitvoeren (`claude -p "..."`) en de uitvoer als systeemmelding tonen of naar het
   klembord zetten.

### Fase 3: open product

- iOS-build met dezelfde Capacitor-code, TestFlight; Play Store-release.
- Variabelen op knoppen. (Smart pages, toggle-knoppen, Teams/Zoom/Meet-toetsen en
  Spotify/Apple Music-besturing zijn al in de MVP gebouwd, zie hoofdstuk 12.)
- OBS (obs-websocket), VLC als derde `appControl`-app, appstaat teruglezen voor toggle-lampjes
  (Spotify shuffle, Discord/Slack mute).
- Documentatie, README, contributie-richtlijnen, GitHub Actions (lint, test, build, release).

### Fase 4: ecosysteem

- Plugin-systeem; overwegen OpenAction-compatibiliteit zodat Elgato-plugins werken.
- Icon packs, import van `.streamDeckProfile`, sliders/draaiknoppen op het scherm.
- Meerdere toestellen per host; eventueel cloud-sync van profielen (Encore).

## 9. Risico's

- Wails v3 is gloednieuw; terugvalopties staan in 6.
- OS-rechten (Accessibility, UIPI, batterij-optimalisatie) frustreren gebruikers; investeer in
  onboarding en een "test verbinding / test toets"-knop.
- Windows-testen zonder Windows-machine: VM (UTM/Parallels) of GitHub Actions-runner inplannen.
- Scope: eerst de tien kernacties goed, dan OBS, dan plugins.

## 10. Besloten op 27 oktober 2026

1. Wails v3.0.0, met terugval naar v2 of headless + browser als het tegenvalt.
2. Licentie MIT.
3. Ontwikkelaarsactie: alle drie de varianten (terminal openen, tekst typen, headless met
   melding); terminal-app instelbaar (macOS standaard Terminal, iTerm2 optioneel; Windows
   Terminal). Variant 1 zit in de spike, 2 en 3 volgen in de MVP.
4. Merknaam `Paneel` (gekozen 27 oktober 2026 na concurrentie- en naamonderzoek; descriptor "Your phone as a control panel for your desk", tagline "The control panel that follows your focus"), slug `paneel`, bundle-id `app.paneel.host` (telefoonapp later `app.paneel.deck`), Go-module `github.com/paneel-nx/paneel/host`. De interne package-scope `@sd/*` en componentprefix `sd` blijven voorlopig staan; hernoemen is een aparte, mechanische stap.

## 11. Bronnen

- Elgato: https://www.corsair.com/newsroom/press-release/stream-deck-goes-free-elgato-announces-groundbreaking-changes-to-mobile-app ,
  https://help.elgato.com/hc/en-us/articles/360030677052 , https://www.scoringnotes.com/news/stream-deck-mobile-now-connects-via-usb/ ,
  https://docs.elgato.com/stream-deck/profiles/getting-started
- Touch Portal: https://www.touch-portal.com/blog/post/tutorials/connecting-touch-portal.php ,
  https://www.touch-portal.com/blog/post/2020-07-22/New_in_release_version_2_3.php
- Macro Deck: https://github.com/Macro-Deck-App/Macro-Deck ; Deckboard: https://apps.apple.com/us/app/deckboard-pro-macropad-for-pc/id1586383431 ;
  OpenDeck: https://github.com/nekename/OpenDeck ; Companion: https://github.com/bitfocus/companion/wiki/Module-Management
- Wails v3 stabiel: https://v3.wails.io/blog/wails-v3-released/ , https://v3.wails.io/changelog/ , tray: https://v3.wails.io/whats-new
- robotgo: https://pkg.go.dev/github.com/go-vgo/robotgo@v1.3.5 ; nx-go: https://npmjs.com/package/@nx-go/nx-go
- Encore self-host/local: https://encore.dev/docs/deploy/self-host , https://encore.dev/product/local-development
- Capacitor: keep-awake https://capgo.app/docs/plugins/keep-awake/getting-started , zeroconf https://capawesome.io/docs/sdks/capacitor/zeroconf/ ,
  https://www.npmjs.org/package/capacitor-zeroconf-lt
- USB-tethering/reverse tethering: https://medium.com/genymobile/gnirehtet-reverse-tethering-android-2afacdbdaec7
- iOS en Bluetooth HID: https://developer.apple.com/forums/thread/725238 ; BLE achtergrond: https://developer.apple.com/forums/thread/837516 ;
  BLE onder Wi-Fi-storing: https://netd.cs.tu-dresden.de/pub/pcthb-blert-22.html
- macOS Accessibility/CGEvent: https://developer.apple.com/forums/thread/820594 ; Windows UIPI:
  https://codenote.net/en/posts/windows-admin-elevation-blocks-chatgpt-computer-use-uipi/
- iOS Local Network: https://mas.owasp.org/MASTG/knowledge/ios/MASVS-PLATFORM/MASTG-KNOW-0128/

## 12. Voortgang

### Fase 1: spike (gestart 27 oktober 2026)

Gedaan:

- Nx-workspace (Nx 24, Angular 22, pnpm 11, Node 24, Vitest, ESLint, Prettier), tooling
  overgenomen van hvs-nx-monorepo, `go.work` en Go-targets via `nx:run-commands`.
- Go-host: protocol, JSON-config met voorbeeldprofiel, action-runner (hotkey, tekst, app,
  URL, shell, terminal, delay) met platformbestanden voor macOS/Windows/Linux, WebSocket-
  server met token-check en SPA-serving, mDNS-advertentie, QR-code (PNG en terminal).
  Twee entrypoints: `cmd/hostd` (headless) en `main.go` (Wails met tray en venster).
- Angular: `@sd/protocol` (types), `@sd/host-client` (WebSocket-client met reconnect en
  signals), `@sd/deck-ui` (raster), `apps/mobile` (deck-client met pairing, wake lock,
  haptics), `apps/desktop` (QR en status via Wails-bindings).
- Builds van desktop en mobile landen in de embed-mappen van de host; Wails-binary compileert.
- Tests: Go (runner, server over echte WebSocket), Vitest (client, raster, apps); lint schoon.
- Rooktest headless: welcome/layout/pong, foutmelding bij onbekende knop, 401 bij fout token.

- 27 oktober 2026: handmatige test vanaf de Android-telefoon geslaagd voor app starten
  (Calculator) en de terminal-actie (Claude). Bugfix onderweg: `crypto.randomUUID` bestaat
  niet over plain http op een LAN-IP, waardoor de client eerst een leeg scherm gaf.

- 27 oktober 2026: Copy/Paste werkt na de Accessibility-prompt. Latentie in de deck-client
  gemiddeld rond 100 ms (de meting omvat ook de uitvoering van de actie, omdat de ack pas
  na afloop wordt gestuurd); niet storend in gebruik. Spike afgerond.

Verschoven naar de MVP:

- Wails-venster en tray live testen (`pnpm nx serve host`).
- Windows-build (VM of GitHub Actions).

### Fase 2: MVP (gestart 27 oktober 2026)

Ontwerp: docs/architecture/data-model-and-sync.md. Gedaan:

- Go: nieuw model (profiel = geordende lijst knoppen, mappen), migratie van het spike-bestand,
  commando's met validatie en revisie, atomair opslaan, `changed`/`sync`/`config`-berichten,
  assets-opslag op hash met upload- en download-endpoint, icoonpijplijn (app-icoon macOS via
  AppKit, favicon, automatisch icoon bij app- en URL-acties), media-actie. Tests en lint schoon.
- TypeScript: protocol-types, pure reducer voor commando's, host-client met optimistisch
  toepassen en resync, netwerk- en uitvoeringstijd apart.
- Deck: layout-algoritme (vierkante knoppen, aantal op basis van viewport), sets met
  horizontale swipe en indicatorbolletjes, verticale swipe voor profielen, mappen met terug-knop,
  knoprendering met asset/Phosphor/emoji/initiaal en automatisch contrast.
- Editor (`libs/editor`, gedeeld door desktop en telefoon): hamburgermenu, bewerkmodus met
  knop-editor (label, kleur, acties, verplaatsen, verwijderen, mappen), icoonkiezer
  (App, Website, Phosphor, Emoji, Upload), catalogus met standaardknoppen per platform,
  pagina's (profielen aanmaken, hernoemen, icoon, volgorde, verwijderen) en instellingen
  (terminal-app, verbinding). Desktop-UI is nu zelf een deck-client over loopback.

- Logo-tab met Simple Icons (host haalt de SVG op en slaat hem op als asset), slepen om te
  rangschikken (lang indrukken op de telefoon, direct met de muis), poort wijzigen en token
  roteren vanuit instellingen met automatische herverbinding.
- Thema's (gesynchroniseerd via `settings.theme`): Midnight, Magenta, Paper, Neon, Hardware,
  Graphite, Daylight, Espresso, Moss, Arctic, gegroepeerd in de kiezer; alle kleuren via
  `--sd-*` tokens.
- App-kiezer met de geïnstalleerde apps van de host (`/api/apps`) in de knop-editor en de
  icoonkiezer.
- Eigen thema's en paletten maken, bewerken en verwijderen (sectie Custom onder aan beide
  kiezers), opgeslagen in de settings van de host.
- Kleurenpalet per pagina (`Profile.palette`, 15 paletten): standaardkleur voor nieuwe knoppen,
  swatches, tint en herkleuren van bestaande knoppen.

- Smart pages: pagina volgt automatisch de app met focus (`appMatch` via de app-kiezer, of de
  apps die de knoppen van de pagina openen; instelbaar in Settings, waar ook de gefocuste app
  staat).
- Catalogus uitgebreid: schermopname, venster- en IDE-sneltoetsen, meer Claude-, git- en
  Nx-opdrachten, meeting-toetsen (Zoom, Teams, Meet), nuttige websites, groep "Your apps" uit de
  geïnstalleerde apps, zoekbalk.
- Welkomstscherm zonder pagina's (alle pagina's mogen weg) met voorbeelden, uitleg en ingangen.
- Preset-pagina's met aanbeveling op basis van geïnstalleerde apps en zoekbalk; "Start clean"
  en "Reload this deck" in Settings; 24 ingebouwde paletten.
- Toggle-knoppen met een tweede staat (label, kleur, icoon, eigen acties) en lampje; de host
  houdt de staat bij en deelt hem met alle decks.

- Builds: `pnpm nx build host` en `pnpm nx package host` leveren `apps/host/bin/paneel.app`
  met de juiste bundle-id, naam en versie (build-assets gegenereerd uit `build/config.yml`). Het
  Wails-venster is gestart met een aparte config (`HOME`-override): embedded host start, venster
  opent en de desktop-UI verbindt als client over loopback (gecontroleerd via de log; een
  schermopname is vanuit de terminal niet mogelijk zonder Screen Recording-toestemming).
- E2E-suite `apps/deck-e2e` in Gherkin (playwright-bdd, opzet overgenomen van hvs-nx-monorepo:
  `tools/playwright-config`, `bddgen`-target, feature-files met tags, stappen per onderwerp) tegen
  een echte headless host op poort 48240 met eigen configmap. 43 scenario's over verbinding, deck,
  catalogus, editor, pagina's, paletten, thema's, instellingen, smart pages, welkomstscherm en
  iconen. Tags: `@smoke`, `@mac`/`@windows`/`@linux` (draaien alleen op dat platform), `@manual`
  (nooit automatisch), `@internet`, `@allow-console-errors`. Console-fouten laten een scenario
  falen. `pnpm nx e2e deck-e2e`.
- CI-workflow `.github/workflows/ci.yml`: frontend-checks op Ubuntu, host-build en -package op
  macOS, host-build op Windows (nog niet gedraaid), e2e op macOS.

- Tailwind 4 ingericht zoals in hvs (PostCSS-plugin, `@source` per lib, `@theme inline` op de
  `--sd-*` tokens, gedeelde `sd-*` utilities) en alle editor- en app-stylesheets omgezet naar
  `@apply` onder de bestaande semantische klassen. Daarna volledig: tokens en Tailwind-entry in
  een eigen lib `libs/styles`, `deck-ui` ook via `@apply` (alleen `cqw`-maten en knoptokens blijven
  CSS), restdeclaraties als utilities (`sd-heading`, `sd-glass-blur`, `sd-grid-fill-*`,
  `sd-select`), basisregels in `@layer base`. Pixelgelijk gecontroleerd met 34
  schermafbeeldingen per stap.
- Try-knop in de editor, toetsen die herhalen bij vasthouden, meldingen bij stille acties en
  back-up/herstel van de hele config met iconen.
- App-knoppen (menu-item "App buttons"): kant-en-klare knoppen per app (Spotify, Apple Music op
  macOS, Zoom, Teams, Meet), geïnstalleerde apps bovenaan, zoeken, "Add all". Nieuwe actie
  `appControl` (shuffle, repeat, play/pause, next, previous) die de app scriptet in plaats van
  toetsen te sturen: AppleScript op macOS, MPRIS over D-Bus op Linux, op Windows terugval op
  app activeren plus de sneltoets van Spotify. Hotkey-acties kregen een optioneel doel-app-veld;
  de host brengt die app eerst naar voren en wacht tot hij de focus heeft. De groep Meetings in
  de standaardcatalogus en het Music-paginapreset hergebruiken deze app-knoppen.
- App-knoppen uitgebreid met Discord (mute, deafen), Claude (desktop-app, Claude Code in de
  terminal met Remote Control, continue, mcp en doctor, en slash-commando's die in de sessie met
  focus worden getypt), VS Code (de IDE-groep met doel-app) en Slack (huddle mute, switcher,
  zoeken, alles gelezen).
- Nog elf apps: Cursor (VS Code-set plus AI chat, composer, inline edit), JetBrains-IDE's,
  GitHub Desktop, Notion, Obsidian, Outlook, Figma, Photoshop, Lightroom Classic, DaVinci
  Resolve en YouTube (browsertab). Apps waarvan de naam per versie verschilt (Adobe, Resolve,
  JetBrains) hebben geen doel-app; hun knoppen werken met de app vooraan. Filter "Installed
  only" boven de applijst, onthouden per browser.
- Dry-run voor tests: `hostd -record-actions <bestand>` valideert acties en schrijft ze als
  JSON-regels weg in plaats van ze uit te voeren. De e2e-suite draait zo en controleert per druk
  welke actie, welk script en welke doel-app de host zou gebruiken, zonder dat er op de
  ontwikkelmachine iets gebeurt.
- Vast raster per scherm in plaats van krimpende knoppen: het aantal kolommen volgt de breedte bij
  een streefmaat per schermklasse (112 px onder een kortste zijde van 600 px, 144 px tot 900 px,
  daarboven 176 px; minimaal 72 px, ruim boven de WCAG-doelgroottes, maximaal 200 px), de rijen
  volgen de hoogte, en de knoppen rekken uit tot de breedte. Telefoon 3 x 5, tablet 5 x 6,
  desktopvenster 8 x 4; grotere schermen krijgen grotere knoppen in plaats van meer. Een pagina
  met meer knoppen bladert naar een volgende set en knoppen houden hun maat en plek.
- Opruimronde over alle projecten, met lint, unit-tests en de volledige e2e-suite tussen elke
  stap (steeds 73 scenario's groen). Doel: leesbaar voor juniors, helpers in eigen bestanden,
  beschrijvende namen, obsolete code weg. Per project:
    - e2e: stapbestanden volgen de featurenamen, een getypeerde `HostApi` (`host-api.ts`) en
      gedeelde `helpers.ts`; twee ongebruikte stappen en de ongebruikte `restore` weg.
    - Go-host, naar de hvs-conventies (zie geheugen): `server` opgesplitst in routes, middleware,
      websocket, press, commands, deck_build en `handler_<area>.go`; `store` in commands, validate,
      patch en button_tree met een generieke `cloneJSON`; `actions` met gedeelde `shell`, `pause`,
      quoting en `terminal_<os>.go`; `assistant` met `validate.go`; `host` met kleinere `Start`,
      `pairing.go` en zonder de ongebruikte `Options.Logger`; `logs` in vier bestanden;
      `config/file.go` en `assets` delen `atomicfile.Write`; `icons` met een `get`-helper.
    - `protocol`: `models`, `messages`, `logs-api` en `assistant-api`; reducer met `insertAt` en
      `mergePatch`; het ongebruikte `release`-bericht is uit TypeScript, Go accepteert het nog.
    - `host-client`: `pairing-url`, `random-id`, `host-api`, `pending-commands` en `config-sync`
      naast een kleinere client; `host`-signaal heet `hostInfo`, `lastAck` weg.
    - `deck-ui`: virtuele knoppen, mapnavigatie, gebaren en `observeSize` in eigen bestanden;
      `contrastColor` in `color/`; `states` heet `buttonStates`.
    - `editor`: map `shared/` (platform, installed-apps, app-match, error-message,
      browser-storage, scroll-to-bottom, icons, group-by, clipboard); de shell gebruikt
      `page-builders.ts`, `toast.ts` en `document-theme.ts`; presets als tabellen; `index.ts`
      exporteert alleen `Shell`; overal `ngOnInit` in plaats van `queueMicrotask`.
    - `mobile`, `desktop`, `styles`: benoemde effects en `pairing-storage.ts`, een eigen
      `sd-assistant-key-form`, gedeelde `sd-btn`-basis; schermafbeeldingen voor en na pixelgelijk.
- Go-module hernoemd van `github.com/newstory/paneel/host` naar `github.com/paneel-nx/paneel/host`;
  bindings opnieuw gegenereerd.
- Repo op github.com/rickvandermey/paneel (28 oktober 2026); de CI-workflow draait groen op alle
  vier de jobs. Daarvoor nodig: de host-targets bouwen eerst de ingebedde frontends, golangci-lint
  wordt in CI geinstalleerd, de Wails-bindings zijn gecommit, de Windows-build gebruikt cgo en
  twee tests die op POSIX-bestandsrechten leunden slaan dat op Windows over.
- Android-app via Capacitor 8 (`apps/mobile/android`, gecommit): dezelfde deckbuild als de host
  serveert, app-id `app.paneel.deck`, minimaal Android 8.0. In de app: QR-scannen op het
  pairingscherm (`@capacitor/barcode-scanner`), scherm-aan via keep-awake, geen herladen bij een
  nieuwe deckbuild. De app draait op het http-schema (cleartext aan) omdat de host geen TLS
  heeft; op https blokkeerde de WebView de iconen van de host als mixed content.
  Nx-targets `sync-android`, `run-android` en `build-apk`; de debug-APK bouwt lokaal (40 MB).
  Webmanifest met iconen voor "Add to Home Screen"; een echte PWA met service worker vraagt
  HTTPS en blijft liggen. Platformverschillen zitten in `apps/mobile/src/app/device.ts`.
  Op de telefoon getest: pairen, knoppen en scherm-aan werken; het mixed-content-probleem met
  app-iconen is in de emulator gereproduceerd en verholpen.

### Vervolgstappen (volgorde, bijgewerkt 28 oktober 2026)

De MVP is functioneel compleet voor macOS plus het webdeck. Wat ontbreekt zit in "op een echt
toestel" en "op een ander OS"; dat bepaalt de volgorde. Na elke stap: lint, tests en de e2e-suite,
en een commit per stap.

1. **Android-app op de telefoon testen.** De APK bouwt (`pnpm nx build-apk mobile`); installeren
   via `adb install` of het bestand, pairen door de QR te scannen, knoppen drukken, scherm-aan en
   de reconnect na een poortwissel controleren. Daarna dagelijks gebruiken; wat opvalt komt op
   deze lijst. Release-signing voor de Play Store en een echte PWA (vraagt TLS) komen later.
2. **Tray, venster en onboarding op macOS.** Het Wails-venster en het tray-menu met de hand
   nalopen (openen, sluiten, afsluiten, weer openen). Een uitlegscherm bij de
   Accessibility-prompt; de host kent de status al (`activeapp.Trusted`), er is alleen geen
   scherm voor. Autostart bij aanmelden.
3. **Windows en Linux echt draaien.** De Windows-host compileert en de Go-tests slagen in CI,
   maar app-iconen, apps-lijst, actieve app, launch, terminal, app activeren en de
   `appControl`-terugval zijn nog nooit op een Windows-machine uitgevoerd. Dat vraagt een VM of
   een tweede machine, plus een firewall-uitleg bij de eerste start. Linux: een CI-job
   toevoegen (xdg-open, notify-send, MPRIS compileren alleen) en daarna hetzelfde op een
   echte machine.
4. **Installers.** De Wails-Taskfile heeft een `package:dmg`-taak; notarisatie en een
   Windows-installer zijn niet ingericht en CI levert alleen `.app` en `.exe` als artifact.
   Pas nodig zodra iemand anders het installeert.
5. **Kleinere MVP-restpunten**, in willekeurige volgorde:
    - knoppen verplaatsen tussen pagina's en mappen (slepen werkt alleen binnen een pagina);
    - pairing met pincode naast QR en token;
    - het e2e-scenario "token roteren" automatiseren (vraagt een herverbinding in de test);
    - de sneltoetsen van de elf laatste app-presets tegen de echte apps controleren; op
      Windows kan Spotify-shuffle alleen togglen via de sneltoets, niet expliciet aan of uit.

Daarna fase 3: appstaat teruglezen voor toggle-lampjes (Spotify shuffle, Discord en Slack
mute), OBS via obs-websocket, VLC als derde `appControl`-app, variabelen op knoppen, iOS via
dezelfde Capacitor-code, en documentatie voor bijdragers. Het hernoemen van `@sd/*` en de
`sd`-prefix naar de merknaam blijft een losse mechanische stap die niets oplevert voor eigen
gebruik; de e2e-suite leunt op de `sd-*`-selectors.
