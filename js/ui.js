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
    const get = id => document.getElementById(id);
    let enemyCount = state.enemies.length;
    if (state.isMultiplayerMode && window.Playroom) {
        try { enemyCount = window.Playroom.getState("enemiesCount") || 0; } catch (_) { /* Lobby not initialized yet. */ }
    }
    const stats = get('statsDisplay');
    if (stats) stats.innerText = `Pálya: ${state.currentStage} | Ellenség: ${enemyCount} / ${state.totalEnemiesInStage} | XP Érték: ${state.score}`;
    if (!state.player) return;

    const health = get('healthDisplay');
    if (health) health.innerText = `Életerő: ${Math.floor(state.player.health)} / ${state.player.maxHealth}`;
    const slots = get('slotsDisplay');
    if (slots) slots.innerText = `⚔️ ${state.player.getActiveSpellCount()}/5  |  🛡️ ${state.player.getPassiveSpellCount()}/5`;
    const xpBar = get('xpBar');
    if (xpBar) xpBar.style.width = `${(state.player.xp / state.player.maxXp) * 100}%`;

    const buffTexts = [];
    if (state.player.xpBoostTimer > 0) buffTexts.push(`⚡ XP x2 (${Math.ceil(state.player.xpBoostTimer / 60)}mp)`);
    if (state.player.dmgBoostTimer > 0) buffTexts.push(`🔥 Sebzés x2 (${Math.ceil(state.player.dmgBoostTimer / 60)}mp)`);
    const buffs = get('buffsDisplay');
    if (buffs) buffs.innerText = buffTexts.join(' | ');

    if (state.activeBoss) {
        const bossBar = get('bossHpBar');
        if (bossBar) bossBar.style.width = `${Math.max(0, (state.activeBoss.health / state.activeBoss.maxHealth) * 100)}%`;
    }
}

export function collectLoot(type) {
    if (!state.player || !LOOT_TYPES[type]) return;
    const overlay = document.getElementById('divineOverlay');
    if (overlay) {
        overlay.innerText = `Megszerezted: ${LOOT_TYPES[type].name}!`;
        overlay.style.opacity = 1;
        setTimeout(() => { overlay.style.opacity = 0; }, 2500);
    }

    if (type === 'potion') {
        const herbalism = state.player.spells.find(spell => spell.id === 'herbalism');
        const bonus = herbalism ? herbalism.level * 0.1 : 0;
        state.player.health = Math.min(state.player.maxHealth, state.player.health + state.player.maxHealth * 0.25 * (1 + bonus));
        createExplosion(state.player.x, state.player.y, '#ff2a2a', 25);
    } else if (type === 'magnet') {
        state.xpGems.forEach(gem => gem.magnetized = true);
        createExplosion(state.player.x, state.player.y, '#00ffff', 30);
    } else if (type === 'grenade') {
        const canvas = document.getElementById('gameCanvas');
        const viewW = canvas.width * state.fovMultiplier;
        const viewH = canvas.height * state.fovMultiplier;
        createExplosion(state.player.x, state.player.y, '#ffffaa', 60);
        state.enemies.forEach(enemy => {
            if (enemy.x > state.camera.x && enemy.x < state.camera.x + viewW &&
                enemy.y > state.camera.y && enemy.y < state.camera.y + viewH) enemy.health = 0;
        });
    } else if (type === 'xp_boost') {
        state.player.xpBoostTimer = 60 * 60;
    } else if (type === 'dmg_boost') {
        state.player.dmgBoostTimer = 60 * 60;
        state.player.recalculateStats();
    }
    updateUI();
}

export function triggerLevelUp() {
    if (!state.player) return;
    state.isPaused = true;
    const container = document.getElementById('cardsContainer');
    if (!container) { state.pendingLevelUps = 0; state.isPaused = false; return; }
    container.innerHTML = '';
    const available = [];
    const activeCount = state.player.getActiveSpellCount();
    const passiveCount = state.player.getPassiveSpellCount();

    for (const key in SPELL_DB) {
        const dbInfo = SPELL_DB[key];
        if (dbInfo.class !== state.player.className) continue;
        const owned = state.player.spells.find(spell => spell.id === key);
        if (owned) {
            if (owned.level < 10) available.push({ id: key, isUpgrade: true, nextLevel: owned.level + 1 });
        } else {
            if (dbInfo.type === 'active' && activeCount < 5) available.push({ id: key, isUpgrade: false, nextLevel: 1 });
            if (dbInfo.type === 'passive' && passiveCount < 5) available.push({ id: key, isUpgrade: false, nextLevel: 1 });
        }
    }

    for (let i = available.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [available[i], available[j]] = [available[j], available[i]];
    }
    const choices = available.slice(0, 4);
    if (choices.length === 0) {
        state.player.health = state.player.maxHealth;
        state.pendingLevelUps = 0;
        state.isPaused = false;
        updateUI();
        return;
    }

    choices.forEach(choice => {
        const db = SPELL_DB[choice.id];
        const card = document.createElement('div');
        card.className = 'spell-card';
        card.innerHTML = `<div><div class="spell-title">${db.name}</div><div class="spell-type">${db.category} | ${choice.isUpgrade ? 'Fejlesztés' : 'Új'}</div><div class="spell-desc">${db.desc(choice.nextLevel)}</div></div><div class="spell-level">Szint: ${choice.nextLevel} / 10</div>`;
        card.onclick = () => selectSpell(choice.id);
        container.appendChild(card);
    });
    document.getElementById('levelUpScreen').style.display = 'block';
}

export function selectSpell(id) {
    if (!state.player || !SPELL_DB[id]) return;
    const existing = state.player.spells.find(spell => spell.id === id);
    if (existing) existing.level++;
    else state.player.spells.push({ id, level: 1, currentCd: 0 });
    state.player.recalculateStats();
    if (state.pendingLevelUps > 0) state.pendingLevelUps--;
    updateUI();
    document.getElementById('levelUpScreen').style.display = 'none';
    if (state.pendingLevelUps > 0) triggerLevelUp();
    else state.isPaused = false;
}

export function gameOver() {
    state.gameActive = false;
    document.getElementById('gameOverScreen').style.display = 'block';
    document.getElementById('finalStats').innerText = `Elért Szint: ${state.player.level} | Összes felvett XP: ${state.score}`;
    const legendBtn = document.getElementById('legendBtn');
    if (legendBtn) { legendBtn.disabled = false; legendBtn.innerText = "✨ Írd meg a legendámat"; }
    const legendText = document.getElementById('legendText');
    if (legendText) legendText.innerText = "";
}
export function resetGame() {
    state.currentStage = 1;
    state.player = null;
    state.score = 0;
    state.pendingLevelUps = 0;
    state.isPaused = false;
    document.getElementById('gameOverScreen').style.display = 'none';
    document.getElementById('ui').style.display = 'block';
    document.getElementById('xpBarContainer').style.display = 'block';
    if (state.isMultiplayerMode) initMultiplayerStage(state.currentStage);
    else initStage(state.currentStage);
}

export async function generateLegend() {
    const btn = document.getElementById('legendBtn');
    const textDiv = document.getElementById('legendText');
    if (!btn || !textDiv || !state.player) return;
    btn.disabled = true;
    btn.innerText = "✨ A krónikások dolgoznak...";
    textDiv.innerText = "";
    const spellNames = state.player.spells.map(s => SPELL_DB[s.id]?.name || s.id).join(", ") || "csak puszta akaratereje";
    const className = state.player.className === 'warrior' ? 'Lovag' : (state.player.className === 'ranger' ? 'Vándor' : 'Mágus');
    const prompt = `Írj maximum 3 mondatos, drámai fantasy lezárást egy hősről. Osztály: ${className}; szint: ${state.player.level}; XP: ${state.score}; képességek: ${spellNames}. Magyarul.`;

    // No API key is committed to the public client repository. Provide a local
    // ending instead of making a guaranteed failing request when no key exists.
    if (!apiKey) {
        textDiv.textContent = `"${className} ${state.player.level}. szintig jutott, és ${state.score} tapasztalatot gyűjtött. ${spellNames} erejével még a legsötétebb hordával is szembeszállt; neve legendává vált."`;
        btn.innerText = "✨ A Legenda Megíratott";
        return;
    }

    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        if (!response.ok) throw new Error(`Legend API returned HTTP ${response.status}`);
        const data = await response.json();
        const legend = data?.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('').trim();
        if (!legend) throw new Error("Empty legend response");
        textDiv.textContent = `"${legend}"`;
        btn.innerText = "✨ A Legenda Megíratott";
    } catch (error) {
        console.error("Legend generation failed:", error);
        textDiv.innerText = "A krónikások ma nem érnek rá. Próbáld újra később.";
        btn.disabled = false;
        btn.innerText = "✨ Próbáld újra";
    }
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