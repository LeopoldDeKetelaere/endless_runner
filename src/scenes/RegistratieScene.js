import Phaser from 'phaser';
import '../registratie.css';
import { BREEDTE, CONFIG } from '../config.js';
import { registerPlayer, findPlayerByEmail, updateNewsletterConsent } from '../scoreService.js';
import { controleerTekst, controleerEmail, controleerTelefoon } from '../validatie.js';

// Registratie in twee stappen. Het formulier is gewone HTML die over het canvas ligt,
// zodat typen vlot werkt. Alles gaat met het toetsenbord (er is geen muis).
//
// Belangrijk: Phaser vangt toetsen als spatie en pijltjes op en blokkeert dan het typen
// in een veld. Daarom vangen WIJ alle toetsen eerst op (capture-fase) en geven we ze niet
// door aan Phaser zolang dit scherm open staat.

// De velden van stap 1, in volgorde
const VELDEN = [
  { naam: 'voornaam', label: 'VOORNAAM', controle: (w) => controleerTekst(w, 'VUL JE VOORNAAM IN') },
  { naam: 'achternaam', label: 'ACHTERNAAM', controle: (w) => controleerTekst(w, 'VUL JE ACHTERNAAM IN') },
  { naam: 'bedrijf', label: 'BEDRIJF / HORECAZAAK', controle: (w) => controleerTekst(w, 'VUL JE BEDRIJF IN') },
  { naam: 'email', label: 'E-MAILADRES', modus: 'email', controle: controleerEmail },
  { naam: 'telefoon', label: 'TELEFOONNUMMER', modus: 'tel', controle: controleerTelefoon },
];

// De keuzes van stap 2
const KEUZES = [
  { tekst: 'JA, IK DOE MEE + STUUR ME NIEUWS', nieuwsbrief: true },
  { tekst: 'JA, IK DOE MEE ZONDER NIEUWS', nieuwsbrief: false },
  { tekst: 'NEE, IK DOE NIET MEE' },
];

const HULP_GEGEVENS = 'ENTER = VOLGENDE   ↑↓ = VELD WISSELEN   ESC = ANNULEREN';
const HULP_TOESTEMMING = '↑↓ = KIEZEN   ENTER = BEVESTIGEN   P = PRIVACYVERKLARING   ESC = TERUG';

const PRIVACY_TEKST = [
  'DIT IS EEN PLACEHOLDERTEKST. DE DEFINITIEVE PRIVACYVERKLARING VOLGT NOG.',
  'GEGEVENS: VOORNAAM, ACHTERNAAM, BEDRIJF, E-MAILADRES EN TELEFOONNUMMER.',
  'DOEL: DEELNAME AAN DEZE WEDSTRIJD EN HET CONTACTEREN VAN DE WINNAAR. ALS JE DAARVOOR KIEST, STUREN WE JE OOK NIEUWS EN AANBIEDINGEN.',
  'OP HET SCOREBORD STAAN ALLEEN JE BEDRIJF, JE VOORNAAM EN JE SCORE. JE E-MAILADRES EN TELEFOONNUMMER WORDEN NOOIT GETOOND.',
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
    this.scherm = 'gegevens'; // 'gegevens', 'toestemming', 'privacy', 'nee' of 'welkom'
    this.actief = 0;          // welk veld is actief
    this.keuze = -1;          // gekozen optie in stap 2 (-1 = nog niets gekozen)
    this.bezig = false;       // bezig met opslaan
    this.gegevens = null;     // gecontroleerde invoer uit stap 1
    this.cameras.main.setBackgroundColor(CONFIG.kleurAchtergrond);

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
      input.maxLength = veld.naam === 'bedrijf' ? CONFIG.maxBedrijfTekens : 100;
      if (veld.modus) input.inputMode = veld.modus;
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

    // Stap 2: toestemming
    const s2 = maak('div', 'reg-scherm');
    s2.append(maak('h1', 'reg-titel', 'TOESTEMMING'));
    s2.append(maak('p', 'reg-vraag',
      'WE BEWAREN JE GEGEVENS VOOR DEZE WEDSTRIJD EN OM DE WINNAAR TE CONTACTEREN. ' +
      'MOGEN WE JE OOK NIEUWS EN AANBIEDINGEN STUREN?'));
    this.keuzeRijen = KEUZES.map((k) => {
      const rij = maak('div', 'reg-keuze');
      rij.append(maak('span', 'reg-pijl rechts'), maak('span', '', k.tekst), maak('span', 'reg-pijl links'));
      s2.append(rij);
      return rij;
    });
    this.melding = maak('p', 'reg-melding');
    s2.append(this.melding, maak('p', 'reg-hulp', HULP_TOESTEMMING));
    this.schermen.toestemming = s2;

    // Bij 'nee'
    const nee = maak('div', 'reg-scherm reg-midden');
    nee.append(maak('p', 'reg-groot', 'ZONDER AKKOORD KAN JE HELAAS NIET DEELNEMEN. DRUK OP ENTER OM TERUG TE GAAN.'));
    this.schermen.nee = nee;

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

    this.wrap.append(s1, s2, nee, welkom, this.modal);
    document.body.append(this.wrap);
  }

  // Leg het formulier precies over het canvas, op dezelfde schaal
  pasPositieAan() {
    if (this.afgesloten) return;
    const r = this.game.canvas.getBoundingClientRect();
    this.wrap.style.left = r.left + 'px';
    this.wrap.style.top = r.top + 'px';
    this.wrap.style.transform = `scale(${r.width / BREEDTE})`;
  }

  toonScherm(naam) {
    this.scherm = naam;
    for (const [sleutel, el] of Object.entries(this.schermen)) {
      el.classList.toggle('zichtbaar', sleutel === naam || (naam === 'privacy' && sleutel === 'toestemming'));
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
      case 'toestemming': this.toetsToestemming(e); break;
      case 'privacy': this.toetsPrivacy(e); break;
      case 'nee': this.toetsNee(e); break;
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

  // Stap 2
  toetsToestemming(e) {
    const toets = e.key.toLowerCase();
    if (!['arrowup', 'arrowdown', 'enter', 'escape', 'p', ' '].includes(toets)) return;
    e.preventDefault();
    if (e.repeat) return;

    if (toets === 'arrowdown') this.kies(this.keuze < 0 ? 0 : this.keuze + 1);
    else if (toets === 'arrowup') this.kies(this.keuze < 0 ? 0 : this.keuze - 1);
    else if (toets === 'enter' && this.keuze >= 0) this.bevestigKeuze();
    else if (toets === 'escape') { this.toonScherm('gegevens'); this.focusVeld(this.actief); }
    else if (toets === 'p') this.toonScherm('privacy');
  }

  toetsPrivacy(e) {
    e.preventDefault();
    if (e.repeat) return;
    if (e.key === 'Enter' || e.key === 'Escape') this.toonScherm('toestemming');
  }

  toetsNee(e) {
    if (e.key !== 'Enter' && e.key !== 'Escape') return;
    e.preventDefault();
    if (e.repeat) return;
    if (e.key === 'Enter') this.naarStartscherm();
    else { this.kies(-1); this.toonScherm('toestemming'); } // Escape: terug naar de keuze
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
    this.kies(-1); // bij het openen is er geen keuze geselecteerd
    this.toonScherm('toestemming');
  }

  // ---------------------------------------------------------------------------
  // Stap 2: toestemming
  // ---------------------------------------------------------------------------
  kies(nummer) {
    this.keuze = nummer < 0 ? -1 : Phaser.Math.Clamp(nummer, 0, KEUZES.length - 1);
    this.keuzeRijen.forEach((rij, i) => rij.classList.toggle('gekozen', i === this.keuze));
  }

  bevestigKeuze() {
    const keuze = KEUZES[this.keuze];
    if (keuze.nieuwsbrief === undefined) {
      this.toonScherm('nee'); // 'NEE, IK DOE NIET MEE'
      return;
    }
    this.registreer(keuze.nieuwsbrief);
  }

  // Speler opslaan (of herkennen aan het e-mailadres) en het spel starten
  async registreer(nieuwsbrief) {
    this.bezig = true;
    this.melding.textContent = '';
    try {
      const g = this.gegevens;
      const bekend = await findPlayerByEmail(g.email);
      let spelerId;
      if (bekend) {
        // Terugkerende speler: bestaande gegevens blijven, alleen de nieuwsbriefkeuze wordt bijgewerkt
        await updateNewsletterConsent(bekend.id, nieuwsbrief);
        spelerId = bekend.id;
      } else {
        spelerId = await registerPlayer({ ...g, toestemming: true, nieuwsbrief });
      }
      if (this.afgesloten) return; // intussen is het scherm al verlaten (bv. door de inactiviteitstimer)
      this.registry.set('spelerId', spelerId); // het spel weet nu wie er speelt

      if (bekend) {
        this.welkomTekst.textContent = `WELKOM TERUG, ${bekend.voornaam.toUpperCase()}!`;
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
    this.kies(-1);
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

  // 60 seconden geen toets: alles wissen en terug naar het startscherm
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
