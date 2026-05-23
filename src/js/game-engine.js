/**
 * 80米无线电测向模拟器 - 游戏状态与逻辑引擎
 * 负责角色移动、碰撞检测、障碍物定义及统计指标
 */

export class GameEngine {
    constructor() {
        // 地图尺寸
        this.width = 750;
        this.height = 750;

        // 玩家状态
        this.player = {
            x: 375,
            y: 625,
            angle: 0, // 朝向角 (弧度, 0为正北, 顺时针为正值)
            radius: 16,
            speed: 2.2, // 基础移动速度
            rotationSpeed: 0.035, // 旋转速度 (弧度/帧)
            distanceWalked: 0 // 累计行走距离 (米)
        };

        // 目标电台 (Fox) 状态
        this.fox = {
            x: 0,
            y: 0,
            id: 'MO',
            isFound: false
        };

        // 哑点线数组
        this.nullLines = []; // 元素结构: { x, y, angle }

        // 玩家行走轨迹记录 (每隔几帧采样一次)
        this.trail = [];
        this.trailSampleCounter = 0;

        // 障碍物模板 (每次游戏随机放置)
        this.obstacleTemplates = [
            { name: '中心大池塘', minR: 65, maxR: 90, type: 'pond' },
            { name: '密林区A',    minR: 50, maxR: 75, type: 'forest' },
            { name: '小石群',     minR: 30, maxR: 50, type: 'rock' },
            { name: '密林区B',    minR: 35, maxR: 55, type: 'forest' },
            { name: '休息亭',     minR: 28, maxR: 42, type: 'structure' }
        ];

        // 障碍物实例 (圆形，便于做平滑的滑动碰撞检测)
        this.obstacles = [];

        // 游戏全局状态
        this.isVictory = false;
        this.startTime = 0;
        this.gameTime = 0; // 游戏持续时间 (秒)
    }

    /**
     * 随机生成障碍物布局，保证分散不重叠
     */
    generateObstacles(playerX, playerY) {
        this.obstacles = [];
        const margin = 60;
        const minCenterDist = 160; // 障碍物中心最小间距

        for (const tpl of this.obstacleTemplates) {
            let placed = false;
            for (let attempt = 0; attempt < 200; attempt++) {
                const r = tpl.minR + Math.random() * (tpl.maxR - tpl.minR);
                const x = margin + Math.random() * (this.width - margin * 2);
                const y = margin + Math.random() * (this.height - margin * 2);

                // 远离玩家起点
                const distToPlayer = Math.sqrt((x - playerX) ** 2 + (y - playerY) ** 2);
                if (distToPlayer < 180) continue;

                // 与其他障碍物保持间距
                let tooClose = false;
                for (const obs of this.obstacles) {
                    const d = Math.sqrt((x - obs.x) ** 2 + (y - obs.y) ** 2);
                    if (d < minCenterDist) {
                        tooClose = true;
                        break;
                    }
                }
                if (tooClose) continue;

                this.obstacles.push({ name: tpl.name, x: Math.round(x), y: Math.round(y), r: Math.round(r), type: tpl.type });
                placed = true;
                break;
            }

            // 保底：找不到位置时放在左上角
            if (!placed) {
                const r = tpl.minR + (tpl.maxR - tpl.minR) / 2;
                this.obstacles.push({ name: tpl.name, x: margin + this.obstacles.length * 100, y: margin, r: Math.round(r), type: tpl.type });
            }
        }
    }

    /**
     * 重置游戏，随机放置电台
     * @param {Array} availableStations 接收机可调频率列表
     */
    resetGame(availableStations) {
        // 1. 重置玩家位置到下方安全区
        this.player.x = 375;
        this.player.y = 650;
        this.player.angle = 0; // 面向北方
        this.player.distanceWalked = 0;

        // 2. 随机生成障碍物布局
        this.generateObstacles(this.player.x, this.player.y);

        // 3. 清空标记与轨迹
        this.nullLines = [];
        this.trail = [{ x: this.player.x, y: this.player.y }];
        this.trailSampleCounter = 0;

        // 4. 随机选择一个电台作为隐藏目标
        const randomStation = availableStations[Math.floor(Math.random() * availableStations.length)];
        this.fox.id = randomStation.id;
        this.fox.isFound = false;

        // 5. 随机在地图上放置电台（避开起点和障碍物）
        let validPos = false;
        let attempt = 0;

        while (!validPos && attempt < 100) {
            attempt++;
            // 边缘留出 50 像素安全距离
            const rx = 50 + Math.random() * (this.width - 100);
            const ry = 63 + Math.random() * (this.height - 225); // 尽量放偏中上方，避开下方起点

            // 检查是否与玩家起点过近 (至少相距 200 像素)
            const distToStart = Math.sqrt(Math.pow(rx - this.player.x, 2) + Math.pow(ry - this.player.y, 2));
            if (distToStart < 200) continue;

            // 检查是否在任何障碍物内
            let insideObstacle = false;
            for (const obs of this.obstacles) {
                const distToObs = Math.sqrt(Math.pow(rx - obs.x, 2) + Math.pow(ry - obs.y, 2));
                if (distToObs < obs.r + 20) { // 电台周围留出空地
                    insideObstacle = true;
                    break;
                }
            }

            if (!insideObstacle) {
                this.fox.x = Math.round(rx);
                this.fox.y = Math.round(ry);
                validPos = true;
            }
        }

        // 如果极罕见情况下找不到位置，给个保底坐标
        if (!validPos) {
            this.fox.x = 375;
            this.fox.y = 188;
        }

        this.isVictory = false;
        this.startTime = Date.now();
        this.gameTime = 0;
    }

    /**
     * 更新每一帧的游戏逻辑，计算移动、滑动碰撞、轨迹
     * @param {Object} keys 按键状态 { forward, backward, left, right }
     */
    update(keys) {
        if (this.isVictory) {
            this.gameTime = Math.round((Date.now() - this.startTime) / 1000);
            return;
        }

        // 1. 更新游戏计时
        this.gameTime = Math.round((Date.now() - this.startTime) / 1000);

        // 2. 旋转逻辑 (左右键)
        if (keys.left) {
            this.player.angle -= this.player.rotationSpeed;
        }
        if (keys.right) {
            this.player.angle += this.player.rotationSpeed;
        }

        // 规范化角度到 [-PI, PI] 之间
        this.player.angle = Math.atan2(Math.sin(this.player.angle), Math.cos(this.player.angle));

        // 3. 移动逻辑 (上下键)
        let dx = 0;
        let dy = 0;

        if (keys.forward) {
            // 面向 0 度(北) 时，sin=0, cos=1, 坐标 y 应该减小
            dx = Math.sin(this.player.angle) * this.player.speed;
            dy = -Math.cos(this.player.angle) * this.player.speed;
        }
        if (keys.backward) {
            dx = -Math.sin(this.player.angle) * this.player.speed * 0.6; // 后退速度稍慢
            dy = Math.cos(this.player.angle) * this.player.speed * 0.6;
        }

        if (dx !== 0 || dy !== 0) {
            const nextX = this.player.x + dx;
            const nextY = this.player.y + dy;

            // 4. 碰撞处理 - 精美的滑动碰撞检测与解决
            let newX = nextX;
            let newY = nextY;

            // 边缘检测限制
            if (newX < this.player.radius) newX = this.player.radius;
            if (newX > this.width - this.player.radius) newX = this.width - this.player.radius;
            if (newY < this.player.radius) newY = this.player.radius;
            if (newY > this.height - this.player.radius) newY = this.height - this.player.radius;

            // 障碍物碰撞检测
            for (const obs of this.obstacles) {
                const distVectorX = newX - obs.x;
                const distVectorY = newY - obs.y;
                const distance = Math.sqrt(distVectorX * distVectorX + distVectorY * distVectorY);
                const minDist = obs.r + this.player.radius;

                if (distance < minDist) {
                    // 发生碰撞，沿障碍物法向外推，实现平滑滑行
                    if (distance > 0) {
                        newX = obs.x + (distVectorX / distance) * minDist;
                        newY = obs.y + (distVectorY / distance) * minDist;
                    } else {
                        // 异常重合时强制反向推离
                        newX += this.player.radius;
                    }
                }
            }

            // 计算本帧实际位移
            const actualMoveDist = Math.sqrt(
                Math.pow(newX - this.player.x, 2) + Math.pow(newY - this.player.y, 2)
            );

            // 80米测向1个像素约合现实 0.5 米
            this.player.distanceWalked += actualMoveDist * 0.5;

            // 应用最终新坐标
            this.player.x = newX;
            this.player.y = newY;

            // 5. 行动轨迹记录
            this.trailSampleCounter++;
            if (this.trailSampleCounter >= 10) { // 每 10 帧采样一个轨迹点
                this.trail.push({ x: this.player.x, y: this.player.y });
                this.trailSampleCounter = 0;

                // 限制最大历史长度，保证 Canvas 渲染性能
                if (this.trail.length > 600) {
                    this.trail.shift();
                }
            }
        }

        // 6. 胜利条件判定 (距离小于 18 像素算找到电台，即玩家重合到天线上)
        const distToFox = Math.sqrt(Math.pow(this.player.x - this.fox.x, 2) + Math.pow(this.player.y - this.fox.y, 2));
        if (distToFox < 18) {
            this.isVictory = true;
            this.fox.isFound = true;
        }
    }

    /**
     * 在当前玩家位置标记一条哑点线 (Null Line)
     * 该线垂直于玩家身体朝向
     */
    addNullLine() {
        if (this.isVictory) return;

        // 保存当前玩家位置和角度，旋转90度使其垂直于玩家朝向
        this.nullLines.push({
            x: this.player.x,
            y: this.player.y,
            angle: this.player.angle + Math.PI / 2
        });
    }

    /**
     * 清除所有已绘制的哑点线
     */
    clearNullLines() {
        this.nullLines = [];
    }
}
