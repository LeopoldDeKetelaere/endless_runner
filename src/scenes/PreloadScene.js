import Phaser from 'phaser';
import { BREEDTE, HOOGTE, CONFIG, px } from '../config.js';
import { AFBEELDINGEN, GELUIDEN } from '../assets.js';

const LETTERTYPE = '"Press Start 2P", monospace';
const MAX_ANIMATIEBEELDJES = 99;

// Bestaat deze afbeelding? We proberen hem echt te laden: dat werkt ook als de server bij een
// ontbrekend bestand een webpagina terugstuurt in plaats van een foutmelding.
function afbeeldingBestaat(url) {
  return new Promise((klaar) => {
    const beeld = new Image();
    beeld.onload = () => klaar(true);
    beeld.onerror = () => klaar(false);
    beeld.src = url;
  });
}

// Laadt alle afbeeldingen en geluiden (zie assets.js) met een laadbalk in de stijl van het spel,
// en gaat daarna naar het inlogscherm.
export default class PreloadScene extends Phaser.Scene {
  constructor() {
    super('PreloadScene');
  }

  preload() {
    this.cameras.main.setBackgroundColor(CONFIG.kleurAchtergrond);

    this.add.text(BREEDTE / 2, HOOGTE / 2 - px(40), 'LADEN', {
      fontFamily: LETTERTYPE, fontSize: px(32) + 'px', color: '#ffe030', stroke: '#000000', strokeThickness: px(6),
    }).setOrigin(0.5);

    // De balk: een kader met daarin een gele vulling die meegroeit met het laden
    const balkBreedte = px(400);
    const balkHoogte = px(24);
    const x = (BREEDTE - balkBreedte) / 2;
    const y = HOOGTE / 2;
    this.add.rectangle(x, y, balkBreedte, balkHoogte).setOrigin(0, 0).setStrokeStyle(px(3), 0xffe030);
    const vulling = this.add.rectangle(x + px(5), y + px(5), 0, balkHoogte - px(10), 0xffe030).setOrigin(0, 0);
    const procent = this.add.text(BREEDTE / 2, y + balkHoogte + px(24), '0%', {
      fontFamily: LETTERTYPE, fontSize: px(12) + 'px', color: '#7fd4ff',
    }).setOrigin(0.5);

    this.load.on('progress', (waarde) => {
      vulling.width = (balkBreedte - px(10)) * waarde;
      procent.setText(Math.round(waarde * 100) + '%');
    });
    // Een bestand dat ontbreekt of niet laadt, laat het spel niet vastlopen
    this.load.on('loaderror', (bestand) => console.warn('Bestand niet geladen:', bestand.key, bestand.url));

    const basis = import.meta.env.BASE_URL; // '/' (de map 'public' staat in de root van de site)
    this.load.setPath(basis + 'assets/images/');
    for (const afbeelding of AFBEELDINGEN) this.load.image(afbeelding.sleutel, afbeelding.bestand);
    this.load.setPath(basis + 'assets/audio/');
    for (const geluid of GELUIDEN) this.load.audio(geluid.sleutel, geluid.bestanden);
  }

  async create() {
    // Staat een bestand in assets.js maar niet in de map (of is het kapot)? Dan melden we dat één keer.
    const ontbreekt = [
      ...AFBEELDINGEN.filter((a) => !this.textures.exists(a.sleutel)).map((a) => a.sleutel),
      ...GELUIDEN.filter((g) => !this.cache.audio.exists(g.sleutel)).map((g) => g.sleutel),
    ];
    if (ontbreekt.length > 0) {
      console.warn(`${ontbreekt.length} bestand(en) niet geladen: ${ontbreekt.join(', ')}. Controleer assets.js en de mappen in public/assets.`);
    }
    // Genummerde animatiebeeldjes van de duiker (duiker_01.png, duiker_02.png, ...): als ze bestaan,
    // spelen ze later af in plaats van de stilstaande afbeelding.
    await this.zoekAnimatie('duiker', 'duikerFrames', 'duiker-zwem');
    await this.zoekAnimatie('duiker_groot', 'duikerGrootFrames', 'duiker-groot-zwem');

    this.scene.start('LoginScene');
  }

  // Zoek bestanden voorvoegsel_01.png, voorvoegsel_02.png, ... (tot het eerste nummer dat ontbreekt),
  // laad ze en maak er een animatie van. Het aantal gevonden beeldjes komt in this.registry
  // (0 = geen animatie). De animatie heet 'animatieNaam'.
  async zoekAnimatie(voorvoegsel, registerSleutel, animatieNaam) {
    const map = import.meta.env.BASE_URL + 'assets/images/';
    const nummer = (n) => String(n).padStart(2, '0');

    let aantal = 0;
    while (aantal < MAX_ANIMATIEBEELDJES && await afbeeldingBestaat(`${map}${voorvoegsel}_${nummer(aantal + 1)}.png`)) aantal++;
    this.registry.set(registerSleutel, aantal);
    if (aantal === 0) return;

    // Laad de beeldjes en maak de animatie
    await new Promise((klaar) => {
      this.load.setPath(map);
      for (let n = 1; n <= aantal; n++) this.load.image(`${voorvoegsel}_${nummer(n)}`, `${voorvoegsel}_${nummer(n)}.png`);
      this.load.once('complete', klaar);
      this.load.start();
    });
    this.anims.create({
      key: animatieNaam,
      frames: Array.from({ length: aantal }, (_, i) => ({ key: `${voorvoegsel}_${nummer(i + 1)}` })),
      frameRate: CONFIG.duikerAnimatieFps,
      repeat: -1,
    });
    console.info(`Zwemanimatie '${voorvoegsel}': ${aantal} beeldjes gevonden.`);
  }
}
