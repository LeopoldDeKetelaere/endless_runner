import { OVERLAY_BREEDTE } from './config.js';

// Maakt een HTML-laag die precies over het spelcanvas ligt (800x450 spelpixels, mee geschaald).
// Wordt gebruikt voor het inlogformulier en de uitlog-bevestiging.
// Geeft { laag, opruimen } terug: 'opruimen' haalt de laag weer weg.
export function maakLaag(game, extraKlasse = '') {
  const laag = document.createElement('div');
  laag.className = ('reg-wrap ' + extraKlasse).trim();
  document.body.append(laag);

  const pas = () => {
    const r = game.canvas.getBoundingClientRect();
    laag.style.left = r.left + 'px';
    laag.style.top = r.top + 'px';
    laag.style.transform = `scale(${r.width / OVERLAY_BREEDTE})`; // het formulier is ontworpen op 800 breed
  };
  window.addEventListener('resize', pas);
  game.scale.on('resize', pas);
  pas();
  requestAnimationFrame(pas);

  const opruimen = () => {
    window.removeEventListener('resize', pas);
    game.scale.off('resize', pas);
    laag.remove();
  };
  return { laag, opruimen };
}

// Maak een element met klasse en eventueel tekst (tekst komt veilig als gewone tekst, nooit als HTML)
export function maakElement(tag, klasse, tekst) {
  const el = document.createElement(tag);
  if (klasse) el.className = klasse;
  if (tekst !== undefined) el.textContent = tekst;
  return el;
}
