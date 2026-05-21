/**
 * 80米无线电测向模拟器 - 主入口与生命周期协调器
 * 连接游戏引擎、音频系统、画布渲染器和 UI 事件，驱动 requestAnimationFrame 主循环
 */

import { GameEngine } from './game-engine.js';
import { AudioEngine } from './audio-engine.js';
import { MapRenderer } from './map-renderer.js';
import { UIController } from './ui-controller.js';

class App {
    constructor() {
        this.game = new GameEngine();
        this.audio = new AudioEngine();
        
        // 获取画布
        const canvas = document.getElementById('game-canvas');
        this.renderer = new MapRenderer(canvas);
        
        // 初始化控制器
        this.ui = new UIController(this.game, this.audio);
        
        // 绑定重置
        this.ui.resetGame();
        
        // 开启循环
        this.tick = this.tick.bind(this);
        requestAnimationFrame(this.tick);
    }

    /**
     * 游戏主循环 (约 60 帧每秒)
     */
    tick() {
        // 1. 物理位置与按键驱动更新
        this.game.update(this.ui.keys);
        
        // 2. 音频位置物理场和距离/方向计算
        const audioResult = this.audio.update(
            this.game.player,
            this.game.player.angle,
            this.game.fox
        );
        
        // 3. 画图渲染
        const showFoxDev = this.ui.dom.showFoxCheckbox.checked;
        this.renderer.draw(this.game, showFoxDev);
        
        // 4. 更新 S仪表
        this.ui.updateSMeter(audioResult.signalStrength);
        
        // 5. 更新仪表盘各种数值状态
        this.ui.updateDashboard(audioResult.activeStation);
        
        // 循环执行下一帧
        requestAnimationFrame(this.tick);
    }
}

// 页面加载完成后实例化应用
window.addEventListener('DOMContentLoaded', () => {
    new App();
});
