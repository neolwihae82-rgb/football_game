const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const selectionScreen = document.getElementById('selection-screen');
const gameScreen = document.getElementById('game-screen');
const uiContainer = document.getElementById('ui-container');
const gameOverScreen = document.getElementById('game-over-screen');
const winnerText = document.getElementById('winner-text');
const scoreCatEl = document.getElementById('score-cat');
const scoreMonkeyEl = document.getElementById('score-monkey');

let playerMovementSpeed = 2.5;
document.getElementById('speed-slider').addEventListener('input', (e) => {
    playerMovementSpeed = parseFloat(e.target.value);
    document.getElementById('speed-val').innerText = playerMovementSpeed;
    for (let p of players) {
        if (!p.isAI) {
            p.speed = playerMovementSpeed;
        }
    }
});

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

// Entities (16:9 ratio field)
const field = { width: 800, height: 450, goalWidth: 150 };
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
        this.speed = this.isAI ? 3.5 : playerMovementSpeed;
        this.img = team === 'cat' ? catImg : monkeyImg;
        this.role = 'atk';
        this.homeX = x;
        this.homeY = y;
    }

    update(keys, ball) {
        if (!this.isAI) {
            this.vx = 0;
            this.vy = 0;
            
            // Joystick logic
            if (joystickActive) {
                this.vx = joystickVector.x * this.speed;
                this.vy = joystickVector.y * this.speed;
            } else {
                if (keys.ArrowUp) this.vy = -this.speed;
                if (keys.ArrowDown) this.vy = this.speed;
                if (keys.ArrowLeft) this.vx = -this.speed;
                if (keys.ArrowRight) this.vx = this.speed;
            }
        } else {
            let targetX = this.homeX;
            let targetY = this.homeY;
            let speedMult = 0.6; 

            const distToBall = Math.hypot(ball.x - this.x, ball.y - this.y);
            const isLeftTeam = this.team === 'cat';
            
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
        this.lastOwner = null;
        this.cooldown = 0;
        this.isShot = false;
    }

    update() {
        if (this.cooldown > 0) this.cooldown--;

        const speed = Math.hypot(this.vx, this.vy);
        if (this.isShot && speed < 4) {
            this.isShot = false;
        }

        if (this.owner) {
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
            this.isShot = false;
        } else {
            this.x += this.vx;
            this.y += this.vy;
            this.vx *= this.friction;
            this.vy *= this.friction;
        }

        // 벽 충돌 및 골 판정
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
        
        // 둥근 모서리 충돌
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

// Virtual Joystick and Shoot Button Logic
let joystickActive = false;
let joystickVector = { x: 0, y: 0 };
let shootPressed = false;
let joystickTouchId = null;

const joystickZone = document.getElementById('joystick-zone');
const joystickKnob = document.getElementById('joystick-knob');
const shootBtn = document.getElementById('shoot-btn');

joystickZone.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (joystickTouchId !== null) return;
    joystickTouchId = e.pointerId;
    joystickActive = true;
    joystickZone.setPointerCapture(e.pointerId);
    updateJoystickPointer(e);
});

joystickZone.addEventListener('pointermove', (e) => {
    e.preventDefault();
    if (joystickTouchId === e.pointerId) {
        updateJoystickPointer(e);
    }
});

const endJoystick = (e) => {
    e.preventDefault();
    if (joystickTouchId === e.pointerId) {
        joystickTouchId = null;
        joystickActive = false;
        joystickVector = { x: 0, y: 0 };
        joystickKnob.style.transform = `translate(-50%, -50%)`;
        joystickZone.releasePointerCapture(e.pointerId);
    }
};

joystickZone.addEventListener('pointerup', endJoystick);
joystickZone.addEventListener('pointercancel', endJoystick);

function updateJoystickPointer(e) {
    const rect = joystickZone.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const maxRadius = rect.width / 2;

    let dx = e.clientX - centerX;
    let dy = e.clientY - centerY;
    const distance = Math.hypot(dx, dy);

    if (distance > maxRadius) {
        dx = (dx / distance) * maxRadius;
        dy = (dy / distance) * maxRadius;
    }

    joystickKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    
    let normX = dx / maxRadius;
    let normY = dy / maxRadius;

    const normDist = Math.hypot(normX, normY);
    if (normDist > 0) {
        normX /= normDist;
        normY /= normDist;
    }

    joystickVector = { x: normX, y: normY };}

shootBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    shootPressed = true;
    keys['Space'] = true;
    shootBtn.style.transform = 'scale(0.95)';
    shootBtn.setPointerCapture(e.pointerId);
});

const endShoot = (e) => {
    e.preventDefault();
    shootPressed = false;
    keys['Space'] = false;
    shootBtn.style.transform = 'none';
    shootBtn.releasePointerCapture(e.pointerId);
};

shootBtn.addEventListener('pointerup', endShoot);
shootBtn.addEventListener('pointercancel', endShoot);

let teamSize = 4;

function selectCharacter(selectedTeam) {
    playerTeam = selectedTeam;
    aiTeam = selectedTeam === 'cat' ? 'monkey' : 'cat';
    
    const sizeSelect = document.getElementById('team-size');
    if (sizeSelect) {
        teamSize = parseInt(sizeSelect.value, 10);
    }

    uiContainer.style.display = 'none';
    gameScreen.style.display = 'flex';
    
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
        
        for (let i = 0; i < teamSize; i++) {
            // First player of user's team is initially controlled
            const isUserControlled = (teamName === playerTeam && i === 0);
            const isAI = !isUserControlled; 
            
            // Distribute start positions
            let startX = centerX;
            let startY = field.height / 2;
            let role = 'atk';
            
            if (teamSize > 1) {
                if (i === 0) { // Forward
                    startX = isLeft ? centerX + 50 : centerX - 50;
                    startY = field.height / 2;
                    role = 'atk';
                } else if (i === 1) { // Midfielder/Def
                    startX = centerX;
                    startY = field.height / 2 - 80;
                    role = 'def';
                } else if (i === 2) { // Midfielder/Def
                    startX = centerX;
                    startY = field.height / 2 + 80;
                    role = 'def';
                } else if (i === 3) { // Goalkeeper
                    startX = isLeft ? 50 : field.width - 50;
                    startY = field.height / 2;
                    role = 'gk';
                }
            }

            const p = new Player(startX, startY, teamName, isAI);
            p.role = role;
            p.homeX = startX;
            p.homeY = startY;
            players.push(p);
        }
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
    // Canvas background is now transparent or same as container
    // Let's clear properly
    ctx.clearRect(0, 0, field.width, field.height);
    
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
        if (!ball.owner.isAI && (keys['Space'] || shootPressed)) {
            const kickSpeed = 16;
            let angle = (ball.owner.vx !== 0 || ball.owner.vy !== 0) ? Math.atan2(ball.owner.vy, ball.owner.vx) : (ball.owner.team === 'cat' ? 0 : Math.PI);
            ball.vx = Math.cos(angle) * kickSpeed;
            ball.vy = Math.sin(angle) * kickSpeed;
            ball.lastOwner = ball.owner;
            ball.owner = null;
            ball.cooldown = 15;
            ball.isShot = true; // 슛 상태 플래그
            shootPressed = false;
        } else if (ball.owner.isAI) {
            const isLeftTeam = ball.owner.team === 'cat';
            const targetX = isLeftTeam ? field.width : 0;
            const targetY = field.height / 2;
            const distToGoal = Math.hypot(targetX - ball.x, targetY - ball.y);
            
            if (distToGoal < 250 && Math.random() < 0.05) {
                const kickSpeed = 16;
                const angle = Math.atan2(targetY - ball.y, targetX - ball.x);
                ball.vx = Math.cos(angle) * kickSpeed;
                ball.vy = Math.sin(angle) * kickSpeed;
                ball.lastOwner = ball.owner;
                ball.owner = null;
                ball.cooldown = 15;
                ball.isShot = true; // 슛 상태 플래그
            }
        }
    }

    // 공 소유자 판별 및 스틸/반사
    for (let p of players) {
        const dx = ball.x - p.x;
        const dy = ball.y - p.y;
        const dist = Math.hypot(dx, dy);
        
        if (dist < p.radius + ball.radius + 5) {
            if (!ball.owner) {
                if ((ball.isShot || ball.cooldown > 0) && ball.lastOwner && ball.lastOwner.team === p.team && ball.lastOwner !== p) {
                    // 패스 받기 (같은 팀이 찬 공)
                    ball.owner = p;
                    ball.isShot = false;
                    ball.cooldown = 0;
                    if (p.team === playerTeam) {
                        players.forEach(pl => {
                            if (pl.team === playerTeam) pl.isAI = true;
                        });
                        p.isAI = false;
                    }
                } else if (ball.isShot || ball.cooldown > 0) {
                    // 슛한 공이거나 쿨다운 중이면 무조건 튕겨나감 (상대팀이거나 본인이 찼을 때)
                    const dotProduct = ball.vx * dx + ball.vy * dy;
                    if (dotProduct < 0) { 
                        const angle = Math.atan2(dy, dx);
                        const nx = Math.cos(angle);
                        const ny = Math.sin(angle);
                        
                        const overlap = (p.radius + ball.radius + 5) - dist;
                        ball.x += nx * overlap;
                        ball.y += ny * overlap;

                        const dot = ball.vx * nx + ball.vy * ny;
                        ball.vx -= 2 * dot * nx;
                        ball.vy -= 2 * dot * ny;
                        
                        ball.vx *= 0.8;
                        ball.vy *= 0.8;
                        
                        ball.cooldown = 15;
                    }
                } else {
                    // 그냥 닿았을 때 공을 차지하여 드리블 시작
                    ball.owner = p;
                    if (p.team === playerTeam && p.isAI) {
                        players.forEach(pl => {
                            if (pl.team === playerTeam) pl.isAI = true;
                        });
                        p.isAI = false;
                    }
                }
            } else if (ball.owner && ball.owner.team !== p.team) {
                // 상대방이 드리블 중인 공에 닿으면 공을 놓침 (난전 유도)
                if (ball.cooldown <= 0) {
                    ball.lastOwner = ball.owner;
                    ball.owner = null;
                    ball.vx = (Math.random() - 0.5) * 10;
                    ball.vy = (Math.random() - 0.5) * 10;
                    ball.cooldown = 30; 
                }
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
