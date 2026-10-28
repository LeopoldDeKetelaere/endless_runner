import { BREEDTE, HOOGTE, CONFIG } from './config.js';

// De zee-achtergrond, gedeeld door alle schermen (zie CONFIG.achtergrond):
// - een hoofdlaag: de naadloze textuur (assets/images/achtergrond.png), eindeloos scrollend naar links
// - een tweede laag voor diepte: dezelfde textuur, groter en half doorzichtig, die trager scrollt
// - een optioneel kleurverloop erover (bovenaan lichter, onderaan donkerder)
// - in de menuschermen (optioneel) een donker, half doorzichtig vlak, zodat teksten goed leesbaar blijven
//
// Gebruik in een scène:
//   create():  this.achtergrond = maakAchtergrond(this, { menu: true });   // menu: stilstaand of heel traag, met donker vlak
//   update():  this.achtergrond.update(delta);                              // menu
//   of in het spel:  this.achtergrond = maakAchtergrond(this);  en  this.achtergrond.update(delta, this.snelheid);
// Ontbreekt de afbeelding, dan gebeurt er niets (de effen achtergrondkleur van de scène blijft).

const DIEPTE = -100; // onder alles

export function maakAchtergrond(scene, { menu = false } = {}) {
  const cfg = CONFIG.achtergrond;
  const lagen = [];

  if (cfg.aan && scene.textures.exists('achtergrond')) {
    // Hoofdlaag
    const hoofd = scene.add.tileSprite(0, 0, BREEDTE, HOOGTE, 'achtergrond').setOrigin(0, 0).setDepth(DIEPTE);
    hoofd.setAlpha(cfg.hoofdAlpha);
    lagen.push({ beeld: hoofd, snelheid: cfg.hoofdSnelheid, schaal: 1 });

    // Tweede laag: groter, half doorzichtig en trager. Begint op een andere plek, zodat de vlekken niet over elkaar liggen.
    if (cfg.laag2Aan) {
      const laag2 = scene.add.tileSprite(0, 0, BREEDTE, HOOGTE, 'achtergrond').setOrigin(0, 0).setDepth(DIEPTE + 1);
      laag2.setTileScale(cfg.laag2Schaal, cfg.laag2Schaal);
      laag2.setAlpha(cfg.laag2Alpha);
      laag2.tilePositionX = cfg.laag2Start;
      lagen.push({ beeld: laag2, snelheid: cfg.laag2Snelheid, schaal: cfg.laag2Schaal });
    }

    // Kleurverloop over de achtergrond
    if (cfg.verloopAan) {
      const verloop = scene.add.graphics().setDepth(DIEPTE + 2);
      verloop.fillGradientStyle(cfg.verloopBoven, cfg.verloopBoven, cfg.verloopOnder, cfg.verloopOnder,
        cfg.verloopBovenAlpha, cfg.verloopBovenAlpha, cfg.verloopOnderAlpha, cfg.verloopOnderAlpha);
      verloop.fillRect(0, 0, BREEDTE, HOOGTE);
    }
  }

  // Donker vlak in de menuschermen (ook als de afbeelding ontbreekt: dan is het gewoon wat donkerder)
  if (menu && cfg.menuVeilAlpha > 0) {
    scene.add.rectangle(0, 0, BREEDTE, HOOGTE, CONFIG.kleurAchtergrond, cfg.menuVeilAlpha).setOrigin(0, 0).setDepth(DIEPTE + 3);
  }

  return {
    // delta: ms sinds de vorige frame. snelheid: de spelsnelheid in pixels per seconde.
    // In een menu geven we geen snelheid mee: dan scrollt het heel traag (menuSnelheid pixels per seconde).
    update(delta, snelheid) {
      const dt = Math.min(delta, 100) / 1000;
      for (const laag of lagen) {
        const pixels = snelheid === undefined ? cfg.menuSnelheid * laag.snelheid / cfg.hoofdSnelheid : snelheid * laag.snelheid;
        laag.beeld.tilePositionX += (pixels * dt) / laag.schaal; // tilePositionX telt in pixels van de afbeelding zelf
      }
    },
  };
}
