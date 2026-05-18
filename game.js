const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const selectionScreen = document.getElementById('selection-screen');
const gameScreen = document.getElementById('game-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const winnerText = document.getElementById('winner-text');
const scoreCatEl = document.getElementById('score-cat');
const scoreMonkeyEl = document.getElementById('score-monkey');

let playerTeam = '';
let aiTeam = '';

// Images
const catImg = new Image();
catImg.src = 'sample picture/cat.jpg';
const monkeyImg = new Image();
monkeyImg.src = 'sample picture/monkey.jpg';
const ballImg = new Image();
ballImg.src = 'sample picture/soccor ball.jpg';

// Game State
let isGameRunning = false;
let score = { cat: 0, monkey: 0 };
const WINNING_SCORE = 6;

// Entities
const field = { width: 800, height: 600, goalWidth: 150 };
const cornerRadius = 60;

class Entity {
    constructor(x, y, radius) {
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.radius = radius;
    }
}

class Player extends Entity {
    constructor(x, y, team, isAI) {
        super(x, y, 25);
        this.team = team;
        this.isAI = isAI;
        this.speed = this.isAI ? 3.5 : 4.5;
        this.img = team === 'cat' ? catImg : monkeyImg;
        this.role = 'atk';
        this.homeX = x;
        this.homeY = y;
    }

    update(keys, ball) {
        if (!this.isAI) {
            this.vx = 0;
            this.vy = 0;
            if (keys.ArrowUp) this.vy = -this.speed;
            if (keys.ArrowDown) this.vy = this.speed;
            if (keys.ArrowLeft) this.vx = -this.speed;
            if (keys.ArrowRight) this.vx = this.speed;
        } else {
            let targetX = this.homeX;
            let targetY = this.homeY;
            let speedMult = 0.6; 

            const distToBall = Math.hypot(ball.x - this.x, ball.y - this.y);
            const isLeftTeam = this.team === 'cat';
            
            // 공을 소유하고 있다면 무조건 상대 골대로 전진
            if (ball.owner === this) {
                targetX = isLeftTeam ? field.width : 0;
                targetY = field.height / 2;
                speedMult = 0.8;
            } else {
                if (this.role === 'gk') {
                    targetY = ball.y;
                    targetY = Math.max(field.height/2 - 100, Math.min(field.height/2 + 100, targetY));
                    speedMult = 0.5;
                } else if (this.role === 'def') {
                    const inOurHalf = isLeftTeam ? ball.x < field.width / 2 + 100 : ball.x > field.width / 2 - 100;
                    if (inOurHalf && distToBall < 400) {
                        targetX = ball.x;
                        targetY = ball.y;
                        speedMult = 0.7;
                    } else {
                        targetY = this.homeY + (ball.y - field.height/2) * 0.3;
                    }
                } else if (this.role === 'atk') {
                    targetX = ball.x;
                    targetY = ball.y;
                    speedMult = 0.8;
                }
            }

            const dx = targetX - this.x;
            const dy = targetY - this.y;
            const dist = Math.hypot(dx, dy);
            
            if (dist > 5) {
                this.vx = (dx / dist) * (this.speed * speedMult);
                this.vy = (dy / dist) * (this.speed * speedMult);
            } else {
                this.vx *= 0.5;
                this.vy *= 0.5;
            }
        }

        this.x += this.vx;
        this.y += this.vy;

        this.x = Math.max(this.radius, Math.min(field.width - this.radius, this.x));
        this.y = Math.max(this.radius, Math.min(field.height - this.radius, this.y));
    }

    draw(ctx) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(this.img, this.x - this.radius, this.y - this.radius, this.radius * 2, this.radius * 2);
        ctx.restore();
        
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.lineWidth = this.isAI ? 3 : 5;
        ctx.strokeStyle = this.team === 'cat' ? '#3498db' : '#e74c3c';
        if (!this.isAI) {
            ctx.strokeStyle = '#f1c40f'; // User
        }
        ctx.stroke();
    }
}

class Ball extends Entity {
    constructor(x, y) {
        super(x, y, 15);
        this.friction = 0.98;
        this.owner = null;
        this.cooldown = 0; // 스틸/슈팅 후 재소유 대기시간
    }

    update() {
        if (this.cooldown > 0) this.cooldown--;

        if (this.owner) {
            // 드리블 중일 때는 주인의 약간 앞에 공을 위치시킴
            let angle = 0;
            if (this.owner.vx !== 0 || this.owner.vy !== 0) {
                angle = Math.atan2(this.owner.vy, this.owner.vx);
            } else {
                angle = this.owner.team === 'cat' ? 0 : Math.PI; 
            }
            
            this.x = this.owner.x + Math.cos(angle) * (this.owner.radius + this.radius);
            this.y = this.owner.y + Math.sin(angle) * (this.owner.radius + this.radius);
            this.vx = 0;
            this.vy = 0;
        } else {
            this.x += this.vx;
            this.y += this.vy;
            this.vx *= this.friction;
            this.vy *= this.friction;
        }

        // 벽 충돌 및 골 판정 (공 소유 여부와 상관없이)
        if (this.x - this.radius < 0) {
            if (this.y > field.height/2 - field.goalWidth/2 && this.y < field.height/2 + field.goalWidth/2) {
                return 'monkey';
            } else {
                this.x = this.radius;
                if (!this.owner) this.vx *= -1;
            }
        } else if (this.x + this.radius > field.width) {
            if (this.y > field.height/2 - field.goalWidth/2 && this.y < field.height/2 + field.goalWidth/2) {
                return 'cat';
            } else {
                this.x = field.width - this.radius;
                if (!this.owner) this.vx *= -1;
            }
        }

        if (this.y - this.radius < 0) {
            this.y = this.radius;
            if (!this.owner) this.vy *= -1;
        } else if (this.y + this.radius > field.height) {
            this.y = field.height - this.radius;
            if (!this.owner) this.vy *= -1;
        }
        
        // 둥근 모서리 충돌 (공이 자유 상태일 때만)
        if (!this.owner) {
            const corners = [
                {x: 0, y: 0},
                {x: field.width, y: 0},
                {x: 0, y: field.height},
                {x: field.width, y: field.height}
            ];
            
            for (let c of corners) {
                const dx = this.x - c.x;
                const dy = this.y - c.y;
                const dist = Math.hypot(dx, dy);
                if (dist < cornerRadius + this.radius) {
                    const overlap = (cornerRadius + this.radius) - dist;
                    const angle = Math.atan2(dy, dx);
                    this.x += Math.cos(angle) * overlap;
                    this.y += Math.sin(angle) * overlap;
                    
                    const nx = Math.cos(angle);
                    const ny = Math.sin(angle);
                    const dot = this.vx * nx + this.vy * ny;
                    this.vx -= 2 * dot * nx;
                    this.vy -= 2 * dot * ny;
                }
            }
        }

        return null;
    }

    draw(ctx) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(ballImg, this.x - this.radius, this.y - this.radius, this.radius * 2, this.radius * 2);
        ctx.restore();

        // 드리블 중일 때 공 주변에 효과 표시
        if (this.owner) {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius + 3, 0, Math.PI * 2);
            ctx.lineWidth = 3;
            ctx.strokeStyle = '#f39c12';
            ctx.stroke();
        }
    }
}

let players = [];
let ball;
const keys = {};

window.addEventListener('keydown', (e) => {
    if(["Space","ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].indexOf(e.code) > -1) {
        e.preventDefault();
    }
    keys[e.code] = true;
});
window.addEventListener('keyup', (e) => keys[e.code] = false);

function selectCharacter(selectedTeam) {
    playerTeam = selectedTeam;
    aiTeam = selectedTeam === 'cat' ? 'monkey' : 'cat';
    
    selectionScreen.style.display = 'none';
    gameScreen.style.display = 'block';
    
    resetGame();
}

function resetGame() {
    score = { cat: 0, monkey: 0 };
    updateScoreUI();
    gameOverScreen.style.display = 'none';
    isGameRunning = true;
    resetPositions();
    gameLoop();
}

function resetPositions() {
    players = [];
    
    const createTeam = (teamName, isLeft) => {
        const sign = isLeft ? 1 : -1;
        const centerX = isLeft ? field.width / 4 : field.width * 3 / 4;
        
        const isUser = (teamName === playerTeam);
        const p = new Player(centerX, field.height / 2, teamName, !isUser);
        p.role = 'atk';
        p.homeX = centerX;
        p.homeY = field.height / 2;
        players.push(p);
    };

    createTeam('cat', true);
    createTeam('monkey', false);
    
    ball = new Ball(field.width / 2, field.height / 2);
}

function updateScoreUI() {
    scoreCatEl.innerText = `고양이: ${score.cat}`;
    scoreMonkeyEl.innerText = `원숭이: ${score.monkey}`;
}

function drawField() {
    ctx.fillStyle = '#4CAF50';
    ctx.fillRect(0, 0, field.width, field.height);

    ctx.strokeStyle = 'white';
    ctx.lineWidth = 3;

    ctx.beginPath();
    ctx.moveTo(field.width / 2, 0);
    ctx.lineTo(field.width / 2, field.height);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(field.width / 2, field.height / 2, 70, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath(); ctx.arc(0, 0, cornerRadius, 0, Math.PI / 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(field.width, 0, cornerRadius, Math.PI / 2, Math.PI); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, field.height, cornerRadius, -Math.PI / 2, 0); ctx.stroke();
    ctx.beginPath(); ctx.arc(field.width, field.height, cornerRadius, Math.PI, Math.PI * 1.5); ctx.stroke();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.fillRect(0, field.height/2 - field.goalWidth/2, 10, field.goalWidth);
    ctx.fillRect(field.width - 10, field.height/2 - field.goalWidth/2, 10, field.goalWidth);
}

function gameLoop() {
    if (!isGameRunning) return;

    for (let p of players) {
        p.update(keys, ball);
    }
    
    // 플레이어 간의 충돌
    for (let i = 0; i < players.length; i++) {
        for (let j = i + 1; j < players.length; j++) {
            const p1 = players[i];
            const p2 = players[j];
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const dist = Math.hypot(dx, dy);
            if (dist < p1.radius + p2.radius) {
                const angle = Math.atan2(dy, dx);
                const overlap = p1.radius + p2.radius - dist;
                const pushX = Math.cos(angle) * overlap / 2;
                const pushY = Math.sin(angle) * overlap / 2;
                
                p1.x -= pushX;
                p1.y -= pushY;
                p2.x += pushX;
                p2.y += pushY;
            }
        }
    }

    // 드리블/스틸 및 킥 로직
    if (ball.owner) {
        // 소유자의 킥(스페이스바) 또는 AI의 슛/패스
        if (!ball.owner.isAI && keys['Space']) {
            const kickSpeed = 15;
            let angle = (ball.owner.vx !== 0 || ball.owner.vy !== 0) ? Math.atan2(ball.owner.vy, ball.owner.vx) : (ball.owner.team === 'cat' ? 0 : Math.PI);
            ball.vx = Math.cos(angle) * kickSpeed;
            ball.vy = Math.sin(angle) * kickSpeed;
            ball.owner = null;
            ball.cooldown = 20; // 잠시 동안 누구도 잡을 수 없음
        } else if (ball.owner.isAI) {
            const isLeftTeam = ball.owner.team === 'cat';
            const targetX = isLeftTeam ? field.width : 0;
            const targetY = field.height / 2;
            const distToGoal = Math.hypot(targetX - ball.x, targetY - ball.y);
            
            // 골대 근처면 슛
            if (distToGoal < 250 && Math.random() < 0.05) {
                const kickSpeed = 15;
                const angle = Math.atan2(targetY - ball.y, targetX - ball.x);
                ball.vx = Math.cos(angle) * kickSpeed;
                ball.vy = Math.sin(angle) * kickSpeed;
                ball.owner = null;
                ball.cooldown = 20;
            }
        }
    }

    // 공 소유자 판별 및 스틸
    for (let p of players) {
        const dx = ball.x - p.x;
        const dy = ball.y - p.y;
        const dist = Math.hypot(dx, dy);
        
        // 공과 캐릭터가 닿았을 때
        if (dist < p.radius + ball.radius + 5) {
            const ballSpeed = Math.hypot(ball.vx, ball.vy);
            
            if (!ball.owner) {
                if (ball.cooldown > 0 || ballSpeed > 7) {
                    // 슛이나 패스로 인해 공이 빠르거나 쿨다운 중일 때 닿으면 튕겨나감
                    const dotProduct = ball.vx * dx + ball.vy * dy;
                    if (dotProduct < 0) { // 공이 캐릭터를 향해 다가올 때만
                        const angle = Math.atan2(dy, dx);
                        const nx = Math.cos(angle);
                        const ny = Math.sin(angle);
                        
                        // 겹침 보정
                        const overlap = (p.radius + ball.radius + 5) - dist;
                        ball.x += nx * overlap;
                        ball.y += ny * overlap;

                        // 반사 속도 계산
                        const dot = ball.vx * nx + ball.vy * ny;
                        ball.vx -= 2 * dot * nx;
                        ball.vy -= 2 * dot * ny;
                        
                        // 충돌 시 약간의 에너지 손실
                        ball.vx *= 0.8;
                        ball.vy *= 0.8;
                        
                        // 튕겨나간 직후에는 다시 잡히지 않도록 쿨다운 부여
                        ball.cooldown = 15;
                    }
                } else if (ball.cooldown <= 0) {
                    // 아무도 공을 안 가졌고 튕길 상태도 아니면 차지
                    ball.owner = p;
                }
            } else if (ball.owner && ball.owner.team !== p.team && ball.cooldown <= 0) {
                // 상대편이 공을 가졌을 때 부딪히면 스틸
                ball.owner = p;
                ball.cooldown = 30; // 스틸 직후 재스틸 방지
            }
        }
    }

    const goalScored = ball.update();

    if (goalScored) {
        score[goalScored]++;
        updateScoreUI();
        
        if (score[goalScored] >= WINNING_SCORE) {
            isGameRunning = false;
            winnerText.innerText = `${goalScored === 'cat' ? '고양이' : '원숭이'} 승리!`;
            gameOverScreen.style.display = 'block';
        } else {
            resetPositions();
        }
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawField();
    
    let userPlayer = null;
    for (let p of players) {
        if (!p.isAI) {
            userPlayer = p;
        } else {
            p.draw(ctx);
        }
    }
    if (userPlayer) userPlayer.draw(ctx);
    
    ball.draw(ctx);

    if (isGameRunning) {
        requestAnimationFrame(gameLoop);
    }
}