import { TARGET_FPS, WORLD_WIDTH, WORLD_HEIGHT } from './config.js';
import { state, input } from './state.js';
import { generateWorld, worldCanvas, worldGenerated, drawMinimap } from './world.js';
import { runMultiplayerSync, startMultiplayerCoop, joinMultiplayerByCode, confirmHostConfig } from './multiplayer.js';
import { Player, Enemy, XPGem, LootDrop, Bullet, createExplosion, FloatingDamage } from './entities.js';
import { LOOT_TYPES } from './spells.js';
import * as UI from './ui.js'; 

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

generateWorld();

function resizeCanvas() {
    canvas.width = window.innerWidth; canvas.height = window.innerHeight;
    input.joystick.originY = canvas.height - 85;
    if (!input.joystick.active) { input.joystick.x = input.joystick.originX; input.joystick.y = input.joystick.originY; }
}
window.addEventListener('resize', resizeCanvas); resizeCanvas();

window.addEventListener('keydown', e => { 
    if(input.keys.hasOwnProperty(e.key.toLowerCase())) input.keys[e.key.toLowerCase()] = true; 
    if(e.key === 'Escape' && state.gameActive) UI.togglePauseMenu(); 
});
window.addEventListener('keyup', e => { 
    if(input.keys.hasOwnProperty(e.key.toLowerCase())) input.keys[e.key.toLowerCase()] = false; 
});
window.addEventListener('mousemove', e => { 
    input.mouse.x = e.clientX; 
    input.mouse.y = e.clientY; 
});
window.addEventListener('mousedown', (e) => { 
    if (e.target.tagName === 'BUTTON' || e.target.closest('#hudMinimapContainer') || e.target.closest('.modal-screen') || e.target.tagName === 'INPUT') return; 
    input.mouse.down = true; 
});
window.addEventListener('mouseup', () => input.mouse.down = false);

if (input.isTouchDevice) {
    canvas.addEventListener('touchstart', e => {
        if (e.target.tagName === 'BUTTON' || e.target.closest('.modal-screen') || e.target.tagName === 'INPUT') return; 
        e.preventDefault(); input.joystick.originY = canvas.height - 85; 
        for (let i = 0; i < e.changedTouches.length; i++) {
            let t = e.changedTouches[i];
            if (t.clientX < window.innerWidth / 2) { 
                if (!input.joystick.active) { input.joystick.active = true; input.joystick.id = t.identifier; _updateJoystick(t.clientX, t.clientY); } 
            } else { 
                if (!input.touchAim.active) { input.touchAim.active = true; input.touchAim.id = t.identifier; input.touchAim.x = t.clientX; input.touchAim.y = t.clientY; } 
            }
        }
    }, { passive: false });
    canvas.addEventListener('touchmove', e => {
        if (e.target.tagName === 'BUTTON' || e.target.closest('.modal-screen') || e.target.tagName === 'INPUT') return; 
        e.preventDefault(); input.joystick.originY = canvas.height - 85;
        for (let i = 0; i < e.changedTouches.length; i++) {
            let t = e.changedTouches[i];
            if (input.joystick.active && t.identifier === input.joystick.id) _updateJoystick(t.clientX, t.clientY);
            if (input.touchAim.active && t.identifier === input.touchAim.id) { input.touchAim.x = t.clientX; input.touchAim.y = t.clientY; }
        }
    }, { passive: false });
    canvas.addEventListener('touchend', e => {
        if (e.target.tagName === 'BUTTON' || e.target.closest('.modal-screen') || e.target.tagName === 'INPUT') return; 
        e.preventDefault();
        for (let i = 0; i < e.changedTouches.length; i++) {
            let t = e.changedTouches[i];
            if (input.joystick.active && t.identifier === input.joystick.id) { 
                input.joystick.active = false; input.joystick.id = null; input.joystick.dx = 0; input.joystick.dy = 0; 
                input.joystick.x = input.joystick.originX; input.joystick.y = input.joystick.originY; 
            }
            if (input.touchAim.active && t.identifier === input.touchAim.id) { 
                input.touchAim.active = false; input.touchAim.id = null; 
            }
        }
    }, { passive: false });
}

function _updateJoystick(x, y) {
    let dx = x - input.joystick.originX; let dy = y - input.joystick.originY; 
    let distance = Math.sqrt(dx*dx + dy*dy); let limitDist = 50; 
    if (distance > limitDist) { dx = (dx/distance)*limitDist; dy = (dy/distance)*limitDist; }
    input.joystick.x = input.joystick.originX + dx; input.joystick.y = input.joystick.originY + dy; 
    input.joystick.dx = dx / limitDist; input.joystick.dy = dy / limitDist;
}

export function initStage(stageNum) {
    if (!state.player) { 
        state.player = new Player(WORLD_WIDTH / 2, WORLD_HEIGHT / 2); 
        state.player.loadClassSprites(state.selectedCharacterType); 
    } else { 
        state.player.x = WORLD_WIDTH / 2; state.player.y = WORLD_HEIGHT / 2; 
        state.player.health = state.player.maxHealth; state.player.minions = []; state.player.recalculateStats(); 
    }
    state.camera.x = state.player.x - canvas.width / 2; state.camera.y = state.player.y - canvas.height / 2;
    state.bullets = []; state.enemies = []; state.xpGems = []; state.particles = []; state.loots = []; state.damageNumbers = []; 
    state.frameCount = 0; state.gameActive = true; state.isPaused = false; lastFrameTime = performance.now();
    let angleToGate = Math.random() * Math.PI * 2; let distToGate = 1500 + Math.random() * 400; 
    state.gate.x = WORLD_WIDTH / 2 + Math.cos(angleToGate) * distToGate; state.gate.y = WORLD_HEIGHT / 2 + Math.sin(angleToGate) * distToGate; state.gate.open = false;
    let isBossStage = (stageNum % 5 === 0);
    
    if (isBossStage) {
        state.activeBoss = new Enemy(state.gate.x - 200, state.gate.y - 200, 'boss_lichald'); state.enemies.push(state.activeBoss); state.totalEnemiesInStage = 1;
        document.getElementById('bossHpContainer').style.display = 'block'; document.getElementById('bossHpBar').style.width = '100%';
        UI.showNotification(`VIGYÁZZ! ${stageNum}. PÁLYA: BOSS HARC!`);
    } else {
        state.activeBoss = null; document.getElementById('bossHpContainer').style.display = 'none'; state.totalEnemiesInStage = 6 + (stageNum * 3);
        let availableTypes = ['slime']; if (stageNum >= 2) availableTypes.push('bat'); if (stageNum >= 3) availableTypes.push('wolf'); if (stageNum >= 4) availableTypes.push('skeleton');
        for (let i = 0; i < state.totalEnemiesInStage; i++) {
            let ex = Math.random() * WORLD_WIDTH; let ey = Math.random() * WORLD_HEIGHT;
            while(Math.hypot(ex - state.player.x, ey - state.player.y) < 300) { ex = Math.random() * WORLD_WIDTH; ey = Math.random() * WORLD_HEIGHT; }
            let type = availableTypes[Math.floor(Math.random() * availableTypes.length)];
            state.enemies.push(new Enemy(ex, ey, type));
        }
        UI.showNotification(`${stageNum}. PÁLYA - Pusztíts el ${state.totalEnemiesInStage} ellenséget!`);
    }
    document.getElementById('gameOverScreen').style.display = 'none'; document.getElementById('levelUpScreen').style.display = 'none'; document.getElementById('pauseMenu').style.display = 'none';
    UI.updateUI();
}

export function initMultiplayerStage(stageNum) {
    if (!state.player) { 
        state.player = new Player(WORLD_WIDTH / 2, WORLD_HEIGHT / 2); 
        state.player.loadClassSprites(state.selectedCharacterType); 
    } else { 
        state.player.x = WORLD_WIDTH / 2; state.player.y = WORLD_HEIGHT / 2; 
        state.player.health = state.player.maxHealth; state.player.minions = []; state.player.recalculateStats(); 
    }

    state.camera.x = state.player.x - canvas.width / 2; state.camera.y = state.player.y - canvas.height / 2;
    state.bullets = []; state.enemies = []; state.xpGems = []; state.particles = []; state.loots = []; state.damageNumbers = []; 
    state.frameCount = 0; state.gameActive = true; state.isPaused = false; lastFrameTime = performance.now();

    if (state.isHostUser) {
        let angleToGate = Math.random() * Math.PI * 2; let distToGate = 1500 + Math.random() * 400; 
        state.gate.x = WORLD_WIDTH / 2 + Math.cos(angleToGate) * distToGate; state.gate.y = WORLD_HEIGHT / 2 + Math.sin(angleToGate) * distToGate; state.gate.open = false;
        window.Playroom.setState("gatePos", { x: state.gate.x, y: state.gate.y }); window.Playroom.setState("gateOpen", false);
    } else {
        const hGate = window.Playroom.getState("gatePos"); if (hGate) { state.gate.x = hGate.x; state.gate.y = hGate.y; } state.gate.open = false;
    }

    let playerCount = 1 + Object.keys(state.remotePlayers).length;
    let isBossStage = (stageNum % 5 === 0);
    
    if (isBossStage) {
        let bossHp = (500 + (stageNum * 150)) * (1 + 0.5 * (playerCount - 1));
        if (state.isHostUser) { state.activeBoss = new Enemy(state.gate.x - 200, state.gate.y - 200, 'boss_lichald', bossHp); state.enemies.push(state.activeBoss); state.totalEnemiesInStage = 1; }
        document.getElementById('bossHpContainer').style.display = 'block'; document.getElementById('bossHpBar').style.width = '100%';
        UI.showNotification(`VIGYÁZZ! CO-OP BOSS HARC: LICHÁLD ÁRNYÉKA! (${playerCount} Játékos ellen!)`);
    } else {
        state.activeBoss = null; document.getElementById('bossHpContainer').style.display = 'none';
        state.totalEnemiesInStage = Math.floor((6 + (stageNum * 3)) * (1 + 0.3 * (playerCount - 1)));
        
        if (state.isHostUser) {
            let availableTypes = ['slime']; if (stageNum >= 2) availableTypes.push('bat'); if (stageNum >= 3) availableTypes.push('wolf'); if (stageNum >= 4) availableTypes.push('skeleton');
            for (let i = 0; i < state.totalEnemiesInStage; i++) {
                let ex = Math.random() * WORLD_WIDTH; let ey = Math.random() * WORLD_HEIGHT;
                while(Math.hypot(ex - state.player.x, ey - state.player.y) < 300) { ex = Math.random() * WORLD_WIDTH; ey = Math.random() * WORLD_HEIGHT; }
                let type = availableTypes[Math.floor(Math.random() * availableTypes.length)];
                state.enemies.push(new Enemy(ex, ey, type));
            }
        }
        UI.showNotification(`${stageNum}. PÁLYA - Pusztítsátok el a(z) ${state.totalEnemiesInStage} szörnyet!`);
    }
    
    document.getElementById('gameOverScreen').style.display = 'none'; document.getElementById('levelUpScreen').style.display = 'none'; document.getElementById('pauseMenu').style.display = 'none';
    UI.updateUI();
}

let lastFrameTime = 0;

function animate(timestamp) {
    requestAnimationFrame(animate);
    if (!state.gameActive || state.isPaused) { lastFrameTime = timestamp; return; }

    if (!lastFrameTime) lastFrameTime = timestamp;
    let deltaTime = timestamp - lastFrameTime;
    lastFrameTime = timestamp;

    let dtModifier = deltaTime / (1000 / TARGET_FPS);
    if (dtModifier > 3.0) dtModifier = 3.0; 

    let viewW = canvas.width * state.fovMultiplier; let viewH = canvas.height * state.fovMultiplier;
    let marginX = viewW * 0.4; let marginY = viewH * 0.4;
    
    if (state.player.x < state.camera.x + marginX) state.camera.x = state.player.x - marginX;
    if (state.player.x > state.camera.x + viewW - marginX) state.camera.x = state.player.x - viewW + marginX;
    if (state.player.y < state.camera.y + marginY) state.camera.y = state.player.y - marginY;
    if (state.player.y > state.camera.y + viewH - marginY) state.camera.y = state.player.y - viewH + marginY;
    
    state.camera.x = Math.max(0, Math.min(WORLD_WIDTH - viewW, state.camera.x));
    state.camera.y = Math.max(0, Math.min(WORLD_HEIGHT - viewH, state.camera.y));

    ctx.fillStyle = '#0d131a'; ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (worldGenerated) { ctx.drawImage(worldCanvas, state.camera.x, state.camera.y, viewW, viewH, 0, 0, canvas.width, canvas.height); }

    runMultiplayerSync(dtModifier);

    ctx.save(); ctx.scale(1 / state.fovMultiplier, 1 / state.fovMultiplier); ctx.translate(-state.camera.x, -state.camera.y);

    ctx.save(); ctx.shadowBlur = state.gate.open ? 30 : 5; ctx.shadowColor = state.gate.open ? '#00ffff' : '#555';
    ctx.strokeStyle = '#2c2e35'; ctx.lineWidth = 14; ctx.beginPath(); ctx.arc(state.gate.x, state.gate.y, state.gate.radius, Math.PI, 0); ctx.stroke();
    ctx.fillStyle = '#1c1e22'; ctx.fillRect(state.gate.x - state.gate.radius - 7, state.gate.y, (state.gate.radius + 7) * 2, 10);
    
    if (state.gate.open) {
        let portalGrad = ctx.createRadialGradient(state.gate.x, state.gate.y - 15, 5, state.gate.x, state.gate.y - 15, state.gate.radius);
        portalGrad.addColorStop(0, 'rgba(0, 255, 255, 0.9)'); portalGrad.addColorStop(0.5, 'rgba(142, 68, 173, 0.7)'); portalGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = portalGrad; ctx.beginPath(); ctx.arc(state.gate.x, state.gate.y, state.gate.radius - 2, Math.PI, 0); ctx.fill();
        if (Math.random() < 0.25) createExplosion(state.gate.x + (Math.random() * 40 - 20), state.gate.y - 15, '#00ffff', 1);
    } else {
        ctx.fillStyle = '#090a0c'; ctx.beginPath(); ctx.arc(state.gate.x, state.gate.y, state.gate.radius - 2, Math.PI, 0); ctx.fill();
    }
    ctx.restore();

    if (state.gate.open) {
        let dToGate = Math.hypot(state.player.x - state.gate.x, state.player.y - state.gate.y);
        if (dToGate < state.player.radius + state.gate.radius) {
            state.currentStage++; UI.showNotification(`PORTÁL AKTIVÁLVA! Belépés a(z) ${state.currentStage}. szintre...`);
            if (state.isMultiplayerMode) { initMultiplayerStage(state.currentStage); } else { initStage(state.currentStage); }
            ctx.restore(); return;
        }
    }

    for (let i = state.loots.length - 1; i >= 0; i--) {
        const l = state.loots[i]; l.draw(ctx);
        if (l.state === 'idle') {
            if (Math.hypot(state.player.x - l.x, state.player.y - l.y) < state.player.radius + l.radius) {
                l.state = 'opening'; createExplosion(l.x, l.y, l.color, 12); 
                if (state.isMultiplayerMode) { window.Playroom.myPlayer().setState("collectAction", { id: l.id, type: "loot", lootType: l.type, r_id: Math.random() }); }
            }
        } 
        else if (l.state === 'opening') {
            l.animationTimer += dtModifier;
            if (l.animationTimer >= l.maxAnimationFrames) {
                l.state = 'collected'; 
                if (state.isMultiplayerMode) {
                    if (!state.roomConfig.sharedProgression) { UI.collectLoot(l.type); } else if (state.isHostUser) { window.Playroom.setState("sharedLootEvent", { type: l.type, r_id: Math.random() }); }
                } else { UI.collectLoot(l.type); }
                if (state.isHostUser || !state.isMultiplayerMode) { state.loots.splice(i, 1); }
            }
        }
    }

    if (state.isMultiplayerMode) { for (let key in state.remotePlayers) { const guest = state.remotePlayers[key].hero; guest.draw(ctx); } }

    state.player.minions.forEach((m, i) => { m.update(dtModifier); m.draw(ctx); });
    state.player.update(dtModifier); state.player.draw(ctx);

    for (let i = state.particles.length - 1; i >= 0; i--) {
        state.particles[i].update(dtModifier); state.particles[i].draw(ctx);
        if (state.particles[i].life <= 0) state.particles.splice(i, 1);
    }

    for (let i = state.damageNumbers.length - 1; i >= 0; i--) {
        state.damageNumbers[i].update(dtModifier); state.damageNumbers[i].draw(ctx);
        if (state.damageNumbers[i].life <= 0) state.damageNumbers.splice(i, 1);
    }

    for (let i = state.xpGems.length - 1; i >= 0; i--) {
        const gem = state.xpGems[i]; gem.update(dtModifier); 
        if (gem.x > state.camera.x - 50 && gem.x < state.camera.x + viewW + 50 && gem.y > state.camera.y - 50 && gem.y < state.camera.y + viewH + 50) { gem.draw(ctx); }
        if (gem.collectedLocally) continue;

        if (Math.hypot(state.player.x - gem.x, state.player.y - gem.y) < state.player.radius + gem.radius) {
            gem.collectedLocally = true;
            if (state.isMultiplayerMode) {
                window.Playroom.myPlayer().setState("collectAction", { id: gem.id, type: "gem", r_id: Math.random() });
                if (!state.roomConfig.sharedProgression) { state.player.addXP(10); state.score += 10; } else if (state.isHostUser) { window.Playroom.setState("sharedXpEvent", { amount: 10, r_id: Math.random() }); }
            } else { state.player.addXP(10); state.score += 10; }
            if (state.isHostUser || !state.isMultiplayerMode) { state.xpGems.splice(i, 1); }
        }
    }

    for (let i = state.bullets.length - 1; i >= 0; i--) {
        const b = state.bullets[i]; b.update(dtModifier); b.draw(ctx);
        if (b.x < state.camera.x - 200 || b.x > state.camera.x + viewW + 200 || b.y < state.camera.y - 200 || b.y > state.camera.y + viewH + 200) { state.bullets.splice(i, 1); continue; }
    }

    if (!state.isMultiplayerMode || state.isHostUser) {
        let spawnRate = Math.max(30, 120 - Math.floor(state.player.level * 3)); 
        if (state.frameCount % spawnRate === 0) {
            let isVertical = Math.random() < 0.5; let x, y;
            if (isVertical) { x = Math.random() < 0.5 ? state.camera.x - 50 : state.camera.x + viewW + 50; y = state.camera.y + Math.random() * viewH; } 
            else { x = state.camera.x + Math.random() * viewW; y = Math.random() < 0.5 ? state.camera.y - 50 : state.camera.y + viewH + 50; }
            x = Math.max(0, Math.min(WORLD_WIDTH, x)); y = Math.max(0, Math.min(WORLD_HEIGHT, y));
            let availableTypes = ['slime'];
            if (state.player.level >= 2) availableTypes.push('bat'); if (state.player.level >= 4) availableTypes.push('wolf'); if (state.player.level >= 6) availableTypes.push('skeleton');
            let type = availableTypes[Math.floor(Math.random() * availableTypes.length)];
            state.enemies.push(new Enemy(x, y, type));
        }

        for (let i = state.enemies.length - 1; i >= 0; i--) {
            const enemy = state.enemies[i]; enemy.update(dtModifier); 
            if (enemy.x > state.camera.x - 50 && enemy.x < state.camera.x + viewW + 50 && enemy.y > state.camera.y - 50 && enemy.y < state.camera.y + viewH + 50) { enemy.draw(ctx); }

            const dToPlayer = Math.hypot(state.player.x - enemy.x, state.player.y - enemy.y);
            if (dToPlayer < state.player.radius + enemy.radius) {
                if (state.player.evasion > 0 && Math.random() < state.player.evasion) {
                    if(state.frameCount % 15 === 0) UI.showNotification("Kitértél a csapás elől! (Evaded)");
                } else {
                    const dmgTaken = enemy.damage * 0.05 * (1.0 - state.player.armor);
                    state.player.health -= dmgTaken; UI.updateUI();
                    state.damageNumbers.push(new FloatingDamage(state.player.x, state.player.y - 15, `${Math.floor(dmgTaken)}`, '#ff3333'));
                    if (state.player.thorns > 0 && (!state.isMultiplayerMode || state.isHostUser)) { enemy.health -= dmgTaken * state.player.thorns; }
                    if(state.frameCount % 10 === 0) createExplosion(state.player.x, state.player.y, '#e74c3c', 2);
                    if (state.player.health <= 0) UI.gameOver();
                }
            }

            if (state.isMultiplayerMode) {
                for (let key in state.remotePlayers) {
                    const guest = state.remotePlayers[key].hero; const dToGuest = Math.hypot(guest.x - enemy.x, guest.y - enemy.y);
                    if (dToGuest < guest.radius + enemy.radius) { if(state.frameCount % 10 === 0) createExplosion(guest.x, guest.y, '#e74c3c', 1); }
                }
            }

            for (let j = state.bullets.length - 1; j >= 0; j--) {
                const b = state.bullets[j];
                if (Math.hypot(b.x - enemy.x, b.y - enemy.y) < enemy.radius + b.radius) {
                    enemy.health -= b.damage; state.damageNumbers.push(new FloatingDamage(enemy.x, enemy.y - 15, `${Math.floor(b.damage)}`, '#00ffff'));
                    state.bullets.splice(j, 1); createExplosion(b.x, b.y, b.color, 5); break;
                }
            }

            if (enemy.health <= 0) {
                state.score++; createExplosion(enemy.x, enemy.y, '#27ae60', 10); state.xpGems.push(new XPGem(enemy.x, enemy.y)); 
                if (Math.random() < 0.02) {
                    const keys = Object.keys(LOOT_TYPES); const randomType = keys[Math.floor(Math.random() * keys.length)];
                    state.loots.push(new LootDrop(enemy.x, enemy.y, randomType));
                }
                state.enemies.splice(i, 1);
                if (state.enemies.length === 0) {
                    state.gate.open = true; document.getElementById('bossHpContainer').style.display = 'none';
                    UI.showNotification("MENEKÜLJ! Az ellenség elbukott, a kőkapu kinyílt!");
                }
                UI.updateUI();
            }
        }
    } else {
        state.enemies.forEach(e => e.draw(ctx));
    }

    ctx.restore();
    
    if (state.gate.open) {
        let angleToGate = Math.atan2(state.gate.y - state.player.y, state.gate.x - state.player.x); ctx.save();
        let compassRadius = 45; let arrowX = canvas.width / 2 + Math.cos(angleToGate) * compassRadius; let arrowY = canvas.height / 2 + Math.sin(angleToGate) * compassRadius;
        ctx.translate(arrowX, arrowY); ctx.rotate(angleToGate); ctx.shadowBlur = 15; ctx.shadowColor = '#00ffff'; ctx.fillStyle = '#00ffff';
        ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(-6, -8); ctx.lineTo(-2, 0); ctx.lineTo(-6, 8); ctx.closePath(); ctx.fill(); ctx.restore();
    }

    if (state.hudMinimapVisible) { drawMinimap('hudMinimapCanvas'); }

    if (input.isTouchDevice) {
        input.joystick.originY = canvas.height - 85; if (!input.joystick.active) { input.joystick.x = input.joystick.originX; input.joystick.y = input.joystick.originY; }
        ctx.save(); ctx.beginPath(); ctx.arc(input.joystick.originX, input.joystick.originY, 50, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255, 255, 255, 0.1)'; ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)'; ctx.lineWidth = 2; ctx.stroke(); ctx.beginPath(); ctx.arc(input.joystick.x, input.joystick.y, 25, 0, Math.PI * 2);
        ctx.fillStyle = input.joystick.active ? 'rgba(0, 255, 255, 0.6)' : 'rgba(0, 255, 255, 0.2)'; ctx.fill(); ctx.restore();
    }
    state.frameCount++;
}


// --- HTML GOMBOK ÉS UI ÁLLAPOTOK KEZELÉSE ---
window.startGame = () => { document.getElementById('startScreen').style.display = 'none'; document.getElementById('mainMenu').style.display = 'block'; };

window.openCharacterSelect = (mode) => { 
    state.charSelectMode = mode;
    document.getElementById('mainMenu').style.display = 'none'; 
    document.getElementById('charSelectScreen').style.display = 'block';
    
    // Szinkronizációs panel mutatása, ha multiplayer
    const lobbyEl = document.getElementById('lobbyContainer');
    if (lobbyEl) lobbyEl.style.display = mode === 'multi' ? 'block' : 'none';
    
    if (mode === 'multi' && state.localPlayerState) {
        state.localPlayerState.setState("gameReady", false);
        state.localPlayerState.setState("class", "");
    }

    state.selectedCharacterType = null;
    const startBtn = document.getElementById('charStartBtn'); startBtn.disabled = true; startBtn.style.boxShadow = 'none'; startBtn.style.border = '';
    startBtn.innerText = "Készen állok! / Ready!";
    document.getElementById('char-wizard').classList.remove('selected'); document.getElementById('char-warrior').classList.remove('selected'); document.getElementById('char-ranger').classList.remove('selected');
    document.getElementById('charSelectWarning').innerText = "";
};

window.selectCharacter = (type) => {
    if (state.isMultiplayerMode && state.roomConfig.uniqueClasses) {
        let taken = false;
        for (let key in state.remotePlayers) {
            if (state.remotePlayers[key].state.getState("class") === type) taken = true;
        }
        if (taken) { 
            document.getElementById('charSelectWarning').innerText = "Ez a hősosztály már foglalt a szobában! Válassz másikat."; 
            return; 
        }
    }
    
    state.selectedCharacterType = type; 
    document.getElementById('charSelectWarning').innerText = "";
    document.getElementById('char-wizard').classList.remove('selected'); document.getElementById('char-warrior').classList.remove('selected'); document.getElementById('char-ranger').classList.remove('selected');
    document.getElementById(`char-${type}`).classList.add('selected');
    
    const startBtn = document.getElementById('charStartBtn'); 
    startBtn.disabled = false; 
    startBtn.style.border = '2px solid #ffd700'; 
    startBtn.style.boxShadow = '0 0 25px rgba(255, 215, 0, 0.6)';

    // Többjátékos módban egyből frissítjük a látható karaktert a többieknek
    if (state.isMultiplayerMode && state.localPlayerState) {
        state.localPlayerState.setState("class", type);
    }
};

window.backToMainMenu = UI.backToMainMenu;

window.confirmCharacterSelection = () => {
    if (state.charSelectMode === 'multi') {
        const currentReady = state.localPlayerState.getState("gameReady");
        state.localPlayerState.setState("gameReady", !currentReady); // Átkapcsolás gomb (Kész/Mégse)
    } else {
        if (!state.selectedCharacterType) return; 
        document.getElementById('charSelectScreen').style.display = 'none'; 
        document.getElementById('ui').style.display = 'block'; 
        document.getElementById('xpBarContainer').style.display = 'block';
        state.currentStage = 1; state.player = null; initStage(state.currentStage); 
    }
};

// --- MULTIPLAYER LOBBY UI FRISSÍTÉSE CIKLUS ---
setInterval(() => {
    const charScreen = document.getElementById('charSelectScreen');
    if (charScreen.style.display !== 'none' && state.charSelectMode === 'multi') {
        const listEl = document.getElementById('lobbyPlayerList');
        if (!listEl) return;
        
        let allReady = true;
        let playersCount = 0;
        let html = "";
        
        const classNames = { wizard: 'Varázsló', warrior: 'Harcos', ranger: 'Vándor' };
        
        // 1. A mi karakterünk listázása
        if (state.localPlayerState) {
            playersCount++;
            const isReady = state.localPlayerState.getState("gameReady");
            const rawClass = state.localPlayerState.getState("class");
            const pClass = classNames[rawClass] || "Kiválasztás alatt...";
            const name = state.localPlayerState.getProfile().name;
            const color = state.localPlayerState.getProfile().color.hex;
            
            if (!isReady) allReady = false;
            
            html += `<li style="margin-bottom: 12px; padding: 10px; background: rgba(0,0,0,0.4); border-radius: 6px; border-left: 5px solid ${color};">
                <strong style="font-size:18px;">${name} (Te)</strong><br>
                <span style="font-size:14px; color:#aaa;">Kaszt: <span style="color:#fff">${pClass}</span></span><br>
                <span style="font-size:16px; font-weight:bold; color:${isReady ? '#2ecc71' : '#e74c3c'}">${isReady ? '✔ Készen áll' : '❌ Nem áll készen'}</span>
            </li>`;
            
            const btn = document.getElementById('charStartBtn');
            if (btn) {
                btn.innerText = isReady ? "Visszavonás / Not Ready" : "Készen állok! / Ready!";
            }
        }
        
        // 2. Többi csatlakozott játékos listázása
        for (let key in state.remotePlayers) {
            playersCount++;
            const guestObj = state.remotePlayers[key];
            const isReady = guestObj.state.getState("gameReady");
            const rawClass = guestObj.state.getState("class");
            const pClass = classNames[rawClass] || "Kiválasztás alatt...";
            const name = guestObj.state.getProfile().name;
            const color = guestObj.state.getProfile().color.hex;
            
            if (!isReady) allReady = false;
            
            html += `<li style="margin-bottom: 12px; padding: 10px; background: rgba(0,0,0,0.4); border-radius: 6px; border-left: 5px solid ${color};">
                <strong style="font-size:18px;">${name}</strong><br>
                <span style="font-size:14px; color:#aaa;">Kaszt: <span style="color:#fff">${pClass}</span></span><br>
                <span style="font-size:16px; font-weight:bold; color:${isReady ? '#2ecc71' : '#e74c3c'}">${isReady ? '✔ Készen áll' : '❌ Várakozás...'}</span>
            </li>`;
        }
        
        listEl.innerHTML = html;
        
        // 3. JÁTÉK INDÍTÁSA HA MINDENKI KÉSZ
        if (allReady && playersCount > 0 && state.localPlayerState) {
            state.localPlayerState.setState("gameReady", false); // Visszaállítjuk, ha vége lenne a menetnek
            document.getElementById('charSelectScreen').style.display = 'none'; 
            document.getElementById('ui').style.display = 'block'; 
            document.getElementById('xpBarContainer').style.display = 'block';
            initMultiplayerStage(1);
        }
    }
}, 500);

window.startMultiplayerCoop = startMultiplayerCoop; 
window.confirmHostConfig = confirmHostConfig;
window.showJoinMenu = UI.showJoinMenu; 
window.closeJoinMenu = UI.closeJoinMenu; 
window.joinMultiplayerByCode = joinMultiplayerByCode;
window.alertComingSoon = UI.alertComingSoon; 
window.generateLegend = UI.generateLegend; 
window.resetGame = UI.resetGame;
window.updateZoom = UI.updateZoom; 
window.adjustFov = UI.adjustFov; 
window.toggleMiniMapHUD = UI.toggleMiniMapHUD; 
window.togglePauseMenu = UI.togglePauseMenu; 

// A Ciklus indítása
requestAnimationFrame(animate);