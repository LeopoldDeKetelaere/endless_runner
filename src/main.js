import Phaser from 'phaser';

class MainScene extends Phaser.Scene {
  create() {
    this.add
      .text(400, 300, 'Endless Runner', { fontSize: '48px', color: '#ffffff' })
      .setOrigin(0.5);
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  parent: 'game',
  backgroundColor: '#1d2b53',
  scene: MainScene,
});
