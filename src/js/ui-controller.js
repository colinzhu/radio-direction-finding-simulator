/**
 * 80米无线电测向模拟器 - UI交互与控制模块
 * 负责旋钮旋转交互、指针式 S表数学刻度映射、键盘状态机、数字面板及调试浮层更新
 */

export class UIController {
    /**
     * @param {GameEngine} game 游戏引擎实例
     * @param {AudioEngine} audio 音频引擎实例
     */
    constructor(game, audio) {
        this.game = game;
        this.audio = audio;
        
        // 键盘按键状态机
        this.keys = {
            forward: false,
            backward: false,
            left: false,
            right: false
        };
        
        // 缓存 DOM 元素
        this.dom = {
            powerBtn: document.getElementById('power-btn'),
            rxStatusText: document.getElementById('rx-status-text'),
            sMeterNeedle: document.getElementById('s-meter-needle'),
            sValueDisplay: document.getElementById('s-value-display'),
            foxIdDisplay: document.getElementById('fox-id-display'),
            morseCodeDisplay: document.getElementById('morse-code-display'),
            compassDisplay: document.getElementById('compass-display'),
            nullLineCount: document.getElementById('null-line-count'),
            
            volumeKnob: document.getElementById('volume-knob'),
            volumeVal: document.getElementById('volume-value-display'),
            volumeContainer: document.getElementById('volume-knob-container'),
            
            markNullBtn: document.getElementById('mark-null-btn'),
            clearNullBtn: document.getElementById('clear-null-btn'),
            
            showFoxCheckbox: document.getElementById('show-fox-checkbox'),
            resetGameBtn: document.getElementById('reset-game-btn'),
            debugInfoPanel: document.getElementById('debug-info-panel'),
            
            debugFoxX: document.getElementById('debug-fox-x'),
            debugFoxY: document.getElementById('debug-fox-y'),
            debugPlayerX: document.getElementById('debug-player-x'),
            debugPlayerY: document.getElementById('debug-player-y'),
            debugDistance: document.getElementById('debug-distance'),
            debugRelativeAngle: document.getElementById('debug-relative-angle'),
            
            victoryOverlay: document.getElementById('victory-overlay'),
            victoryDetails: document.getElementById('victory-details'),
            nextGameBtn: document.getElementById('next-game-btn')
        };
        
        // 初始化绑定
        this.initEvents();
    }

    /**
     * 初始化事件监听器
     */
    initEvents() {
        // 1. 电源开关 (解锁 Web Audio)
        this.dom.powerBtn.addEventListener('click', () => this.togglePower());
        
        // 2. 旋钮拖拽处理
        this.setupKnobDrag(this.dom.volumeContainer, this.dom.volumeKnob, -135, 135, (ratio) => {
            const volPercent = Math.round(ratio * 100);
            this.dom.volumeVal.textContent = `${volPercent}%`;
            this.audio.setVolume(ratio);
        });
        
        // 3. 辅助按键绑定
        this.dom.markNullBtn.addEventListener('click', () => this.markNullLine());
        this.dom.clearNullBtn.addEventListener('click', () => this.clearNullLines());
        this.dom.resetGameBtn.addEventListener('click', () => this.resetGame());
        this.dom.nextGameBtn.addEventListener('click', () => this.resetGame());
        
        // 4. 调试选项
        this.dom.showFoxCheckbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                this.dom.debugInfoPanel.classList.remove('hidden');
            } else {
                this.dom.debugInfoPanel.classList.add('hidden');
            }
        });
        
        // 5. 键盘输入监听
        window.addEventListener('keydown', (e) => this.handleKeyDown(e));
        window.addEventListener('keyup', (e) => this.handleKeyUp(e));
    }

    /**
     * 拨动接收机电源开关
     */
    async togglePower() {
        if (!this.audio.initialized) {
            this.dom.rxStatusText.textContent = '启动中...';
            await this.audio.init();
            // 确保播放的是当前游戏分配的目标电台呼号
            this.audio.setActiveStation(this.game.fox.id);
        }
        
        const isOff = this.dom.powerBtn.classList.contains('off');
        if (isOff) {
            this.dom.powerBtn.classList.remove('off');
            this.dom.powerBtn.classList.add('on');
            this.dom.powerBtn.querySelector('.switch-text').textContent = 'ON';
            this.dom.rxStatusText.textContent = '工作中';
            this.dom.rxStatusText.className = 'status-val text-neon-green';
            document.querySelector('.status-dot').className = 'status-dot green';
            this.audio.start();
        } else {
            this.dom.powerBtn.classList.remove('on');
            this.dom.powerBtn.classList.add('off');
            this.dom.powerBtn.querySelector('.switch-text').textContent = 'OFF';
            this.dom.rxStatusText.textContent = '关机';
            this.dom.rxStatusText.className = 'status-val';
            document.querySelector('.status-dot').className = 'status-dot';
            this.audio.stop();
            this.updateSMeter(0);
        }
    }

    /**
     * 处理键盘按下事件
     */
    handleKeyDown(e) {
        if (this.game.isVictory) return;
        
        switch (e.key.toLowerCase()) {
            case 'arrowup':
            case 'w':
                this.keys.forward = true;
                e.preventDefault();
                break;
            case 'arrowdown':
            case 's':
                this.keys.backward = true;
                e.preventDefault();
                break;
            case 'arrowleft':
            case 'a':
                this.keys.left = true;
                e.preventDefault();
                break;
            case 'arrowright':
            case 'd':
                this.keys.right = true;
                e.preventDefault();
                break;
            case 'l': // 标记哑点线
                this.markNullLine();
                break;
            case 'c': // 清空哑点线
                this.clearNullLines();
                break;
        }
    }

    /**
     * 处理键盘松开事件
     */
    handleKeyUp(e) {
        switch (e.key.toLowerCase()) {
            case 'arrowup':
            case 'w':
                this.keys.forward = false;
                break;
            case 'arrowdown':
            case 's':
                this.keys.backward = false;
                break;
            case 'arrowleft':
            case 'a':
                this.keys.left = false;
                break;
            case 'arrowright':
            case 'd':
                this.keys.right = false;
                break;
        }
    }

    /**
     * 点击或按键标记哑点线
     */
    markNullLine() {
        if (this.dom.powerBtn.classList.contains('off')) return;
        this.game.addNullLine();
        this.dom.nullLineCount.textContent = this.game.nullLines.length;
        
        // 按钮点击动效反馈
        this.dom.markNullBtn.style.transform = 'scale(0.95)';
        setTimeout(() => this.dom.markNullBtn.style.transform = 'scale(1)', 100);
    }

    /**
     * 清除哑点线
     */
    clearNullLines() {
        this.game.clearNullLines();
        this.dom.nullLineCount.textContent = 0;
    }

    /**
     * 旋转物理旋钮的通用拖拽逻辑 (支持鼠标和触屏)
     */
    setupKnobDrag(container, knob, minDeg, maxDeg, onChange) {
        let isDragging = false;
        let currentRotation = 0;
        
        const match = knob.style.transform.match(/rotate\(([-\d.]+)deg\)/);
        if (match) {
            currentRotation = parseFloat(match[1]);
        }

        const handleStart = (clientX, clientY) => {
            isDragging = true;
            document.body.style.userSelect = 'none';
        };

        const handleMove = (clientX, clientY) => {
            if (!isDragging) return;
            
            const rect = container.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            
            const dx = clientX - centerX;
            const dy = clientY - centerY;
            
            let angleRad = Math.atan2(dy, dx);
            let angleDeg = angleRad * (180 / Math.PI) + 90;
            
            if (angleDeg > 180) angleDeg -= 360;
            if (angleDeg < -180) angleDeg += 360;
            
            if (angleDeg >= minDeg && angleDeg <= maxDeg) {
                currentRotation = angleDeg;
                knob.style.transform = `rotate(${currentRotation}deg)`;
                
                const ratio = (currentRotation - minDeg) / (maxDeg - minDeg);
                onChange(ratio);
            }
        };

        const handleEnd = () => {
            isDragging = false;
            document.body.style.userSelect = '';
        };

        container.addEventListener('mousedown', (e) => handleStart(e.clientX, e.clientY));
        window.addEventListener('mousemove', (e) => handleMove(e.clientX, e.clientY));
        window.addEventListener('mouseup', handleEnd);

        container.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                handleStart(e.touches[0].clientX, e.touches[0].clientY);
            }
        }, { passive: true });
        window.addEventListener('touchmove', (e) => {
            if (isDragging && e.touches.length === 1) {
                handleMove(e.touches[0].clientX, e.touches[0].clientY);
            }
        }, { passive: false });
        window.addEventListener('touchend', handleEnd);
    }

    /**
     * 重置游戏
     */
    resetGame() {
        this.game.resetGame(this.audio.stations);
        this.audio.setActiveStation(this.game.fox.id); // 同步声音模块的目标电台ID
        this.dom.nullLineCount.textContent = 0;
        this.dom.victoryOverlay.classList.add('hidden');
        
        // 重置电台显示面板
        this.dom.foxIdDisplay.textContent = '--';
        this.dom.morseCodeDisplay.textContent = '--';
        
        // 如果电源已打开，需要同步更新播放状态
        if (this.dom.powerBtn.classList.contains('on')) {
            this.audio.playActiveStation();
        }
    }

    /**
     * 更新 S表 刻度显示
     */
    updateSMeter(strength) {
        if (this.dom.powerBtn.classList.contains('off')) {
            this.dom.sMeterNeedle.style.transform = 'rotate(-60deg)';
            this.dom.sValueDisplay.textContent = 'S0 (--- dBm)';
            return;
        }
        
        const needleAngle = -60 + (strength / 100) * 120;
        this.dom.sMeterNeedle.style.transform = `rotate(${needleAngle}deg)`;
        
        let sText = '';
        let dbm = -121 + Math.round(strength * 0.88);
        
        if (strength < 90) {
            const sUnit = Math.floor(strength / 10);
            sText = `S${sUnit}`;
        } else {
            const dbOver = (strength - 90) * 4;
            sText = `S9 + ${dbOver}dB`;
        }
        
        this.dom.sValueDisplay.textContent = `${sText} (${dbm} dBm)`;
    }

    /**
     * 刷新面板上的其它文字与调试数据
     */
    updateDashboard(activeStation) {
        // 1. 罗盘朝向
        let headingDeg = Math.round(this.game.player.angle * (180 / Math.PI));
        if (headingDeg < 0) headingDeg += 360;
        
        const directions = ['北', '东北', '东', '东南', '南', '西南', '西', '西北'];
        const dirIndex = Math.round(headingDeg / 45) % 8;
        this.dom.compassDisplay.textContent = `${headingDeg}° (${directions[dirIndex]})`;
        
        // 2. 显示当前电台呼号与对应的莫尔斯码
        if (activeStation && !this.dom.powerBtn.classList.contains('off')) {
            this.dom.foxIdDisplay.textContent = activeStation.name;
            
            const morseMap = {
                'M': '--', 'O': '---',
                '0': '-----', '1': '.----', '2': '..---', '3': '...--', '4': '....-',
                '5': '.....', '6': '-....', '7': '--...', '8': '---..', '9': '----.'
            };
            const mCode = activeStation.code.split('').map(c => morseMap[c] || '').join(' ');
            this.dom.morseCodeDisplay.textContent = mCode;
        } else {
            this.dom.foxIdDisplay.textContent = '--';
            this.dom.morseCodeDisplay.textContent = '--';
        }
        
        // 3. 更新调试面板数值
        if (this.dom.showFoxCheckbox.checked) {
            this.dom.debugFoxX.textContent = this.game.fox.x;
            this.dom.debugFoxY.textContent = this.game.fox.y;
            this.dom.debugPlayerX.textContent = Math.round(this.game.player.x);
            this.dom.debugPlayerY.textContent = Math.round(this.game.player.y);
            
            const dx = this.game.fox.x - this.game.player.x;
            const dy = this.game.fox.y - this.game.player.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            
            this.dom.debugDistance.textContent = Math.round(dist * 0.5);
            
            let relAngle = Math.atan2(dy, dx) - this.game.player.angle;
            relAngle = Math.atan2(Math.sin(relAngle), Math.cos(relAngle));
            const relDeg = Math.round(relAngle * (180 / Math.PI));
            this.dom.debugRelativeAngle.textContent = relDeg;
        }
        
        // 4. 胜利弹窗
        if (this.game.isVictory && this.dom.victoryOverlay.classList.contains('hidden')) {
            this.dom.victoryOverlay.classList.remove('hidden');
            this.dom.victoryDetails.textContent = `你共画了 ${this.game.nullLines.length} 条哑点线，探索行走约 ${Math.round(this.game.player.distanceWalked)} 米，耗时 ${this.game.gameTime} 秒。`;
            this.audio.stop();
        }
    }
}
