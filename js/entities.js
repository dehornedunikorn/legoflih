import { state, input } from './state.js';
import { SPELL_DB, LOOT_TYPES } from './spells.js';
import { WORLD_WIDTH, WORLD_HEIGHT, TARGET_FPS } from './config.js';
import { triggerLevelUp, updateUI, showNotification } from './ui.js';

export function createExplosion(x, y, color, count) {
    for(let i=0; i<count; i++) state.particles.push(new Particle(x, y, color, 4));
}

export class FloatingDamage {
    constructor(x, y, text, color = '#ff0000') {
        this.x = x; this.y = y; this.text = text; this.color = color;
        this.life = 1.0; this.vy = -1.2; this.vx = (Math.random() - 0.5) * 1.5;
    }
    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.font = "bold 20px 'Georgia', serif";
        ctx.strokeStyle = '#000'; ctx.lineWidth = 3;
        ctx.strokeText(this.text, this.x, this.y);
        ctx.fillText(this.text, this.x, this.y);
        ctx.restore();
    }
    update(dtModifier) {
        this.x += this.vx * dtModifier;
        this.y += this.vy * dtModifier;
        this.life -= 0.025 * dtModifier;
    }
}

export class Bullet {
    constructor(x, y, vx, vy, damage, color) { 
        this.x = x; this.y = y; this.vx = vx; this.vy = vy; 
        this.damage = damage; this.color = color; this.radius = 5; 
    }
    draw(ctx) { 
        ctx.save();
        ctx.beginPath(); 
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2); 
        ctx.fillStyle = this.color; 
        ctx.shadowBlur = 10; 
        ctx.shadowColor = this.color; 
        ctx.fill(); 
        ctx.restore(); 
    }
    update(dtModifier) { 
        this.x += this.vx * dtModifier; 
        this.y += this.vy * dtModifier; 
    }
}

export class Player {
    constructor(x, y, customColor = null) {
        this.x = x; this.y = y; this.radius = 16;
        this.color = customColor || '#5b2c6f';
        this.baseSpeed = 2.0; this.baseHealth = 100;
        this.health = this.baseHealth; this.maxHealth = this.baseHealth;
        this.speed = this.baseSpeed; this.armor = 0; this.regen = 0; 
        this.damageMulti = 1.0; this.cooldownMulti = 1.0;
        this.thorns = 0; this.lifesteal = 0; this.lowHpRegen = 0; this.evasion = 0;
        
        this.xpBoostTimer = 0;   
        this.dmgBoostTimer = 0;
        this.divineSpeedMulti = 1.0;

        this.level = 1; this.xp = 0; this.maxXp = 20;
        this.shootCooldown = 0; this.fireRate = 15;
        this.spells = []; this.minions = [];
        this.className = "wizard";

        this.slashActive = false;
        this.slashAngle = 0;
        this.slashTimer = 0;

        this.sprites = [];
        this.spritesLoadedCount = 0;
        this.frameX = 0;
        this.isMoving = false;
    }

    loadClassSprites(type) {
        this.className = type;
        this.sprites = [];
        this.spritesLoadedCount = 0;
        
        let baseName = "wizard";
        if (type === "warrior") { this.color = "#a6acaf"; baseName = "warrior"; }
        if (type === "ranger") { this.color = "#27ae60"; baseName = "ranger"; }

        for (let i = 1; i <= 4; i++) {
            let img = new Image();
            img.crossOrigin = "Anonymous";
            img.onload = () => { this.spritesLoadedCount++; };
            img.onerror = () => {
                let temp = document.createElement('canvas'); temp.width = 32; temp.height = 32;
                let tCtx = temp.getContext('2d');
                tCtx.fillStyle = this.color; tCtx.beginPath(); tCtx.arc(16,16,10,0,Math.PI*2); tCtx.fill();
                img.src = temp.toDataURL();
            };
            img.src = `https://raw.githubusercontent.com/dehornedunikorn/legoflih/main/${baseName}${i}.png`;
            this.sprites.push(img);
        }
    }

    getActiveSpellCount() { return this.spells.filter(s => SPELL_DB[s.id].type === 'active').length; }
    getPassiveSpellCount() { return this.spells.filter(s => SPELL_DB[s.id].type === 'passive').length; }

    addXP(amount) {
        let finalAmount = this.xpBoostTimer > 0 ? amount * 2 : amount;
        this.xp += finalAmount;
        if (this.xp >= this.maxXp) {
            this.xp -= this.maxXp; this.level++; this.maxXp = Math.floor(this.maxXp * 1.5);
            triggerLevelUp();
        }
        updateUI();
    }

    recalculateStats() {
        this.speed = this.baseSpeed; this.armor = 0; this.regen = 0;
        this.damageMulti = this.dmgBoostTimer > 0 ? 2.0 : 1.0; 
        this.cooldownMulti = 1.0;
        this.thorns = 0; this.lifesteal = 0; this.lowHpRegen = 0; this.evasion = 0;

        this.spells.forEach(s => {
            const db = SPELL_DB[s.id];
            if (db.type === 'passive') {
                if(db.stat === 'speed') this.speed += this.baseSpeed * (db.value * s.level);
                if(db.stat === 'armor') this.armor += (db.value * s.level);
                if(db.stat === 'regen') this.regen += (db.value * s.level);
                if(db.stat === 'damageMulti') this.damageMulti += (db.value * s.level) * (this.dmgBoostTimer > 0 ? 2 : 1);
                if(db.stat === 'cooldownMulti') this.cooldownMulti -= (db.value * s.level);
                if(db.stat === 'thorns') this.thorns += (db.value * s.level);
                if(db.stat === 'lifesteal') this.lifesteal += (db.value * s.level);
                if(db.stat === 'low_hp_regen') this.lowHpRegen += (db.value * s.level);
            }
        });
        if (this.armor > 0.8) this.armor = 0.8;
        if (this.cooldownMulti < 0.3) this.cooldownMulti = 0.3;
        
        this.speed *= this.divineSpeedMulti; 
    }

    draw(ctx) {
        let targetX, targetY;
        if (input.isTouchDevice && input.touchAim.active) {
            targetX = input.touchAim.x * state.fovMultiplier + state.camera.x;
            targetY = input.touchAim.y * state.fovMultiplier + state.camera.y;
        } else {
            targetX = input.mouse.x * state.fovMultiplier + state.camera.x;
            targetY = input.mouse.y * state.fovMultiplier + state.camera.y;
        }
        
        const angle = Math.atan2(targetY - this.y, targetX - this.x);
        ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(angle);
        
        if (this.spritesLoadedCount === 4) {
            let maxFrames = 4;
            if (this.isMoving && state.frameCount % 10 === 0) {
                this.frameX = (this.frameX + 1) % maxFrames;
            } else if (!this.isMoving) {
                this.frameX = 0; 
            }

            if(this.divineSpeedMulti > 1.0 || this.dmgBoostTimer > 0) {
                ctx.shadowBlur = 20; ctx.shadowColor = this.dmgBoostTimer > 0 ? '#e67e22' : '#00ffff';
            }

            let currentSprite = this.sprites[this.frameX];
            let drawSizeW = this.radius * 4.5; 
            let drawSizeH = drawSizeW * (currentSprite.height / currentSprite.width);
            ctx.drawImage(currentSprite, -drawSizeW / 2, -drawSizeH / 2, drawSizeW, drawSizeH);
        } else {
            ctx.beginPath();
            ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
            ctx.fillStyle = this.color;
            ctx.fill();
            
            if (this.className === "warrior") {
                ctx.fillStyle = "#e5e7e9"; ctx.fillRect(-2, -this.radius, 4, -8);
                ctx.fillStyle = "#ff3333"; ctx.beginPath(); ctx.arc(0, -this.radius-8, 4, 0, Math.PI*2); ctx.fill();
                ctx.strokeStyle = "#ccd1d1"; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(this.radius - 2, 5); ctx.lineTo(this.radius + 18, 5); ctx.stroke();
                ctx.strokeStyle = "#f1c40f"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(this.radius - 4, 2); ctx.lineTo(this.radius - 4, 8); ctx.stroke();
            } else if (this.className === "ranger") {
                ctx.strokeStyle = "#8b5a2b"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(this.radius, 0, 16, -Math.PI*0.4, Math.PI*0.4); ctx.stroke();
                ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(this.radius - 8, -13); ctx.lineTo(this.radius - 8, 13); ctx.stroke();
            }
        }
        ctx.restore();

        if (this.slashActive) {
            ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.slashAngle);
            ctx.beginPath(); ctx.arc(0, 0, 48 * (this.slashTimer / 10), -Math.PI * 0.35, Math.PI * 0.35);
            ctx.strokeStyle = `rgba(224, 242, 241, ${1 - (this.slashTimer / 10)})`; ctx.lineWidth = 6; ctx.stroke(); ctx.restore();
        }

        const blizzard = this.spells.find(s => s.id === 'blizzard');
        if (blizzard) {
            ctx.beginPath(); ctx.arc(this.x, this.y, 100, 0, Math.PI*2);
            ctx.fillStyle = 'rgba(0, 255, 255, 0.1)'; ctx.fill();
            ctx.strokeStyle = 'rgba(0, 255, 255, 0.3)'; ctx.stroke();
        }
    }

    update(dtModifier) {
        if (this.xpBoostTimer > 0) this.xpBoostTimer -= dtModifier;
        if (this.dmgBoostTimer > 0) {
            this.dmgBoostTimer -= dtModifier;
            if (this.dmgBoostTimer <= 0) { this.dmgBoostTimer = 0; this.recalculateStats(); updateUI(); }
        }

        if (this.lowHpRegen > 0 && this.health < this.maxHealth * 0.3) {
            if (state.frameCount % 60 === 0) { this.health = Math.min(this.maxHealth, this.health + this.lowHpRegen); updateUI(); }
        }

        if (state.frameCount % 60 === 0 && this.health < this.maxHealth) {
            this.health = Math.min(this.maxHealth, this.health + this.regen); updateUI();
        }

        let dx = 0; let dy = 0;
        if (input.isTouchDevice && input.joystick.active) {
            dx = input.joystick.dx; dy = input.joystick.dy;
        } else {
            if (input.keys.w) dy -= 1; if (input.keys.s) dy += 1;
            if (input.keys.a) dx -= 1; if (input.keys.d) dx += 1;
            if (dx !== 0 && dy !== 0) { const len = Math.sqrt(dx*dx + dy*dy); dx /= len; dy /= len; }
        }
        
        this.isMoving = (dx !== 0 || dy !== 0);

        this.x = Math.max(this.radius, Math.min(WORLD_WIDTH - this.radius, this.x + dx * this.speed * dtModifier));
        this.y = Math.max(this.radius, Math.min(WORLD_HEIGHT - this.radius, this.y + dy * this.speed * dtModifier));

        if (this.shootCooldown > 0) this.shootCooldown -= dtModifier;
        
        let isShooting = input.mouse.down || (input.isTouchDevice && input.touchAim.active);
        
        if (isShooting && this.shootCooldown <= 0) {
            let targetX, targetY;
            if (input.isTouchDevice && input.touchAim.active) {
                targetX = input.touchAim.x * state.fovMultiplier + state.camera.x;
                targetY = input.touchAim.y * state.fovMultiplier + state.camera.y;
            } else {
                targetX = input.mouse.x * state.fovMultiplier + state.camera.x;
                targetY = input.mouse.y * state.fovMultiplier + state.camera.y;
            }
            
            const angle = Math.atan2(targetY - this.y, targetX - this.x);
            
            if (this.className === "warrior") {
                this.slashActive = true; this.slashAngle = angle; this.slashTimer = 0;

                state.enemies.forEach(e => {
                    let dist = Math.hypot(e.x - this.x, e.y - this.y);
                    if (dist < 55) {
                        let angleToEnemy = Math.atan2(e.y - this.y, e.x - this.x);
                        let diff = Math.abs(angle - angleToEnemy);
                        if (diff < Math.PI * 0.35) {
                            let damageDone = 40 * this.damageMulti; e.health -= damageDone;
                            e.x += Math.cos(angleToEnemy) * 25 * dtModifier; e.y += Math.sin(angleToEnemy) * 25 * dtModifier;
                            if (this.lifesteal > 0) { this.health = Math.min(this.maxHealth, this.health + (damageDone * this.lifesteal)); updateUI(); }
                            createExplosion(e.x, e.y, '#e5e7e9', 6);
                        }
                    }
                });
                this.shootCooldown = 18 * this.cooldownMulti;

            } else if (this.className === "ranger") {
                const vx = Math.cos(angle) * 11; const vy = Math.sin(angle) * 11;
                state.bullets.push(new Bullet(this.x, this.y, vx, vy, 20 * this.damageMulti, '#b3af91'));
                this.shootCooldown = 13 * this.cooldownMulti;
            } else {
                const vx = Math.cos(angle) * 10; const vy = Math.sin(angle) * 10;
                state.bullets.push(new Bullet(this.x, this.y, vx, vy, 25 * this.damageMulti, '#00ffff'));
                this.shootCooldown = this.fireRate * this.cooldownMulti;
            }
        }

        if (this.slashActive) {
            this.slashTimer += dtModifier;
            if (this.slashTimer >= 10) this.slashActive = false;
        }

        this.spells.forEach(spell => {
            const db = SPELL_DB[spell.id];
            if (db.type === 'active') {
                if (spell.currentCd > 0) { spell.currentCd -= (1.0 / TARGET_FPS) * dtModifier; return; }

                const actualDmg = (db.baseDamage + db.dmgScale * spell.level) * this.damageMulti;
                
                if (spell.id === 'fireball') {
                    let closest = null; let minDist = 300;
                    state.enemies.forEach(e => { const d = Math.hypot(e.x - this.x, e.y - this.y); if (d < minDist) { minDist = d; closest = e; } });
                    if (closest) {
                        const angle = Math.atan2(closest.y - this.y, closest.x - this.x);
                        state.bullets.push(new Bullet(this.x, this.y, Math.cos(angle)*8, Math.sin(angle)*8, actualDmg, '#ff4500'));
                        spell.currentCd = Math.max(10, (db.baseCooldown + db.cdScale * spell.level) * this.cooldownMulti);
                    }
                }
                else if (spell.id === 'lightning') {
                    if (state.enemies.length > 0) {
                        const target = state.enemies[Math.floor(Math.random() * state.enemies.length)];
                        target.health -= actualDmg; createExplosion(target.x, target.y, '#ffff00', 10);
                        spell.currentCd = Math.max(10, (db.baseCooldown + db.cdScale * spell.level) * this.cooldownMulti);
                    }
                }
                else if (spell.id === 'blizzard') {
                    state.enemies.forEach(e => {
                        if (Math.hypot(e.x - this.x, e.y - this.y) < 100) { e.health -= actualDmg; e.speed = e.baseSpeed * 0.5; if(Math.random()<0.1) createExplosion(e.x, e.y, '#aaddff', 1); }
                    });
                    spell.currentCd = 10;
                }
                else if (spell.id === 'cleave') {
                    let closest = null; let minDist = 120;
                    state.enemies.forEach(e => { const d = Math.hypot(e.x - this.x, e.y - this.y); if (d < minDist) { minDist = d; closest = e; } });
                    if (closest) {
                        let angleToEnemy = Math.atan2(closest.y - this.y, closest.x - this.x);
                        this.slashActive = true; this.slashAngle = angleToEnemy; this.slashTimer = 0;
                        closest.health -= actualDmg; createExplosion(closest.x, closest.y, '#e5e7e9', 8);
                        spell.currentCd = Math.max(10, (db.baseCooldown + db.cdScale * spell.level) * this.cooldownMulti);
                    }
                }
                else if (spell.id === 'whirlwind') {
                    state.enemies.forEach(e => { if (Math.hypot(e.x - this.x, e.y - this.y) < 70) { e.health -= actualDmg; createExplosion(e.x, e.y, '#ccd1d1', 2); } });
                    spell.currentCd = Math.max(20, (db.baseCooldown + db.cdScale * spell.level) * this.cooldownMulti);
                }
                else if (spell.id === 'skeleton' || spell.id === 'wolf' || spell.id === 'ranger_wolf') {
                    const maxCount = Math.floor(db.baseCount + db.countScale * spell.level);
                    const myMinions = this.minions.filter(m => m.type === spell.id);
                    if (myMinions.length < maxCount) {
                        const color = spell.id === 'skeleton' ? '#cccccc' : '#88aaff';
                        const mSpeed = spell.id === 'skeleton' ? 2 : 4;
                        this.minions.push(new Minion(this.x, this.y, spell.id, color, mSpeed, actualDmg));
                        spell.currentCd = Math.max(30, (db.baseCooldown + db.cdScale * spell.level) * this.cooldownMulti);
                    }
                }
                else if (spell.id === 'owl') {
                    const myOwls = this.minions.filter(m => m.type === 'owl');
                    if (myOwls.length < 1) { this.minions.push(new Minion(this.x, this.y, 'owl', '#ffffcc', 3, 0)); }
                    state.fovMultiplier = 1.0 + (spell.level * 0.1); 
                    const zoomValueEl = document.getElementById('zoomValue'); if (zoomValueEl) zoomValueEl.innerText = (state.fovMultiplier * 100) + '%';
                    spell.currentCd = 300;
                }
                else if (spell.id === 'fox') {
                    const myFoxes = this.minions.filter(m => m.type === 'fox');
                    if (myFoxes.length < 1) { this.minions.push(new Minion(this.x, this.y, 'fox', '#d35400', 5, 0)); }
                    spell.currentCd = 250;
                }
            }
        });
    }
}

export class Enemy {
    constructor(x, y, type, customMaxHp = null, customId = null) {
        this.id = customId || "enemy_" + Math.random().toString(36).substr(2, 9);
        this.x = x; this.y = y; this.type = type;
        this.targetX = x; this.targetY = y; 
        let levelScale = state.currentStage;
        this.wobbleOffset = Math.random() * Math.PI * 2;
        this.isBoss = (type === 'boss_lichald');

        if (this.isBoss) {
            this.radius = 48; this.color = '#ff3366'; this.baseSpeed = 0.8;
            this.maxHealth = customMaxHp || 500 + (levelScale * 150); this.damage = 40 + (levelScale * 5);
        } else if (type === 'slime') {
            this.radius = 12 + Math.random() * 4; this.color = '#2ecc71';
            this.baseSpeed = 0.5 + Math.random() * 0.4 + (levelScale * 0.03);
            this.maxHealth = 15 + (levelScale * 4); this.damage = 10 + (levelScale * 1.5);
        } else if (type === 'bat') {
            this.radius = 8 + Math.random() * 3; this.color = '#8e44ad';
            this.baseSpeed = 1.5 + Math.random() * 0.8 + (levelScale * 0.05);
            this.maxHealth = 8 + (levelScale * 3); this.damage = 5 + (levelScale * 1);
        } else if (type === 'wolf') {
            this.radius = 14 + Math.random() * 4; this.color = '#7f8c8d';
            this.baseSpeed = 1.0 + Math.random() * 0.5 + (levelScale * 0.05);
            this.maxHealth = 30 + (levelScale * 8); this.damage = 18 + (levelScale * 3);
        } else if (type === 'skeleton') {
            this.radius = 16 + Math.random() * 2; this.color = '#ecf0f1';
            this.baseSpeed = 0.3 + Math.random() * 0.2 + (levelScale * 0.02);
            this.maxHealth = 60 + (levelScale * 15); this.damage = 30 + (levelScale * 5);
        }
        this.speed = this.baseSpeed; this.health = this.maxHealth;
    }

    draw(ctx) {
        ctx.save(); ctx.translate(this.x, this.y); const angle = Math.atan2(state.player.y - this.y, state.player.x - this.x); ctx.rotate(angle);
        
        if (this.isBoss) {
            ctx.shadowBlur = 30; ctx.shadowColor = '#ff0055';
            ctx.beginPath(); ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
            ctx.fillStyle = '#110515'; ctx.fill();
            ctx.strokeStyle = '#ff0055'; ctx.lineWidth = 4; ctx.stroke();
            ctx.fillStyle = '#ff0000';
            ctx.beginPath(); ctx.arc(15, -12, 6, 0, Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(15, 12, 6, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = '#ffd700'; ctx.beginPath(); ctx.moveTo(-15, -this.radius); ctx.lineTo(0, -this.radius * 1.4); ctx.lineTo(15, -this.radius); ctx.lineTo(30, -this.radius * 1.5); ctx.lineTo(10, -this.radius * 0.8); ctx.closePath(); ctx.fill();
        } else if (this.type === 'slime') {
            const currentWobble = Math.sin(state.frameCount * 0.1 + this.wobbleOffset) * 2;
            ctx.beginPath(); ctx.ellipse(0, 0, this.radius + currentWobble, this.radius - currentWobble, 0, 0, Math.PI * 2);
            ctx.fillStyle = this.color; ctx.fill(); ctx.strokeStyle = '#003300'; ctx.lineWidth=2; ctx.stroke();
        } else if (this.type === 'bat') {
            ctx.beginPath(); ctx.arc(0, 0, this.radius, 0, Math.PI * 2); ctx.fillStyle = this.color; ctx.fill();
            const wingFlap = Math.sin(state.frameCount * 0.4 + this.wobbleOffset) * 8; ctx.fillStyle = '#5b2c6f';
            ctx.beginPath(); ctx.moveTo(0, -this.radius); ctx.lineTo(-12, -15 - wingFlap); ctx.lineTo(-this.radius, 0); ctx.fill();
            ctx.beginPath(); ctx.moveTo(0, this.radius); ctx.lineTo(-12, 15 + wingFlap); ctx.lineTo(-this.radius, 0); ctx.fill();
        } else if (this.type === 'wolf') {
            ctx.beginPath(); ctx.arc(0, 0, this.radius, 0, Math.PI * 2); ctx.fillStyle = this.color; ctx.fill();
            ctx.fillStyle = '#4d5656'; ctx.beginPath(); ctx.moveTo(this.radius*0.2, -this.radius*0.8); ctx.lineTo(this.radius*0.8, -this.radius*1.3); ctx.lineTo(this.radius*0.6, -this.radius*0.2); ctx.fill();
            ctx.beginPath(); ctx.moveTo(this.radius*0.2, this.radius*0.8); ctx.lineTo(this.radius*0.8, this.radius*1.3); ctx.lineTo(this.radius*0.6, this.radius*0.2); ctx.fill();
            ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(this.radius, 0, 3, 0, Math.PI * 2); ctx.fill();
        } else if (this.type === 'skeleton') {
            ctx.beginPath(); ctx.arc(0, 0, this.radius, 0, Math.PI * 2); ctx.fillStyle = this.color; ctx.fill();
            ctx.strokeStyle = '#95a5a6'; ctx.lineWidth=2; ctx.stroke(); ctx.fillStyle = '#111';
            ctx.beginPath(); ctx.arc(this.radius*0.3, -this.radius*0.35, this.radius*0.25, 0, Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.arc(this.radius*0.3, this.radius*0.35, this.radius*0.25, 0, Math.PI*2); ctx.fill();
        }
        ctx.restore();
    }

    update(dtModifier) { 
        if (state.isMultiplayerMode && !state.isHostUser) {
            this.x += (this.targetX - this.x) * 0.15 * dtModifier;
            this.y += (this.targetY - this.y) * 0.15 * dtModifier;
        } else {
            let targetX = state.player.x; let targetY = state.player.y;
            let minDist = Math.hypot(targetX - this.x, targetY - this.y);

            if (state.isMultiplayerMode) {
                for (let key in state.remotePlayers) {
                    const guest = state.remotePlayers[key].hero;
                    const dist = Math.hypot(guest.x - this.x, guest.y - this.y);
                    if (dist < minDist) { minDist = dist; targetX = guest.x; targetY = guest.y; }
                }
            }
            
            const angle = Math.atan2(targetY - this.y, targetX - this.x); 
            this.x += Math.cos(angle) * this.speed * dtModifier; 
            this.y += Math.sin(angle) * this.speed * dtModifier; 
        }
        this.speed = this.baseSpeed; 

        if (this.isBoss && state.frameCount % 120 === 0) {
            for(let a=0; a<Math.PI*2; a += Math.PI/4) {
                state.bullets.push(new Bullet(this.x, this.y, Math.cos(a)*5, Math.sin(a)*5, 15, '#ff0055'));
            }
        }
    }
}

export class XPGem {
    constructor(x, y, customId = null) { 
        this.id = customId || "gem_" + Math.random().toString(36).substr(2, 9);
        this.x = x; this.y = y; this.radius = 4; this.color = '#00ffff'; this.magnetized = false; 
        this.collectedLocally = false;
    }
    draw(ctx) { ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI*2); ctx.fillStyle = this.color; ctx.fill(); }
    update(dtModifier) {
        const dist = Math.hypot(state.player.x - this.x, state.player.y - this.y);
        if (dist < 80 || this.magnetized) { 
            this.magnetized = true;
            const angle = Math.atan2(state.player.y - this.y, state.player.x - this.x); 
            this.x += Math.cos(angle) * 7 * dtModifier; this.y += Math.sin(angle) * 7 * dtModifier; 
        }
    }
}

export class LootDrop {
    constructor(x, y, type, customId = null) {
        this.id = customId || "loot_" + Math.random().toString(36).substr(2, 9);
        this.x = x; this.y = y; this.type = type;
        this.radius = 11; this.color = LOOT_TYPES[type].color;
        this.pulse = Math.random() * Math.PI;
        
        this.state = 'idle';
        this.animationTimer = 0;
        this.maxAnimationFrames = 45; 
    }
    draw(ctx) {
        this.pulse += 0.05;
        let currentRadius = this.radius + (this.state === 'idle' ? Math.sin(this.pulse) * 1.5 : 0);
        
        ctx.save();
        ctx.shadowBlur = 15; ctx.shadowColor = this.color;
        
        if (this.state === 'idle') {
            ctx.fillStyle = '#5c4033'; ctx.fillRect(this.x - currentRadius, this.y, currentRadius * 2, currentRadius * 0.9);
            ctx.fillStyle = '#8b5a2b'; ctx.beginPath(); ctx.arc(this.x, this.y, currentRadius, Math.PI, 0); ctx.fill();
            ctx.fillRect(this.x - currentRadius, this.y - currentRadius * 0.5, currentRadius * 2, currentRadius * 0.5);
            ctx.fillStyle = '#ffd700'; ctx.fillRect(this.x - currentRadius * 0.7, this.y - currentRadius, 3, currentRadius * 1.9); ctx.fillRect(this.x + currentRadius * 0.5, this.y - currentRadius, 3, currentRadius * 1.9);
            ctx.fillStyle = '#111'; ctx.fillRect(this.x - 3, this.y - 2, 6, 8); ctx.fillStyle = '#ffd700'; ctx.fillRect(this.x - 1, this.y, 2, 3);
        } 
        else if (this.state === 'opening') {
            let t = this.animationTimer / this.maxAnimationFrames;
            
            if (state.frameCount % 4 === 0 && t < 0.8) { createExplosion(this.x, this.y - 5, this.color, 2); }

            ctx.fillStyle = '#5c4033'; ctx.fillRect(this.x - this.radius, this.y, this.radius * 2, this.radius * 0.9);
            ctx.fillStyle = '#ffd700'; ctx.fillRect(this.x - this.radius * 0.7, this.y, 3, this.radius * 0.9); ctx.fillRect(this.x + this.radius * 0.5, this.y, 3, this.radius * 0.9);

            ctx.save();
            ctx.translate(this.x - this.radius, this.y); ctx.rotate(-t * Math.PI * 0.5); 
            ctx.fillStyle = '#8b5a2b'; ctx.beginPath(); ctx.arc(this.radius, 0, this.radius, Math.PI, 0); ctx.fill();
            ctx.fillRect(0, -this.radius * 0.5, this.radius * 2, this.radius * 0.5); ctx.fillStyle = '#ffd700';
            ctx.fillRect(this.radius * 0.3, -this.radius, 3, this.radius); ctx.fillRect(this.radius * 1.5, -this.radius, 3, this.radius); ctx.restore();

            let gradient = ctx.createRadialGradient(this.x, this.y - 5, 2, this.x, this.y - 12, 30 * t);
            gradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)'); gradient.addColorStop(0.4, this.color + 'aa'); gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = gradient; ctx.beginPath(); ctx.arc(this.x, this.y - 10, 30 * t, 0, Math.PI * 2); ctx.fill();

            ctx.save();
            let floatY = this.y - 15 - (t * 50); ctx.globalAlpha = 1 - t; 
            ctx.beginPath(); ctx.arc(this.x, floatY, 15, 0, Math.PI * 2); ctx.fillStyle = 'rgba(15, 10, 30, 0.85)'; ctx.fill();
            ctx.strokeStyle = this.color; ctx.lineWidth = 2; ctx.stroke();

            ctx.fillStyle = '#ffffff'; ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            let sym = '🎁';
            if (this.type === 'potion') sym = '🧪'; if (this.type === 'magnet') sym = '🧲'; if (this.type === 'grenade') sym = '💣'; if (this.type === 'xp_boost') sym = '✨'; if (this.type === 'dmg_boost') sym = '🔥';
            ctx.fillText(sym, this.x, floatY); ctx.restore();
        }
        ctx.restore();
    }
}

export class Minion {
    constructor(x, y, type, color, speed, damage) { this.x = x; this.y = y; this.type = type; this.color = color; this.speed = speed; this.damage = damage; this.radius = 8; this.target = null; }
    draw(ctx) { 
        ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI*2); ctx.fillStyle = this.color; ctx.fill(); 
        
        if (this.type === "owl") {
            ctx.fillStyle = "#000"; ctx.beginPath(); ctx.arc(this.x-2, this.y-2, 1.5, 0, Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(this.x+2, this.y-2, 1.5, 0, Math.PI*2); ctx.fill();
        } else if (this.type === "fox") {
            ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.moveTo(this.x - 3, this.y + 1); ctx.lineTo(this.x, this.y - 4); ctx.lineTo(this.x + 3, this.y + 1); ctx.fill();
        }
    }
    update(dtModifier) {
        if (this.type === "fox") {
            let closestGem = null; let minDist = 250; 
            state.xpGems.forEach(gem => {
                let d = Math.hypot(gem.x - this.x, gem.y - this.y);
                if (d < minDist) { minDist = d; closestGem = gem; }
            });
            
            if (closestGem) {
                const angle = Math.atan2(closestGem.y - this.y, closestGem.x - this.x);
                this.x += Math.cos(angle) * this.speed * dtModifier; this.y += Math.sin(angle) * this.speed * dtModifier;
                
                if (Math.hypot(closestGem.x - this.x, closestGem.y - this.y) < this.radius + closestGem.radius) {
                    if (!closestGem.collectedLocally) {
                        closestGem.collectedLocally = true;
                        if (state.isMultiplayerMode) {
                            window.Playroom.myPlayer().setState("collectAction", { id: closestGem.id, type: "gem", r_id: Math.random() });
                            if (!state.roomConfig.sharedProgression) {
                                state.player.addXP(10); state.score += 10;
                            } else if (state.isHostUser) {
                                window.Playroom.setState("sharedXpEvent", { amount: 10, r_id: Math.random() });
                            }
                        } else {
                            state.player.addXP(10); state.score += 10;
                        }
                        if (state.isHostUser || !state.isMultiplayerMode) {
                            const idx = state.xpGems.indexOf(closestGem);
                            if(idx !== -1) state.xpGems.splice(idx, 1);
                        }
                    }
                }
            } else {
                let dToPlayer = Math.hypot(state.player.x - this.x, state.player.y - this.y);
                if (dToPlayer > 40) {
                    const angle = Math.atan2(state.player.y - this.y, state.player.x - this.x);
                    this.x += Math.cos(angle) * this.speed * dtModifier; this.y += Math.sin(angle) * this.speed * dtModifier;
                }
            }
            return;
        }

        if (this.type === "owl") {
            let angle = (state.frameCount * 0.04);
            this.x = state.player.x + Math.cos(angle) * 35;
            this.y = state.player.y + Math.sin(angle) * 35;
            return;
        }

        if (!this.target || this.target.health <= 0 || !state.enemies.includes(this.target)) {
            let minDist = Infinity; this.target = null;
            state.enemies.forEach(e => { const d = Math.hypot(e.x - this.x, e.y - this.y); if (d < minDist) { minDist = d; this.target = e; } });
        }
        if (this.target) {
            const dist = Math.hypot(this.target.x - this.x, this.target.y - this.y);
            if (dist < this.radius + this.target.radius) {
                this.target.health -= this.damage * 0.1; createExplosion(this.target.x, this.target.y, this.color, 1);
            } else {
                const angle = Math.atan2(this.target.y - this.y, this.target.x - this.x); this.x += Math.cos(angle) * this.speed * dtModifier; this.y += Math.sin(angle) * this.speed * dtModifier;
            }
        } else {
            const dToPlayer = Math.hypot(state.player.x - this.x, state.player.y - this.y);
            if (dToPlayer > 50) { const angle = Math.atan2(state.player.y - this.y, state.player.x - this.x); this.x += Math.cos(angle) * this.speed * dtModifier; this.y += Math.sin(angle) * this.speed * dtModifier; }
        }
    }
}

export class Particle {
    constructor(x, y, color, speed) {
        this.x = x; this.y = y; this.color = color; this.radius = Math.random() * 3 + 1;
        const angle = Math.random() * Math.PI * 2; const vel = Math.random() * speed;
        this.vx = Math.cos(angle) * vel; this.vy = Math.sin(angle) * vel;
        this.life = 1.0; this.decay = Math.random() * 0.05 + 0.02;
    }
    draw(ctx) { ctx.save(); ctx.globalAlpha = this.life; ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2); ctx.fillStyle = this.color; ctx.fill(); ctx.restore(); }
    update(dtModifier) { 
        this.x += this.vx * dtModifier; 
        this.y += this.vy * dtModifier; 
        this.life -= this.decay * dtModifier; 
    }
}