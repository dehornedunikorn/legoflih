import { WORLD_WIDTH, WORLD_HEIGHT } from './config.js';
import { state } from './state.js';

export const worldCanvas = document.createElement('canvas');
worldCanvas.width = WORLD_WIDTH;
worldCanvas.height = WORLD_HEIGHT;
export let worldGenerated = false;

function generateProceduralFallback() {
    const wCtx = worldCanvas.getContext('2d');
    if (!wCtx) return;
    wCtx.fillStyle = '#18351f';
    wCtx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    // Subtle ground variation keeps the world readable while the tile loads.
    for (let i = 0; i < 9000; i++) {
        const x = Math.random() * WORLD_WIDTH;
        const y = Math.random() * WORLD_HEIGHT;
        const r = 2 + Math.random() * 7;
        wCtx.fillStyle = Math.random() > 0.5 ? 'rgba(75,105,55,.13)' : 'rgba(8,25,15,.16)';
        wCtx.beginPath();
        wCtx.arc(x, y, r, 0, Math.PI * 2);
        wCtx.fill();
    }
    worldGenerated = true;
}

export function generateWorld() {
    generateProceduralFallback();
    const groundImg = new Image();
    groundImg.onload = () => {
        const wCtx = worldCanvas.getContext('2d');
        if (!wCtx) return;
        const pattern = wCtx.createPattern(groundImg, 'repeat');
        if (!pattern) return;
        wCtx.clearRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
        wCtx.fillStyle = pattern;
        wCtx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
        worldGenerated = true;
    };
    groundImg.onerror = () => {
        console.warn('A talajtextúra nem tölthető be; a beépített procedurális talaj marad aktív.');
    };
    // The actual tile is stored in assets/img; the old talaj.png path did not exist.
    groundImg.src = './assets/img/field_tile.png';
}

export function drawMinimap(canvasId) {
    const minimapCanvas = document.getElementById(canvasId);
    if (!minimapCanvas) return;
    const mCtx = minimapCanvas.getContext('2d');
    if (!mCtx) return;
    mCtx.clearRect(0, 0, minimapCanvas.width, minimapCanvas.height);
    mCtx.fillStyle = '#111215';
    mCtx.fillRect(0, 0, minimapCanvas.width, minimapCanvas.height);

    const scaleX = minimapCanvas.width / WORLD_WIDTH;
    const scaleY = minimapCanvas.height / WORLD_HEIGHT;
    mCtx.fillStyle = 'rgba(76, 103, 61, 0.35)';
    mCtx.fillRect(0, 0, minimapCanvas.width, minimapCanvas.height);

    mCtx.fillStyle = state.gate.open ? '#00ffff' : '#777b84';
    mCtx.beginPath();
    mCtx.arc(state.gate.x * scaleX, state.gate.y * scaleY, Math.max(3, state.gate.radius * scaleX), 0, Math.PI * 2);
    mCtx.fill();

    state.loots.forEach(l => {
        mCtx.fillStyle = l.color || '#f1c40f';
        mCtx.fillRect(l.x * scaleX - 2, l.y * scaleY - 2, 4, 4);
    });
    mCtx.fillStyle = '#00ffff';
    state.xpGems.forEach(g => {
        mCtx.beginPath();
        mCtx.arc(g.x * scaleX, g.y * scaleY, 2, 0, Math.PI * 2);
        mCtx.fill();
    });

    mCtx.fillStyle = '#cccccc';
    if (state.player?.minions) state.player.minions.forEach(m => {
        mCtx.beginPath();
        mCtx.arc(m.x * scaleX, m.y * scaleY, 2, 0, Math.PI * 2);
        mCtx.fill();
    });

    state.enemies.forEach(e => {
        mCtx.fillStyle = e.isBoss ? '#ff0055' : '#e74c3c';
        mCtx.beginPath();
        mCtx.arc(e.x * scaleX, e.y * scaleY, e.isBoss ? 5 : 3, 0, Math.PI * 2);
        mCtx.fill();
    });

    if (state.player) {
        mCtx.fillStyle = '#9b59b6';
        mCtx.beginPath();
        mCtx.arc(state.player.x * scaleX, state.player.y * scaleY, 5, 0, Math.PI * 2);
        mCtx.fill();
    }

    if (state.isMultiplayerMode) {
        Object.values(state.remotePlayers).forEach(remote => {
            const guest = remote.hero;
            if (!guest) return;
            mCtx.fillStyle = guest.color || '#00ffff';
            mCtx.beginPath();
            mCtx.arc(guest.x * scaleX, guest.y * scaleY, 4, 0, Math.PI * 2);
            mCtx.fill();
        });
    }

    const gameCanvas = document.getElementById('gameCanvas');
    if (gameCanvas) {
        const viewW = gameCanvas.width * state.fovMultiplier;
        const viewH = gameCanvas.height * state.fovMultiplier;
        mCtx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
        mCtx.lineWidth = 1.5;
        mCtx.strokeRect(state.camera.x * scaleX, state.camera.y * scaleY, viewW * scaleX, viewH * scaleY);
    }
}
