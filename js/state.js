export const state = {
    player: null,
    bullets: [],
    enemies: [],
    xpGems: [],
    particles: [],
    loots: [],
    damageNumbers: [],
    
    gameActive: false,
    isPaused: false,
    score: 0,
    frameCount: 0,
    
    lastSharedXpTs: 0,
    lastSharedLootTs: 0,
    
    currentStage: 1,
    totalEnemiesInStage: 0,
    activeBoss: null,
    
    gate: { x: 0, y: 0, radius: 45, open: false },
    fovMultiplier: 1.0,
    camera: { x: 0, y: 0 },
    hudMinimapVisible: false,
    
    isMultiplayerMode: false,
    localPlayerState: null,
    remotePlayers: {},
    isHostUser: false,
    roomConfig: {
        uniqueClasses: true,
        sharedProgression: true
    },
    
    selectedCharacterType: null,
    charSelectMode: 'single'
};

export const input = {
    keys: { w: false, a: false, s: false, d: false },
    mouse: { x: 0, y: 0, down: false },
    isTouchDevice: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
    joystick: { active: false, id: null, originX: 85, originY: 0, x: 85, y: 0, dx: 0, dy: 0 },
    touchAim: { active: false, id: null, x: 0, y: 0 }
};