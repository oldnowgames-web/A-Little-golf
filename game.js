const canvas = document.getElementById('golfCanvas');
const ctx = canvas.getContext('2d');

// Elementos da UI
const startScreen = document.getElementById('start-screen');
const pauseScreen = document.getElementById('pause-screen');
const pauseTitle = document.getElementById('pause-title');
const pauseInfo = document.getElementById('pause-info');
const hud = document.getElementById('hud');
const scoreDisplay = document.getElementById('scoreDisplay');
const strokesDisplay = document.getElementById('strokesDisplay');
const timeDisplay = document.getElementById('timeDisplay');
const successMsg = document.getElementById('success-msg');
const btnInGameMenu = document.getElementById('btn-ingame-menu');

// Estado do Jogo
let gameState = 'menu'; // menu, playing, paused
let score = 0;
let strokes = 0; // Contador de tacadas
let timeElapsed = 0;
let timerInterval = null;

let ball = { x: 0, y: 0, vx: 0, vy: 0, radius: 10, stopped: true };
let hole = { x: 0, y: 0, radius: 15 };

let isDragging = false;
let mouseX = 0;
let mouseY = 0;

// ----- ÁUDIO SINTETIZADO -----
const AudioContext = window.AudioContext || window.webkitAudioContext;
let audioCtx;

function initAudio() {
    if (!audioCtx) audioCtx = new AudioContext();
    if (audioCtx.state === 'suspended') audioCtx.resume();
}

function playSound(type) {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    const now = audioCtx.currentTime;

    if (type === 'hit') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.1);
        gainNode.gain.setValueAtTime(1, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
    } else if (type === 'score') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(523.25, now); // Dó
        osc.frequency.setValueAtTime(659.25, now + 0.1); // Mi
        gainNode.gain.setValueAtTime(0.5, now);
        gainNode.gain.linearRampToValueAtTime(0, now + 0.4);
        osc.start(now);
        osc.stop(now + 0.4);
    } else if (type === 'bounce') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(150, now);
        gainNode.gain.setValueAtTime(0.3, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
    }
}

// ----- RESPONSIVIDADE -----
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    if (ball.x > canvas.width || ball.y > canvas.height) resetBall();
    if (hole.x > canvas.width || hole.y > canvas.height) randomizeHole();
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// ----- CONTROLES DA INTERFACE -----
document.getElementById('btn-fullscreen').addEventListener('click', () => {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => console.log(err));
    } else {
        document.exitFullscreen();
    }
});

document.getElementById('btn-start').addEventListener('click', () => {
    initAudio();
    startScreen.classList.add('hidden');
    startGame();
});

btnInGameMenu.addEventListener('click', () => {
    gameState = 'paused';
    pauseTitle.innerText = "Pausado";
    pauseInfo.innerText = `Acertos: ${score} | Tacadas no momento: ${strokes}`;
    pauseScreen.classList.remove('hidden');
});

document.getElementById('btn-resume').addEventListener('click', () => {
    pauseScreen.classList.add('hidden');
    gameState = 'playing';
});

document.getElementById('btn-restart').addEventListener('click', () => {
    pauseScreen.classList.add('hidden');
    startGame();
});

function startGame() {
    hud.classList.remove('hidden');
    btnInGameMenu.classList.remove('hidden');
    score = 0;
    strokes = 0;
    timeElapsed = 0;
    updateHUD();
    resetBall();
    randomizeHole();
    
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        if (gameState === 'playing') {
            timeElapsed++;
            updateHUD();
        }
    }, 1000);

    gameState = 'playing';
}

function updateHUD() {
    scoreDisplay.innerText = `Acertos: ${score}`;
    strokesDisplay.innerText = `Tacadas: ${strokes}`;
    let m = Math.floor(timeElapsed / 60).toString().padStart(2, '0');
    let s = (timeElapsed % 60).toString().padStart(2, '0');
    timeDisplay.innerText = `${m}:${s}`;
}

function resetBall() {
    ball.x = canvas.width * 0.15;
    ball.y = canvas.height * 0.5;
    ball.vx = 0;
    ball.vy = 0;
    ball.stopped = true;
}

function randomizeHole() {
    hole.x = (canvas.width * 0.5) + (Math.random() * (canvas.width * 0.4));
    hole.y = (canvas.height * 0.2) + (Math.random() * (canvas.height * 0.6));
}

// ----- CONTROLES (MOUSE E TOUCH) -----
function getEventPos(e) {
    if (e.touches && e.touches.length > 0) {
        return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else if (e.changedTouches && e.changedTouches.length > 0) {
        return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
    }
    return { x: e.clientX, y: e.clientY };
}

function handleStart(e) {
    if (gameState !== 'playing') return;
    if (e.type === 'touchstart') e.preventDefault();

    if (ball.stopped) {
        const pos = getEventPos(e);
        const dist = Math.hypot(pos.x - ball.x, pos.y - ball.y);
        if (dist < ball.radius * 4) {
            isDragging = true;
            mouseX = pos.x;
            mouseY = pos.y;
        }
    }
}

function handleMove(e) {
    if (!isDragging) return;
    if (e.type === 'touchmove') e.preventDefault();
    
    const pos = getEventPos(e);
    mouseX = pos.x;
    mouseY = pos.y;
}

function handleEnd(e) {
    if (!isDragging) return;
    isDragging = false;
    
    let dx = ball.x - mouseX;
    let dy = ball.y - mouseY;
    let power = Math.hypot(dx, dy) * 0.15;
    
    if (power > 0.5) { 
        if (power > 25) { 
            let ratio = 25 / power;
            dx *= ratio;
            dy *= ratio;
        }
        ball.vx = dx * 0.15;
        ball.vy = dy * 0.15;
        ball.stopped = false;
        
        // Incrementar tacadas
        strokes++;
        updateHUD();
        
        playSound('hit');
    }
}

// Listeners do Mouse
canvas.addEventListener('mousedown', handleStart);
canvas.addEventListener('mousemove', handleMove);
window.addEventListener('mouseup', handleEnd);

// Listeners de Touch
canvas.addEventListener('touchstart', handleStart, {passive: false});
canvas.addEventListener('touchmove', handleMove, {passive: false});
window.addEventListener('touchend', handleEnd);

// ----- LÓGICA E FÍSICA -----
function update() {
    if (gameState !== 'playing') return;

    if (!ball.stopped) {
        ball.x += ball.vx;
        ball.y += ball.vy;

        // Atrito
        ball.vx *= 0.98;
        ball.vy *= 0.98;

        if (Math.hypot(ball.vx, ball.vy) < 0.2) {
            ball.vx = 0; ball.vy = 0; ball.stopped = true;
        }

        // Colisões com paredes
        let bounced = false;
        if (ball.x - ball.radius < 0) {
            ball.x = ball.radius; ball.vx *= -0.8; bounced = true;
        } else if (ball.x + ball.radius > canvas.width) {
            ball.x = canvas.width - ball.radius; ball.vx *= -0.8; bounced = true;
        }

        if (ball.y - ball.radius < 0) {
            ball.y = ball.radius; ball.vy *= -0.8; bounced = true;
        } else if (ball.y + ball.radius > canvas.height) {
            ball.y = canvas.height - ball.radius; ball.vy *= -0.8; bounced = true;
        }

        if (bounced && Math.hypot(ball.vx, ball.vy) > 2) {
            playSound('bounce');
        }

        // Colisão com buraco
        const distToHole = Math.hypot(ball.x - hole.x, ball.y - hole.y);
        if (distToHole < hole.radius && Math.hypot(ball.vx, ball.vy) < 8) {
            playSound('score');
            score++;
            updateHUD();
            
            // Exibe efeito visual ao acertar
            successMsg.classList.add('show');
            setTimeout(() => successMsg.classList.remove('show'), 1000);
            
            resetBall();
            randomizeHole();
        } else if (distToHole < hole.radius) {
            ball.vx *= 0.95; ball.vy *= 0.95;
        }
    }
}

// ----- RENDERIZAÇÃO -----
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Tapete de tacada
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.beginPath();
    ctx.arc(canvas.width * 0.15, canvas.height * 0.5, Math.min(canvas.width, canvas.height) * 0.2, 0, Math.PI * 2);
    ctx.fill();

    // Buraco
    ctx.beginPath();
    ctx.arc(hole.x, hole.y, hole.radius, 0, Math.PI * 2);
    ctx.fillStyle = '#0a2e0c';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#1b5e20';
    ctx.stroke();

    // Bandeira
    ctx.beginPath();
    ctx.moveTo(hole.x, hole.y);
    ctx.lineTo(hole.x, hole.y - 45);
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#fff';
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(hole.x, hole.y - 45);
    ctx.lineTo(hole.x + 25, hole.y - 32);
    ctx.lineTo(hole.x, hole.y - 20);
    ctx.fillStyle = '#f44336';
    ctx.fill();

    // Linha de mira
    if (isDragging) {
        ctx.beginPath();
        ctx.moveTo(ball.x, ball.y);
        let dx = ball.x - mouseX;
        let dy = ball.y - mouseY;
        ctx.lineTo(ball.x + dx, ball.y + dy);
        
        let power = Math.hypot(dx, dy);
        if (power > 150) ctx.strokeStyle = '#f44336';
        else if (power > 75) ctx.strokeStyle = '#ff9800';
        else ctx.strokeStyle = '#ffeb3b';
        
        ctx.setLineDash([5, 5]);
        ctx.lineWidth = 4;
        ctx.stroke();
        ctx.setLineDash([]);
    }

    // Sombra da bola
    ctx.beginPath();
    ctx.arc(ball.x + 3, ball.y + 5, ball.radius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fill();

    // Bola
    const gradient = ctx.createRadialGradient(ball.x - 3, ball.y - 3, 2, ball.x, ball.y, ball.radius);
    gradient.addColorStop(0, '#ffffff');
    gradient.addColorStop(1, '#aaaaaa');

    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#888';
    ctx.stroke();
}

function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
}

loop();