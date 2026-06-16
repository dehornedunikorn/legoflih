import { WORLD_WIDTH, WORLD_HEIGHT } from './config.js';
import { state } from './state.js';

export let worldCanvas = document.createElement('canvas');
worldCanvas.width = WORLD_WIDTH;
worldCanvas.height = WORLD_HEIGHT;
export let worldGenerated = false;

function generateProceduralFallback() {
    let wCtx = worldCanvas.getContext('2d');
    wCtx.fillStyle = '#143118';
    wCtx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    wCtx.strokeStyle = '#1b4320';
    wCtx.lineWidth = 2;
    for (let i = 0; i < 15000; i++) {
        let x = Math.random() * WORLD_WIDTH;
        let y = Math.random() * WORLD_HEIGHT;
        wCtx.beginPath();
        wCtx.moveTo(x, y); wCtx.lineTo(x - 2, y - 6);
        wCtx.moveTo(x, y); wCtx.lineTo(x + 2, y - 6);
        wCtx.stroke();
    }
    worldGenerated = true;
}

export function generateWorld() {
    generateProceduralFallback();

    let groundImg = new Image();
    groundImg.crossOrigin = "Anonymous"; 

    groundImg.onload = () => {
        let wCtx = worldCanvas.getContext('2d');
        wCtx.clearRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
        
        let pattern = wCtx.createPattern(groundImg, 'repeat');
        wCtx.fillStyle = pattern;
        wCtx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
        
        worldGenerated = true; 
    };

    groundImg.onerror = () => {
        console.warn("Nem sikerült betölteni a talaj textúrát a GitHubról! Procedurális fallback aktív.");
    };

    groundImg.src = "https://raw.githubusercontent.com/dehornedunikorn/legoflih/main/talaj.png"; 
}

export function drawMinimap(canvasId) {
    const minimapCanvas = document.getElementById(canvasId);
    if (!minimapCanvas) return;
    const mCtx = minimapCanvas.getContext('2d');
    mCtx.clearRect(0, 0, minimapCanvas.width, minimapCanvas.height);
    mCtx.fillStyle = '#111215'; mCtx.fillRect(0, 0, minimapCanvas.width, minimapCanvas.height);
    
    const scaleX = minimapCanvas.width / WORLD_WIDTH;
    const scaleY = minimapCanvas.height / WORLD_HEIGHT;

    mCtx.fillStyle = 'rgba(76, 53, 28, 0.4)';
    mCtx.beginPath(); mCtx.arc(WORLD_WIDTH/2 * scaleX, WORLD_HEIGHT/2 * scaleY, 700 * scaleX, 0, Math.PI * 2); mCtx.fill();

    mCtx.fillStyle = state.gate.open ? '#00ffff' : '#444850';
    mCtx.beginPath(); mCtx.arc(state.gate.x * scaleX, state.gate.y * scaleY, (state.gate.radius + 8) * scaleX, 0, Math.PI * 2); mCtx.fill();

    state.loots.forEach(l => { mCtx.fillStyle = l.color; mCtx.fillRect(l.x * scaleX - 2, l.y * scaleY - 2, 4, 4); });
    mCtx.fillStyle = '#00ffff'; state.xpGems.forEach(g => { mCtx.beginPath(); mCtx.arc(g.x * scaleX, g.y * scaleY, 2, 0, Math.PI * 2); mCtx.fill(); });

    mCtx.fillStyle = '#cccccc';
    if (state.player && state.player.minions) { state.player.minions.forEach(m => { mCtx.beginPath(); mCtx.arc(m.x * scaleX, m.y * scaleY, 2, 0, Math.PI * 2); mCtx.fill(); }); }

    state.enemies.forEach(e => {
        mCtx.fillStyle = e.isBoss ? '#ff0055' : '#e74c3c';
        mCtx.beginPath(); mCtx.arc(e.x * scaleX, e.y * scaleY, e.isBoss ? 5 : 3, 0, Math.PI * 2); mCtx.fill();
    });

    mCtx.fillStyle = '#9b59b6'; mCtx.beginPath(); mCtx.arc(state.player.x * scaleX, state.player.y * scaleY, 5, 0, Math.PI*2); mCtx.fill();

    if (state.isMultiplayerMode) {
        for (let key in state.remotePlayers) {
            const guest = state.remotePlayers[key].hero;
            mCtx.fillStyle = guest.color;
            mCtx.beginPath(); mCtx.arc(guest.x * scaleX, guest.y * scaleY, 4, 0, Math.PI * 2); mCtx.fill();
        }
    }

    const canvas = document.getElementById('gameCanvas');
    const viewW = canvas.width * state.fovMultiplier; const viewH = canvas.height * state.fovMultiplier;
    mCtx.strokeStyle = 'rgba(255, 255, 255, 0.35)'; mCtx.lineWidth = 1.5;
    mCtx.strokeRect(state.camera.x * scaleX, state.camera.y * scaleY, viewW * scaleX, viewH * scaleY);
}