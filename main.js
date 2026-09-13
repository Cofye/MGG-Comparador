import { parseXML } from './js/parser.js?v=2';
import { render, setLanguage, preloadLangFiles, preloadNames, setModeChangeHandler } from './js/renderer.js?v=2';

function hasChanges(o, n) {
  return JSON.stringify(o) !== JSON.stringify(n);
}

let entriesData = null;
const title = document.getElementById("title");

let currentMode = 'rebalance';
let previousMode = 'rebalance';

function updateProgress(message, percent) {
  title.textContent = `Cargando calculadora... ${percent}% - ${message}`;
}

setModeChangeHandler(() => {
  if (currentMode === 'all') {
    currentMode = previousMode;
  } else {
    previousMode = currentMode;
    currentMode = currentMode === 'rebalance' ? 'new' : 'rebalance';
  }
  loadDataAndRender();
});

let typed = "";
document.addEventListener('keydown', (e) => {
  if (e.key.length === 1 && e.key.match(/[a-z]/i)) {
    typed += e.key.toLowerCase();
    if (typed.length > "manuellewe".length) {
      typed = typed.slice(-"manuellewe".length);
    }
    if (typed === "manuellewe") {
      typed = "";
      if (currentMode === 'all') {
        currentMode = previousMode;
      } else {
        previousMode = currentMode;
        currentMode = 'all';
      }
      loadDataAndRender();
    }
  }
});

async function loadData() {
  updateProgress("Descargando archivos XML", 50);
  const [oldXML, announcedXML, newXML, baseXML] = await Promise.all([
    fetch(`./data/gamedefinitions_old.xml?t=${Date.now()}`).then(r => r.text()),
    fetch(`./data/gamedefinitions_announcements.xml?t=${Date.now()}`).then(r => r.text()),
    fetch(`./data/gamedefinitions_new.xml?t=${Date.now()}`).then(r => r.text()),
    fetch(`./data/gamedefinitions.xml?t=${Date.now()}`).then(r => r.text())
  ]);

  updateProgress("Parseando XML", 60);
  const oldData = parseXML(oldXML);
  const announcedData = parseXML(announcedXML);
  const newData = parseXML(newXML);
  const baseData = parseXML(baseXML);

  updateProgress("Comparando datos", 70);
  const oldMap = Object.fromEntries(oldData.map(x => [x.id, x]));
  const announcedMap = Object.fromEntries(announcedData.map(x => [x.id, x]));
  const newMap = Object.fromEntries(newData.map(x => [x.id, x]));
  const baseMap = Object.fromEntries(baseData.map(x => [x.id, x]));

  const entries = [];
  let updatedCount = 0;

  if (currentMode === 'rebalance') {
    const allIds = new Set([...Object.keys(newMap), ...Object.keys(announcedMap)]);
    for (const id of allIds) {
      const old = oldMap[id] || null;
      const announced = announcedMap[id] || null;
      const current = newMap[id] || null;
      if (!current) continue;

      const hasRealChange = old && hasChanges(old, current);
      const hasAnnouncedChange = announced && old && hasChanges(old, announced);

      if (hasRealChange || hasAnnouncedChange) {
        entries.push({ id, old, announced, new: current });
        if (hasRealChange) updatedCount++;
      }
    }
  } else if (currentMode === 'new') {
    for (const id of Object.keys(baseMap)) {
      const current = baseMap[id];
      const newVersion = newMap[id];
      const old = oldMap[id] || null;
      const announced = announcedMap[id] || null;

      if (!current) continue;

      const isNew = !newVersion || hasChanges(newVersion, current);
      if (isNew) {
        entries.push({ id, old, announced, new: current });
        updatedCount++;
      }
    }
  } else {
    for (const id of Object.keys(baseMap)) {
      const current = baseMap[id];
      const old = oldMap[id] || null;
      const announced = announcedMap[id] || null;
      if (!current) continue;

      entries.push({ id, old, announced, new: current });
      updatedCount++;
    }
  }

  entriesData = { entries, updatedCount };
  return entriesData;
}

async function loadDataAndRender() {
  await loadData();
  render(entriesData.entries, entriesData.updatedCount, currentMode);
}

async function init() {
  updateProgress("Cargando idiomas", 10);
  await preloadLangFiles();

  updateProgress("Cargando nombres de mutantes", 30);
  await preloadNames();

  await loadData();

  updateProgress("Preparando vista", 90);
  render(entriesData.entries, entriesData.updatedCount, currentMode);
}

init();