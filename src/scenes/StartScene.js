import Phaser from 'phaser';
import { BREEDTE, HOOGTE, CONFIG } from '../config.js';
import { getTopScoresToday, getTopScoresAllTime } from '../scoreService.js';
import { voegTestspelersToe } from '../testdata.js';

const LETTERTYPE = '"Press Start 2P", monospace';
const MARGE = 16;
const PLAATS_TEKENS = 4; // "10. " of " 1. "

// Kort een tekst in met "…" als hij langer is dan 'max' tekens
function kort(tekst, max) {
  if (tekst.length <= max) return tekst;
  return tekst.slice(0, Math.max(max - 1, 0)).trimEnd() + '…';
}

// Eén regel van het scorebord, altijd precies 'tekens' tekens lang (het lettertype is monospace,
// dus alle kolommen lijnen netjes uit): "1. CAFÉ DE KROON (LEO) ...... 12450"
function maakRegel(plaats, item, tekens, scoreBreedte) {
  const voorvoegsel = String(plaats).padStart(2, ' ') + '. ';
  if (!item) return voorvoegsel + '.'.repeat(tekens - PLAATS_TEKENS); // lege plek

  const score = String(item.score).padStart(scoreBreedte, ' ');
  // Ruimte voor "BEDRIJF (VOORNAAM)": minstens 2 tekens over voor de puntjes (spatie, punt, spatie)
  const naamRuimte = tekens - PLAATS_TEKENS - scoreBreedte - 3;
  const voornaam = kort(item.voornaam.normalize('NFC').toUpperCase(), 8);
  const bedrijf = kort(item.bedrijf.normalize('NFC').toUpperCase(), naamRuimte - voornaam.length - 3);
  const naam = `${bedrijf} (${voornaam})`;
  const puntjes = '.'.repeat(Math.max(tekens - PLAATS_TEKENS - naam.length - scoreBreedte - 2, 1));
  return `${voorvoegsel}${naam} ${puntjes} ${score}`;
}

export default class StartScene extends Phaser.Scene {
  constructor() {
    super('StartScene');
  }

  create() {
    this.afgesloten = false;
    this.events.once('shutdown', () => { this.afgesloten = true; });
    this.cameras.main.setBackgroundColor(CONFIG.kleurAchtergrond);

    // Titel
    this.add.text(BREEDTE / 2, 36, CONFIG.spelTitel, {
      fontFamily: LETTERTYPE, fontSize: '40px', color: '#ffe030', stroke: '#000000', strokeThickness: 8,
    }).setOrigin(0.5);

    // Twee kolommen met de top 10
    const fontPx = CONFIG.scorebordLettergrootte;
    const kolomBreedte = (BREEDTE - 3 * MARGE) / 2;
    // Een teken is in dit lettertype precies even breed als de lettergrootte
    const proef = this.add.text(0, 0, 'M'.repeat(10), { fontFamily: LETTERTYPE, fontSize: fontPx + 'px' });
    this.tekens = Math.floor(kolomBreedte / (proef.width / 10));
    proef.destroy();

    this.kolommen = [
      { titel: 'TOP 10 VANDAAG', x: MARGE },
      { titel: 'TOP 10 ALLER TIJDEN', x: MARGE * 2 + kolomBreedte },
    ].map(({ titel, x }) => {
      this.add.text(x, 92, titel, { fontFamily: LETTERTYPE, fontSize: '16px', color: '#7fd4ff' });
      const regels = [];
      for (let i = 0; i < CONFIG.topAantal; i++) {
        regels.push(this.add.text(x, 124 + i * (fontPx + 14), '', {
          fontFamily: LETTERTYPE, fontSize: fontPx + 'px', color: '#ffffff',
        }));
      }
      return regels;
    });
    this.vulBorden();

    // Knipperende tekst
    const start = this.add.text(BREEDTE / 2, HOOGTE - 34, 'DRUK OP SPATIE', {
      fontFamily: LETTERTYPE, fontSize: '24px', color: '#ffffff', stroke: '#000000', strokeThickness: 6,
    }).setOrigin(0.5);
    this.time.addEvent({ delay: 500, loop: true, callback: () => start.setVisible(!start.visible) });

    // Spatie (of tik) gaat voorlopig rechtstreeks naar het spel
    this.input.keyboard.on('keydown-SPACE', () => this.scene.start('GameScene'));
    this.input.on('pointerdown', () => this.scene.start('GameScene'));

    // Testfunctie: toets T voegt nepspelers toe
    if (CONFIG.testfunctieAan) {
      this.meldingTekst = this.add.text(MARGE, HOOGTE - 12, 'TESTMODUS: TOETS T = 15 NEPSPELERS', {
        fontFamily: LETTERTYPE, fontSize: '8px', color: '#7fd4ff',
      }).setOrigin(0, 1).setAlpha(0.8);
      this.input.keyboard.on('keydown-T', async () => {
        await voegTestspelersToe();
        if (this.afgesloten) return;
        this.meldingTekst.setText('15 NEPSPELERS TOEGEVOEGD').setColor('#ffe030');
        this.vulBorden();
      });
    }
  }

  // Haal de toppen op en toon ze
  async vulBorden() {
    const [vandaag, alles] = await Promise.all([
      getTopScoresToday(CONFIG.topAantal),
      getTopScoresAllTime(CONFIG.topAantal),
    ]);
    if (this.afgesloten) return; // scherm is intussen verlaten

    [vandaag, alles].forEach((lijst, k) => {
      // Alle scores in een kolom krijgen dezelfde breedte, zodat de scores onder elkaar staan
      const scoreBreedte = Math.max(5, ...lijst.map((s) => String(s.score).length));
      this.kolommen[k].forEach((regel, i) => {
        regel.setText(maakRegel(i + 1, lijst[i], this.tekens, scoreBreedte));
        regel.setColor(lijst[i] ? '#ffffff' : '#4a6aa8'); // lege plekken dimmen
      });
    });
  }
}
