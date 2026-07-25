import { getDiff } from './utils.js';
import { calcRealDamage } from './utils.js';

let modeMap = {};
let currentData = [];
let namesMap = {};
let calculatedMode = true;
let namesLoaded = false;
let loadingNames = false;

// --- Carga de nombres (con caché y manejo de errores) ---
async function loadNames() {
  if (namesLoaded) return namesMap;
  if (loadingNames) {
    // Esperar a que termine la carga en curso
    while (loadingNames) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    return namesMap;
  }
  loadingNames = true;
  try {
    const url = `https://s-beta.kobojo.com/mutants/gameconfig/localisation_es.txt?t=${Date.now()}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const txt = await response.text();
    const map = {};
    txt.split("\n").forEach(line => {
      const [id, name] = line.split(";");
      if (id && name) map[id] = name.trim();
    });
    namesMap = map;
    namesLoaded = true;
    console.log(`✅ Nombres cargados: ${Object.keys(map).length} entradas`);
  } catch (error) {
    console.error("❌ Error al cargar localisation_es.txt:", error);
    // Fallback: usar IDs como nombres
    namesMap = {};
    namesLoaded = true; // Marcar como cargado para no reintentar
  } finally {
    loadingNames = false;
  }
  return namesMap;
}

// --- Renderizado principal (siempre carga nombres si es necesario) ---
export async function render(data) {
  currentData = data;
  // Cargar nombres si no están disponibles
  if (!namesLoaded) {
    await loadNames();
  }

  const container = document.getElementById("table");
  container.innerHTML = "";

  // --- 1. Cabecera superior ---
  const topHeader = document.createElement("div");
  topHeader.className = "top-header";

  const counterSpan = document.createElement("div");
  counterSpan.className = "counter";
  counterSpan.innerHTML = `🧬 Mutantes actualizados: <span id="mutant-counter">${data.length}</span>`;

  const toggleBtn = document.createElement("button");
  toggleBtn.id = "toggle-calculated-btn";
  toggleBtn.textContent = "Estadísticas calculadas";
  toggleBtn.className = "toggle-btn" + (calculatedMode ? " active" : "");
  toggleBtn.onclick = toggleCalculatedMode;

  topHeader.append(counterSpan, toggleBtn);
  container.appendChild(topHeader);

  // --- 2. Cabecera de columnas ---
  const headerRow = document.createElement("div");
  headerRow.className = "header-row";

  const col1 = document.createElement("div");
  col1.textContent = "Mutante";
  const col2 = document.createElement("div");
  col2.textContent = "Antes";
  const col3 = document.createElement("div");
  col3.textContent = "Después";
  const col4 = document.createElement("div");
  col4.textContent = "Cambio";

  headerRow.append(col1, col2, col3, col4);
  container.appendChild(headerRow);

  requestAnimationFrame(() => {
    const topHeight = topHeader.offsetHeight;
    headerRow.style.top = topHeight + 'px';
  });

  // --- 3. Filas de mutantes ---
  data.forEach(entry => {
    const row = document.createElement("div");
    const id = entry.new.id;
    row.className = "row";
    row.dataset.id = id;

    row.appendChild(createColumnInfo(entry.new, namesMap[id] || id));
    row.appendChild(createStats(entry.old, id));
    row.appendChild(createStats(entry.new, id, entry.old));
    row.appendChild(createDiffScaled(entry.old, entry.new, id));

    container.appendChild(row);
  });

  // --- 4. Eventos de hover (una sola vez) ---
  setupHighlightEvents(container);
}

// --- Eventos de hover ---
function setupHighlightEvents(container) {
  container.removeEventListener('mouseenter', highlightMouseEnter);
  container.removeEventListener('mouseleave', highlightMouseLeave);
  container.addEventListener('mouseenter', highlightMouseEnter, true);
  container.addEventListener('mouseleave', highlightMouseLeave, true);
}

function highlightMouseEnter(e) {
  const row = e.target.closest('.stat-row');
  if (!row) return;
  const statType = row.dataset.statType;
  if (!statType) return;
  const mutantRow = row.closest('.row');
  if (!mutantRow) return;
  mutantRow.querySelectorAll(`.stat-row[data-stat-type="${statType}"]`)
    .forEach(el => el.classList.add('highlight'));
}

function highlightMouseLeave(e) {
  const row = e.target.closest('.stat-row');
  if (!row) return;
  const mutantRow = row.closest('.row');
  if (!mutantRow) return;
  mutantRow.querySelectorAll('.stat-row.highlight')
    .forEach(el => el.classList.remove('highlight'));
}

// --- Alternar modo calculado (rápido) ---
export function toggleCalculatedMode() {
  calculatedMode = !calculatedMode;
  const btn = document.getElementById('toggle-calculated-btn');
  if (btn) btn.classList.toggle('active');
  refreshAllRows();
}

// --- Refrescar filas (sin recargar nombres) ---
function refreshAllRows() {
  currentData.forEach(entry => {
    const id = entry.new.id;
    const row = document.querySelector(`.row[data-id="${id}"]`);
    if (!row) return;
    const newAfter = createStats(entry.new, id, entry.old);
    const newDiff = createDiffScaled(entry.old, entry.new, id);
    const children = row.children;
    if (children.length >= 4) {
      children[2].replaceWith(newAfter);
      children[3].replaceWith(newDiff);
    }
  });
}

// --- Actualizar fila por cambio de oro/platino ---
function updateRow(id) {
  const row = document.querySelector(`.row[data-id="${id}"]`);
  if (!row) return;
  const entry = currentData.find(e => e.new.id === id);
  if (!entry) return;

  const newRow = document.createElement("div");
  newRow.className = "row";
  newRow.dataset.id = id;
  newRow.appendChild(createColumnInfo(entry.new, namesMap[id] || id));
  newRow.appendChild(createStats(entry.old, id));
  newRow.appendChild(createStats(entry.new, id, entry.old));
  newRow.appendChild(createDiffScaled(entry.old, entry.new, id));

  row.replaceWith(newRow);
}

// --- Funciones auxiliares (sin cambios, solo incluyo bank) ---

function getAttackValue(atk, isPlus, mod) {
  const base = isPlus && calculatedMode ? calcRealDamage(atk.value) : atk.value;
  return Math.floor(base * mod);
}

function getMultiplier(mode) {
  if (mode === "gold") return 1.75;
  if (mode === "platinum") return 2;
  return 1;
}

function createColumnInfo(data, name) {
  const div = document.createElement("div");

  const img = document.createElement("img");
  img.width = 80;

  let base = `https://s-ak.kobojo.com/mutants/assets/thumbnails/${data.id.toLowerCase()}`;
  let url = base + ".png";
  if (modeMap[data.id] === "gold") url = base + "_gold.png";
  if (modeMap[data.id] === "platinum") url = base + "_platinum.png";
  img.src = url;
  img.onerror = () => { img.src = base + ".png"; };

  const title = document.createElement("div");
  title.textContent = name || data.id; // fallback

  const btnContainer = document.createElement("div");
  btnContainer.className = "btn-container";
  const btnGold = createButton("gold", data.id);
  const btnPlat = createButton("platinum", data.id);
  btnContainer.append(btnGold, btnPlat);

  div.append(img, title, btnContainer);
  return div;
}

function createButton(type, id) {
  const btn = document.createElement("div");
  btn.className = "btn";

  const icon = document.createElement("img");
  icon.src = type === "gold"
    ? "https://s-ak.kobojo.com/mutants/assets/mobile/thumbnails/star_gold.png"
    : "https://s-ak.kobojo.com/mutants/assets/mobile/thumbnails/star_platinum.png";
  icon.className = "btn-icon";
  btn.appendChild(icon);

  if (modeMap[id] === type) btn.classList.add("active");

  btn.onclick = () => {
    if (modeMap[id] === type) {
      delete modeMap[id];
    } else {
      modeMap[id] = type;
    }
    updateRow(id);
  };

  return btn;
}

function createStats(data, id, oldData = null) {
  const div = document.createElement("div");
  const mod = getMultiplier(modeMap[id]);

  addStat(div, "life.png", "Vida", data.life * mod, oldData ? oldData.life * mod : null, 'life');
  addStat(div, "speed.png", "Velocidad", data.speed, oldData?.speed, 'speed', true);

  addAttack(div, "Ataque 1", data.atk1, data.unlock["1"], mod,
    oldData ? getAttackValue(oldData.atk1, false, mod) : null, false, 'atk1');
  addAttack(div, "Ataque 1+", data.atk1p, data.unlock["1p"], mod,
    oldData ? getAttackValue(oldData.atk1p, true, mod) : null, true, 'atk1p');
  addAttack(div, "Ataque 2", data.atk2, data.unlock["2"], mod,
    oldData ? getAttackValue(oldData.atk2, false, mod) : null, false, 'atk2');
  addAttack(div, "Ataque 2+", data.atk2p, data.unlock["2p"], mod,
    oldData ? getAttackValue(oldData.atk2p, true, mod) : null, true, 'atk2p');

  addAbility(div, "Habilidad", data.ability1, data.abilities.a1, oldData?.ability1, 'ability1');
  addAbility(div, "Habilidad+", data.ability2, data.abilities.a2, oldData?.ability2, 'ability2');

  addStat(div, "credits.png", "Créditos", data.bank, oldData ? oldData.bank : null, 'bank');

  return div;
}

function addStat(parent, iconName, label, value, oldValue = null, statType = '', isSpeed = false) {
  const row = document.createElement("div");
  row.className = "stat-row";
  row.dataset.statType = statType;

  const left = document.createElement("div");
  left.className = "left";

  const right = document.createElement("div");
  right.className = "right";

  const icon = document.createElement("img");
  icon.src = `img/${iconName}`;
  icon.className = "icon";

  let displayValue;
  if (isSpeed) {
    let rounded = Math.round(value * 100) / 100;
    displayValue = (rounded % 1 === 0) ? rounded.toString() : rounded.toFixed(2);
  } else {
    displayValue = Math.floor(value);
  }

  left.append(icon, document.createTextNode(label));
  right.textContent = displayValue;

  if (oldValue !== null) {
    if (value > oldValue) right.classList.add("green");
    if (value < oldValue) right.classList.add("red");
  }

  row.append(left, right);
  parent.appendChild(row);
}

function addAttack(parent, label, atk, gen, mod, oldAtk = null, isPlus = false, statType = '') {
  atk.isPlus = isPlus;
  const row = document.createElement("div");
  row.className = "stat-row";
  row.dataset.statType = statType;

  const left = document.createElement("div");
  left.className = "left";
  const right = document.createElement("div");
  right.className = "right";

  const icon = createAttackIcon(gen, atk);
  const value = getAttackValue(atk, isPlus, mod);

  left.append(icon, document.createTextNode(label + (atk.aoe ? " Triple" : "")));
  right.textContent = Math.floor(value);

  if (oldAtk !== null) {
    if (value > oldAtk) right.classList.add("green");
    if (value < oldAtk) right.classList.add("red");
  }

  row.append(left, right);
  parent.appendChild(row);
}

function createAttackIcon(gen, atk) {
  const wrapper = document.createElement("div");
  wrapper.className = "icon-wrapper";

  const base = document.createElement("img");
  base.src = gen ? `img/attack_${gen}.png` : `img/attack_neutre.png`;
  base.className = "icon-base";
  wrapper.appendChild(base);

  if (atk.isPlus) {
    const plus = document.createElement("img");
    plus.src = "img/attack_plus.png";
    plus.className = "icon-plus";
    wrapper.appendChild(plus);
  }

  if (atk.aoe) {
    const aoe = document.createElement("img");
    aoe.src = "img/attack_aoe.png";
    aoe.className = "icon-aoe";
    wrapper.appendChild(aoe);
  }

  return wrapper;
}

function addAbility(parent, label, val, ability, oldVal = null, statType = '') {
  const row = document.createElement("div");
  row.className = "stat-row";
  row.dataset.statType = statType;

  const left = document.createElement("div");
  left.className = "left";
  const right = document.createElement("div");
  right.className = "right";

  const icon = createAbilityIcon(ability, label.includes("+"));
  left.append(icon, document.createTextNode(label));
  right.textContent = val + "%";

  if (oldVal !== null) {
    let improved = val > oldVal;
    if (val < 0 && oldVal < 0) improved = val < oldVal;
    if (improved) right.classList.add("green");
    else if (val !== oldVal) right.classList.add("red");
  }

  row.append(left, right);
  parent.appendChild(row);
}

function createAbilityIcon(ability, isPlus) {
  const wrapper = document.createElement("div");
  wrapper.className = "icon-wrapper";

  const clean = ability?.replace("_plus", "");
  const base = document.createElement("img");
  base.src = clean ? `img/${clean}.png` : `img/ability_unknown.png`;
  base.className = "icon-base";
  wrapper.appendChild(base);

  if (isPlus) {
    const plus = document.createElement("img");
    plus.src = "img/ability_plus.png";
    plus.className = "icon-plus";
    wrapper.appendChild(plus);
  }

  return wrapper;
}

function createDiffScaled(oldD, newD, id) {
  const div = document.createElement("div");
  const mode = modeMap[id];
  const oldStats = getFinalStats(oldD, mode);
  const newStats = getFinalStats(newD, mode);

  addDiff(div, oldStats.life, newStats.life, false, false, 'life');
  addDiff(div, oldStats.speed, newStats.speed, false, true, 'speed');
  addDiff(div, oldStats.atk1, newStats.atk1, false, false, 'atk1');
  addDiff(div, oldStats.atk1p, newStats.atk1p, false, false, 'atk1p');
  addDiff(div, oldStats.atk2, newStats.atk2, false, false, 'atk2');
  addDiff(div, oldStats.atk2p, newStats.atk2p, false, false, 'atk2p');
  addDiff(div, oldStats.ability1, newStats.ability1, true, false, 'ability1');
  addDiff(div, oldStats.ability2, newStats.ability2, true, false, 'ability2');
  addDiff(div, oldStats.bank, newStats.bank, false, false, 'bank');

  return div;
}

function getFinalStats(data, mode) {
  const mod = getMultiplier(mode);
  return {
    life: Math.floor(data.life * mod),
    speed: Math.round(data.speed * 100) / 100,
    atk1: Math.floor(data.atk1.value * mod),
    atk1p: Math.floor((calculatedMode ? calcRealDamage(data.atk1p.value) : data.atk1p.value) * mod),
    atk2: Math.floor(data.atk2.value * mod),
    atk2p: Math.floor((calculatedMode ? calcRealDamage(data.atk2p.value) : data.atk2p.value) * mod),
    ability1: data.ability1,
    ability2: data.ability2,
    bank: data.bank
  };
}

function addDiff(parent, oldVal, newVal, isAbility = false, isSpeed = false, statType = '') {
  const row = document.createElement("div");
  row.className = "stat-row diff-row";
  row.dataset.statType = statType;

  const right = document.createElement("div");
  right.className = "center";

  let diffValue = newVal - oldVal;

  if (diffValue === 0) {
    right.textContent = "-";
    row.appendChild(right);
    parent.appendChild(row);
    return;
  }

  let isPositive = diffValue > 0;
  if (isAbility && newVal < 0 && oldVal < 0) {
    isPositive = newVal < oldVal;
  }

  if (isSpeed) {
    diffValue = Math.round(diffValue * 100) / 100;
    if (diffValue % 1 !== 0) diffValue = diffValue.toFixed(2);
  } else {
    diffValue = Math.floor(diffValue);
  }

  let absDiff = Math.abs(diffValue);
  if (isSpeed) {
    absDiff = Math.round(absDiff * 100) / 100;
    if (absDiff % 1 !== 0) absDiff = absDiff.toFixed(2);
  } else {
    absDiff = Math.floor(absDiff);
  }

  let sign;
  if (isAbility) {
    sign = isPositive ? "+" : "-";
  } else {
    sign = diffValue > 0 ? "+" : "-";
  }

  const displayValue = isAbility ? `${sign}${absDiff}%` : `${sign}${absDiff}`;
  right.textContent = displayValue;

  if (isPositive) right.classList.add("green");
  else right.classList.add("red");

  row.appendChild(right);
  parent.appendChild(row);
}