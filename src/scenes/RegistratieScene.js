import Phaser from 'phaser';
import '../registratie.css';
import { OVERLAY_BREEDTE, CONFIG } from '../config.js';
import { registerPlayer } from '../scoreService.js';
import { controleerTekst } from '../validatie.js';
import { maakAchtergrond } from '../achtergrond.js';

// Registratie in twee stappen: bedrijf en voornaam invullen, dan zien hoe je op het scorebord staat. Het formulier is gewone HTML die over het canvas ligt,
// zodat typen vlot werkt. Alles gaat met het toetsenbord (er is geen muis).
//
// Belangrijk: Phaser vangt toetsen als spatie en pijltjes op en blokkeert dan het typen
// in een veld. Daarom vangen WIJ alle toetsen eerst op (capture-fase) en geven we ze niet
// door aan Phaser zolang dit scherm open staat.

// De velden van stap 1, in volgorde
const VELDEN = [
  { naam: 'bedrijf', label: 'BEDRIJF / HORECAZAAK', max: CONFIG.maxBedrijfTekens, fout: 'VUL JE BEDRIJF IN' },
  { naam: 'voornaam', label: 'VOORNAAM', max: CONFIG.maxVoornaamTekens, fout: 'VUL JE VOORNAAM IN' },
].map((veld) => ({ ...veld, controle: (w) => controleerTekst(w, veld.max, veld.fout) }));

const HULP_GEGEVENS = 'ENTER = VOLGENDE   ↑↓ = VELD WISSELEN   ESC = ANNULEREN';
const HULP_INFO = 'ENTER = SPELEN   ESC = TERUG AANPASSEN   P = PRIVACYVERKLARING';

const PRIVACY_TEKST = [
  'DIT IS EEN PLACEHOLDERTEKST. DE DEFINITIEVE PRIVACYVERKLARING VOLGT NOG.',
  'GEGEVENS: JE BEDRIJF EN JE VOORNAAM, MET JE SCORES.',
  'DOEL: HET SCOREBORD EN DE WEDSTRIJD OP DEZE STAND.',
  'OP HET SCOREBORD STAAN ALLEEN JE BEDRIJF, JE VOORNAAM EN JE SCORE.',
  'BEWAARTERMIJN: [NOG IN TE VULLEN].',
  'INZAGE OF WISSEN VAN JE GEGEVENS: [CONTACTGEGEVENS NOG IN TE VULLEN].',
];

// Maak een element met klasse en eventueel tekst
function maak(tag, klasse, tekst) {
  const el = document.createElement(tag);
  if (klasse) el.className = klasse;
  if (tekst !== undefined) el.textContent = tekst;
  return el;
}

export default class RegistratieScene extends Phaser.Scene {
  constructor() {
    super('RegistratieScene');
  }

  create() {
    this.afgesloten = false;
    this.scherm = 'gegevens'; // 'gegevens', 'info', 'privacy' of 'welkom'
    this.actief = 0;          // welk veld is actief
    this.bezig = false;       // bezig met opslaan
    this.gegevens = null;     // gecontroleerde invoer uit stap 1
    this.cameras.main.setBackgroundColor(CONFIG.kleurAchtergrond);
    this.achtergrond = maakAchtergrond(this, { menu: true }); // het formulier ligt (doorzichtig) hierover

    this.bouwFormulier();

    // Toetsen: wij nemen ze over (zie boven). Ook 'keyup' houden we bij Phaser vandaan.
    this.toetsFunctie = (e) => this.opToets(e);
    this.losFunctie = (e) => e.stopPropagation();
    window.addEventListener('keydown', this.toetsFunctie, true);
    window.addEventListener('keyup', this.losFunctie, true);
    this.input.keyboard?.clearCaptures(); // Phaser mag geen toetsen meer blokkeren

    // Formulier meeschalen met het canvas
    this.pasFunctie = () => this.pasPositieAan();
    window.addEventListener('resize', this.pasFunctie);
    this.scale.on('resize', this.pasFunctie);
    this.pasPositieAan();
    requestAnimationFrame(this.pasFunctie);

    this.events.once('shutdown', () => this.opruimen());
    this.toonScherm('gegevens');
    this.focusVeld(0);
    this.startInactiviteitsTimer();
  }

  update(tijd, delta) {
    this.achtergrond.update(delta);
  }

  // ---------------------------------------------------------------------------
  // Opbouw van het formulier (gewone HTML)
  // ---------------------------------------------------------------------------
  bouwFormulier() {
    this.wrap = maak('div', 'reg-wrap');
    // Het formulier is een gewone div (geen <form>), zodat er niets verstuurd of onthouden wordt
    this.schermen = {};

    // Stap 1: gegevens
    const s1 = maak('div', 'reg-scherm');
    s1.append(maak('h1', 'reg-titel', 'JE GEGEVENS'));
    this.rijen = [];
    this.invoer = [];
    this.foutVakken = [];
    VELDEN.forEach((veld, i) => {
      const rij = maak('div', 'reg-rij');
      const links = maak('div');
      const label = maak('label', 'reg-label', veld.label);
      const input = maak('input', 'reg-invoer');
      // Geen suggesties van eerdere spelers: autocomplete uit, onduidelijke namen, geen spellingcontrole
      input.type = 'text';
      input.name = input.id = `x${i}-${Math.random().toString(36).slice(2, 8)}`;
      label.htmlFor = input.id;
      input.setAttribute('autocomplete', 'off');
      input.setAttribute('autocapitalize', 'off');
      input.setAttribute('autocorrect', 'off');
      input.setAttribute('aria-autocomplete', 'none');
      input.setAttribute('data-lpignore', 'true'); // wachtwoordmanagers negeren dit veld
      input.setAttribute('data-1p-ignore', 'true');
      input.spellcheck = false;
      input.maxLength = veld.max;
      // Zodra je typt, verdwijnt de foutmelding van dit veld
      input.addEventListener('input', () => this.wisFout(i));
      // Focus nooit kwijtraken (geen muis): terugzetten als het veld toch focus verliest
      input.addEventListener('blur', () => {
        setTimeout(() => {
          if (!this.afgesloten && this.scherm === 'gegevens') this.invoer[this.actief]?.focus();
        }, 0);
      });
      const fout = maak('div', 'reg-fout');
      links.append(label, input);
      rij.append(links, fout);
      s1.append(rij);
      this.rijen.push(rij);
      this.invoer.push(input);
      this.foutVakken.push(fout);
    });
    s1.append(maak('p', 'reg-hulp', HULP_GEGEVENS));
    this.schermen.gegevens = s1;

    // Stap 2: zo sta je op het scorebord
    const s2 = maak('div', 'reg-scherm');
    s2.append(maak('h1', 'reg-titel', 'SCOREBORD'));
    s2.append(maak('p', 'reg-vraag', 'JE VOORNAAM EN BEDRIJF VERSCHIJNEN OP HET SCOREBORD.'));
    this.voorbeeld = maak('p', 'reg-voorbeeld');
    this.melding = maak('p', 'reg-melding');
    s2.append(this.voorbeeld, this.melding, maak('p', 'reg-hulp', HULP_INFO));
    this.schermen.info = s2;

    // Terugkerende speler
    const welkom = maak('div', 'reg-scherm reg-midden');
    this.welkomTekst = maak('p', 'reg-groot');
    welkom.append(this.welkomTekst);
    this.schermen.welkom = welkom;

    // Privacyverklaring (venster boven stap 2)
    this.modal = maak('div', 'reg-modal');
    this.modal.append(maak('h2', '', 'PRIVACYVERKLARING'));
    PRIVACY_TEKST.forEach((tekst) => this.modal.append(maak('p', '', tekst)));
    this.modal.append(maak('p', 'reg-hulp', 'ESC OF ENTER = SLUITEN'));

    this.wrap.append(s1, s2, welkom, this.modal);
    document.body.append(this.wrap);
  }

  // Leg het formulier precies over het canvas, op dezelfde schaal
  pasPositieAan() {
    if (this.afgesloten) return;
    const r = this.game.canvas.getBoundingClientRect();
    this.wrap.style.left = r.left + 'px';
    this.wrap.style.top = r.top + 'px';
    this.wrap.style.transform = `scale(${r.width / OVERLAY_BREEDTE})`; // het formulier is ontworpen op 800 breed
  }

  toonScherm(naam) {
    this.scherm = naam;
    for (const [sleutel, el] of Object.entries(this.schermen)) {
      el.classList.toggle('zichtbaar', sleutel === naam || (naam === 'privacy' && sleutel === 'info'));
    }
    this.modal.classList.toggle('zichtbaar', naam === 'privacy');
  }

  // ---------------------------------------------------------------------------
  // Toetsen
  // ---------------------------------------------------------------------------
  opToets(e) {
    e.stopPropagation(); // Phaser (en het startscherm) krijgen deze toets niet
    this.startInactiviteitsTimer();
    if (this.bezig) { e.preventDefault(); return; }

    switch (this.scherm) {
      case 'gegevens': this.toetsGegevens(e); break;
      case 'info': this.toetsInfo(e); break;
      case 'privacy': this.toetsPrivacy(e); break;
      default: e.preventDefault(); // 'welkom': even niets doen
    }
  }

  // Stap 1. Letters, spaties, 'p' enzovoort laten we ongemoeid: die komen gewoon in het veld.
  toetsGegevens(e) {
    const stuurToets = ['Enter', 'ArrowDown', 'ArrowUp', 'Escape', 'Tab'].includes(e.key);
    if (!stuurToets) return;
    e.preventDefault();
    if (e.repeat) return; // vastgehouden toets telt maar één keer

    if (e.key === 'Enter') this.enterOpVeld();
    else if (e.key === 'ArrowDown') this.focusVeld(this.actief + 1);
    else if (e.key === 'ArrowUp') this.focusVeld(this.actief - 1);
    else if (e.key === 'Tab') this.focusVeld(this.actief + (e.shiftKey ? -1 : 1));
    else if (e.key === 'Escape') this.naarStartscherm();
  }

  // Stap 2: Enter = registreren en spelen, Esc = terug naar stap 1 (alles blijft ingevuld), P = privacyverklaring
  toetsInfo(e) {
    const toets = e.key.toLowerCase();
    if (!['enter', 'escape', 'p'].includes(toets)) return;
    e.preventDefault();
    if (e.repeat) return;

    if (toets === 'enter') this.registreer();
    else if (toets === 'escape') { this.melding.textContent = ''; this.toonScherm('gegevens'); this.focusVeld(this.actief); }
    else this.toonScherm('privacy');
  }

  toetsPrivacy(e) {
    e.preventDefault();
    if (e.repeat) return;
    if (e.key === 'Enter' || e.key === 'Escape') this.toonScherm('info');
  }

  // ---------------------------------------------------------------------------
  // Stap 1: gegevens
  // ---------------------------------------------------------------------------
  focusVeld(i) {
    this.actief = Phaser.Math.Clamp(i, 0, VELDEN.length - 1);
    this.rijen.forEach((rij, n) => rij.classList.toggle('actief', n === this.actief));
    const input = this.invoer[this.actief];
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length); // cursor achteraan
  }

  enterOpVeld() {
    if (this.actief < VELDEN.length - 1) this.focusVeld(this.actief + 1);
    else this.controleerAlles();
  }

  wisFout(i) {
    this.foutVakken[i].textContent = '';
    this.rijen[i].classList.remove('fout');
  }

  // Alle velden controleren. Fout: melding naast het veld en de cursor naar het eerste foute veld.
  controleerAlles() {
    const gegevens = {};
    let eersteFout = -1;
    VELDEN.forEach((veld, i) => {
      const resultaat = veld.controle(this.invoer[i].value);
      if (resultaat.ok) {
        gegevens[veld.naam] = resultaat.waarde;
        this.wisFout(i);
      } else {
        this.foutVakken[i].textContent = resultaat.fout;
        this.rijen[i].classList.add('fout');
        if (eersteFout < 0) eersteFout = i;
      }
    });
    if (eersteFout >= 0) {
      this.focusVeld(eersteFout);
      return;
    }
    this.gegevens = gegevens;
    this.melding.textContent = '';
    // Zo komt de speler op het scorebord te staan, zodat een tikfout nog zichtbaar is
    this.voorbeeld.textContent = `${gegevens.bedrijf} (${gegevens.voornaam})`.toUpperCase();
    this.toonScherm('info');
  }

  // ---------------------------------------------------------------------------
  // Stap 2: registreren en spelen
  // ---------------------------------------------------------------------------

  // Speler opslaan (of herkennen aan bedrijf en voornaam) en het spel starten
  async registreer() {
    this.bezig = true;
    this.melding.textContent = '';
    try {
      const speler = await registerPlayer(this.gegevens);
      if (this.afgesloten) return; // intussen is het scherm al verlaten (bv. door de inactiviteitstimer)
      this.registry.set('spelerId', speler.id); // het spel weet nu wie er speelt

      if (speler.bestaand) {
        this.welkomTekst.textContent = `WELKOM TERUG, ${speler.voornaam.toUpperCase()}!`;
        this.toonScherm('welkom');
        await new Promise((klaar) => setTimeout(klaar, CONFIG.welkomTerugSeconden * 1000));
        if (this.afgesloten) return;
      }
      this.startSpel();
    } catch (fout) {
      console.error(fout);
      this.bezig = false;
      this.melding.textContent = 'OPSLAAN MISLUKT. PROBEER HET OPNIEUW.';
    }
  }

  // ---------------------------------------------------------------------------
  // Wissen, verlaten en opruimen
  // ---------------------------------------------------------------------------

  // Alle ingevulde gegevens volledig wissen (ook uit het geheugen)
  wisAlles() {
    this.invoer?.forEach((input, i) => { input.value = ''; this.wisFout(i); });
    this.gegevens = null;
    this.voorbeeld.textContent = '';
  }

  naarStartscherm() {
    this.wisAlles();
    this.registry.remove('spelerId');
    this.scene.start('StartScene');
  }

  startSpel() {
    this.wisAlles();
    this.scene.start('GameScene');
  }

  // Een tijd lang geen toets: alles wissen en terug naar het startscherm
  startInactiviteitsTimer() {
    clearTimeout(this.inactiefTimer);
    this.inactiefTimer = setTimeout(() => {
      if (!this.afgesloten) this.naarStartscherm();
    }, CONFIG.registratieInactiviteitSeconden * 1000);
  }

  opruimen() {
    this.afgesloten = true;
    clearTimeout(this.inactiefTimer);
    window.removeEventListener('keydown', this.toetsFunctie, true);
    window.removeEventListener('keyup', this.losFunctie, true);
    window.removeEventListener('resize', this.pasFunctie);
    this.scale.off('resize', this.pasFunctie);
    this.wisAlles();
    this.wrap.remove();
  }
}
