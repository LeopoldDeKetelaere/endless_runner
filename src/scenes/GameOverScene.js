import Phaser from 'phaser';
import { BREEDTE, HOOGTE } from '../config.js';

export default class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOverScene');
  }

  create(data) {
    const midden = BREEDTE / 2;
    this.add.text(midden, HOOGTE * 0.28, 'Game over', {
      fontSize: '56px', color: '#ffffff',
    }).setOrigin(0.5);
    this.add.text(midden, HOOGTE * 0.48, 'Score: ' + (data.score ?? 0), {
      fontSize: '32px', color: '#ffe030',
    }).setOrigin(0.5);
    this.add.text(midden, HOOGTE * 0.7, 'Druk op spatie of tik om opnieuw te spelen', {
      fontSize: '20px', color: '#ffffff',
    }).setOrigin(0.5);

    // Korte pauze, zodat je niet per ongeluk meteen opnieuw start
    this.time.delayedCall(400, () => {
      this.input.keyboard.once('keydown-SPACE', () => this.scene.start('GameScene'));
      this.input.once('pointerdown', () => this.scene.start('GameScene'));
    });
  }
}
