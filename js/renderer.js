import { getDiff } from './utils.js';
import { calcRealDamage } from './utils.js';

let modeMap = {};
let currentData = [];
let namesMap = {};


export async function render(data) {
  currentData = data;
  namesMap = await loadNames();

  const container = document.getElementById("table");
  container.innerHTML = "";

  const names = await loadNames();

  data.forEach(entry => {
    const row = document.createElement("div");

    const id = entry.new.id;

    row.className = "row";
    row.dataset.id = id;

    row.appendChild(createColumnInfo(entry.new, names[id] || id));
    row.appendChild(createStats(entry.old, id));
    row.appendChild(createStats(entry.new, id, entry.old));
    row.appendChild(createDiffScaled(entry.old, entry.new, id));

    container.appendChild(row);
  });
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

img.onerror = () => {
  img.src = base + ".png";
};

  const title = document.createElement("div");
  title.textContent = name;

  const btnGold = createButton("gold", data.id);
  const btnPlat = createButton("platinum", data.id);

  div.append(img, title, btnGold, btnPlat);

  const btnContainer = document.createElement("div");
btnContainer.className = "btn-container";

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

  // 🔥 marcar activo
  if (modeMap[id] === type) {
    btn.classList.add("active");
  }

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

  const oldMod = oldData ? getMultiplier(modeMap[id]) : null;

  addStat(div, "life.png", "Vida",
    data.life * mod,
    oldData ? oldData.life * mod : null
  );

  addStat(div, "speed.png", "Velocidad",
    data.speed,
    oldData?.speed
  );

  addAttack(div, "Ataque 1", data.atk1, data.unlock["1"], mod,
    oldData ? oldData.atk1.value * mod : null
  );

  addAttack(div, "Ataque 1+", data.atk1p, data.unlock["1p"], mod,
    oldData ? calcRealDamage(oldData.atk1p.value) * mod : null, true
  );

  addAttack(div, "Ataque 2", data.atk2, data.unlock["2"], mod,
    oldData ? oldData.atk2.value * mod : null
  );

  addAttack(div, "Ataque 2+", data.atk2p, data.unlock["2p"], mod,
    oldData ? calcRealDamage(oldData.atk2p.value) * mod : null, true
  );

  addAbility(div, "Habilidad", data.ability1, data.abilities.a1,
    oldData?.ability1
  );

  addAbility(div, "Habilidad+", data.ability2, data.abilities.a2,
    oldData?.ability2
  );

  return div;
}


function addStat(parent, iconName, label, value, oldValue = null) {
  const row = document.createElement("div");
  row.className = "stat-row";

  const left = document.createElement("div");
  left.className = "left";

  const right = document.createElement("div");
  right.className = "right";

  const icon = document.createElement("img");
  icon.src = `img/${iconName}`;
  icon.className = "icon";

  let displayValue;

if (label === "Velocidad") {
  let rounded = Math.round(value * 100) / 100;

  if (rounded % 1 === 0) {
    displayValue = rounded.toString();
  } else {
    displayValue = rounded.toFixed(2);
  }
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

function createAttackIcon(gen, atk) {
  const wrapper = document.createElement("div");
  wrapper.className = "icon-wrapper";

  // 🔹 base
  const base = document.createElement("img");
  base.src = gen ? `img/attack_${gen}.png` : `img/attack_neutre.png`;
  base.className = "icon-base";

  wrapper.appendChild(base);

  // 🔹 PLUS (detrás)
  if (atk.isPlus) {
    const plus = document.createElement("img");
    plus.src = "img/attack_plus.png";
    plus.className = "icon-plus";
    wrapper.appendChild(plus);
  }

  // 🔹 AOE (encima)
  if (atk.aoe) {
    const aoe = document.createElement("img");
    aoe.src = "img/attack_aoe.png";
    aoe.className = "icon-aoe";
    wrapper.appendChild(aoe);
  }

  return wrapper;
}


function addAttack(parent, label, atk, gen, mod, oldAtk = null, isPlus = false) {
  atk.isPlus = isPlus;
  const row = document.createElement("div");
  row.className = "stat-row";

  const left = document.createElement("div");
  left.className = "left";

  const right = document.createElement("div");
  right.className = "right";

  const icon = createAttackIcon(gen, atk);

  const baseValue = isPlus
  ? calcRealDamage(atk.value)
  : atk.value;

const value = baseValue * mod;

  left.append(icon, document.createTextNode(label + (atk.aoe ? " Triple" : "")));
  right.textContent = Math.floor(value);

  if (oldAtk !== null) {
    if (value > oldAtk) right.classList.add("green");
    if (value < oldAtk) right.classList.add("red");
  }

  row.append(left, right);
  parent.appendChild(row);
}

function createAbilityIcon(ability, isPlus) {
  const wrapper = document.createElement("div");
  wrapper.className = "icon-wrapper";

  const clean = ability?.replace("_plus", "");

  // base
  const base = document.createElement("img");
  base.src = clean
    ? `img/${clean}.png`
    : `img/ability_unknown.png`;

  base.className = "icon-base";
  wrapper.appendChild(base);

  // plus detrás
  if (isPlus) {
    const plus = document.createElement("img");
    plus.src = "img/ability_plus.png";
    plus.className = "icon-plus";
    wrapper.appendChild(plus);
  }

  return wrapper;
}


function addAbility(parent, label, val, ability, oldVal = null) {
  const row = document.createElement("div");
  row.className = "stat-row";

  const left = document.createElement("div");
  left.className = "left";

  const right = document.createElement("div");
  right.className = "right";

  const icon = createAbilityIcon(ability, label.includes("+"));
  let cleanAbility = ability;

if (cleanAbility?.endsWith("_plus")) {
  cleanAbility = cleanAbility.replace("_plus", "");
}

icon.src = cleanAbility
  ? `img/${cleanAbility}.png`
  : `img/ability_unknown.png`;
  icon.className = "icon";

  left.append(icon, document.createTextNode(label));
  right.textContent = val + "%";

  if (oldVal !== null) {
    let improved = val > oldVal;

    if (val < 0 && oldVal < 0) {
      improved = val < oldVal;
    }

    if (improved) right.classList.add("green");
    else if (val !== oldVal) right.classList.add("red");
  }

  row.append(left, right);
  parent.appendChild(row);
}


function addDiff(parent, oldVal, newVal, isAbility = false, isSpeed = false) {
  const row = document.createElement("div");
  row.className = "stat-row diff-row";

  const right = document.createElement("div");
  right.className = "center";

  // 🔥 calcular diferencia REAL
  let diffValue = newVal - oldVal;

  // sin cambios
  if (diffValue === 0) {
    right.textContent = "-";
    row.appendChild(right);
    parent.appendChild(row);
    return;
  }

  // 🧠 habilidades (corrección negativos)
  let isPositive = diffValue > 0;

  if (isAbility && newVal < 0 && oldVal < 0) {
    isPositive = newVal < oldVal;
  }

  // ⚡ velocidad → 2 decimales
  if (isSpeed) {
    diffValue = Math.round(diffValue * 100) / 100;

    if (diffValue % 1 !== 0) {
      diffValue = diffValue.toFixed(2);
    }
  } else {
    diffValue = Math.floor(diffValue);
  }

  // signo
  let displayValue;

// valor absoluto SIEMPRE
let absDiff = Math.abs(diffValue);

// velocidad
if (isSpeed) {
  absDiff = Math.round(absDiff * 100) / 100;

  if (absDiff % 1 !== 0) {
    absDiff = absDiff.toFixed(2);
  }
} else {
  absDiff = Math.floor(absDiff);
}

// signo correcto
let sign;

if (isAbility) {
  // 🔥 habilidades usan lógica de mejora
  sign = isPositive ? "+" : "-";
} else {
  // stats normales usan diff real
  sign = diffValue > 0 ? "+" : "-";
}

// texto final
displayValue = isAbility
  ? `${sign}${absDiff}%`
  : `${sign}${absDiff}`;

right.textContent = displayValue;

  // colores
  if (isPositive) right.classList.add("green");
  else right.classList.add("red");

  row.appendChild(right);
  parent.appendChild(row);
}


function getMultiplier(mode) {
  if (mode === "gold") return 1.75;
  if (mode === "platinum") return 2;
  return 1;
}


async function loadNames() {
  const txt = await fetch(`https://s-beta.kobojo.com/mutants/gameconfig/localisation_es.txt?t=${Date.now()}`)
  .then(r => r.text());

  const map = {};

  txt.split("\n").forEach(line => {
    const [id, name] = line.split(";");
    if (id && name) map[id] = name;
  });

  return map;
}

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

function createDiffScaled(oldD, newD, id) {
  const div = document.createElement("div");

  const mode = modeMap[id];

  const oldStats = getFinalStats(oldD, mode);
  const newStats = getFinalStats(newD, mode);

  addDiff(div, oldStats.life, newStats.life);
  addDiff(div, oldStats.speed, newStats.speed, false, true);

  addDiff(div, oldStats.atk1, newStats.atk1);
  addDiff(div, oldStats.atk1p, newStats.atk1p);
  addDiff(div, oldStats.atk2, newStats.atk2);
  addDiff(div, oldStats.atk2p, newStats.atk2p);

  addDiff(div, oldStats.ability1, newStats.ability1, true);
  addDiff(div, oldStats.ability2, newStats.ability2, true);

  return div;
}

function getFinalStats(data, mode) {
  const mod = getMultiplier(mode);

  return {
    life: Math.floor(data.life * mod),
    speed: Math.round(data.speed * 100) / 100,

    atk1: Math.floor(data.atk1.value * mod),
    atk1p: Math.floor(calcRealDamage(data.atk1p.value) * mod),
    atk2: Math.floor(data.atk2.value * mod),
    atk2p: Math.floor(calcRealDamage(data.atk2p.value) * mod),

    ability1: data.ability1,
    ability2: data.ability2
  };
}