/**
 * 80米无线电测向模拟器 - 音频合成与处理引擎
 * 使用 Web Audio API 纯底层合成，无需外部音频文件
 */

// 莫尔斯电码映射表（包含字间与元件间延迟）
const MORSE_PATTERNS = {
    'M': [1, 1, 1, 0, 1, 1, 1, 0], // --
    'O': [1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0], // ---
    '0': [1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0], // -----
    '1': [1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0], // .----
    '2': [1, 0, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0], // ..---
    '3': [1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0], // ...--
    '4': [1, 0, 1, 0, 1, 0, 1, 0, 1, 1, 1, 0], // ....-
    '5': [1, 0, 1, 0, 1, 0, 1, 0, 1, 0], // .....
    '6': [1, 1, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0], // -....
    '7': [1, 1, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 0], // --...
    '8': [1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0], // ---..
    '9': [1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 0] // ----.
};

// 将电台代号转换为位序列（1表示有声，0表示无声）
function generateMorseSequence(word) {
    let sequence = [];
    const charGap = [0, 0]; // 字母间隔
    
    for (let i = 0; i < word.length; i++) {
        const char = word[i].toUpperCase();
        if (MORSE_PATTERNS[char]) {
            sequence = sequence.concat(MORSE_PATTERNS[char]);
            if (i < word.length - 1) {
                sequence = sequence.concat(charGap);
            }
        }
    }
    // 单词末尾添加长停顿
    sequence = sequence.concat([0, 0, 0, 0, 0, 0]);
    return sequence;
}

export class AudioEngine {
    constructor() {
        this.ctx = null;
        this.initialized = false;
        
        // 11个候选电台（0-9 和 MO）
        this.stations = [
            { id: 'MO', name: 'MO 电台', code: 'MO' },
            { id: '0', name: '0号电台', code: '0' },
            { id: '1', name: '1号电台', code: '1' },
            { id: '2', name: '2号电台', code: '2' },
            { id: '3', name: '3号电台', code: '3' },
            { id: '4', name: '4号电台', code: '4' },
            { id: '5', name: '5号电台', code: '5' },
            { id: '6', name: '6号电台', code: '6' },
            { id: '7', name: '7号电台', code: '7' },
            { id: '8', name: '8号电台', code: '8' },
            { id: '9', name: '9号电台', code: '9' }
        ];
        
        this.activeStationId = 'MO'; // 当前正在接收的电台ID
        this.masterVolume = 0.5;      // 主音量
        
        // Web Audio 节点
        this.noiseNode = null;
        this.noiseGain = null;
        this.signalSource = null;
        this.signalGain = null;
        this.masterGain = null;
        this.bandpassFilter = null;
        
        // 预渲染的电台音频缓存
        this.stationBuffers = {};
        this.noiseBuffer = null;
        
        // 实时状态输出
        this.latestSignalStrength = 0;

        // 地图对角线长度 (750x750)
        this.mapDiagonal = Math.sqrt(750 * 750 + 750 * 750);
    }

    /**
     * 初始化 AudioContext 并生成所有电台音频缓存
     */
    async init() {
        if (this.initialized) return;
        
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContextClass();
        
        const sampleRate = this.ctx.sampleRate;
        const tickDuration = 0.08;
        const toneFreq = 800;
        
        // 1. 为每个电台预先合成莫尔斯电码 AudioBuffer
        this.stations.forEach(station => {
            const sequence = generateMorseSequence(station.code);
            const totalTicks = sequence.length;
            const durationSec = totalTicks * tickDuration;
            const bufferSize = Math.floor(sampleRate * durationSec);
            
            const buffer = this.ctx.createBuffer(1, bufferSize, sampleRate);
            const data = buffer.getChannelData(0);
            
            const fadeSamples = Math.floor(sampleRate * 0.005); 
            
            for (let i = 0; i < bufferSize; i++) {
                const t = i / sampleRate;
                const tickIndex = Math.floor(t / tickDuration);
                const isTone = sequence[tickIndex] === 1;
                
                if (isTone) {
                    let amp = Math.sin(2 * Math.PI * toneFreq * t);
                    const tickStartSample = Math.floor(tickIndex * tickDuration * sampleRate);
                    const tickEndSample = Math.floor((tickIndex + 1) * tickDuration * sampleRate);
                    
                    let fade = 1.0;
                    if (tickIndex === 0 || sequence[tickIndex - 1] === 0) {
                        const distFromStart = i - tickStartSample;
                        if (distFromStart < fadeSamples) {
                            fade = distFromStart / fadeSamples;
                        }
                    }
                    if (tickIndex === totalTicks - 1 || sequence[tickIndex + 1] === 0) {
                        const distFromEnd = tickEndSample - i;
                        if (distFromEnd < fadeSamples) {
                            fade = Math.min(fade, distFromEnd / fadeSamples);
                        }
                    }
                    
                    data[i] = amp * fade * 0.5;
                } else {
                    data[i] = 0;
                }
            }
            this.stationBuffers[station.id] = buffer;
        });
        
        // 2. 生成白噪音 Buffer
        const noiseBufferSize = sampleRate;
        this.noiseBuffer = this.ctx.createBuffer(1, noiseBufferSize, sampleRate);
        const noiseData = this.noiseBuffer.getChannelData(0);
        for (let i = 0; i < noiseBufferSize; i++) {
            noiseData[i] = Math.random() * 2 - 1;
        }
        
        // 3. 构建音频链路
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = this.masterVolume * 4;
        this.masterGain.connect(this.ctx.destination);
        
        this.bandpassFilter = this.ctx.createBiquadFilter();
        this.bandpassFilter.type = 'bandpass';
        this.bandpassFilter.frequency.value = toneFreq;
        this.bandpassFilter.Q.value = 1.0;
        this.bandpassFilter.connect(this.masterGain);
        
        this.noiseGain = this.ctx.createGain();
        this.noiseGain.gain.value = 0.08;
        this.noiseGain.connect(this.bandpassFilter);
        
        this.signalGain = this.ctx.createGain();
        this.signalGain.gain.value = 0;
        this.signalGain.connect(this.masterGain);
        
        this.initialized = true;
    }

    /**
     * 启动音频
     */
    start() {
        if (!this.initialized) return;
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
        
        this.noiseNode = this.ctx.createBufferSource();
        this.noiseNode.buffer = this.noiseBuffer;
        this.noiseNode.loop = true;
        this.noiseNode.connect(this.noiseGain);
        this.noiseNode.start();
        
        this.playActiveStation();
    }

    /**
     * 播放当前选中的电台呼号
     */
    playActiveStation() {
        if (!this.initialized) return;
        
        if (this.signalSource) {
            try {
                this.signalSource.stop();
            } catch (e) {}
            this.signalSource.disconnect();
            this.signalSource = null;
        }
        
        const station = this.stations.find(st => st.id === this.activeStationId);
        
        if (station) {
            const buffer = this.stationBuffers[station.id];
            this.signalSource = this.ctx.createBufferSource();
            this.signalSource.buffer = buffer;
            this.signalSource.loop = true;
            this.signalSource.connect(this.signalGain);
            this.signalSource.start();
        }
    }

    /**
     * 切换播放的电台
     * @param {string} stationId 电台ID (0-9 或 MO)
     */
    setActiveStation(stationId) {
        this.activeStationId = stationId;
        if (this.initialized && this.noiseNode) {
            this.playActiveStation();
        }
    }

    /**
     * 停止音频
     */
    stop() {
        if (this.noiseNode) {
            try { this.noiseNode.stop(); } catch(e){}
            this.noiseNode.disconnect();
            this.noiseNode = null;
        }
        if (this.signalSource) {
            try { this.signalSource.stop(); } catch(e){}
            this.signalSource.disconnect();
            this.signalSource = null;
        }
    }

    /**
     * 调节主音量
     * @param {number} value 0.0 - 1.0
     */
    setVolume(value) {
        this.masterVolume = Math.max(0, Math.min(1, value));
        if (this.masterGain) {
            this.masterGain.gain.setTargetAtTime(this.masterVolume * 4, this.ctx.currentTime, 0.01);
        }
    }

    /**
     * 物理衰减计算 (已移除频率偏差衰减)
     * @param {Object} playerPos {x, y}
     * @param {number} playerAngle 身体朝向
     * @param {Object} foxPos {x, y} 电台坐标
     */
    update(playerPos, playerAngle, foxPos) {
        if (!this.initialized || !this.noiseNode) return { signalStrength: 0, activeStation: null };
        
        let signalStrength = 0;
        let activeStation = null;
        
        const dx = foxPos.x - playerPos.x;
        const dy = foxPos.y - playerPos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        // 1. 距离衰减 (D0越小衰减越明显)
        const D0 = 15;
        const distGain = D0 / (D0 + dist);

        // 2. 方向图衰减 (8字形，哑点线在身体垂直方向)
        const angleToFox = Math.atan2(dy, dx);
        let relativeAngle = angleToFox - playerAngle;
        relativeAngle = Math.atan2(Math.sin(relativeAngle), Math.cos(relativeAngle));

        const dirGain = Math.abs(Math.cos(relativeAngle));

        // 综合增益
        const finalSignalGain = distGain * dirGain;

        // 控制信号音量
        this.signalGain.gain.setTargetAtTime(finalSignalGain * 1.5, this.ctx.currentTime, 0.02);
        
        // 噪音与距离成正比：越远噪音越大
        const noiseLevel = 0.015 + (dist / this.mapDiagonal) * 0.05;
        this.noiseGain.gain.setTargetAtTime(noiseLevel, this.ctx.currentTime, 0.05);
        
        // 信号强度分度 (0 - 100)
        signalStrength = Math.round(Math.pow(finalSignalGain, 0.7) * 100);
        
        activeStation = this.stations.find(st => st.id === this.activeStationId);
        
        // 注入抖动
        if (signalStrength > 0) {
            const jitter = (Math.random() - 0.5) * 4;
            this.latestSignalStrength = Math.max(0, Math.min(100, signalStrength + jitter));
        } else {
            const jitter = Math.random() * 2;
            this.latestSignalStrength = Math.max(0, jitter);
        }
        
        return {
            signalStrength: this.latestSignalStrength,
            activeStation: activeStation
        };
    }
}
