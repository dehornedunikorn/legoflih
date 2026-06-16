export const SPELL_DB = {
    // --- VARÁZSLÓ (WIZARD) KÉPESSÉGEK ---
    fireball: { id: 'fireball', name: 'Tűzgolyó', category: 'Támadó', type: 'active', desc: (lvl) => `Automatikusan lő a legközelebbi ellenfélre. Sebzés: ${20 + lvl*10}`, baseDamage: 20, dmgScale: 10, baseCooldown: 90, cdScale: -5, class: 'wizard' },
    lightning: { id: 'lightning', name: 'Villámcsapás', category: 'Támadó', type: 'active', desc: (lvl) => `Véletlenszerű villámok az égből. Sebzés: ${40 + lvl*15}`, baseDamage: 40, dmgScale: 15, baseCooldown: 120, cdScale: -8, class: 'wizard' },
    blizzard: { id: 'blizzard', name: 'Jégvihar', category: 'Támadó', type: 'active', desc: (lvl) => `Fagyos aura körülötted, ami folyamatosan sebez. Sebzés: ${2 + lvl}`, baseDamage: 2, dmgScale: 1, baseCooldown: 10, cdScale: 0, class: 'wizard' },
    skeleton: { id: 'skeleton', name: 'Csontváz Harcos', category: 'Idéző', type: 'active', desc: (lvl) => `Megidéz egy harcoló csontvázat. Max szám: ${Math.floor(1 + lvl/2)}`, baseCount: 1, countScale: 0.5, baseDamage: 15, dmgScale: 5, baseCooldown: 300, cdScale: -15, class: 'wizard' },
    wolf: { id: 'wolf', name: 'Szellemfarkas', category: 'Idéző', type: 'active', desc: (lvl) => `Gyors, harapós farkasok idézése. Sebzés: ${10 + lvl*8}`, baseCount: 1, countScale: 0.3, baseDamage: 10, dmgScale: 8, baseCooldown: 200, cdScale: -10, class: 'wizard' },
    stoneskin: { id: 'stoneskin', name: 'Kőbőr', category: 'Védekező', type: 'passive', desc: (lvl) => `Csökkenti a bekapott sebzést ${lvl * 5}%-kal.`, stat: 'armor', value: 0.05, class: 'wizard' },
    waterbubble: { id: 'waterbubble', name: 'Vízburok', category: 'Védekező', type: 'passive', desc: (lvl) => `Másodpercenként gyógyít ${lvl} Életerőt.`, stat: 'regen', value: 1, class: 'wizard' },
    haste: { id: 'haste', name: 'Szélsebesség', category: 'Support', type: 'passive', desc: (lvl) => `Megnöveli a mozgási sebességet ${lvl * 8}%-kal.`, stat: 'speed', value: 0.08, class: 'wizard' },
    hawkeye: { id: 'hawkeye', name: 'Sólyomszem', category: 'Support', type: 'passive', desc: (lvl) => `Minden sebzésed megnő ${lvl * 10}%-kal.`, stat: 'damageMulti', value: 0.1, class: 'wizard' },
    manaspring: { id: 'manaspring', name: 'Mana Forrás', category: 'Support', type: 'passive', desc: (lvl) => `A varázslatok újratöltése ${lvl * 5}%-kal gyorsabb.`, stat: 'cooldownMulti', value: 0.05, class: 'wizard' },

    // --- HARCOS (WARRIOR) KÉPESSÉGEK ---
    cleave: { id: 'cleave', name: 'Hasítás', category: 'Támadó', type: 'active', desc: (lvl) => `Széles kardcsapás a legközelebbi ellenfél felé. Sebzés: ${35 + lvl*12}`, baseDamage: 35, dmgScale: 12, baseCooldown: 70, cdScale: -4, class: 'warrior' },
    whirlwind: { id: 'whirlwind', name: 'Forgószél', category: 'Támadó', type: 'active', desc: (lvl) => `Folyamatos pörgő csapások 360 fokban. Körkörös Sebzés: ${15 + lvl*5}`, baseDamage: 15, dmgScale: 5, baseCooldown: 180, cdScale: -10, class: 'warrior' },
    shield_charge: { id: 'shield_charge', name: 'Roham', category: 'Támadó', type: 'active', desc: (lvl) => `Előrerohan és elgázol mindenkit. Sebzés: ${25 + lvl*10}, kábítással!`, baseDamage: 25, dmgScale: 10, baseCooldown: 200, cdScale: -12, class: 'warrior' },
    ground_slam: { id: 'ground_slam', name: 'Földrengés', category: 'Támadó', type: 'active', desc: (lvl) => `Földre mért csapás, ami sebez és lelassít. Sebzés: ${20 + lvl*8}`, baseDamage: 20, dmgScale: 8, baseCooldown: 150, cdScale: -8, class: 'warrior' },
    thorns: { id: 'thorns', name: 'Tüskepáncél', category: 'Védekező', type: 'passive', desc: (lvl) => `Visszaveri a bekapott sebzések ${lvl * 10}%-át a támadóra.`, stat: 'thorns', value: 0.1, class: 'warrior' },
    heavy_plate: { id: 'heavy_plate', name: 'Nehéz Páncélzat', category: 'Védekező', type: 'passive', desc: (lvl) => `Flat ${lvl * 8} sebzéscsökkentés és hátralökés-mentesség.`, stat: 'armor', value: 0.08, class: 'warrior' },
    bloodlust: { id: 'bloodlust', name: 'Vérszomj', category: 'Support', type: 'passive', desc: (lvl) => `Minden kardcsapásod gyógyít ${lvl * 2}% életelszívással (Lifesteal).`, stat: 'lifesteal', value: 0.02, class: 'warrior' },
    second_wind: { id: 'second_wind', name: 'Második Szél', category: 'Support', type: 'passive', desc: (lvl) => `30% HP alatt másodpercenként gyógyít ${lvl * 3} HP-t.`, stat: 'low_hp_regen', value: 3, class: 'warrior' },

    // --- VÁNDOR (RANGER) KÉPESSÉGEK ---
    owl: { id: 'owl', name: 'Szellemi Bagoly', category: 'Idéző', type: 'active', desc: (lvl) => `Megidéz egy repülő baglyot, ami ${lvl * 15}%-kal növeli a látótávolságodat (Zoom).`, baseCount: 1, countScale: 0, baseCooldown: 300, cdScale: 0, class: 'ranger' },
    fox: { id: 'fox', name: 'Gyűjtögető Róka', category: 'Idéző', type: 'active', desc: (lvl) => `Megidéz egy gyors rókát, ami ${lvl * 50} pixel távolságból automatikusan felveszi az XP-t és a ládákat.`, baseCount: 1, countScale: 0, baseCooldown: 250, cdScale: -10, class: 'ranger' },
    ranger_wolf: { id: 'ranger_wolf', name: 'Vadon Farkasa', category: 'Idéző', type: 'active', desc: (lvl) => `Támadó farkas társa. Harapás sebzés: ${15 + lvl*7}`, baseCount: 1, countScale: 0.2, baseDamage: 15, dmgScale: 7, baseCooldown: 240, cdScale: -10, class: 'ranger' },
    herbalism: { id: 'herbalism', name: 'Gyógyfüvek', category: 'Support', type: 'passive', desc: (lvl) => `Passzív életerő regeneráció: ${lvl} HP/mp, és a HP bájitalok ${lvl * 10}%-kal jobban gyógyítanak.`, stat: 'regen', value: 1, class: 'ranger' },
    forest_swiftness: { id: 'forest_swiftness', name: 'Erdőjáró', category: 'Support', type: 'passive', desc: (lvl) => `Növeli a sebességedet ${lvl * 6}%-kal és a kitérést ${lvl * 3}%-kal.`, stat: 'speed', value: 0.06, class: 'ranger' }
};

export const LOOT_TYPES = {
    potion: { name: 'Kispotion', color: '#ff2a2a' },
    magnet: { name: 'XP Mágnes', color: '#00ffff' },
    grenade: { name: 'Szent Kézigránát', color: '#f1c40f' },
    xp_boost: { name: 'XP Duplázó', color: '#3498db' },
    dmg_boost: { name: 'Sebzés Duplázó', color: '#e67e22' }
};