import Phaser from 'phaser';
import { BREEDTE, HOOGTE, CONFIG, px } from '../config.js';
import { AFBEELDINGEN, GELUIDEN } from '../assets.js';

const LETTERTYPE = '"Press Start 2P", monospace';

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

  create() {
    // Staat een bestand in assets.js maar niet in de map (of is het kapot)? Dan melden we dat één keer.
    const ontbreekt = [
      ...AFBEELDINGEN.filter((a) => !this.textures.exists(a.sleutel)).map((a) => a.sleutel),
      ...GELUIDEN.filter((g) => !this.cache.audio.exists(g.sleutel)).map((g) => g.sleutel),
    ];
    if (ontbreekt.length > 0) {
      console.warn(`${ontbreekt.length} bestand(en) niet geladen: ${ontbreekt.join(', ')}. Controleer assets.js en de mappen in public/assets.`);
    }
    this.scene.start('LoginScene');
  }
}
