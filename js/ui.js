import { state } from './state.js';
import { SPELL_DB, LOOT_TYPES } from './spells.js';
import { drawMinimap } from './world.js';
import { createExplosion } from './entities.js';
import { apiKey } from './config.js';
import { initStage, initMultiplayerStage } from './main.js';

export function showNotification(msg) {
    const bar = document.getElementById('notificationBar');
    bar.innerText = msg; bar.style.display = 'block'; setTimeout(() => { bar.style.display = 'none'; }, 3500);
}

export function updateUI() {
    let enemyCount = state.isMultiplayerMode ? window.Playroom.getState("enemiesCount") || 0 : state.enemies.length;
    document.getElementById('statsDisplay').innerText = `Pálya: ${state.currentStage} | Ellenség: ${enemyCount} / ${state.totalEnemiesInStage} | XP Érték: ${state.score}`;
    document.getElementById('healthDisplay').innerText = `Életerő: ${Math.floor(state.player.health)} / ${state.player.maxHealth}`;
    document.getElementById('slotsDisplay').innerText = `⚔️ ${state.player.getActiveSpellCount()}/5  |  🛡️ ${state.player.getPassiveSpellCount()}/5`;
    document.getElementById('xpBar').style.width = `${(state.player.xp / state.player.maxXp) * 100}%`;
    
    let buffTexts = [];
    if (state.player.xpBoostTimer > 0) buffTexts.push(`⚡ XP x2 (${Math.ceil(state.player.xpBoostTimer / 60)}mp)`);
    if (state.player.dmgBoostTimer > 0) buffTexts.push(`🔥 Sebzés x2 (${Math.ceil(state.player.dmgBoostTimer / 60)}mp)`);
    document.getElementById('buffsDisplay').innerText = buffTexts.join(' | ');

    if (state.activeBoss) {
        let bossHpPercent = Math.max(0, (state.activeBoss.health / state.activeBoss.maxHealth) * 100);
        document.getElementById('bossHpBar').style.width = `${bossHpPercent}%`;
    }
}

export function collectLoot(type) {
    const overlay = document.getElementById('divineOverlay'); overlay.innerText = `Megszerezted: ${LOOT_TYPES[type].name}!`; overlay.style.opacity = 1;
    setTimeout(() => { overlay.style.opacity = 0; }, 2500);

    if (type === 'potion') { state.player.health = Math.min(state.player.maxHealth, state.player.health + (state.player.maxHealth * 0.25)); createExplosion(state.player.x, state.player.y, '#ff2a2a', 25); } 
    else if (type === 'magnet') { state.xpGems.forEach(gem => gem.magnetized = true); createExplosion(state.player.x, state.player.y, '#00ffff', 30); } 
    else if (type === 'grenade') { 
        const canvas = document.getElementById('gameCanvas');
        let viewW = canvas.width * state.fovMultiplier; let viewH = canvas.height * state.fovMultiplier; 
        createExplosion(state.player.x, state.player.y, '#ffffaa', 60); 
        state.enemies.forEach(e => { if (e.x > state.camera.x && e.x < state.camera.x + viewW && e.y > state.camera.y && e.y < state.camera.y + viewH) { e.health = 0; } }); 
    } 
    else if (type === 'xp_boost') { state.player.xpBoostTimer = 60 * 60; } 
    else if (type === 'dmg_boost') { state.player.dmgBoostTimer = 60 * 60; state.player.recalculateStats(); }
    updateUI();
}

export function triggerLevelUp() {
    state.isPaused = true; const container = document.getElementById('cardsContainer'); container.innerHTML = '';
    let available = []; const activeCount = state.player.getActiveSpellCount(); const passiveCount = state.player.getPassiveSpellCount();

    for (let key in SPELL_DB) {
        const dbInfo = SPELL_DB[key]; if (dbInfo.class !== state.player.className) continue;
        const owned = state.player.spells.find(s => s.id === key);
        if (owned) { if (owned.level < 10) available.push({ id: key, isUpgrade: true, nextLevel: owned.level + 1 }); } 
        else { if (dbInfo.type === 'active' && activeCount < 5) available.push({ id: key, isUpgrade: false, nextLevel: 1 }); if (dbInfo.type === 'passive' && passiveCount < 5) available.push({ id: key, isUpgrade: false, nextLevel: 1 }); }
    }

    for (let i = available.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [available[i], available[j]] = [available[j], available[i]]; }
    const choices = available.slice(0, 4);
    if (choices.length === 0) { state.player.health = state.player.maxHealth; state.isPaused = false; return; }

    choices.forEach(choice => {
        const db = SPELL_DB[choice.id]; const card = document.createElement('div'); card.className = 'spell-card';
        card.innerHTML = `<div><div class="spell-title">${db.name}</div><div class="spell-type">${db.category} | ${choice.isUpgrade ? 'Fejlesztés' : 'Új'}</div><div class="spell-desc">${db.desc(choice.nextLevel)}</div></div><div class="spell-level">Szint: ${choice.nextLevel} / 10</div>`;
        card.onclick = () => { selectSpell(choice.id); }; container.appendChild(card);
    });
    document.getElementById('levelUpScreen').style.display = 'block';
}

export function selectSpell(id) {
    const existing = state.player.spells.find(s => s.id === id);
    if (existing) existing.level++; else state.player.spells.push({ id: id, level: 1, currentCd: 0 });
    state.player.recalculateStats(); updateUI(); document.getElementById('levelUpScreen').style.display = 'none'; state.isPaused = false;
}

export function gameOver() { state.gameActive = false; document.getElementById('gameOverScreen').style.display = 'block'; document.getElementById('finalStats').innerText = `Elért Szint: ${state.player.level} | Összes felvett XP: ${state.score}`; }
export function resetGame() { state.currentStage = 1; state.player = null; initStage(state.currentStage); }

export async function generateLegend() {
    const btn = document.getElementById('legendBtn'); const textDiv = document.getElementById('legendText'); btn.disabled = true; btn.innerText = "✨ Krónikások körmölnek..."; textDiv.innerText = "";
    const spellNames = state.player.spells.map(s => SPELL_DB[s.id].name).join(", ") || "csak puszta akaratereje";
    
    const prompt = `Írj egy nagyon rövid (maximum 3 mondatos), drámai, epikus fantasy lezárást egy hőstől, aki épp most halt hősi halált egy végtelen szörnyhorda ellen egy Crimsonland nevű vidéken. A hős legendájának adatai: Osztály: ${state.player.className === 'warrior' ? 'Lovag' : (state.player.className === 'ranger' ? 'Vándor' : 'Mágus')}, Elért szint: ${state.player.level}, XP: ${state.score}, Használt varázslatok: ${spellNames}. Magyar nyelven.`;
    try { 
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;
        const payload = { contents: [{ parts: [{ text: prompt }] }] };
        const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const data = await response.json();
        const legend = data.candidates[0].content.parts[0].text;
        textDiv.innerHTML = `"${legend}"`; btn.innerText = "✨ A Legenda Megíratott"; 
    } 
    catch (error) { console.error(error); textDiv.innerText = "A krónikások tolla eltört..."; btn.disabled = false; btn.innerText = "✨ Próbáld újra"; }
}

export function togglePauseMenu() {
    if (!state.gameActive) return; state.isPaused = !state.isPaused; const menu = document.getElementById('pauseMenu');
    if (state.isPaused) { menu.style.display = 'block'; drawMinimap('minimapCanvas'); } else { menu.style.display = 'none'; }
}

export function toggleMiniMapHUD() {
    state.hudMinimapVisible = !state.hudMinimapVisible; const container = document.getElementById('hudMinimapContainer');
    if (container) container.style.display = state.hudMinimapVisible ? 'block' : 'none';
}

export function updateZoom(val) { const zoomValueEl = document.getElementById('zoomValue'); if (zoomValueEl) zoomValueEl.innerText = val + '%'; state.fovMultiplier = val / 100; }

export function adjustFov(amount) {
    let currentPercent = state.fovMultiplier * 100; currentPercent = Math.max(100, Math.min(200, currentPercent + (amount * 100)));
    updateZoom(currentPercent); const slider = document.getElementById('zoomSlider'); if (slider) slider.value = currentPercent;
}

export function showJoinMenu() { document.getElementById('mainMenu').style.display = 'none'; document.getElementById('joinMenuScreen').style.display = 'block'; document.getElementById('roomCodeInput').value = ''; document.getElementById('roomCodeInput').focus(); }
export function closeJoinMenu() { document.getElementById('joinMenuScreen').style.display = 'none'; document.getElementById('mainMenu').style.display = 'block'; }
export function alertComingSoon() { showNotification("Ez a funkció jelenleg még fejlesztés alatt áll!"); }
export function backToMainMenu() { document.getElementById('charSelectScreen').style.display = 'none'; document.getElementById('mainMenu').style.display = 'block'; }

export function openCharacterSelect(mode) {
    state.charSelectMode = mode;
    document.getElementById('mainMenu').style.display = 'none'; document.getElementById('charSelectScreen').style.display = 'block';
    state.selectedCharacterType = null;
    const startBtn = document.getElementById('charStartBtn'); startBtn.disabled = true; startBtn.style.boxShadow = 'none'; startBtn.style.border = '';
    document.getElementById('char-wizard').classList.remove('selected'); document.getElementById('char-warrior').classList.remove('selected'); document.getElementById('char-ranger').classList.remove('selected');
    document.getElementById('charSelectWarning').innerText = "";
}

export function selectCharacter(type) {
    if (state.isMultiplayerMode && state.roomConfig.uniqueClasses) {
        let taken = false;
        for (let key in state.remotePlayers) { if (state.remotePlayers[key].state.getState("class") === type) taken = true; }
        if (taken) { document.getElementById('charSelectWarning').innerText = "Ez a hősosztály már foglalt a szobában! Válassz másikat."; return; }
    }
    state.selectedCharacterType = type; document.getElementById('charSelectWarning').innerText = "";
    document.getElementById('char-wizard').classList.remove('selected'); document.getElementById('char-warrior').classList.remove('selected'); document.getElementById('char-ranger').classList.remove('selected');
    document.getElementById(`char-${type}`).classList.add('selected');
    const startBtn = document.getElementById('charStartBtn'); startBtn.disabled = false; startBtn.style.border = '2px solid #ffd700'; startBtn.style.boxShadow = '0 0 25px rgba(255, 215, 0, 0.6)';
}

export function checkAllReadyAndLaunch() {
    let allReady = true;
    if (state.localPlayerState && !state.localPlayerState.getState("gameReady")) allReady = false;
    for (let key in state.remotePlayers) { if (!state.remotePlayers[key].state.getState("gameReady")) allReady = false; }
    if (allReady) {
        document.getElementById('charSelectScreen').style.display = 'none'; document.getElementById('ui').style.display = 'block'; document.getElementById('xpBarContainer').style.display = 'block';
        initMultiplayerStage(1);
    }
}