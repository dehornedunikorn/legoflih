import { PLAYROOM_GAME_ID, TARGET_FPS } from './config.js';
import { state, input } from './state.js';
import { Player, Enemy, XPGem, LootDrop, Bullet, createExplosion } from './entities.js';
import { showNotification, openCharacterSelect, collectLoot, updateUI } from './ui.js';

export async function startMultiplayerCoop() {
    document.getElementById('mainMenu').style.display = 'none';
    await startMultiplayerCore(null);
}

export async function joinMultiplayerByCode() {
    const code = document.getElementById('roomCodeInput').value.toUpperCase().trim();
    if (code.length !== 4) { showNotification("Hiba: A szobakódnak pontosan 4 betűből kell állnia!"); return; }
    document.getElementById('joinMenuScreen').style.display = 'none';
    await startMultiplayerCore(code);
}

export async function startMultiplayerCore(roomCodeToJoin) {
    state.isMultiplayerMode = true;
    showNotification("Csatlakozás a mágikus lobbihoz... / Connecting to Playroom...");

    if (typeof window.Playroom === 'undefined') {
        showNotification("A Playroom hálózati modul nem érhető el. Egyjátékos mód indul...");
        state.isMultiplayerMode = false; openCharacterSelect('single'); return;
    }

    try {
        let initOptions = {
            gameId: PLAYROOM_GAME_ID, discord: false, maxPlayers: 3,
            defaultPlayerStates: { x: 2000, y: 2000, angle: 0, health: 100, level: 1, class: "wizard", score: 0 }
        };
        if (roomCodeToJoin) { initOptions.roomCode = roomCodeToJoin; }

        await window.Playroom.insertCoin(initOptions);
        state.isHostUser = window.Playroom.isHost();

        if (state.isHostUser) {
            document.getElementById('displayRoomCode').innerText = window.Playroom.getRoomCode();
            document.getElementById('hostConfigScreen').style.display = 'block';
        } else {
            showNotification("Várakozás a Házigazdára... / Waiting for the Host to start...");
            let checkHostInterval = setInterval(() => {
                let started = window.Playroom.getState("gameStarted");
                if (started) {
                    clearInterval(checkHostInterval);
                    const syncedConfig = window.Playroom.getState("config");
                    if (syncedConfig) state.roomConfig = syncedConfig;
                    openCharacterSelect('multi');
                }
            }, 500);
        }

        window.Playroom.onPlayerJoin((playerState) => {
            const profile = playerState.getProfile(); showNotification(`${profile.name} csatlakozott a harchoz!`);
            if (playerState.id !== window.Playroom.myPlayer().id) {
                const guestHero = new Player(2000, 2000, profile.color.hex);
                guestHero.name = profile.name; guestHero.id = playerState.id;
                state.remotePlayers[playerState.id] = { hero: guestHero, state: playerState, lastActionTimestamp: 0, lastCollectTimestamp: 0 };
            } else {
                state.localPlayerState = playerState;
            }
            playerState.onQuit(() => {
                showNotification(`${profile.name} elhagyta a csatateret.`); delete state.remotePlayers[playerState.id]; updateUI();
            });
        });

    } catch (err) {
        console.error("Playroom hiba: ", err);
        if (roomCodeToJoin) { showNotification("Hibás szobakód, vagy a szoba már nem létezik!"); document.getElementById('mainMenu').style.display = 'block'; } 
        else { showNotification("Sikertelen hálózati kapcsolat. Single Player mód betöltése..."); state.isMultiplayerMode = false; openCharacterSelect('single'); }
    }
}

export function confirmHostConfig() {
    state.roomConfig.uniqueClasses = document.getElementById('configUniqueClasses').value === 'true';
    state.roomConfig.sharedProgression = document.getElementById('configSharedProgression').value === 'true';
    window.Playroom.setState("config", state.roomConfig); window.Playroom.setState("gameStarted", true);
    document.getElementById('hostConfigScreen').style.display = 'none'; openCharacterSelect('multi');
}

export function runMultiplayerSync(dtModifier) {
    if (!state.isMultiplayerMode) return;
    if (!state.localPlayerState || !state.player) return; 

    state.localPlayerState.setState("pos", { x: Math.round(state.player.x), y: Math.round(state.player.y) });
    state.localPlayerState.setState("angle", Math.atan2(input.mouse.y - state.player.y, input.mouse.x - state.player.x));
    state.localPlayerState.setState("health", state.player.health);
    state.localPlayerState.setState("level", state.player.level);
    state.localPlayerState.setState("score", state.score);

    if (input.mouse.down && state.player.shootCooldown <= 0) {
        let dmg = 25 * state.player.damageMulti;
        if(state.player.className === 'warrior') dmg = 40 * state.player.damageMulti;
        if(state.player.className === 'ranger') dmg = 20 * state.player.damageMulti;

        state.localPlayerState.setState("shootAction", {
            x: Math.round(state.player.x), y: Math.round(state.player.y), angle: Math.atan2(input.mouse.y - state.player.y, input.mouse.x - state.player.x), damage: dmg, r_id: Math.random() 
        });
    }

    for (let key in state.remotePlayers) {
        const guestObj = state.remotePlayers[key]; const guestState = guestObj.state; const guestHero = guestObj.hero;
        const pos = guestState.getState("pos"); const angle = guestState.getState("angle"); const hp = guestState.getState("health"); const pClass = guestState.getState("class");

        if (pos) { guestHero.x = guestHero.x + (pos.x - guestHero.x) * 0.2 * dtModifier; guestHero.y = guestHero.y + (pos.y - guestHero.y) * 0.2 * dtModifier; }
        if (angle !== undefined) guestHero.slashAngle = angle; if (hp !== undefined) guestHero.health = hp;
        if (pClass && guestHero.className !== pClass) { guestHero.loadClassSprites(pClass); }

        const shootAction = guestState.getState("shootAction");
        if (shootAction && guestObj.lastActionTimestamp !== shootAction.r_id) {
            guestObj.lastActionTimestamp = shootAction.r_id;
            let dmg = shootAction.damage || 20;
            
            if (guestHero.className === "warrior") {
                guestHero.slashActive = true; guestHero.slashAngle = shootAction.angle; guestHero.slashTimer = 0;
                createExplosion(guestHero.x + Math.cos(shootAction.angle)*20, guestHero.y + Math.sin(shootAction.angle)*20, '#e5e7e9', 4);
                if (state.isHostUser) {
                    state.enemies.forEach(e => {
                        let dist = Math.hypot(e.x - guestHero.x, e.y - guestHero.y);
                        if (dist < 55) {
                            let angleToEnemy = Math.atan2(e.y - guestHero.y, e.x - guestHero.x);
                            if (Math.abs(shootAction.angle - angleToEnemy) < Math.PI * 0.35) {
                                e.health -= dmg; e.x += Math.cos(angleToEnemy) * 25; e.y += Math.sin(angleToEnemy) * 25;
                                createExplosion(e.x, e.y, '#e5e7e9', 6);
                            }
                        }
                    });
                }
            } else {
                const speed = guestHero.className === "ranger" ? 11 : 10;
                const vx = Math.cos(shootAction.angle) * speed; const vy = Math.sin(shootAction.angle) * speed;
                const color = guestHero.className === "ranger" ? '#b3af91' : '#00ffff';
                state.bullets.push(new Bullet(guestHero.x, guestHero.y, vx, vy, dmg, color));
            }
        }

        const collectAction = guestState.getState("collectAction");
        if (collectAction && guestObj.lastCollectTimestamp !== collectAction.r_id) {
            guestObj.lastCollectTimestamp = collectAction.r_id;
            if (state.isHostUser) {
                if (collectAction.type === "gem") {
                    let gIdx = state.xpGems.findIndex(g => g.id === collectAction.id); if(gIdx !== -1) state.xpGems.splice(gIdx, 1);
                    if (state.roomConfig.sharedProgression) { window.Playroom.setState("sharedXpEvent", { amount: 10, r_id: Math.random() }); }
                } else if (collectAction.type === "loot") {
                    let lIdx = state.loots.findIndex(l => l.id === collectAction.id); if(lIdx !== -1 && state.loots[lIdx].state === 'idle') { state.loots[lIdx].state = "opening"; }
                    if (state.roomConfig.sharedProgression) { window.Playroom.setState("sharedLootEvent", { type: collectAction.lootType, r_id: Math.random() }); }
                }
            }
        }
    }

    if (state.isHostUser) {
        if (state.frameCount % 6 === 0) {
            const serializedEnemies = state.enemies.map(e => ({ id: e.id, x: Math.round(e.x), y: Math.round(e.y), type: e.type, hp: Math.round(e.health), maxHp: Math.round(e.maxHealth), isBoss: e.isBoss }));
            window.Playroom.setState("enemies", serializedEnemies); window.Playroom.setState("enemiesCount", state.enemies.length);

            const serializedGems = state.xpGems.map(g => ({ id: g.id, x: Math.round(g.x), y: Math.round(g.y) }));
            window.Playroom.setState("gems", serializedGems);

            const serializedLoots = state.loots.map(l => ({ id: l.id, x: Math.round(l.x), y: Math.round(l.y), type: l.type, state: l.state, timer: Math.round(l.animationTimer) }));
            window.Playroom.setState("loots", serializedLoots);
        }

        if (state.enemies.length === 0 && !state.gate.open) {
            state.gate.open = true; window.Playroom.setState("gateOpen", true);
            showNotification("A helyiek megmenekültek! A kapu kinyílt, siessetek oda!");
        }
    } else {
        const hEnemies = window.Playroom.getState("enemies");
        if (hEnemies !== undefined && hEnemies !== null) {
            let activeEnemyIds = new Set(hEnemies.map(he => he.id)); state.enemies = state.enemies.filter(e => activeEnemyIds.has(e.id)); 
            hEnemies.forEach(he => {
                let local = state.enemies.find(e => e.id === he.id);
                if (local) { local.targetX = he.x; local.targetY = he.y; local.health = he.hp; } 
                else { let newE = new Enemy(he.x, he.y, he.type, he.maxHp, he.id); newE.targetX = he.x; newE.targetY = he.y; newE.health = he.hp; newE.isBoss = he.isBoss; state.enemies.push(newE); }
            });
        }

        const hGems = window.Playroom.getState("gems");
        if (hGems !== undefined && hGems !== null) {
            let activeGemIds = new Set(hGems.map(hg => hg.id)); state.xpGems = state.xpGems.filter(g => activeGemIds.has(g.id));
            hGems.forEach(hg => {
                let local = state.xpGems.find(g => g.id === hg.id);
                if (local) { local.x += (hg.x - local.x) * 0.2 * dtModifier; local.y += (hg.y - local.y) * 0.2 * dtModifier; } else { state.xpGems.push(new XPGem(hg.x, hg.y, hg.id)); }
            });
        }

        const hLoots = window.Playroom.getState("loots");
        if (hLoots !== undefined && hLoots !== null) {
            let activeLootIds = new Set(hLoots.map(hl => hl.id)); state.loots = state.loots.filter(l => activeLootIds.has(l.id));
            hLoots.forEach(hl => {
                let local = state.loots.find(l => l.id === hl.id);
                if (local) { local.x = hl.x; local.y = hl.y; local.state = hl.state; local.animationTimer = hl.timer; } 
                else { let newL = new LootDrop(hl.x, hl.y, hl.type, hl.id); newL.state = hl.state; newL.animationTimer = hl.timer; state.loots.push(newL); }
            });
        }

        const hGate = window.Playroom.getState("gatePos"); if (hGate) { state.gate.x = hGate.x; state.gate.y = hGate.y; }
        state.gate.open = window.Playroom.getState("gateOpen") || false;
    }

    if (state.roomConfig.sharedProgression) {
        const sharedXp = window.Playroom.getState("sharedXpEvent");
        if (sharedXp && state.lastSharedXpTs !== sharedXp.r_id) { state.lastSharedXpTs = sharedXp.r_id; state.player.addXP(sharedXp.amount); state.score += sharedXp.amount; }
        const sharedLoot = window.Playroom.getState("sharedLootEvent");
        if (sharedLoot && state.lastSharedLootTs !== sharedLoot.r_id) { state.lastSharedLootTs = sharedLoot.r_id; collectLoot(sharedLoot.type); }
    }
}