import Phaser from 'phaser';
import '../registratie.css';
import { CONFIG } from '../config.js';
import { firebaseGeconfigureerd, huidigeGebruiker, logIn } from '../firebase.js';
import { maakLaag, maakElement } from '../laag.js';
import { maakAchtergrond } from '../achtergrond.js';

// Inloggen voor het personeel. Verschijnt vóór het startscherm als er niemand is ingelogd.
// Zelfde aanpak als de registratie: een HTML-formulier over het canvas, alles met het
// toetsenbord. Zolang het formulier open staat, krijgt Phaser geen toetsen (anders blokkeert
// Phaser spaties en pijltjes in de velden).

const VELDEN = [
  { label: 'E-MAILADRES', type: 'text', modus: 'email' },
  { label: 'WACHTWOORD', type: 'password' }, // verborgen
];
const HULP = 'ENTER = VOLGENDE / INLOGGEN   ↑↓ = VELD WISSELEN';

// Bewust algemene meldingen: we verklappen nooit of een e-mailadres bestaat
function foutTekst(fout) {
  if (fout?.code === 'auth/network-request-failed') return 'GEEN VERBINDING. CONTROLEER HET WIFI-NETWERK.';
  if (fout?.code === 'auth/too-many-requests') return 'TE VEEL POGINGEN. WACHT EVEN EN PROBEER HET OPNIEUW.';
  return 'INLOGGEN MISLUKT. CONTROLEER JE GEGEVENS.';
}

export default class LoginScene extends Phaser.Scene {
  constructor() {
    super('LoginScene');
  }

  update(tijd, delta) {
    this.achtergrond?.update(delta);
  }

  create() {
    this.afgesloten = false;
    this.bezig = false;
    this.actief = 0;
    this.cameras.main.setBackgroundColor(CONFIG.kleurAchtergrond);
    this.achtergrond = maakAchtergrond(this, { menu: true }); // het formulier ligt (doorzichtig) hierover
    this.events.once('shutdown', () => this.opruimen());

    if (!firebaseGeconfigureerd) {
      this.toonNietIngesteld();
      return;
    }
    // Is er al iemand ingelogd (op dit toestel bewaard)? Dan meteen door naar het startscherm.
    huidigeGebruiker().then((gebruiker) => {
      if (this.afgesloten) return;
      if (gebruiker) this.scene.start('StartScene');
      else this.bouwFormulier();
    });
  }

  // Firebase heeft nog geen instellingen: duidelijke melding in plaats van een kapot spel
  toonNietIngesteld() {
    const { laag, opruimen } = maakLaag(this.game);
    this.opruimLaag = opruimen;
    const scherm = maakElement('div', 'reg-scherm reg-midden zichtbaar');
    scherm.append(maakElement('p', 'reg-groot', 'FIREBASE IS NOG NIET INGESTELD. VUL .ENV.LOCAL IN EN HERSTART.'));
    laag.append(scherm);
  }

  bouwFormulier() {
    const { laag, opruimen } = maakLaag(this.game);
    this.opruimLaag = opruimen;

    const scherm = maakElement('div', 'reg-scherm login zichtbaar');
    scherm.append(maakElement('h1', 'reg-titel', 'INLOGGEN'));
    this.rijen = [];
    this.invoer = [];
    VELDEN.forEach((veld, i) => {
      const rij = maakElement('div', 'reg-rij');
      const links = maakElement('div');
      const label = maakElement('label', 'reg-label', veld.label);
      const input = maakElement('input', 'reg-invoer');
      input.type = veld.type;
      input.name = input.id = `l${i}-${Math.random().toString(36).slice(2, 8)}`;
      label.htmlFor = input.id;
      // Geen suggesties of opgeslagen wachtwoorden van de browser
      input.setAttribute('autocomplete', veld.type === 'password' ? 'new-password' : 'off');
      input.setAttribute('autocapitalize', 'off');
      input.setAttribute('autocorrect', 'off');
      input.setAttribute('aria-autocomplete', 'none');
      input.setAttribute('data-lpignore', 'true');
      input.setAttribute('data-1p-ignore', 'true');
      input.spellcheck = false;
      if (veld.modus) input.inputMode = veld.modus;
      input.maxLength = 200;
      // Focus nooit kwijtraken (er is geen muis)
      input.addEventListener('blur', () => {
        setTimeout(() => { if (!this.afgesloten) this.invoer[this.actief]?.focus(); }, 0);
      });
      links.append(label, input);
      rij.append(links);
      scherm.append(rij);
      this.rijen.push(rij);
      this.invoer.push(input);
    });
    this.melding = maakElement('p', 'login-melding');
    scherm.append(this.melding, maakElement('p', 'reg-hulp', HULP));
    laag.append(scherm);

    // Toetsen: wij nemen ze over, Phaser krijgt ze niet
    this.toetsFunctie = (e) => this.opToets(e);
    this.losFunctie = (e) => e.stopPropagation();
    window.addEventListener('keydown', this.toetsFunctie, true);
    window.addEventListener('keyup', this.losFunctie, true);
    this.input.keyboard?.clearCaptures();

    this.focusVeld(0);
  }

  opToets(e) {
    e.stopPropagation();
    if (this.bezig) { e.preventDefault(); return; }
    const stuurToets = ['Enter', 'ArrowDown', 'ArrowUp', 'Tab', 'Escape'].includes(e.key);
    if (!stuurToets) return; // typen laten we met rust
    e.preventDefault();
    if (e.repeat) return;

    if (e.key === 'Enter') {
      if (this.actief < VELDEN.length - 1) this.focusVeld(this.actief + 1);
      else this.inloggen();
    } else if (e.key === 'ArrowDown') this.focusVeld(this.actief + 1);
    else if (e.key === 'ArrowUp') this.focusVeld(this.actief - 1);
    else if (e.key === 'Tab') this.focusVeld(this.actief + (e.shiftKey ? -1 : 1));
  }

  focusVeld(i) {
    this.actief = Phaser.Math.Clamp(i, 0, VELDEN.length - 1);
    this.rijen.forEach((rij, n) => rij.classList.toggle('actief', n === this.actief));
    const input = this.invoer[this.actief];
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  }

  toonMelding(tekst, neutraal = false) {
    this.melding.textContent = tekst;
    this.melding.classList.toggle('neutraal', neutraal);
  }

  async inloggen() {
    const email = this.invoer[0].value.trim();
    const wachtwoord = this.invoer[1].value;
    if (!email || !wachtwoord) {
      this.toonMelding('VUL JE E-MAILADRES EN WACHTWOORD IN.');
      this.focusVeld(email ? 1 : 0);
      return;
    }
    this.bezig = true;
    this.toonMelding('BEZIG MET INLOGGEN...', true);
    try {
      await logIn(email, wachtwoord);
      if (this.afgesloten) return;
      this.scene.start('StartScene');
    } catch (fout) {
      if (this.afgesloten) return;
      this.bezig = false;
      this.invoer[1].value = ''; // wachtwoord altijd wissen na een mislukte poging
      this.toonMelding(foutTekst(fout));
      this.focusVeld(1);
    }
  }

  opruimen() {
    this.afgesloten = true;
    window.removeEventListener('keydown', this.toetsFunctie, true);
    window.removeEventListener('keyup', this.losFunctie, true);
    this.invoer?.forEach((input) => { input.value = ''; }); // wachtwoord niet laten rondslingeren
    this.opruimLaag?.();
  }
}
