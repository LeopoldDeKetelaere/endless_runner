import Phaser from 'phaser';
import { BREEDTE, HOOGTE, CONFIG } from '../config.js';

export default class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOverScene');
  }

  create(data) {
    const midden = BREEDTE / 2;
    this.add.text(midden, HOOGTE * 0.28, 'Helaas, verloren', {
      fontSize: '56px', color: '#ffffff',
    }).setOrigin(0.5);
    this.add.text(midden, HOOGTE * 0.48, 'Score: ' + (data.score ?? 0), {
      fontSize: '32px', color: '#ffe030',
    }).setOrigin(0.5);
    this.add.text(midden, HOOGTE * 0.7, 'Druk op spatie of tik om naar het scorebord te gaan', {
      fontSize: '20px', color: '#ffffff',
    }).setOrigin(0.5);

    // Korte pauze, zodat je niet per ongeluk meteen doorklikt. Daarna gaat spatie (of tik)
    // naar het startscherm met het scorebord.
    this.time.delayedCall(400, () => {
      this.input.keyboard.once('keydown-SPACE', () => this.scene.start('StartScene'));
      this.input.once('pointerdown', () => this.scene.start('StartScene'));
    });

    // Doet niemand iets, dan gaat het scherm vanzelf naar het scorebord
    this.time.delayedCall(CONFIG.gameOverSeconden * 1000, () => this.scene.start('StartScene'));
  }
}
