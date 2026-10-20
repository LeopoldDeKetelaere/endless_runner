# Endless Runner (duikersgame)

Retro endless runner met placeholder-graphics (gekleurde rechthoeken), gebouwd met Phaser (Vite, vanilla JavaScript). Code staat op GitHub (`LeopoldDeKetelaere/endless_runner`) en wordt gehost op Vercel via GitHub.

## Spel
- Een duiker (geel) zwemt naar rechts, blijft op ~20% van links; achtergrond en hindernissen scrollen naar links. De speler beweegt omhoog/omlaag (pijltjes, of op mobiel: bovenste helft van het scherm = omhoog, onderste helft = omlaag).
- Hindernissen: rotsen (grijs, vanaf de bodem), bootrompen (bruin, vanaf de bovenkant), octopussen (paars, dobberen) en vissen (oranje, sneller dan de achtergrond).
- 3 levens (hartjes rechtsboven). Na een botsing met levens over: hindernissen weg, spel staat stil tot spatie/tik, dan countdown 3-2-1, daarna 3 seconden onkwetsbaar (knipperen). Bij het laatste leven: game-over-scherm met eindscore.
- Het spel wordt geleidelijk sneller. Score = afgelegde afstand (telt niet tijdens wachten/countdown).

## Doel van het project
Gespeeld op een groot scherm op onze stand op een meerdaags B2B-event.
- Spelers registreren zich (voornaam, achternaam, bedrijf/horecazaak, e-mail, telefoonnummer, toestemming).
- Op het scorebord staat per regel: "BEDRIJF (VOORNAAM)" en de score. Niets anders van de speler.
- Er is een top 10 per dag en een algemene top 10. De winnaar krijgt een prijs.
- Backend wordt later Firebase (Firestore + Authentication) met strikte security rules.
- Persoonsgegevens en scores worden gescheiden opgeslagen.
- E-mailadressen worden NOOIT op het scherm getoond.
- Fase 2 (Firebase): verbinding en inloggen zijn klaar (Authentication met e-mail/wachtwoord voor het personeel). `scoreService` werkt nog op localStorage; Firestore en security rules komen nog.
- Nog te bouwen: score opslaan na het spel (via `registry.get('spelerId')` en `submitScore`), rang tonen op het game-over-scherm, Firebase-koppeling. Het scorebord op het startscherm en de registratie bestaan al.

## Mappenstructuur
- `index.html`: pagina met het `#game`-element, laadt `src/main.js`.
- `src/main.js`: Phaser-instellingen (800x450, `Phaser.Scale.FIT`, Arcade Physics, pixelArt) en de lijst met scènes (LoginScene, StartScene, RegistratieScene, GameScene, GameOverScene). Laadt eerst het lettertype "Press Start 2P" (via het npm-pakket `@fontsource/press-start-2p`, dus zonder internet en zonder Google-verbinding).
- `src/config.js`: ALLE instelbare waarden (snelheden, afmetingen, kleuren, levens, countdown, kansen).
- `src/firebase.js`: initialiseert Firebase met de `VITE_FIREBASE_*`-waarden uit `.env.local` (niet in Git; namen staan in `.env.example`; op Vercel onder Settings > Environment Variables). Exporteert o.a. `logIn`, `logOut`, `huidigeGebruiker` en `volgVerbinding` (bolletje op het startscherm: elke 15 s een bereikbaarheidscontrole). Zonder ingevulde waarden start Firebase niet en toont het spel een melding. Optioneel `VITE_FIREBASE_AUTH_EMULATOR_URL` voor testen met de emulator.
- `src/laag.js`: maakt een HTML-laag die precies over het canvas ligt (voor login en uitlog-vraag).
- `src/uitloggen.js`: verborgen sneltoets Ctrl+Shift+L = uitloggen met bevestiging (ENTER = JA, ESC = NEE); legt het spel stil zolang de vraag open staat.
- `src/scenes/LoginScene.js`: eerste scherm als niemand is ingelogd: e-mail en wachtwoord (verborgen), alles met het toetsenbord, dezelfde aanpak als de registratie. Algemene foutmeldingen (verklappen niet of een e-mailadres bestaat). De login blijft bewaard op het toestel (Firebase-persistentie), dus ook offline na herstart nog ingelogd.
- `src/scoreService.js`: ALLE opslag van spelers en scores (async: `registerPlayer`, `submitScore`, `getTopScoresToday`, `getTopScoresAllTime`, `getRank`). Nu localStorage, later Firebase: de rest van het spel gebruikt alleen deze functies. Spelers en scores staan apart; een score bevat alleen bedrijf, voornaam, score, datum en spelers-id. "Vandaag" = dag in tijdzone Europe/Brussels. Per speler telt alleen de beste score in een top.
- `src/testdata.js`: testfunctie (toets T op het startscherm) die 15 nepspelers toevoegt, alleen als `testfunctieAan` in config.js `true` is (VOOR HET EVENT OP false ZETTEN). Nepspelers hebben een e-mailadres op @test.invalid.
- `src/hindernissen.js`: maakt kolommen hindernissen en garandeert altijd een doorgang (zie hieronder).
- `src/scenes/StartScene.js`: eerste scherm: titel, "TOP 10 VANDAAG" links en "TOP 10 ALLER TIJDEN" rechts ("1. BEDRIJF (VOORNAAM) ..... score", lange namen ingekort met "…"), knipperende "DRUK OP SPATIE". Spatie/tik gaat naar de registratie.
- `src/scenes/RegistratieScene.js` (+ `src/registratie.css`): registratie in twee stappen als HTML-formulier over het canvas, ALLES met het toetsenbord (geen muis). Stap 1: 5 verplichte velden (Enter/↓ = volgend, ↑ = vorig, Esc = annuleren). Stap 2: toestemming met 3 keuzes (↑↓, Enter, P = privacyverklaring, Esc = terug). Autocomplete uit; alle gegevens worden gewist na starten, annuleren, keuze "nee" en na 30 s zonder toets (`registratieInactiviteitSeconden`). Bekend e-mailadres = terugkerende speler (bestaande gegevens blijven, alleen nieuwsbriefkeuze en tijdstip worden bijgewerkt, "WELKOM TERUG"). Het spelers-id staat daarna in `this.registry` onder `spelerId` (wordt gewist bij het startscherm). Het scherm vangt alle toetsen zelf op (capture-fase) zodat Phaser geen spaties of pijltjes in velden blokkeert; houd dat zo.
- `src/validatie.js`: controle van naam, e-mail en telefoonnummer (Belgisch en internationaal, bewaard zonder spaties).
- `src/scenes/GameScene.js`: het spel zelf (duiker, decor, hindernissen, levens, wachten/countdown/onkwetsbaar).
- `src/scenes/GameOverScene.js`: eindscherm met score. Spatie/tik gaat naar het startscherm (scorebord); doet niemand iets, dan gaat het vanzelf na `gameOverSeconden` (30 s).
- `.claude/launch.json`: lokale configuratie om de dev-server te starten (niet in git).

## Belangrijke regels in de spellogica
- Er is in elke kolom ALTIJD een vrije doorgang van minstens `minimaleOpening` pixels, haalbaar vanaf de vorige doorgang. Vissen (sneller dan de achtergrond) blijven buiten het gebied van recente doorgangen. Houd deze garantie intact bij elke wijziging aan hindernissen.
- Rotsen en boten wisselen elkaar af (evenveel van allebei), octopussen en vissen ook. Rotsen en boten zijn maximaal 20% van de schermhoogte (`maxRandHoogteFractie`).
- Dieren en doorgang zijn over het hele scherm verdeeld, zodat stilstaan (ook in het midden of onderin) niet loont.

## Werkafspraken
- Code eenvoudig houden, korte opmerkingen in het Nederlands, namen in het Nederlands zoals in de bestaande code.
- Alle instelbare waarden in `src/config.js`, niet in de code verspreiden.
- Na elke werkende stap: commit en push naar GitHub (`main`).
- Ontwikkelserver: `npm run dev` (poort 5173).

## Let op
- Geïnstalleerde Phaser-versie is 4.x (`npm install phaser` gaf 4.2.1), ook al werd het project als "Phaser 3" omschreven. Het werkt, maar let hierop bij het opzoeken van documentatie en voorbeelden.
