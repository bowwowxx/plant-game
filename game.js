import { createWorld } from './three-scene.js';

const canvas = document.querySelector('#gameCanvas');
const threeCanvas = document.querySelector('#threeCanvas');
const ctx = canvas.getContext('2d');

const W = 1600;
const H = 900;
const world = createWorld(threeCanvas, W, H);
const sceneBackdrops = [
  { name: '月夜森林', file: 'screenshots/moonlit-forest.png' },
  { name: '秋日庭園', file: 'screenshots/autumn-garden.png' },
  { name: '海岸晨曦', file: 'screenshots/coastal-sunrise.png' }
];
let lastSceneIndex = -1;
const GRID = {
  cols: 9, rows: 5,
  origin: { x: 425, y: 128 },
  colVector: { x: 105, y: 42 },
  rowVector: { x: -45, y: 78 }
};

function project(gx, gy) {
  return {
    x: GRID.origin.x + gx * GRID.colVector.x + gy * GRID.rowVector.x,
    y: GRID.origin.y + gx * GRID.colVector.y + gy * GRID.rowVector.y
  };
}

function unproject(x, y) {
  const dx = x - GRID.origin.x;
  const dy = y - GRID.origin.y;
  const det = GRID.colVector.x * GRID.rowVector.y - GRID.colVector.y * GRID.rowVector.x;
  return {
    col: (dx * GRID.rowVector.y - dy * GRID.rowVector.x) / det,
    row: (GRID.colVector.x * dy - GRID.colVector.y * dx) / det
  };
}

const plantTypes = [
  { id: 'sun', name: '日耀花', hint: '持續產出日光', icon: '☀', cost: 50, hp: 100, cooldown: 5, accent: '#ffd25d' },
  { id: 'pea', name: '種子砲草', hint: '射擊同路敵人', icon: '●', cost: 100, hp: 120, cooldown: 6, accent: '#73e485', damage: 24, rate: 1.15 },
  { id: 'wall', name: '甲殼南瓜', hint: '高耐久前排', icon: '⬢', cost: 75, hp: 650, cooldown: 10, accent: '#ff9a4d' },
  { id: 'ice', name: '霜脈蕨', hint: '攻擊並使敵人減速', icon: '✦', cost: 150, hp: 110, cooldown: 9, accent: '#82dff4', damage: 16, rate: 1.55 }
];

const waves = [
  { count: 8, interval: 2.8, hp: 110, speed: .25 },
  { count: 12, interval: 2.2, hp: 145, speed: .29 },
  { count: 17, interval: 1.75, hp: 180, speed: .33 }
];

const ui = {
  sun: document.querySelector('#sunCount'), wave: document.querySelector('#waveCount'),
  enemies: document.querySelector('#enemyCount'), lives: document.querySelector('#livesCount'),
  progress: document.querySelector('#waveProgress'), cards: document.querySelector('#plantCards'),
  toast: document.querySelector('#toast'), pause: document.querySelector('#pauseBtn'),
  sound: document.querySelector('#soundBtn'), test: document.querySelector('#testBtn'),
  introSound: document.querySelector('#introSoundBtn'),
  shovel: document.querySelector('#shovelBtn'), help: document.querySelector('#helpDialog'),
  bossBar: document.querySelector('#bossBar'), bossHealth: document.querySelector('#bossHealth'),
  sceneBackdrop: document.querySelector('#sceneBackdrop')
};

let state;
let lastTime = 0;
let audioContext = null;
let audioMaster = null;
let audioUnlockPromise = null;
let toastTimer = 0;
let musicTimer = 0;
let musicStep = 0;

function freshState() {
  return {
    running: false, paused: false, ended: false, sound: true, testMode: false,
    sun: 200, lives: 3, score: 0, selected: null, shovelMode: false,
    wave: 0, spawned: 0, spawnTimer: 1.5, waveBreak: 0, bossSpawned: false,
    plants: [], enemies: [], bullets: [], suns: [], particles: [],
    mowers: Array.from({ length: 5 }, (_, row) => ({ row, gx: -.65, active: false, used: false })),
    cardCooldowns: Object.fromEntries(plantTypes.map(p => [p.id, 0])),
    skySunTimer: 4, elapsed: 0, cursor: { col: 0, row: 2 }
  };
}

function buildCards() {
  ui.cards.innerHTML = plantTypes.map((plant, index) => `
    <button class="plant-card" type="button" data-plant="${plant.id}" style="--accent:${plant.accent}" aria-label="${index + 1}：${plant.name}，需要 ${plant.cost} 日光">
      <span class="card-key">${index + 1}</span>
      <span class="plant-icon" aria-hidden="true">${plant.icon}</span>
      <span class="plant-copy"><b>${plant.name}</b><small>${plant.hint}</small></span>
      <span class="plant-cost">✦ ${plant.cost}</span>
      <span class="cooldown"></span>
    </button>`).join('');
  ui.cards.querySelectorAll('.plant-card').forEach(button => {
    button.addEventListener('click', () => selectPlant(button.dataset.plant));
  });
}

function resetGame() {
  state = freshState();
  chooseRandomScene();
  ui.test.classList.remove('active');
  ui.test.setAttribute('aria-pressed', 'false');
  ui.shovel.classList.remove('active');
  ui.shovel.setAttribute('aria-pressed', 'false');
  lastTime = performance.now();
  updateUI();
}

function chooseRandomScene() {
  const candidates = sceneBackdrops.map((_, index) => index).filter(index => index !== lastSceneIndex);
  lastSceneIndex = candidates[Math.floor(Math.random() * candidates.length)];
  const scene = sceneBackdrops[lastSceneIndex];
  ui.sceneBackdrop.style.backgroundImage = `url('${scene.file}')`;
  ui.sceneBackdrop.dataset.scene = scene.name;
}

async function startGame() {
  if (state.ended) resetGame();
  await unlockAudio();
  state.running = true;
  state.paused = false;
  document.querySelector('#startOverlay').classList.add('hidden');
  document.querySelector('#resultOverlay').classList.add('hidden');
  canvas.focus();
  startMusic();
  sound('start');
  showToast('第一波夜行者正在靠近');
}

function selectPlant(id) {
  if (!state.running || state.paused) return;
  const type = plantTypes.find(p => p.id === id);
  if (!state.testMode && (state.cardCooldowns[id] > 0 || state.sun < type.cost)) {
    showToast(state.sun < type.cost ? '日光不足' : '植物還在休息');
    sound('deny');
    return;
  }
  state.selected = state.selected === id ? null : id;
  state.shovelMode = false;
  ui.shovel.classList.remove('active');
  ui.shovel.setAttribute('aria-pressed', 'false');
  updateCards();
}

function canvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return { x: (event.clientX - rect.left) * W / rect.width, y: (event.clientY - rect.top) * H / rect.height };
}

canvas.addEventListener('pointerdown', event => {
  if (!state.running || state.paused || state.ended) return;
  if (event.button !== 0) return;
  const point = canvasPoint(event);
  const caughtSun = state.suns.find(sun => Math.hypot(sun.x - point.x, sun.y - point.y) < 48);
  if (caughtSun) {
    state.sun += 25;
    state.score += 10;
    burst(caughtSun.x, caughtSun.y, '#ffe477', 12);
    state.suns = state.suns.filter(sun => sun !== caughtSun);
    sound('sun');
    updateUI();
    return;
  }
  const cell = world.pickCell(event.clientX, event.clientY);
  if (!cell) return;
  const { col, row } = cell;
  state.cursor = { col, row };
  if (state.shovelMode) return removePlantAt(col, row);
  placeSelected(col, row);
});

canvas.addEventListener('contextmenu', event => {
  event.preventDefault();
  if (!state.running || state.paused) return;
  const cell = world.pickCell(event.clientX, event.clientY);
  if (cell) removePlantAt(cell.col, cell.row);
});

function toggleShovel() {
  if (!state.running || state.paused) return;
  state.shovelMode = !state.shovelMode;
  state.selected = null;
  ui.shovel.classList.toggle('active', state.shovelMode);
  ui.shovel.setAttribute('aria-pressed', String(state.shovelMode));
  showToast(state.shovelMode ? '鏟子模式：可連續移除植物' : '鏟子模式已關閉');
  updateCards();
}

function removePlantAt(col, row) {
  const plant = state.plants.find(item => item.col === col && item.row === row);
  if (!plant) { showToast('這格沒有植物'); sound('deny'); return; }
  state.plants = state.plants.filter(item => item !== plant);
  const refund = state.testMode ? 0 : Math.floor(plant.cost * .25);
  state.sun += refund;
  burst(plant.x, plant.y, '#d8b078', 14);
  sound('shovel');
  showToast(refund ? `已鏟除 ${plant.name}，回收 ${refund} 日光` : `已鏟除 ${plant.name}`);
  updateUI();
}

function placeSelected(col, row) {
  if (!state.selected) return;
  if (state.plants.some(p => p.col === col && p.row === row)) {
    showToast('這格已經有守衛了');
    sound('deny');
    return;
  }
  const type = plantTypes.find(p => p.id === state.selected);
  if (!state.testMode && state.sun < type.cost) return;
  if (!state.testMode) state.sun -= type.cost;
  const point = world.screenPoint(col, .35, row);
  state.plants.push({ ...type, row, col, x: point.x, y: point.y, hp: type.hp, maxHp: type.hp, timer: type.id === 'sun' ? 5 : .6, bob: Math.random() * Math.PI * 2 });
  state.cardCooldowns[type.id] = state.testMode ? 0 : type.cooldown;
  if (!state.testMode) state.selected = null;
  burst(point.x, point.y + 25, '#9ee76b', 10);
  sound('plant');
  updateUI();
}

function collectAllSuns() {
  if (!state.running || state.paused || !state.suns.length) return;
  state.suns.forEach(sun => burst(sun.x, sun.y, '#ffe477', 6));
  state.sun += state.suns.length * 25;
  state.score += state.suns.length * 10;
  state.suns = [];
  sound('sun');
  showToast('已收集場上所有日光');
  updateUI();
}

function update(dt) {
  if (!state.running || state.paused || state.ended) return;
  state.elapsed += dt;
  for (const id in state.cardCooldowns) state.cardCooldowns[id] = Math.max(0, state.cardCooldowns[id] - dt);

  const wave = waves[state.wave];
  if (state.spawned < wave.count) {
    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0) {
      spawnEnemy();
      state.spawned++;
      state.spawnTimer = wave.interval * (.8 + Math.random() * .45);
    }
  } else if (state.enemies.length === 0) {
    state.waveBreak += dt;
    if (state.waveBreak > 2.5) {
      if (state.wave === waves.length - 1) return finish(true);
      state.wave++;
      state.spawned = 0;
      state.spawnTimer = 1.5;
      state.waveBreak = 0;
      state.sun += 75;
      showToast(`第 ${state.wave + 1} 波開始 · 獲得 75 日光`);
      sound('wave');
    }
  }

  state.skySunTimer -= dt;
  if (state.skySunTimer <= 0) {
    const target = world.screenPoint(.4 + Math.random() * 8, .5, Math.random() * 4);
    state.suns.push({ x: target.x, y: 80, targetY: target.y, life: 10, phase: Math.random() * 6 });
    state.skySunTimer = 6.5 + Math.random() * 3;
  }

  state.suns.forEach(sun => { sun.y += Math.min(90 * dt, sun.targetY - sun.y); sun.life -= dt; sun.phase += dt * 2; });
  state.suns = state.suns.filter(s => s.life > 0);

  state.plants.forEach(plant => {
    plant.timer -= dt;
    plant.bob += dt * 2;
    if (plant.id === 'sun' && plant.timer <= 0) {
      state.suns.push({ x: plant.x + 18, y: plant.y - 30, targetY: plant.y + 25, life: 11, phase: 0 });
      plant.timer = 7.5;
    }
    if ((plant.id === 'pea' || plant.id === 'ice') && plant.timer <= 0) {
      const target = state.enemies.find(enemy => enemy.row === plant.row && enemy.gx > plant.col);
      if (target) {
        state.bullets.push({ gx: plant.col + .8, row: plant.row, speed: 3.6, damage: plant.damage, ice: plant.id === 'ice' });
        plant.timer = plant.rate;
        sound('shoot');
      }
    }
  });

  state.bullets.forEach(bullet => {
    bullet.gx += bullet.speed * dt;
    const hit = state.enemies.find(enemy => enemy.row === bullet.row && Math.abs(enemy.gx - bullet.gx) < .32);
    if (hit) {
      hit.hp -= bullet.damage;
      if (bullet.ice) hit.slow = 2.6;
      bullet.hit = true;
      burst(bullet.x, bullet.y, bullet.ice ? '#b9f4ff' : '#9bea66', 5);
    }
  });
  state.bullets = state.bullets.filter(b => !b.hit && b.gx < 10);

  state.enemies.forEach(enemy => {
    enemy.slow = Math.max(0, enemy.slow - dt);
    enemy.step += dt * 5;
    const blocker = state.plants.filter(p => p.row === enemy.row && p.col < enemy.gx + .25 && enemy.gx - p.col < .68).sort((a, b) => b.col - a.col)[0];
    if (blocker) {
      enemy.attackTimer -= dt;
      if (enemy.attackTimer <= 0) {
        blocker.hp -= enemy.damage;
        enemy.attackTimer = .72;
        sound('bite');
      }
    } else {
      enemy.gx -= enemy.speed * (enemy.slow > 0 ? .46 : 1) * dt;
    }

    const mower = state.mowers[enemy.row];
    if (!mower.used && enemy.gx < .05) {
      mower.active = true;
      mower.used = true;
      sound('mower');
      showToast('自走推草機啟動！');
    }
    if (enemy.gx < -.85) {
      enemy.dead = true;
      state.lives--;
      sound('hurt');
      showToast(`庭院受損，剩下 ${state.lives} 點防線`);
      if (state.lives <= 0) finish(false);
    }
  });

  state.mowers.forEach(mower => {
    if (!mower.active) return;
    mower.gx += 5 * dt;
    state.enemies.forEach(enemy => {
      if (enemy.row === mower.row && Math.abs(enemy.gx - mower.gx) < .7) enemy.hp = 0;
    });
    if (mower.gx > 10) mower.active = false;
  });

  state.plants.filter(p => p.hp <= 0).forEach(p => burst(p.x, p.y, '#8a5634', 14));
  state.plants = state.plants.filter(p => p.hp > 0);
  state.enemies.filter(e => e.hp <= 0).forEach(e => {
    if (!e.dead) { state.score += e.boss ? 1200 : 100; burst(e.x, e.y, e.boss ? '#ffcf72' : '#a4d58b', e.boss ? 35 : 15); sound(e.boss ? 'win' : 'pop'); }
    e.dead = true;
  });
  state.enemies = state.enemies.filter(e => !e.dead);
  state.particles.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 90 * dt; p.life -= dt; });
  state.particles = state.particles.filter(p => p.life > 0);
  updateUI();
}

function spawnEnemy() {
  const wave = waves[state.wave];
  const row = Math.floor(Math.random() * GRID.rows);
  const boss = state.wave === 2 && !state.bossSpawned && state.spawned >= Math.floor(wave.count * .55);
  if (boss) {
    state.bossSpawned = true;
    showToast('警告：庭院霸主登場！');
    sound('boss');
  }
  const armored = !boss && state.wave > 0 && Math.random() < .28;
  const gx = 9.4 + Math.random() * .5;
  const point = world.screenPoint(gx, 1, row);
  const hp = boss ? 1200 : wave.hp * (armored ? 1.75 : 1);
  state.enemies.push({ row, gx, x: point.x, y: point.y, hp, maxHp: hp, speed: boss ? .18 : wave.speed * (.86 + Math.random() * .25), damage: boss ? 58 : armored ? 30 : 24, attackTimer: .3, slow: 0, step: Math.random() * 6, armored, boss });
}

function burst(x, y, color, count) {
  for (let i = 0; i < count; i++) state.particles.push({ x, y, color, vx: (Math.random() - .5) * 130, vy: -30 - Math.random() * 100, life: .45 + Math.random() * .5, size: 3 + Math.random() * 6 });
}

function finish(won) {
  if (state.ended) return;
  state.ended = true;
  state.running = false;
  const bonus = won ? state.lives * 500 + Math.round(state.sun) : 0;
  state.score += bonus;
  const best = Math.max(Number(localStorage.getItem('garden-guardians-best') || 0), state.score);
  localStorage.setItem('garden-guardians-best', best);
  document.querySelector('#resultKicker').textContent = won ? '防守完成' : '防線失守';
  document.querySelector('#resultTitle').textContent = won ? '花園安全了' : '夜行者進門了';
  document.querySelector('#resultScore').textContent = `本局 ${state.score} 分 · 最佳 ${best} 分`;
  document.querySelector('#resultOverlay').classList.remove('hidden');
  sound(won ? 'win' : 'lose');
}

function draw() {
  world.sync(state, performance.now(), hoverCell);
  ctx.clearRect(0, 0, W, H);
  state.suns.forEach(drawSun);
  state.particles.forEach(p => { ctx.globalAlpha = Math.max(0, p.life); ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; });
  if (state.paused && state.running) {
    ctx.fillStyle = 'rgba(5,18,13,.58)'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = '900 52px sans-serif'; ctx.fillText('已暫停', W / 2, H / 2);
    ctx.font = '20px sans-serif'; ctx.fillStyle = '#cfddcf'; ctx.fillText('按空白鍵或右上角按鈕繼續', W / 2, H / 2 + 42);
  }
}

let hoverCell = null;
canvas.addEventListener('pointermove', event => {
  hoverCell = world.pickCell(event.clientX, event.clientY);
});
canvas.addEventListener('pointerleave', () => hoverCell = null);

function drawGridHover() {
  if (!hoverCell || !state.selected || !state.running || state.paused) return;
  const occupied = state.plants.some(p => p.col === hoverCell.col && p.row === hoverCell.row);
  ctx.fillStyle = occupied ? 'rgba(255,90,70,.28)' : 'rgba(225,255,135,.25)';
  drawCellPath(hoverCell.col, hoverCell.row, 5);
  ctx.fill();
  ctx.strokeStyle = occupied ? '#ff806b' : '#e7ff9b';
  ctx.lineWidth = 4;
  ctx.stroke();
}

function drawCellPath(col, row, inset = 0) {
  const a = project(col, row);
  const b = project(col + 1, row);
  const c = project(col + 1, row + 1);
  const d = project(col, row + 1);
  const center = project(col + .5, row + .5);
  const pull = point => ({ x: point.x + (center.x - point.x) * inset / 55, y: point.y + (center.y - point.y) * inset / 55 });
  const points = [a, b, c, d].map(pull);
  ctx.beginPath(); ctx.moveTo(points[0].x, points[0].y);
  points.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
  ctx.closePath();
}

function drawScene() {
  ctx.fillStyle = '#061d24';
  ctx.fillRect(0, 0, W, H);

  const corners = [project(-.65, -.55), project(9.75, -.55), project(9.75, 5.55), project(-.65, 5.55)];
  ctx.fillStyle = '#063f37';
  ctx.beginPath(); ctx.moveTo(corners[0].x, corners[0].y);
  corners.slice(1).forEach(p => ctx.lineTo(p.x, p.y)); ctx.closePath(); ctx.fill();
  ctx.save(); ctx.translate(0, 22); ctx.fillStyle = '#032c2d';
  ctx.beginPath(); ctx.moveTo(corners[3].x, corners[3].y); ctx.lineTo(corners[2].x, corners[2].y);
  ctx.lineTo(corners[2].x, corners[2].y + 34); ctx.lineTo(corners[3].x, corners[3].y + 34); ctx.closePath(); ctx.fill(); ctx.restore();

  for (let row = 0; row < GRID.rows; row++) {
    for (let col = 0; col < GRID.cols; col++) {
      drawCellPath(col, row, 3);
      ctx.fillStyle = (row + col) % 2 ? '#168061' : '#1d906a';
      ctx.fill();
      ctx.strokeStyle = '#075346'; ctx.lineWidth = 3; ctx.stroke();
    }
  }

  drawLowPolyTree(150, 315, 1.35);
  drawLowPolyTree(1300, 175, .85);
  ctx.fillStyle = 'rgba(255,255,255,.035)';
  ctx.beginPath(); ctx.ellipse(800, 730, 620, 150, .38, 0, Math.PI * 2); ctx.fill();
}

function drawLowPolyTree(x, y, scale) {
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
  ctx.fillStyle = '#795139'; ctx.fillRect(-10, 22, 20, 65);
  const layers = [[0,-95,55,'#167b62'], [0,-52,70,'#12684f'], [0,-5,85,'#0d5745']];
  layers.forEach(([cx, cy, size, color]) => { ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(cx, cy - size); ctx.lineTo(cx - size, cy + size * .45); ctx.lineTo(cx + size, cy + size * .45); ctx.closePath(); ctx.fill(); });
  ctx.restore();
}

function ellipse(x, y, rx, ry, color) { ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); }

function drawPlant(p) {
  const bob = Math.sin(p.bob) * 3;
  ellipse(p.x, p.y + 39, 39, 14, 'rgba(0,0,0,.22)');
  ctx.save(); ctx.translate(p.x, p.y + bob);
  if (p.id === 'sun') {
    ctx.fillStyle = '#d9992d'; for (let i = 0; i < 10; i++) { ctx.save(); ctx.rotate(i * Math.PI / 5); ctx.beginPath(); ctx.ellipse(0, -34, 12, 23, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
    ellipse(0, -9, 31, 31, '#ffd75f'); ellipse(-10, -14, 3, 5, '#372a22'); ellipse(10, -14, 3, 5, '#372a22');
    ctx.strokeStyle = '#744a25'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, -7, 12, .2, Math.PI - .2); ctx.stroke();
    ctx.fillStyle = '#3c873f'; ctx.fillRect(-5, 20, 10, 30); ellipse(-17, 42, 22, 10, '#4fb34f'); ellipse(17, 42, 22, 10, '#4fb34f');
  } else if (p.id === 'pea' || p.id === 'ice') {
    const main = p.id === 'ice' ? '#78d8e9' : '#62bb4f', dark = p.id === 'ice' ? '#388ca7' : '#2d7537';
    ctx.fillStyle = dark; ctx.fillRect(-7, 8, 14, 42); ellipse(-18, 43, 24, 11, main); ellipse(18, 43, 24, 11, main);
    ellipse(-2, -9, 32, 30, main); ellipse(25, -17, 21, 18, main); ellipse(32, -17, 12, 10, '#173e2b');
    ellipse(-9, -15, 4, 6, '#132b21'); ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.arc(-11, -17, 1.5, 0, 7); ctx.fill();
  } else {
    ellipse(0, 7, 42, 47, '#ee8b3e');
    ctx.strokeStyle = '#a64f28'; ctx.lineWidth = 5; for (const x of [-20, 0, 20]) { ctx.beginPath(); ctx.moveTo(x, -33); ctx.quadraticCurveTo(x * .6, 8, x, 46); ctx.stroke(); }
    ellipse(-13, -2, 4, 5, '#39261e'); ellipse(13, -2, 4, 5, '#39261e'); ctx.fillStyle = '#5f311f'; ctx.fillRect(-14, 15, 28, 4);
    ctx.fillStyle = '#4c883b'; ctx.fillRect(-5, -47, 10, 14);
  }
  ctx.restore();
  if (p.hp < p.maxHp) healthBar(p.x, p.y - 69, p.hp / p.maxHp, '#79df6b');
}

function drawEnemy(e) {
  const walk = Math.sin(e.step) * 5;
  ellipse(e.x, e.y + 42, 38, 13, 'rgba(0,0,0,.25)');
  ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(Math.sin(e.step) * .025);
  ctx.strokeStyle = '#4c4238'; ctx.lineWidth = 13; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-9, 27); ctx.lineTo(-15 + walk, 50); ctx.moveTo(10, 27); ctx.lineTo(16 - walk, 50); ctx.stroke();
  ctx.fillStyle = e.slow > 0 ? '#56828b' : '#5a6359'; ctx.beginPath(); ctx.roundRect(-27, -9, 54, 52, 12); ctx.fill();
  ctx.strokeStyle = '#7f8e7f'; ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(-22, 0); ctx.lineTo(-51, 16 + walk); ctx.moveTo(22, 0); ctx.lineTo(51, 14 - walk); ctx.stroke();
  ellipse(0, -34, 29, 31, e.slow > 0 ? '#89b7b7' : '#91a17e');
  ellipse(-10, -38, 6, 8, '#f4e8aa'); ellipse(11, -38, 6, 8, '#f4e8aa'); ellipse(-9, -37, 2, 3, '#222'); ellipse(12, -37, 2, 3, '#222');
  ctx.strokeStyle = '#423a31'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-10, -20); ctx.lineTo(12, -20); ctx.stroke();
  if (e.armored) { ctx.fillStyle = '#db6c44'; ctx.beginPath(); ctx.moveTo(-29, -58); ctx.lineTo(0, -91); ctx.lineTo(29, -58); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#f2b05e'; ctx.fillRect(-31, -59, 62, 9); }
  ctx.restore();
  if (e.hp < e.maxHp) healthBar(e.x, e.y - (e.armored ? 101 : 75), e.hp / e.maxHp, '#ff8066');
}

function drawBullet(b) { ellipse(b.x, b.y, b.ice ? 10 : 9, b.ice ? 8 : 9, b.ice ? '#b8f4ff' : '#77d755'); if (b.ice) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(b.x - 14, b.y); ctx.lineTo(b.x + 14, b.y); ctx.moveTo(b.x, b.y - 14); ctx.lineTo(b.x, b.y + 14); ctx.stroke(); } }

function drawSun(s) {
  const r = 24 + Math.sin(s.phase) * 2;
  ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.phase * .25); ctx.fillStyle = 'rgba(255,216,72,.45)';
  for (let i = 0; i < 8; i++) { ctx.rotate(Math.PI / 4); ctx.fillRect(-3, -38, 6, 16); }
  ellipse(0, 0, r, r, '#ffe268'); ellipse(-7, -6, 4, 5, '#fff6b0'); ctx.restore();
}

function drawMower(m) {
  const point = project(m.gx + .5, m.row + .5);
  ctx.save(); ctx.translate(point.x, point.y + 29); ctx.rotate(.38);
  ellipse(-21, 14, 12, 12, '#25352c'); ellipse(21, 14, 12, 12, '#25352c');
  ctx.fillStyle = m.used && !m.active ? '#575e59' : '#d54e3f'; ctx.beginPath(); ctx.roundRect(-37, -12, 72, 29, 7); ctx.fill();
  ctx.strokeStyle = '#d9e0d8'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(24, -9); ctx.lineTo(45, -39); ctx.lineTo(61, -39); ctx.stroke(); ctx.restore();
}

function healthBar(x, y, ratio, color) { ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(x - 30, y, 60, 6); ctx.fillStyle = color; ctx.fillRect(x - 30, y, 60 * Math.max(0, ratio), 6); }

function updateUI() {
  ui.sun.textContent = state.testMode ? '∞' : Math.floor(state.sun);
  ui.wave.textContent = `${state.wave + 1}/3`;
  ui.enemies.textContent = state.enemies.length;
  ui.lives.textContent = state.lives;
  const wave = waves[state.wave];
  ui.progress.style.width = `${Math.min(100, ((state.spawned - state.enemies.length + state.enemies.reduce((n, e) => n + (1 - e.hp / e.maxHp), 0)) / wave.count) * 100)}%`;
  const boss = state.enemies.find(enemy => enemy.boss);
  ui.bossBar.classList.toggle('hidden', !boss);
  ui.bossHealth.style.width = boss ? `${Math.max(0, boss.hp / boss.maxHp) * 100}%` : '0%';
  updateCards();
}

function updateCards() {
  ui.cards.querySelectorAll('.plant-card').forEach(button => {
    const type = plantTypes.find(p => p.id === button.dataset.plant);
    const cooldown = state.cardCooldowns[type.id];
    button.classList.toggle('selected', state.selected === type.id);
    button.disabled = !state.running || state.paused || (!state.testMode && (state.sun < type.cost || cooldown > 0));
    button.querySelector('.cooldown').style.height = state.testMode ? '0%' : `${(cooldown / type.cooldown) * 100}%`;
  });
}

function showToast(message) {
  ui.toast.textContent = message;
  ui.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ui.toast.classList.remove('show'), 1900);
}

function ensureAudio() {
  if (audioContext) return audioContext;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  audioContext = new AudioContextClass();
  audioMaster = audioContext.createGain();
  audioMaster.gain.value = .9;
  audioMaster.connect(audioContext.destination);
  audioContext.addEventListener('statechange', updateSoundUI);
  return audioContext;
}

async function unlockAudio() {
  const context = ensureAudio();
  if (!context) return false;
  if (context.state === 'running') { updateSoundUI(); return true; }
  if (audioUnlockPromise) return audioUnlockPromise;

  // iOS Safari 需要在使用者手勢中啟動一個來源，單獨 resume() 並不總是足夠。
  const silentBuffer = context.createBuffer(1, 1, context.sampleRate);
  const silentSource = context.createBufferSource();
  silentSource.buffer = silentBuffer;
  silentSource.connect(audioMaster);
  silentSource.start(0);

  audioUnlockPromise = context.resume()
    .then(() => context.state === 'running')
    .catch(() => false)
    .finally(() => { audioUnlockPromise = null; updateSoundUI(); });
  return audioUnlockPromise;
}

function updateSoundUI() {
  const unlocked = audioContext?.state === 'running';
  ui.sound.textContent = state.sound ? '♪' : '×';
  ui.sound.setAttribute('aria-label', state.sound ? '關閉音效' : '開啟音效');
  ui.sound.setAttribute('aria-pressed', String(state.sound && unlocked));
  ui.introSound.classList.toggle('active', state.sound && unlocked);
  ui.introSound.setAttribute('aria-pressed', String(state.sound && unlocked));
  ui.introSound.textContent = state.sound && unlocked ? '♫ 首頁音樂播放中' : '♫ 點一下開啟首頁音樂';
}

function sound(kind) {
  if (!state.sound) return;
  const context = ensureAudio();
  if (!context || context.state !== 'running') return;
  const notes = { start: [392, .18], plant: [260, .08], shovel: [155, .12], sun: [740, .1], shoot: [180, .035], bite: [90, .04], pop: [120, .1], wave: [520, .2], boss: [72, .65], mower: [75, .3], hurt: [110, .25], deny: [130, .06], win: [660, .45], lose: [95, .5] };
  const [freq, duration] = notes[kind] || notes.plant;
  const osc = context.createOscillator(); const gain = context.createGain();
  osc.type = kind === 'shoot' ? 'square' : 'sine'; osc.frequency.setValueAtTime(freq, context.currentTime);
  if (kind === 'win') osc.frequency.exponentialRampToValueAtTime(990, context.currentTime + duration);
  gain.gain.setValueAtTime(.075, context.currentTime); gain.gain.exponentialRampToValueAtTime(.001, context.currentTime + duration);
  osc.connect(gain).connect(audioMaster); osc.start(); osc.stop(context.currentTime + duration);
}

function startMusic() {
  if (musicTimer) return;
  const introMelody = [262, 330, 392, 330, 294, 349, 440, 349, 262, 330, 392, 494, 440, 392, 330, 294];
  const gameMelody = [196, 247, 294, 247, 220, 262, 330, 262, 196, 247, 294, 392, 330, 294, 247, 220];
  musicTimer = window.setInterval(() => {
    const context = audioContext;
    if (!state.sound || state.paused || state.ended || !context || context.state !== 'running') return;
    const melody = state.running ? gameMelody : introMelody;
    const now = context.currentTime;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(melody[musicStep % melody.length], now);
    gain.gain.setValueAtTime(state.running ? .026 : .018, now);
    gain.gain.exponentialRampToValueAtTime(.001, now + (state.running ? .3 : .42));
    osc.connect(gain).connect(audioMaster);
    osc.start(now); osc.stop(now + (state.running ? .31 : .43));
    musicStep++;
  }, 360);
}

function togglePause() {
  if (!state.running || state.ended) return;
  state.paused = !state.paused;
  ui.pause.textContent = state.paused ? '▶' : 'Ⅱ';
  ui.pause.setAttribute('aria-label', state.paused ? '繼續' : '暫停');
  updateCards();
}

document.querySelector('#startBtn').addEventListener('click', startGame);
document.querySelector('#restartBtn').addEventListener('click', () => { resetGame(); startGame(); });
ui.pause.addEventListener('click', togglePause);
ui.shovel.addEventListener('click', toggleShovel);
ui.sound.addEventListener('click', async () => {
  const unlocked = audioContext?.state === 'running';
  if (state.sound && !unlocked) {
    await unlockAudio();
  } else {
    state.sound = !state.sound;
    if (state.sound) await unlockAudio();
  }
  updateSoundUI();
  if (state.sound) sound('sun');
});
ui.introSound.addEventListener('click', async () => {
  state.sound = true;
  await unlockAudio();
  updateSoundUI();
  sound('sun');
});
ui.test.addEventListener('click', () => {
  state.testMode = !state.testMode;
  ui.test.classList.toggle('active', state.testMode);
  ui.test.setAttribute('aria-pressed', String(state.testMode));
  Object.keys(state.cardCooldowns).forEach(id => state.cardCooldowns[id] = 0);
  showToast(state.testMode ? '測試模式：無限日光、無冷卻' : '測試模式已關閉');
  sound('sun');
  updateUI();
});
document.querySelector('#helpBtn').addEventListener('click', () => { if (state.running && !state.paused) togglePause(); ui.help.showModal(); });
document.querySelector('#closeHelpBtn').addEventListener('click', () => ui.help.close());
ui.help.addEventListener('close', () => { if (state.running && state.paused) togglePause(); });
document.addEventListener('keydown', event => {
  if (event.key >= '1' && event.key <= '4') selectPlant(plantTypes[Number(event.key) - 1].id);
  if (event.code === 'Space') { event.preventDefault(); togglePause(); }
  if (event.key.toLowerCase() === 'c') collectAllSuns();
  if (event.key.toLowerCase() === 'x') {
    if (!state.shovelMode) toggleShovel();
    if (state.shovelMode) removePlantAt(state.cursor.col, state.cursor.row);
  }
  const moves = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
  if (moves[event.key] && state.running && !state.paused) {
    event.preventDefault();
    state.cursor.col = Math.max(0, Math.min(GRID.cols - 1, state.cursor.col + moves[event.key][0]));
    state.cursor.row = Math.max(0, Math.min(GRID.rows - 1, state.cursor.row + moves[event.key][1]));
    hoverCell = { ...state.cursor };
  }
  if (event.key === 'Enter' && state.running && !state.paused) {
    if (state.shovelMode) removePlantAt(state.cursor.col, state.cursor.row);
    else placeSelected(state.cursor.col, state.cursor.row);
  }
  if (event.key === 'Escape') {
    state.selected = null; state.shovelMode = false; hoverCell = null;
    ui.shovel.classList.remove('active'); ui.shovel.setAttribute('aria-pressed', 'false');
    updateCards(); showToast('已取消目前工具');
  }
});

function frame(time) {
  const dt = Math.min(.05, (time - lastTime) / 1000 || 0);
  lastTime = time;
  update(dt);
  draw();
  requestAnimationFrame(frame);
}

buildCards();
resetGame();
startMusic();
updateSoundUI();

// 行動瀏覽器禁止未經互動播放；第一次觸碰或按鍵時立即解鎖音訊。
const unlockFromGesture = () => { if (state.sound) unlockAudio(); };
document.addEventListener('pointerdown', unlockFromGesture, { capture: true });
document.addEventListener('touchend', unlockFromGesture, { capture: true });
document.addEventListener('keydown', unlockFromGesture, { capture: true });
requestAnimationFrame(frame);
