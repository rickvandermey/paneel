# Datamodel, sync en iconen

Status: in uitvoering, 27 oktober 2026. Geldt voor de MVP (fase 2 in PLAN.md). Afwijkingen van
het oorspronkelijke voorstel staan onder "Besluiten tijdens de bouw".

## In het kort

De host bezit één configuratie: profielen met een geordende lijst knoppen. Clients (desktop-UI
en telefoon) sturen commando's; de host past ze toe, verhoogt een versienummer en stuurt de
wijziging naar iedereen. De telefoon bepaalt zelf hoeveel vierkante knoppen er passen en
verdeelt de lijst in sets waar je tussen swipet. Iconen zijn bestanden met een hash; de host
haalt ze op (app-icoon, favicon, logo, iconenset, upload) en de client cachet ze.

## Model

```ts
interface Config {
	schemaVersion: 1;
	revision: number; // stijgt bij elk toegepast commando
	token: string;
	port: number;
	settings: { terminal: string };
	profiles: Profile[]; // volgorde = volgorde in de UI
}

interface Profile {
	id: string;
	name: string;
	icon?: IconRef;
	appMatch?: string; // later: automatisch wisselen op actieve app (bundle-id of exe)
	buttons: Button[]; // geordende lijst, geen vaste posities
}

interface Button {
	id: string;
	label?: string;
	showLabel: boolean;
	color: string; // achtergrond, hex
	icon?: IconRef;
	actions: Action[]; // uitgevoerd in volgorde
	folder?: Button[]; // een knop kan een map zijn: opent een sub-lijst op de telefoon
}

type IconRef =
	| { source: 'asset'; hash: string } // opgehaald of geupload bestand (PNG/SVG/GIF)
	| { source: 'phosphor'; name: string; weight?: 'regular' | 'bold' | 'fill' | 'duotone' }
	| { source: 'simple-icons'; slug: string } // merklogo's, kleur komt uit de set
	| { source: 'emoji'; value: string };

type Action =
	| { kind: 'hotkey'; key: string; modifiers: Modifier[] }
	| { kind: 'text'; text: string }
	| { kind: 'launch'; target: string } // pad of app-naam; levert app-icoon
	| { kind: 'url'; url: string } // levert favicon
	| { kind: 'shell'; command: string; workDir?: string }
	| {
			kind: 'terminal';
			command: string;
			prompt?: string;
			workDir?: string;
			window?: 'reuse' | 'new';
	  }
	| { kind: 'delay'; millis: number }
	| {
			kind: 'media';
			control: 'playPause' | 'next' | 'previous' | 'volumeUp' | 'volumeDown' | 'mute';
	  }
	| { kind: 'switchProfile'; profileId: string };
```

Besluiten:

- Geen `Page` en geen `row`/`column` meer: een profiel is een lijst, sets ontstaan op het
  toestel. Mappen (`folder`) vervangen de sub-pagina's van Elgato.
- `revision` is één getal voor de hele config. Simpel en voldoende bij één telefoon per host.
- Het bestand blijft JSON in de gebruikersconfigmap, atomair geschreven (tijdelijk bestand +
  rename). `schemaVersion` maakt migraties later mogelijk.

## Commando's en sync

Clients sturen commando's, nooit de hele config:

```ts
type Command =
	| { type: 'profile.create'; profile: Omit<Profile, 'buttons'> }
	| { type: 'profile.update'; id: string; patch: Partial<Profile> }
	| { type: 'profile.delete'; id: string }
	| { type: 'profile.move'; id: string; index: number }
	| { type: 'button.create'; profileId: string; index: number; button: Button; parentId?: string }
	| { type: 'button.update'; id: string; patch: Partial<Button> }
	| { type: 'button.delete'; id: string }
	| { type: 'button.move'; id: string; profileId: string; index: number; parentId?: string }
	| { type: 'settings.update'; patch: Partial<Settings> };
```

Protocolberichten (uitbreiding op de spike):

| Richting            | Bericht         | Inhoud                                                                         |
| ------------------- | --------------- | ------------------------------------------------------------------------------ |
| client → host       | `command`       | `{ commandId, baseRevision, command }`                                         |
| host → client       | `commandResult` | `{ commandId, ok, revision, error? }`                                          |
| host → alle clients | `changed`       | `{ revision, command }` (dezelfde command, al toegepast)                       |
| client → host       | `sync`          | `{ sinceRevision }`                                                            |
| host → client       | `config`        | volledige config bij verbinden, na `sync`, of als de client te ver achterloopt |

Regels:

- De host valideert en past toe onder een lock, schrijft op schijf, verhoogt `revision`, en
  broadcast `changed`. Volgorde van toepassen is de volgorde van ontvangst.
- Een client past een eigen commando optimistisch toe en draait terug bij `ok: false`.
- Een client die een `changed` krijgt met `revision` ≠ eigen revision + 1 stuurt `sync` en
  krijgt de hele config. Geen merge-logica nodig.
- Knoppen indrukken blijft `press` zoals in de spike; de ack krijgt een extra veld
  `executionMs` zodat netwerk- en uitvoeringstijd apart zichtbaar zijn.

## Iconen

Alle iconen van buiten worden door de host opgehaald en als bestand opgeslagen in
`<config>/assets/<sha256>.<ext>`. Het model verwijst alleen naar de hash. De client haalt
`GET /assets/<hash>` op, met lange cache-headers, en bewaart het in de browsercache of
(Capacitor) op schijf.

| Bron              | Hoe                                                                                                                                                                                                   | Wanneer                                                        |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| App-icoon macOS   | AppKit `NSWorkspace.iconForFile` via cgo (werkt ook voor apps met iconen in `Assets.car`); app gezocht in /Applications, /System/Applications, ~/Applications en via `mdfind`                         | automatisch bij `launch`-actie, of via "Kies app" in de editor |
| App-icoon Windows | PowerShell + System.Drawing `ExtractAssociatedIcon` → PNG (ongetest tot er een Windows-machine is)                                                                                                    | idem                                                           |
| Favicon           | host haalt de pagina op, leest `<link rel="icon">` en `apple-touch-icon`, anders `/favicon.ico`; grootste variant wint; fallback letter op kleur                                                      | automatisch bij `url`-actie                                    |
| Simple Icons      | npm-package `simple-icons` alleen in de editor (lazy geladen) voor zoeken; bij kiezen wordt de SVG als asset naar de host gestuurd en de merkkleur als knopkleur gezet. Het deck kent de set dus niet | gebruiker kiest "Logo"                                         |
| Phosphor          | `@phosphor-icons/core` SVG's in de client; naam in het model                                                                                                                                          | gebruiker kiest "Icoon"                                        |
| Upload            | editor stuurt het bestand naar `POST /assets`, host hasht en slaat op                                                                                                                                 | gebruiker kiest "Eigen afbeelding"                             |
| Emoji             | tekst in het model                                                                                                                                                                                    | gebruiker kiest "Emoji"                                        |

Rendering van een knop: vierkant, afgeronde hoeken, `color` als achtergrond, icoon
gecentreerd op ongeveer 55% van de breedte, optioneel label eronder. Simple Icons en Phosphor
krijgen automatisch wit of zwart op basis van het contrast met `color`.

## Layout op de telefoon

- Knopgrootte: zo groot mogelijk met minimaal 72 px en maximaal 160 px, 1:1, vaste gutter.
- `columns = floor(breedte / (knop + gutter))`, `rows = floor(hoogte / (knop + gutter))`,
  waarna de knopgrootte wordt opgerekt tot het raster de ruimte vult.
- `setSize = rows × columns`; de lijst wordt in sets gehakt. Horizontaal swipen = volgende
  set, verticaal swipen = volgend profiel. Een map opent als een nieuwe lijst met een
  terug-knop op de eerste positie.
- Geen scrollen; swipen gaat per set met een snap, zoals een carousel. Indicatorbolletjes
  onderaan tonen set en aantal.
- Draaien van het toestel herberekent het raster; de huidige set wordt opnieuw bepaald op
  basis van de eerste zichtbare knop.

## Editor (desktop en telefoon, zelfde lib)

Zelfde Angular-lib in beide apps, responsive:

1. Knop bewerken: label, kleur (palet + vrij), icoonkiezer met tabbladen App / Website / Logo /
   Icoon / Emoji / Upload, actielijst met toevoegen, volgorde, verwijderen.
2. Rangschikken: slepen in de lijst (desktop: drag & drop, telefoon: lang indrukken en slepen).
3. Profielen: aanmaken, hernoemen, volgorde, icoon.
4. Instellingen: terminal-app, poort, token opnieuw genereren.

## Bouwvolgorde

1. Go: nieuw model, migratie van het spike-bestand, commando's, revisie, atomair opslaan,
   `changed`/`sync`/`config`-berichten, assets-endpoint. Tests per commando.
2. TypeScript: protocol-types, `host-client` met commando's, optimistisch toepassen, resync.
3. Deck: layout-algoritme, sets met swipe, mappen, nieuwe knoprendering met icoonbronnen.
4. Icoonpijplijn in Go: app-icoon macOS, favicon, upload. Windows-app-icoon zodra er een
   Windows-testmachine is.
5. Editor: knop bewerken en icoonkiezer, daarna rangschikken, profielen, instellingen.

## Invarianten

- De host is de enige die de config muteert; clients sturen commando's.
- Het model bevat geen toestel-specifieke layout; sets zijn afgeleid.
- Een `IconRef` naar een asset verwijst altijd naar een bestand dat op de host bestaat.
- `revision` stijgt strikt met één per toegepast commando.

## Besluiten tijdens de bouw

- `changed` draagt een optioneel `commandId`, zodat de client zijn eigen, al optimistisch
  toegepaste commando herkent en niet dubbel toepast.
- Bij een afgewezen commando of een gemiste revisie vraagt de client de hele config op (`sync`).
  Dat is de terugrol; er is geen lokale undo-stack nodig.
- Quick Look (`qlmanage`) is afgevallen voor app-iconen: het hangt zonder GUI-sessie. AppKit via
  cgo is betrouwbaar en snel (circa 0,5 s voor het eerste icoon).
- De ack van een druk bevat `executionMs`; de client toont netwerktijd en uitvoeringstijd apart.
- Simple Icons worden bij het kiezen omgezet naar een asset (zie tabel), zodat het deck geen
  3000 logo's hoeft te laden.
- `switchProfile` is een client-side actie: de host voert niets uit, de telefoon wisselt van profiel.
- `folder` wordt altijd geserialiseerd (`null` voor gewone knoppen, `[]` voor een lege map). Met
  `omitempty` verloor een lege map zijn map-status na een rondreis door de host.
- De editor zit in één lib (`@sd/editor`, component `sd-shell`) die desktop en telefoon allebei
  tonen. De desktop-UI is daarmee zelf een deck-client over loopback; de host stuurt CORS-headers
  zodat de Wails-webview (en later Capacitor) de API mag aanroepen. Het token blijft de poort.
- Hamburgermenu met: knoppen bewerken, standaardknoppen (catalogus per platform met de groepen
  Media, System, Window, Editing, Browser, IDE, Coding, Meetings, Apps, Websites en "Your apps"
  uit de geïnstalleerde apps van de host; de groep Apps toont alleen wat geïnstalleerd is; met
  zoekbalk), pagina's (profielen) en instellingen.
  Profielen staan ook als chips in de balk en zijn verticaal te swipen.
- Rangschikken: slepen in de bewerkmodus (muis direct, aanraking na lang indrukken; aan de rand
  van het deck wisselt de set) plus pijltjes in de knop-editor. Beide sturen `button.move`.
- Logo-tab: de lijst met Simple Icons-namen (titel, slug, merkkleur) wordt gegenereerd met
  `node tools/scripts/generate-simple-icons-names.mjs` en lui geladen. Bij het kiezen haalt de host
  de SVG van cdn.simpleicons.org in wit of zwart (contrast met de knopkleur) en slaat hem op als
  asset. Zonder internet op de host faalt dit met een melding.
- Poort en token: `POST /api/network` (`{port, rotateToken}`) slaat de wijziging op, antwoordt met
  poort en token, en de host sluit kort daarna alle verbindingen; bij een andere poort start de
  listener en mDNS opnieuw. De vragende client bouwt de nieuwe koppel-URL en verbindt opnieuw; de
  web-deck navigeert mee naar de nieuwe poort omdat hij door de host wordt geserveerd.
- Styling: Tailwind 4 met de tokens uit `libs/styles/src/themes.css` als `@theme inline`, zodat
  utilities naar runtime-variabelen verwijzen en themawissels blijven werken. Componentstijlen
  gebruiken `@reference` plus `@apply` onder semantische klassen; alleen container-query-eenheden,
  de knoptokens per thema en `color-mix` blijven gewone CSS.
- Thema's: `settings.theme` wordt gesynchroniseerd, zodat telefoon en desktop hetzelfde tonen.
  Alle componenten gebruiken alleen `--sd-*` tokens uit `libs/styles/src/themes.css`;
  een thema definieert die tokens opnieuw onder `[data-theme=...]`. Tien thema's: Midnight
  (standaard), Magenta (geïnspireerd op de huisstijl van New Story: pruim, magenta pillen, aqua,
  zware letters), Paper (licht, warm), Neon (zwart met gloed), Hardware (bevel en monospace),
  Graphite (neutraal donkergrijs), Daylight (licht, koel), Espresso (bruin-zwart met koper), Moss
  (groen-zwart met salie), Arctic (blauwgrijs met frost). De kiezer groepeert ze: Dark, Tinted,
  Expressive, Light. De Expressive-thema's (Neon, Magenta) zijn glass-thema's: gradiënt achter alles
  (`--sd-bg-image`), doorschijnende panelen met blur (`--sd-surface-blur`, `--sd-surface-border`) en
  deels doorzichtige knoppen (`--sd-key-mix`, `--sd-key-blur`). Elk thema heeft een eigen
  knopafronding (`--sd-key-radius`, van 8% bij Hardware tot 42% bij Magenta) zodat de vorm het
  thema mee uitdraagt. Paletten zijn gegroepeerd op tint (Neutral, Warm, Purple, Cool, Mixed) en
  een test bewaakt dat geen kleurwaarde in twee paletten voorkomt.
- De terminal-instelling wordt bij elke druk gelezen, zodat een wijziging direct geldt.
- `GET /api/apps` geeft de geïnstalleerde apps (macOS: `.app`-bundels in de Applications-mappen,
  Windows: snelkoppelingen in het Startmenu, Linux: `.desktop`-bestanden), 60 s gecachet. De
  app-kiezer in de knop-editor en de icoonkiezer gebruikt die lijst; `target` is de naam die
  `open -a` verwacht, op Windows het pad van de snelkoppeling.
- Het thema wordt ook lokaal gecachet (`sd.theme`) voor de eerste tekening; de host blijft de bron.
- Eigen thema's en paletten staan in `settings.customThemes` en `settings.customPalettes`
  (gesynchroniseerd; de client stuurt bij een wijziging de volledige lijst). Een eigen thema slaat
  maar een handvol waarden op (achtergrond, panelen, tekst, accent, optionele gloed, knopafronding,
  knopdekking, blur) plus een basisthema; `customThemeVars` leidt daar alle tokens uit af en zet ze
  als inline variabelen op `<html>` met het basisthema als `data-theme`. Een eigen palet is naam,
  kleuren en een tintkleur. Verwijderen valt terug op Midnight respectievelijk "None".
- Rasteralgoritme: `computeGrid(width, height, count)` zoekt de grootste vierkante knopmaat
  (maximaal 240 px) waarbij alle knoppen van de lijst in één set passen; past dat zelfs op het
  minimum (72 px) niet, dan verdeelt het deck ze over sets. De knoppen rekken altijd tot de
  volle breedte. Zes knoppen op een telefoon worden zo ongeveer 190 px, een volle pagina krimpt.
- Het deck bewaart de open map en de actieve set bij configwijzigingen: de `linkedSignal`s in
  `Deck` herberekenen bij elk nieuw profielobject en houden daarom de vorige waarde zolang het
  profiel-id gelijk blijft (gevonden door de e2e-suite).
- Knop-editor "Try it on your computer now" stuurt de conceptacties als `run`; niets wordt
  opgeslagen.
- `Button.repeat`: het deck herhaalt de druk zolang de toets ingedrukt blijft (na 400 ms, elke
  120 ms, met pointer capture); de host ziet gewone `press`-berichten. Volume en helderheid in de
  catalogus staan standaard op herhalen; toggles herhalen nooit.
- Stille acties (`shell`) vangen de uitvoer en tonen bij afloop een desktopmelding (macOS
  `display notification`, Windows tray-balloon via PowerShell, Linux `notify-send`) met de laatste
  regel uitvoer of de fout; `Action.silent` zet dat uit. De melder is vervangbaar in tests.
- Back-up: `GET /api/backup` levert een zip met `config.json` (zonder token en poort) en alle
  assets; `POST /api/restore` leest zo'n zip, schrijft ontbrekende assets terug (op hash, dus nooit
  overschrijven) en vervangt pagina's en instellingen met behoud van token en poort. In Settings
  als "Download backup" en "Restore from backup".
- `hostd` kent `-port` (overschrijft en bewaart de poort) en `-config-dir` (andere configmap), zodat
  tests en een tweede host de eigen config nooit raken.
- Smart pages: de host peilt elke seconde de app met focus (macOS via de Accessibility-API
  `kAXFocusedApplicationAttribute`, met de vensterlijst als terugval zonder toestemming;
  `NSWorkspace.frontmostApplication` bleek in een headless proces zonder run loop niet bij te
  werken. Windows via `GetForegroundWindow` plus procesnaam, Linux niet) en stuurt
  bij een wissel `activeApp {name, id}`; nieuwe clients krijgen de laatste direct na `config`.
  Een pagina met `appMatch` (komma-gescheiden namen of bundle-ids, hoofdletterongevoelig,
  substring) komt dan naar voren, behalve tijdens bewerken of met een open paneel. Zonder
  `appMatch` volgt een pagina ook de apps die haar "Open app"-knoppen starten (`settings.smartPages`
  = `buttons`, de standaard; `explicit` zet dat uit). Een expliciete match wint altijd.
- Clientbericht `run {runId, actions}` voert acties uit die niet als knop zijn opgeslagen; de
  `ack` draagt `runId` als `buttonId`. De voorbeeldknoppen op het welkomstscherm (afspelen,
  volume, mute, schermafbeelding, vergrendelen, uit de catalogus per platform) werken daarmee echt.
- De laatste pagina mag weg. Zonder pagina's toont de shell `sd-welcome`: werkende voorbeeldknoppen,
  drie stappen uitleg en twee ingangen (pagina toevoegen via de presets, of de voorbeeldpagina "Start"
  terugzetten). Een standaardknop toevoegen zonder pagina maakt eerst een pagina "Start".
- Preset-pagina's (`page-presets.ts`): Music, Coding, AI, Browsing, Meetings, Writing, Design,
  System. Bij "Add page" laadt de shell de geïnstalleerde apps; presets met gevonden apps staan
  bovenaan onder "Recommended for this computer", er is een zoekbalk, en een blanco pagina kan
  ook. De gevonden apps worden de `appMatch` van de nieuwe pagina en de knoppen krijgen de
  paletkleuren van de preset.
- `welcome.deckBuild` is een vingerafdruk van de geserveerde deck-build (hash van `index.html`).
  De host leest die elke 3 s opnieuw en stuurt bij een verschil een nieuwe `welcome` naar alle
  decks; de web-deck herlaadt zichzelf zodra de vingerafdruk afwijkt van die bij het laden. Zo
  volgt een open telefoon elke nieuwe build, ook zonder host-herstart (bijvoorbeeld na
  `pnpm nx build mobile`).
- `POST /api/reset` zet pagina's en instellingen terug naar de standaard, houdt token en poort,
  zet toggles uit en stuurt de nieuwe config naar alle decks (Settings, "Start clean").
- Toggle-knoppen: `Button.toggle {label?, color?, icon?, actions}`. De host houdt in het geheugen
  bij welke toggles aan staan (`buttonState {states}`, gebroadcast na elke druk en bij verbinden;
  een herstart zet alles uit). Eerste druk: `actions` en aan; volgende druk: `toggle.actions` en
  uit. Het deck tekent de overrides zolang de knop aan staat, met een lampje rechtsboven.
- Per pagina een palet (`Profile.palette`, id uit `libs/editor/.../palettes.ts`, gesynchroniseerd via
  `profile.update`). Het palet bepaalt de standaardkleur van nieuwe knoppen (om de beurt, ook uit
  de catalogus), zet zijn kleuren vooraan in de kleurkiezer, geeft het deck een lichte tint en kan
  bestaande knoppen op de pagina in één keer herkleuren (één `button.update` per knop). Het vak
  bovenaan het paletpaneel is sticky, toont vooraf de eerste knoppen in de nieuwe kleuren en past
  pas toe bij "Apply"; daarna is er Undo in de melding en in het paneel, dat de vorige kleuren
  terugstuurt (de shell bewaart ze tot de volgende herkleuring). Knoppen
  houden altijd hun eigen expliciete kleur; het palet is een hulpmiddel, geen overschrijving.
- Helderheid is een media-control (`brightnessUp`/`brightnessDown`, robotgo `lights_mon_*`).
- De Phosphor-namenlijst voor de icoonkiezer wordt gegenereerd uit het font-pakket
  (`node tools/scripts/generate-phosphor-names.mjs`); Logo (Simple Icons) is nog niet gebouwd.
- Terminal-acties hergebruiken standaard het open terminalvenster (`window: 'reuse'`), omdat
  projectcommando's in de map horen waar je al werkt. De host kijkt op macOS naar de voorste
  sessie: geen venster of bezig met iets anders geeft een nieuw venster; draait het programma
  van de actie er al (bijvoorbeeld `claude`), dan wordt alleen de `prompt` gestuurd. Windows
  opent een nieuwe tab in het bestaande Windows Terminal-venster, Linux altijd een nieuw venster.
  Bij `reuse` kijkt de host eerst welke app vooraan staat: een editor (VS Code-familie via
  Cmd/Ctrl+1 en Ctrl+`, Zed via Ctrl+`, JetBrains via Esc en Alt+F12) krijgt het commando in zijn
  ingebouwde terminal, anders geldt het terminalvenster. Of die editor-terminal bezig is, is van
  buiten niet te zien; wel kijkt de host in de procestabel of `claude`/`codex` met een tty onder
  het editorproces draait, en stuurt dan alleen de prompt. `window: 'editor'` is een oudere
  spelling van `reuse`. Schema 2 splitst `claude "..."`-commando's in commando plus prompt.
- Een WebSocket-handshake die nooit opent is voor de browser hetzelfde bij een host die uit staat
  als bij een afgewezen token. De client vraagt daarom `GET /api/session` (204 of 401): bij 401
  stopt het herverbinden, wordt de status `unpaired` en toont de telefoon het koppelscherm met
  uitleg; anders blijft hij elke twee seconden proberen.
- Logging: de host logt via `slog` naar een ringbuffer (1000 regels), `host.log` naast de config
  (rotatie op 1 MB, drie bestanden) en stderr. Decks sturen hun eigen regels mee als `log`-bericht
  zodat één bestand de volgorde van beide kanten laat zien. `GET /api/logs` (JSON of `?format=text`)
  en `POST /api/logs/clear` zitten achter het token. Nooit in het log: token, getypte tekst, prompts;
  wel: labels, actiesoorten en commando's. `settings.verboseLogging` schakelt debug-regels in.
- AI-paginabouwer: `POST /api/assistant` krijgt het gesprek plus de catalogus (labels en groepen),
  paginanamen, paletten en optioneel appnamen; de host bouwt het prompt, vraagt het model om precies
  één JSON-vorm (`question`, `plan` of `decline`, afgedwongen met structured outputs) en valideert
  het plan tegen de catalogus en het actiemodel, met één correctiebeurt. Het deck zet een
  geaccepteerd plan om in gewone `profile.create`/`button.create`-commando's met undo. Providers:
  Anthropic (Go-SDK, caching, lage inspanning) en OpenAI-compatible (ook Ollama, LM Studio,
  OpenRouter via `baseUrl`); sleutels in `secrets.json` (0600), alleen via de desktop-app of de
  omgeving. `-assistant-fake` of `PANEEL_ASSISTANT_FAKE=1` antwoordt zonder netwerk.
- Menu-indeling: secties Buttons (bewerken, standaardknoppen, app-knoppen, AI-bouwer), Pages
  (beheer plus de paginalijst) en Deck (thema, instellingen).
