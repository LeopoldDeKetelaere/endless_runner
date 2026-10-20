import { auth, logOut } from './firebase.js';
import { maakLaag, maakElement } from './laag.js';

// Verborgen sneltoets voor het personeel: Ctrl+Shift+L = uitloggen (met bevestiging).
// Werkt op elk scherm zolang er iemand ingelogd is. Het spel staat stil zolang de vraag open staat.

export function installeerUitloggen(game) {
  let laag = null;        // de open bevestiging (of null)
  let gepauzeerd = [];    // scènes die we hebben stilgezet

  function toon() {
    gepauzeerd = game.scene.getScenes(true).map((scene) => scene.scene.key);
    gepauzeerd.forEach((sleutel) => game.scene.pause(sleutel));

    laag = maakLaag(game, 'laag-boven');
    const venster = maakElement('div', 'reg-modal zichtbaar');
    venster.append(
      maakElement('h2', '', 'UITLOGGEN?'),
      maakElement('p', 'groot', 'ENTER = JA, ESC = NEE'),
    );
    laag.laag.append(venster);
  }

  function sluit() {
    laag.opruimen();
    laag = null;
  }

  async function bevestig() {
    sluit();
    await logOut();
    // Alle schermen stoppen en terug naar het inlogscherm
    gepauzeerd.forEach((sleutel) => game.scene.stop(sleutel));
    game.scene.start('LoginScene');
  }

  function annuleer() {
    sluit();
    gepauzeerd.forEach((sleutel) => game.scene.resume(sleutel));
  }

  // Capture-fase en als eerste geregistreerd: we zien elke toets vóór Phaser en de andere schermen
  window.addEventListener('keydown', (e) => {
    if (laag) {
      // Vraag staat open: alleen Enter en Escape tellen, alle andere toetsen worden tegengehouden
      e.stopImmediatePropagation();
      e.preventDefault();
      if (e.repeat) return;
      if (e.key === 'Enter') bevestig();
      else if (e.key === 'Escape') annuleer();
      return;
    }
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'l') {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (auth?.currentUser) toon(); // niemand ingelogd: niets te doen
    }
  }, true);
}
