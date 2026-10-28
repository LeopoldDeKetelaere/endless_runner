import Phaser from 'phaser';
import { BREEDTE, HOOGTE, CONFIG, px } from '../config.js';
import { maakAchtergrond } from '../achtergrond.js';

export default class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOverScene');
  }

  create(data) {
    this.achtergrond = maakAchtergrond(this, { menu: true });
    const midden = BREEDTE / 2;
    this.add.text(midden, HOOGTE * 0.28, 'Helaas, verloren', {
      fontSize: px(56) + 'px', color: '#ffffff',
    }).setOrigin(0.5);
    this.add.text(midden, HOOGTE * 0.48, 'Score: ' + (data.score ?? 0), {
      fontSize: px(32) + 'px', color: '#ffe030',
    }).setOrigin(0.5);
    this.add.text(midden, HOOGTE * 0.7, 'Druk op spatie of tik om naar het scorebord te gaan', {
      fontSize: px(20) + 'px', color: '#ffffff',
    }).setOrigin(0.5);

    // Het opslaan van de score is mislukt: laat het personeel dat duidelijk zien
    if (data.opgeslagen === false) {
      this.add.text(midden, HOOGTE * 0.88, 'SCORE NIET OPGESLAGEN!', {
        fontSize: px(18) + 'px', color: '#ff6b6b',
      }).setOrigin(0.5);
    }

    // Korte pauze, zodat je niet per ongeluk meteen doorklikt. Daarna gaat spatie (of tik)
    // naar het startscherm met het scorebord.
    this.time.delayedCall(400, () => {
      this.input.keyboard.once('keydown-SPACE', () => this.scene.start('StartScene'));
      this.input.once('pointerdown', () => this.scene.start('StartScene'));
    });

    // Doet niemand iets, dan gaat het scherm vanzelf naar het scorebord
    this.time.delayedCall(CONFIG.gameOverSeconden * 1000, () => this.scene.start('StartScene'));
  }

  update(tijd, delta) {
    this.achtergrond.update(delta);
  }
}
