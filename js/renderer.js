import { calcRealDamage } from './utils.js?v=2';

let modeMap = {};
let currentData = [];
let currentUpdatedCount = 0;
let namesMap = {};
let calculatedMode = false;
let namesLoaded = false;
let gachaLoaded = false;
let langMap = {};
let currentLang = 'es';
let langLoaded = false;
let topHeaderEl = null;
let headerRowEl = null;
let langCache = {};
let namesCache = {};
let currentMode = 'rebalance';
let onModeChange = null;

const STAT_ORDER = ['life', 'speed', 'atk1', 'atk1p', 'atk2', 'atk2p', 'ability1', 'ability2', 'bank'];

export function setModeChangeHandler(handler) {
  onModeChange = handler;
}

function getCounterLabel() {
  if (currentMode === 'new') return langMap.updated_new || '';
  if (currentMode === 'all') return langMap.updated_all || '';
  return langMap.updated || '';
}

function updateTitle(count) {
  const titleElement = document.getElementById("title");
  if (!titleElement) return;
  const template = currentMode === 'all'
    ? (langMap.show_all_indicator || '')
    : (langMap.title || '');
  titleElement.textContent = template.replace('{count}', count);
}

function getModeButtonText() {
  if (currentMode === 'rebalance') return langMap.mode_rebalance || '';
  if (currentMode === 'new') return langMap.mode_new || '';
  return langMap.mode_all || '';
}

export async function preloadLangFiles() {
  const files = ['es', 'en'];
  for (const lang of files) {
    if (!langCache[lang]) {
      const map = await loadLangFile(lang);
      if (map) langCache[lang] = map;
    }
  }
  if (langCache['es']) {
    langMap = langCache['es'];
    langLoaded = true;
    currentLang = 'es';
  }
}

export async function preloadNames() {
  const langs = ['es', 'en'];
  for (const lang of langs) {
    if (!namesCache[lang]) {
      try {
        const url = `https://s-beta.kobojo.com/mutants/gameconfig/localisation_${lang}.txt?t=${Date.now()}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const txt = await response.text();
        const map = {};
        txt.split("\n").forEach(line => {
          const [id, name] = line.split(";");
          if (id && name) map[id] = name.trim();
        });
        namesCache[lang] = map;
      } catch (error) {
        namesCache[lang] = {};
      }
    }
  }
  namesMap = namesCache['es'] || {};
  namesLoaded = true;
}

async function loadLangFile(lang) {
  try {
    const url = `./lang/${lang}.txt?t=${Date.now()}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const txt = await response.text();
    const map = {};
    txt.split("\n").forEach(line => {
      const [key, ...valueParts] = line.split("=");
      if (key && valueParts.length > 0) {
        map[key.trim()] = valueParts.join("=").trim();
      }
    });
    return map;
  } catch (error) {
    return null;
  }
}

export async function render(entries, updatedCount, mode = 'rebalance') {
  currentMode = mode;
  currentData = entries;
  currentUpdatedCount = updatedCount || 0;
  const container = document.getElementById("table");
  if (!container) return;

  container.className = `mode-${currentMode}`;

  if (!langLoaded) {
    if (langCache['es']) {
      langMap = langCache['es'];
      langLoaded = true;
      currentLang = 'es';
    } else {
      const map = await loadLangFile('es');
      if (map) {
        langCache['es'] = map;
        langMap = map;
        langLoaded = true;
        currentLang = 'es';
      }
    }
  }

  updateTitle(entries.length);

  if (!container.querySelector('.top-header')) {
    container.appendChild(createTopHeader('0'));
    topHeaderEl = container.querySelector('.top-header');
  } else {
    topHeaderEl = container.querySelector('.top-header');
    updateTopHeaderTexts();
  }

  const oldHeader = container.querySelector('.header-row');
  if (oldHeader) oldHeader.remove();
  container.appendChild(createHeaderRow());
  headerRowEl = container.querySelector('.header-row');
  requestAnimationFrame(() => {
    const topHeader = container.querySelector('.top-header');
    const headerRow = container.querySelector('.header-row');
    if (topHeader && headerRow) {
      headerRow.style.top = topHeader.offsetHeight + 'px';
    }
  });

  if (!gachaLoaded) {
    await loadGachas();
  }

  const counterDiv = container.querySelector('.counter');
  if (counterDiv) {
    counterDiv.innerHTML = `${getCounterLabel()} <span id="mutant-counter">${currentUpdatedCount}</span>`;
  }

  container.querySelectorAll('.row').forEach(el => el.remove());

  entries.forEach(entry => {
    const row = document.createElement("div");
    const id = entry.id;
    row.className = "row";
    row.dataset.id = id;

    row.appendChild(createColumnInfo(entry.new, namesMap[id] || id));

    if (currentMode === 'rebalance') {
      row.appendChild(createStats(entry.old, id));
      row.appendChild(createStats(entry.new, id, entry.old));
      row.appendChild(createDiffScaled(entry.old, entry.new, id));
      row.appendChild(createAlertsColumn(entry.old, entry.announced, entry.new, id));
    } else {
      const statsDiv = createStats(entry.new, id);
      statsDiv.classList.add('col-wide');
      row.appendChild(statsDiv);
    }

    container.appendChild(row);
  });

  setupHighlightEvents(container);
}

function updateTopHeaderTexts() {
  if (!topHeaderEl) return;
  const counterSpan = topHeaderEl.querySelector('.counter');
  if (counterSpan) {
    const counterValue = counterSpan.querySelector('#mutant-counter');
    const value = counterValue ? counterValue.textContent : '0';
    counterSpan.innerHTML = `${getCounterLabel()} <span id="mutant-counter">${value}</span>`;
  }
  const legendSpan = topHeaderEl.querySelector('.legend');
  if (legendSpan) {
    legendSpan.innerHTML = `
      <span class="red">${langMap.legend_nerf || ''}</span>
      <span class="green">${langMap.legend_buff || ''}</span>
      <span class="changed">${langMap.legend_rework || ''}</span>
    `;
  }
  const toggleBtn = topHeaderEl.querySelector('#toggle-calculated-btn');
  if (toggleBtn) {
    toggleBtn.textContent = langMap.toggle_calculated || '';
  }
  const modeBtn = topHeaderEl.querySelector('#mode-btn');
  if (modeBtn) {
    modeBtn.textContent = getModeButtonText();
  }
  updateLangButtons(currentLang);
}

function updateLangButtons(lang) {
  const btns = document.querySelectorAll('.lang-btn');
  btns.forEach(btn => {
    if (btn.dataset.lang === lang) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

export async function setLanguage(lang) {
  if (lang === currentLang) return;

  if (langCache[lang]) {
    langMap = langCache[lang];
    currentLang = lang;
  } else {
    const map = await loadLangFile(lang);
    if (map) {
      langCache[lang] = map;
      langMap = map;
      currentLang = lang;
    } else {
      return;
    }
  }

  if (namesCache[lang]) {
    namesMap = namesCache[lang];
  } else {
    namesMap = {};
  }

  if (currentData.length > 0) {
    updateTitle(currentData.length);
    render(currentData, currentUpdatedCount, currentMode);
  }
}

function createTopHeader(initialText = '0') {
  const topHeader = document.createElement("div");
  topHeader.className = "top-header";

  const counterSpan = document.createElement("div");
  counterSpan.className = "counter";
  counterSpan.innerHTML = `${getCounterLabel()} <span id="mutant-counter">${initialText}</span>`;

  const legendSpan = document.createElement("div");
  legendSpan.className = "legend";
  legendSpan.innerHTML = `
    <span class="red">${langMap.legend_nerf || ''}</span>
    <span class="green">${langMap.legend_buff || ''}</span>
    <span class="changed">${langMap.legend_rework || ''}</span>
  `;

  const toggleBtn = document.createElement("button");
  toggleBtn.id = "toggle-calculated-btn";
  toggleBtn.textContent = langMap.toggle_calculated || '';
  toggleBtn.className = "toggle-btn" + (calculatedMode ? " active" : "");
  toggleBtn.onclick = toggleCalculatedMode;

  const modeBtn = document.createElement("button");
  modeBtn.id = "mode-btn";
  modeBtn.className = "toggle-btn mode-btn";
  modeBtn.textContent = getModeButtonText();
  modeBtn.onclick = () => {
    if (onModeChange) onModeChange();
  };

  const langBtnContainer = document.createElement("div");
  langBtnContainer.className = "lang-buttons";

  const btnEs = document.createElement("button");
  btnEs.textContent = "ES";
  btnEs.className = "lang-btn" + (currentLang === 'es' ? " active" : "");
  btnEs.dataset.lang = "es";
  btnEs.onclick = () => setLanguage('es');

  const btnEn = document.createElement("button");
  btnEn.textContent = "EN";
  btnEn.className = "lang-btn" + (currentLang === 'en' ? " active" : "");
  btnEn.dataset.lang = "en";
  btnEn.onclick = () => setLanguage('en');

  langBtnContainer.append(btnEs, btnEn);
  topHeader.append(counterSpan, legendSpan, toggleBtn, modeBtn, langBtnContainer);
  return topHeader;
}

function createHeaderRow() {
  const headerRow = document.createElement("div");
  headerRow.className = "header-row";

  const col1 = document.createElement("div");
  col1.textContent = langMap.col_mutant || '';
  headerRow.appendChild(col1);

  if (currentMode === 'rebalance') {
    const col2 = document.createElement("div");
    col2.textContent = langMap.col_before || '';
    const col3 = document.createElement("div");
    col3.textContent = langMap.col_after || '';
    const col4 = document.createElement("div");
    col4.textContent = langMap.col_change || '';
    const col5 = document.createElement("div");
    col5.textContent = langMap.col_alerts || '';
    headerRow.append(col2, col3, col4, col5);
  } else {
    const col2 = document.createElement("div");
    col2.textContent = langMap.col_stats || '';
    col2.classList.add('col-wide');
    headerRow.appendChild(col2);
  }

  return headerRow;
}

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

export function toggleCalculatedMode() {
  calculatedMode = !calculatedMode;
  const btn = document.getElementById('toggle-calculated-btn');
  if (btn) btn.classList.toggle('active');
  refreshAllRows();
}

function updateRow(id) {
  const row = document.querySelector(`.row[data-id="${id}"]`);
  if (!row) return;
  const entry = currentData.find(e => e.id === id);
  if (!entry) return;

  const newRow = document.createElement("div");
  newRow.className = "row";
  newRow.dataset.id = id;
  newRow.appendChild(createColumnInfo(entry.new, namesMap[id] || id));

  if (currentMode === 'rebalance') {
    newRow.appendChild(createStats(entry.old, id));
    newRow.appendChild(createStats(entry.new, id, entry.old));
    newRow.appendChild(createDiffScaled(entry.old, entry.new, id));
    newRow.appendChild(createAlertsColumn(entry.old, entry.announced, entry.new, id));
  } else {
    const statsDiv = createStats(entry.new, id);
    statsDiv.classList.add('col-wide');
    newRow.appendChild(statsDiv);
  }

  row.replaceWith(newRow);
}

function refreshAllRows() {
  currentData.forEach(entry => updateRow(entry.id));
}

function createAlertsColumn(oldData, announcedData, newData, id) {
  const div = document.createElement("div");

  const oldStats = oldData ? getFinalStats(oldData, id) : null;
  const announcedStats = announcedData ? getFinalStats(announcedData, id) : null;
  const newStats = getFinalStats(newData, id);

  STAT_ORDER.forEach(key => {
    const row = document.createElement("div");
    row.className = "stat-row alert-row";

    const oldVal = oldStats ? oldStats[key] : null;
    const announcedVal = announcedStats ? announcedStats[key] : null;
    const newVal = newStats ? newStats[key] : null;

    let alertMsg = null;

    if (announcedVal !== null) {
      if (announcedVal === oldVal && newVal !== oldVal) {
        alertMsg = langMap.alert_unannounced || '';
      } else if (announcedVal !== oldVal && newVal === oldVal) {
        alertMsg = (langMap.alert_not_arrived || '')
          .replace('{value}', formatAlertValue(announcedVal, key));
      } else if (announcedVal !== oldVal && newVal !== oldVal && announcedVal !== newVal) {
        alertMsg = (langMap.alert_announced_diff || '')
          .replace('{announced}', formatAlertValue(announcedVal, key))
          .replace('{real}', formatAlertValue(newVal, key));
      }
    }

    if (alertMsg) {
      const icon = document.createElement("img");
      icon.src = "img/alert.png";
      icon.className = "alert-icon";
      icon.title = alertMsg;
      row.appendChild(icon);
    }

    div.appendChild(row);
  });

  return div;
}

function formatAlertValue(val, key) {
  if (key === 'speed') return val.toFixed(2);
  if (key.startsWith('ability')) return val + '%';
  if (key === 'bank') return val;
  return Math.floor(val);
}

function getAttackValue(atk, isPlus, mod) {
  const base = isPlus && calculatedMode ? calcRealDamage(atk.value) : atk.value;
  return Math.floor(base * mod);
}

function getMultipliers(id) {
  const mode = modeMap[id];
  let starMult = 1;
  let gachaAtk = 1;
  let gachaLife = 1;

  if (mode === "bronze") starMult = 1.10;
  else if (mode === "silver") starMult = 1.30;
  else if (mode === "gold") starMult = 1.75;
  else if (mode === "platinum") starMult = 2.00;
  else {
    const gachaList = gachaMap[id];
    if (gachaList) {
      const found = gachaList.find(g => g.gachaId === mode);
      if (found) {
        const bonus = found.bonus / 100;
        const starBonus = getStarBonus(found.stars);
        gachaAtk = (1 + bonus) * (1 + starBonus);
        gachaLife = 1 - bonus + starBonus;
      }
    }
  }

  return {
    atk: starMult * gachaAtk,
    life: starMult * gachaLife
  };
}

function createColumnInfo(data, name) {
  const div = document.createElement("div");
  const img = document.createElement("img");
  img.width = 80;

  let base = `https://s-beta.kobojo.com/mutants/assets/thumbnails/${data.id.toLowerCase()}`;
  let url = base + ".png";
  const activeMode = modeMap[data.id];

  if (activeMode) {
    if (activeMode === "gold") url = base + "_gold.png";
    else if (activeMode === "platinum") url = base + "_platinum.png";
    else if (activeMode === "bronze") url = base + "_bronze.png";
    else if (activeMode === "silver") url = base + "_silver.png";
    else {
      const gachaList = gachaMap[data.id];
      if (gachaList && gachaList.some(g => g.gachaId === activeMode)) {
        url = base + `_${activeMode}.png`;
      }
    }
  }

  img.src = url;
  img.onerror = () => { img.src = base + ".png"; };

  const title = document.createElement("div");
  title.textContent = name || data.id;

  const btnContainer = document.createElement("div");
  btnContainer.className = "btn-container";

  const btnBronze = createButton("bronze", data.id);
  const btnSilver = createButton("silver", data.id);
  const btnGold = createButton("gold", data.id);
  const btnPlat = createButton("platinum", data.id);
  btnContainer.append(btnBronze, btnSilver, btnGold, btnPlat);

  const gachaList = gachaMap[data.id];
  if (gachaList && gachaList.length > 0) {
    gachaList.forEach(g => {
      const gachaBtn = createGachaButton(g.gachaId, data.id);
      btnContainer.appendChild(gachaBtn);
    });
  }

  div.append(img, title, btnContainer);
  return div;
}

function createButton(type, id) {
  const btn = document.createElement("div");
  btn.className = "btn";
  const icon = document.createElement("img");
  let iconSrc;
  if (type === "gold") iconSrc = "https://s-beta.kobojo.com/mutants/assets/mobile/thumbnails/star_gold.png";
  else if (type === "platinum") iconSrc = "https://s-beta.kobojo.com/mutants/assets/mobile/thumbnails/star_platinum.png";
  else if (type === "bronze") iconSrc = "https://s-beta.kobojo.com/mutants/assets/mobile/thumbnails/star_bronze.png";
  else if (type === "silver") iconSrc = "https://s-beta.kobojo.com/mutants/assets/mobile/thumbnails/star_silver.png";
  icon.src = iconSrc;
  icon.className = "btn-icon";
  btn.appendChild(icon);
  if (modeMap[id] === type) btn.classList.add("active");
  btn.onclick = () => {
    if (modeMap[id] === type) delete modeMap[id];
    else modeMap[id] = type;
    updateRow(id);
  };
  return btn;
}

function createGachaButton(gachaId, specimenId) {
  const btn = document.createElement("div");
  btn.className = "btn gacha-btn";
  const icon = document.createElement("img");
  icon.src = `https://s-beta.kobojo.com/mutants/assets/gachacontent/icon_${gachaId}.png`;
  icon.className = "btn-icon-gacha";
  btn.appendChild(icon);
  if (modeMap[specimenId] === gachaId) btn.classList.add("active");
  btn.onclick = () => {
    if (modeMap[specimenId] === gachaId) delete modeMap[specimenId];
    else modeMap[specimenId] = gachaId;
    updateRow(specimenId);
  };
  return btn;
}

function createStats(data, id, oldData = null) {
  const div = document.createElement("div");
  const mult = getMultipliers(id);

  addStat(div, "life.png", langMap.stat_life, data.life * mult.life, oldData ? oldData.life * mult.life : null, 'life');
  addStat(div, "speed.png", langMap.stat_speed, data.speed, oldData ? oldData.speed : null, 'speed', true);

  addAttack(div, langMap.stat_attack1, data.atk1, data.unlock["1"], mult.atk,
    oldData ? getAttackValue(oldData.atk1, false, mult.atk) : null, false, 'atk1',
    oldData ? oldData.atk1 : null, oldData ? oldData.unlock["1"] : null);
  addAttack(div, langMap.stat_attack1p, data.atk1p, data.unlock["1p"], mult.atk,
    oldData ? getAttackValue(oldData.atk1p, true, mult.atk) : null, true, 'atk1p',
    oldData ? oldData.atk1p : null, oldData ? oldData.unlock["1p"] : null);
  addAttack(div, langMap.stat_attack2, data.atk2, data.unlock["2"], mult.atk,
    oldData ? getAttackValue(oldData.atk2, false, mult.atk) : null, false, 'atk2',
    oldData ? oldData.atk2 : null, oldData ? oldData.unlock["2"] : null);
  addAttack(div, langMap.stat_attack2p, data.atk2p, data.unlock["2p"], mult.atk,
    oldData ? getAttackValue(oldData.atk2p, true, mult.atk) : null, true, 'atk2p',
    oldData ? oldData.atk2p : null, oldData ? oldData.unlock["2p"] : null);

  addAbility(div, langMap.stat_ability, data.ability1, data.abilities.a1,
    oldData ? oldData.ability1 : null, 'ability1', oldData ? oldData.abilities.a1 : null);
  addAbility(div, langMap.stat_ability_plus, data.ability2, data.abilities.a2,
    oldData ? oldData.ability2 : null, 'ability2', oldData ? oldData.abilities.a2 : null);
  addStat(div, "credits.png", langMap.stat_credits, data.bank, oldData ? oldData.bank : null, 'bank');

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

  left.append(icon, document.createTextNode(label || ''));
  right.textContent = displayValue;

  if (oldValue !== null && oldValue !== undefined) {
    if (value > oldValue) right.classList.add("green");
    if (value < oldValue) right.classList.add("red");
  }

  row.append(left, right);
  parent.appendChild(row);
}

function addAttack(parent, label, atk, gen, mod, oldAtkValue = null, isPlus = false, statType = '', oldAtkObj = null, oldGen = null) {
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

  let labelText = label || '';
  if (atk.aoe) labelText += langMap.triple || '';
  const labelSpan = document.createElement("span");
  labelSpan.textContent = labelText;
  if (oldGen !== null && oldGen !== undefined && oldGen !== gen) {
    labelSpan.classList.add("changed");
  }
  if (oldAtkObj !== null && oldAtkObj !== undefined && oldAtkObj.aoe !== atk.aoe) {
    labelSpan.classList.add("changed");
  }
  left.append(icon, labelSpan);

  right.textContent = Math.floor(value);

  if (oldAtkValue !== null && oldAtkValue !== undefined) {
    if (value > oldAtkValue) right.classList.add("green");
    if (value < oldAtkValue) right.classList.add("red");
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

function addAbility(parent, label, val, ability, oldVal = null, statType = '', oldAbility = null) {
  const row = document.createElement("div");
  row.className = "stat-row";
  row.dataset.statType = statType;

  const left = document.createElement("div");
  left.className = "left";
  const right = document.createElement("div");
  right.className = "right";

  const icon = createAbilityIcon(ability, (label || '').includes("+"));
  const labelSpan = document.createElement("span");
  labelSpan.textContent = label || '';
  if (oldAbility !== null && oldAbility !== undefined && oldAbility !== ability) {
    labelSpan.classList.add("changed");
  }
  left.append(icon, labelSpan);

  right.textContent = val + "%";

  if (oldVal !== null && oldVal !== undefined) {
    const absVal = Math.abs(val);
    const absOld = Math.abs(oldVal);
    if (absVal > absOld) {
      right.classList.add("green");
    } else if (absVal < absOld) {
      right.classList.add("red");
    }
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
  const oldStats = getFinalStats(oldD, id);
  const newStats = getFinalStats(newD, id);

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

function getFinalStats(data, id) {
  const mult = getMultipliers(id);
  return {
    life: Math.floor(data.life * mult.life),
    speed: Math.round(data.speed * 100) / 100,
    atk1: Math.floor(data.atk1.value * mult.atk),
    atk1p: Math.floor((calculatedMode ? calcRealDamage(data.atk1p.value) : data.atk1p.value) * mult.atk),
    atk2: Math.floor(data.atk2.value * mult.atk),
    atk2p: Math.floor((calculatedMode ? calcRealDamage(data.atk2p.value) : data.atk2p.value) * mult.atk),
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

  let diffValue;
  let isPositive;

  if (isAbility) {
    const absOld = Math.abs(oldVal);
    const absNew = Math.abs(newVal);
    diffValue = absNew - absOld;
    isPositive = diffValue > 0;
  } else {
    diffValue = newVal - oldVal;
    isPositive = diffValue > 0;
  }

  if (diffValue === 0) {
    right.textContent = "-";
    row.appendChild(right);
    parent.appendChild(row);
    return;
  }

  let displayDiff;
  if (isSpeed) {
    displayDiff = (diffValue > 0 ? '+' : '') + diffValue.toFixed(2);
  } else {
    displayDiff = (diffValue > 0 ? '+' : '') + Math.floor(diffValue);
  }

  let percentageText = '';
  if (!isAbility && oldVal !== 0) {
    const percent = ((newVal - oldVal) / oldVal) * 100;
    const sign = percent > 0 ? '+' : '';
    const percentDisplay = percent.toFixed(1);
    percentageText = ` (${sign}${percentDisplay}%)`;
  }

  let displayValue;
  if (isAbility) {
    let absDiff = Math.abs(diffValue);
    let sign = isPositive ? '+' : '-';
    displayValue = `${sign}${absDiff}%`;
  } else {
    displayValue = displayDiff + percentageText;
  }

  right.textContent = displayValue;

  if (isPositive) right.classList.add("green");
  else right.classList.add("red");

  row.appendChild(right);
  parent.appendChild(row);
}

let gachaMap = {};

async function loadGachas() {
  try {
    const url = `https://s-beta.kobojo.com/mutants/gameconfig/gacha.xml?t=${Date.now()}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const xmlString = await response.text();
    const parser = new DOMParser();
    const xml = parser.parseFromString(xmlString, "text/xml");

    const gachas = xml.getElementsByTagName("Gacha");
    for (const gacha of gachas) {
      const gachaId = gacha.getAttribute("id");
      const specimens = gacha.querySelectorAll("GachaSpecimen");
      for (const spec of specimens) {
        const specimenId = spec.getAttribute("specimen");
        const stars = parseInt(spec.getAttribute("stars"), 10);
        const bonus = parseInt(spec.getAttribute("bonus"), 10);

        if (specimenId === "Specimen_FD_03" && gachaId !== "japan") {
          continue;
        }

        if (!gachaMap[specimenId]) gachaMap[specimenId] = [];
        gachaMap[specimenId].push({ gachaId, stars, bonus });
      }
    }
  } catch (error) {
  } finally {
    gachaLoaded = true;
  }
}

function getStarBonus(stars) {
  switch(stars) {
    case 0: return 0;
    case 1: return 0.10;
    case 2: return 0.30;
    case 3: return 0.75;
    case 4: return 1.00;
    default: return 0;
  }
}