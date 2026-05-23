/**
 * 80米无线电测向模拟器 - Canvas 画布渲染引擎
 * 负责绘制公园地形、障碍物、行动轨迹、身体与天线朝向以及交汇的哑点线
 */

export class MapRenderer {
    /**
     * @param {HTMLCanvasElement} canvas 画布元素
     */
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        
        // 动画变量
        this.waveRadius = 0;
        this.waterOffset = 0;
    }

    /**
     * 主渲染函数
     * @param {Object} game 游戏状态 (GameEngine 实例)
     * @param {boolean} devShowFox 是否强制显示电台 (调试用)
     */
    draw(game, devShowFox) {
        // 1. 清空画布并绘制草地背景
        this.ctx.fillStyle = '#141c18'; // 深草绿色底色
        this.ctx.fillRect(0, 0, game.width, game.height);
        
        // 2. 绘制草地噪点或微弱网格，提升质感
        this.drawGrassGrid(game.width, game.height);
        
        // 3. 绘制公园装饰性小路
        this.drawParkPaths();
        
        // 4. 绘制自然障碍物
        game.obstacles.forEach(obs => {
            this.drawObstacle(obs);
        });
        
        // 5. 绘制历史轨迹
        this.drawTrail(game.trail);
        
        // 6. 绘制已被记录的“哑点线”
        this.drawNullLines(game.nullLines);
        
        // 7. 绘制隐藏的或已找到的“电台”
        if (devShowFox || game.fox.isFound) {
            this.drawFox(game.fox, game.isVictory);
        }
        
        // 8. 绘制玩家（身体及头顶垂直的磁棒天线）
        this.drawPlayer(game.player);
    }

    /**
     * 绘制细微的草地底盘网格
     */
    drawGrassGrid(w, h) {
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.015)';
        this.ctx.lineWidth = 1;
        const gridSize = 40;
        
        this.ctx.beginPath();
        for (let x = 0; x < w; x += gridSize) {
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, h);
        }
        for (let y = 0; y < h; y += gridSize) {
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(w, y);
        }
        this.ctx.stroke();
    }

    /**
     * 绘制公园的弯曲装饰道路（使2D地图更生动）
     */
    drawParkPaths() {
        this.ctx.strokeStyle = '#1a221f';
        this.ctx.lineWidth = 24;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        
        // 绘制主干道
        this.ctx.beginPath();
        this.ctx.moveTo(63, 625);
        this.ctx.quadraticCurveTo(375, 600, 375, 375);
        this.ctx.quadraticCurveTo(375, 150, 688, 125);
        this.ctx.stroke();

        // 支路
        this.ctx.lineWidth = 14;
        this.ctx.strokeStyle = '#18201d';
        this.ctx.beginPath();
        this.ctx.moveTo(375, 475);
        this.ctx.quadraticCurveTo(125, 438, 100, 250);
        this.ctx.moveTo(375, 313);
        this.ctx.quadraticCurveTo(625, 350, 650, 500);
        this.ctx.stroke();
    }

    /**
     * 绘制具体障碍物
     */
    drawObstacle(obs) {
        this.ctx.save();
        
        if (obs.type === 'pond') {
            // 绘制中心大池塘（带水波动画）
            this.waterOffset = (this.waterOffset + 0.05) % (Math.PI * 2);
            
            // 岸边
            this.ctx.fillStyle = '#1c2e28';
            this.ctx.beginPath();
            this.ctx.arc(obs.x, obs.y, obs.r + 3, 0, Math.PI * 2);
            this.ctx.fill();
            
            // 水体渐变
            const grad = this.ctx.createRadialGradient(obs.x, obs.y, 5, obs.x, obs.y, obs.r);
            grad.addColorStop(0, '#0d253f');
            grad.addColorStop(1, '#1b4461');
            
            this.ctx.fillStyle = grad;
            this.ctx.beginPath();
            this.ctx.arc(obs.x, obs.y, obs.r, 0, Math.PI * 2);
            this.ctx.fill();
            
            // 荡漾的小波纹
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
            this.ctx.lineWidth = 1;
            this.ctx.beginPath();
            this.ctx.arc(obs.x, obs.y, obs.r - 20 + Math.sin(this.waterOffset) * 2, 0, Math.PI * 2);
            this.ctx.arc(obs.x, obs.y, obs.r - 40 + Math.cos(this.waterOffset) * 2, 0, Math.PI * 2);
            this.ctx.stroke();
            
        } else if (obs.type === 'forest') {
            // 绘制绿荫树木林
            const grad = this.ctx.createRadialGradient(obs.x, obs.y, 2, obs.x, obs.y, obs.r);
            grad.addColorStop(0, '#2d5a27');
            grad.addColorStop(0.7, '#1b3e18');
            grad.addColorStop(1, '#0e240c');
            
            // 外圈树荫阴影
            this.ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
            this.ctx.shadowBlur = 10;
            
            this.ctx.fillStyle = grad;
            this.ctx.beginPath();
            this.ctx.arc(obs.x, obs.y, obs.r, 0, Math.PI * 2);
            this.ctx.fill();
            
            // 绘制几棵大树的微小轮廓
            this.ctx.shadowBlur = 0;
            this.ctx.fillStyle = '#0f200c';
            this.ctx.beginPath();
            this.ctx.arc(obs.x - obs.r*0.3, obs.y - obs.r*0.2, obs.r*0.4, 0, Math.PI*2);
            this.ctx.arc(obs.x + obs.r*0.2, obs.y + obs.r*0.3, obs.r*0.35, 0, Math.PI*2);
            this.ctx.arc(obs.x + obs.r*0.3, obs.y - obs.r*0.4, obs.r*0.3, 0, Math.PI*2);
            this.ctx.fill();
            
        } else if (obs.type === 'rock') {
            // 绘制乱石群
            this.ctx.fillStyle = '#3a4440';
            this.ctx.strokeStyle = '#272d2b';
            this.ctx.lineWidth = 3;
            
            this.ctx.beginPath();
            this.ctx.arc(obs.x, obs.y, obs.r, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.stroke();
            
            // 碎石刻痕
            this.ctx.fillStyle = '#515e58';
            this.ctx.beginPath();
            this.ctx.arc(obs.x - 10, obs.y - 5, obs.r * 0.4, 0, Math.PI * 2);
            this.ctx.arc(obs.x + 12, obs.y + 8, obs.r * 0.35, 0, Math.PI * 2);
            this.ctx.fill();
            
        } else if (obs.type === 'structure') {
            // 红色亭子
            this.ctx.fillStyle = '#6d2626'; // 基座
            this.ctx.beginPath();
            this.ctx.arc(obs.x, obs.y, obs.r, 0, Math.PI*2);
            this.ctx.fill();
            
            // 亭顶（八角形或正方形）
            this.ctx.fillStyle = '#d63031';
            this.ctx.beginPath();
            this.ctx.moveTo(obs.x - obs.r * 0.8, obs.y - obs.r * 0.8);
            this.ctx.lineTo(obs.x + obs.r * 0.8, obs.y - obs.r * 0.8);
            this.ctx.lineTo(obs.x + obs.r * 0.8, obs.y + obs.r * 0.8);
            this.ctx.lineTo(obs.x - obs.r * 0.8, obs.y + obs.r * 0.8);
            this.ctx.closePath();
            this.ctx.fill();
            
            // 亭尖
            this.ctx.fillStyle = '#ffeaa7';
            this.ctx.beginPath();
            this.ctx.arc(obs.x, obs.y, 4, 0, Math.PI*2);
            this.ctx.fill();
        }
        
        this.ctx.restore();
    }

    /**
     * 绘制已标记的哑点线（垂直于当时玩家身体朝向）
     */
    drawNullLines(lines) {
        if (lines.length === 0) return;
        
        this.ctx.save();
        this.ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)'; // 亮青色
        this.ctx.lineWidth = 1.5;
        this.ctx.setLineDash([6, 6]); // 虚线形式
        
        // 阴影发光特效
        this.ctx.shadowColor = '#00f0ff';
        this.ctx.shadowBlur = 4;
        
        lines.forEach(line => {
            // 计算垂直方向的单位向量
            // 玩家当时朝向角为 angle
            // 垂直向量即为 (cos(angle), sin(angle))
            const cos = Math.cos(line.angle);
            const sin = Math.sin(line.angle);
            
            // 绘制贯穿整张地图的长虚线 (沿垂直向量两端延伸)
            const length = 1200; // 足够覆盖画布
            this.ctx.beginPath();
            this.ctx.moveTo(line.x - length * cos, line.y - length * sin);
            this.ctx.lineTo(line.x + length * cos, line.y + length * sin);
            this.ctx.stroke();
            
            // 标记点 (标记时的起始圆圈)
            this.ctx.fillStyle = 'rgba(0, 240, 255, 0.8)';
            this.ctx.beginPath();
            this.ctx.arc(line.x, line.y, 4, 0, Math.PI * 2);
            this.ctx.fill();
        });
        
        this.ctx.restore();
    }

    /**
     * 绘制历史轨迹
     */
    drawTrail(trail) {
        if (trail.length < 2) return;
        
        this.ctx.save();
        this.ctx.strokeStyle = 'rgba(255, 159, 0, 0.18)'; // 极淡暖橙色
        this.ctx.lineWidth = 2.5;
        this.ctx.setLineDash([3, 5]);
        
        this.ctx.beginPath();
        this.ctx.moveTo(trail[0].x, trail[0].y);
        for (let i = 1; i < trail.length; i++) {
            this.ctx.lineTo(trail[i].x, trail[i].y);
        }
        this.ctx.stroke();
        this.ctx.restore();
    }

    /**
     * 绘制玩家头像，突出磁棒天线的方位物理关系
     */
    drawPlayer(player) {
        this.ctx.save();
        
        // 平移并旋转坐标系至玩家朝向
        this.ctx.translate(player.x, player.y);
        this.ctx.rotate(player.angle);
        
        // 1. 绘制身体主轮廓
        const grad = this.ctx.createRadialGradient(0, 0, 2, 0, 0, player.radius);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(1, '#0072ff'); // 蓝色身体
        
        this.ctx.shadowColor = '#0072ff';
        this.ctx.shadowBlur = 8;
        
        this.ctx.fillStyle = grad;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, player.radius, 0, Math.PI * 2);
        this.ctx.fill();
        
        this.ctx.shadowBlur = 0;
        
        // 2. 绘制前方视线/朝向指示三角形
        this.ctx.fillStyle = '#ffffff';
        this.ctx.beginPath();
        this.ctx.moveTo(0, -player.radius - 2); // 顶点朝前 (向上)
        this.ctx.lineTo(-4, -player.radius + 3);
        this.ctx.lineTo(4, -player.radius + 3);
        this.ctx.closePath();
        this.ctx.fill();
        
        // 3. 关键科普标识：绘制磁棒天线 (Ferrite Rod Antenna)
        // 磁棒与身体垂直，即打横放在左右侧 (在画布旋转坐标系中即横向沿 X 轴分布)
        // 使用暗灰色配铜黄色线圈来示意磁棒天线
        this.ctx.strokeStyle = '#576574'; // 磁棒本身
        this.ctx.lineWidth = 4;
        this.ctx.lineCap = 'square';
        this.ctx.beginPath();
        this.ctx.moveTo(-16, 0); // 向左伸展
        this.ctx.lineTo(16, 0);  // 向右伸展
        this.ctx.stroke();
        
        // 在磁棒两端包覆红色端盖
        this.ctx.fillStyle = '#ff3366';
        this.ctx.fillRect(-17, -2.5, 2, 5);
        this.ctx.fillRect(15, -2.5, 2, 5);
        
        // 绘制黄色的铜线圈绕组在磁棒中间，生动还原物理细节！
        this.ctx.strokeStyle = '#ff9f00';
        this.ctx.lineWidth = 2.5;
        this.ctx.setLineDash([2, 2]);
        this.ctx.beginPath();
        this.ctx.moveTo(-10, 0);
        this.ctx.lineTo(-2, 0);
        this.ctx.moveTo(2, 0);
        this.ctx.lineTo(10, 0);
        this.ctx.stroke();
        
        // 4. 辅助指示线：向身体正前方及正后方延伸的虚线，表示最强灵敏方向
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        this.ctx.lineWidth = 1;
        this.ctx.setLineDash([2, 4]);
        this.ctx.beginPath();
        this.ctx.moveTo(0, -80);
        this.ctx.lineTo(0, 80);
        this.ctx.stroke();
        
        this.ctx.restore();
    }

    /**
     * 绘制电台 (Fox) - 带有无线电波发射动画
     */
    drawFox(fox, isVictory) {
        this.ctx.save();
        
        // 电台位置闪烁发光效果
        this.ctx.shadowColor = isVictory ? '#39ff14' : '#ff3366';
        this.ctx.shadowBlur = 10;
        
        // 1. 绘制发射塔塔座
        this.ctx.strokeStyle = isVictory ? '#39ff14' : '#ff3366';
        this.ctx.lineWidth = 2.5;
        this.ctx.beginPath();
        this.ctx.moveTo(fox.x, fox.y);
        this.ctx.lineTo(fox.x - 7, fox.y + 14);
        this.ctx.lineTo(fox.x + 7, fox.y + 14);
        this.ctx.closePath();
        this.ctx.fillStyle = '#1c1e26';
        this.ctx.fill();
        this.ctx.stroke();
        
        // 2. 绘制发射塔桅杆和顶端闪烁红点
        this.ctx.beginPath();
        this.ctx.moveTo(fox.x, fox.y);
        this.ctx.lineTo(fox.x, fox.y - 12);
        this.ctx.stroke();
        
        this.ctx.fillStyle = isVictory ? '#39ff14' : '#ff3366';
        this.ctx.beginPath();
        this.ctx.arc(fox.x, fox.y - 12, 3, 0, Math.PI * 2);
        this.ctx.fill();
        
        // 3. 动态扩散的无线电波圈
        this.waveRadius = (this.waveRadius + 0.3) % 45;
        this.ctx.shadowBlur = 0;
        this.ctx.strokeStyle = isVictory ? 'rgba(57, 255, 20, ' + (1.0 - this.waveRadius/45) + ')' : 'rgba(255, 51, 102, ' + (1.0 - this.waveRadius/45) + ')';
        this.ctx.lineWidth = 1.5;
        this.ctx.beginPath();
        this.ctx.arc(fox.x, fox.y - 12, this.waveRadius, 0, Math.PI * 2);
        this.ctx.stroke();
        
        // 4. 显示电台编号文本标签
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = 'bold 10px Share Tech Mono';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(fox.id, fox.x, fox.y + 26);
        
        this.ctx.restore();
    }
}
