import { parseXML } from './js/parser.js?v=2';
import { render, setLanguage, preloadLangFiles, preloadNames } from './js/renderer.js?v=2';
import { toggleShowAll, isShowAll } from './js/renderer.js?v=2'; // Necesitamos exportar estas funciones

function hasChanges(o, n) {
  return JSON.stringify(o) !== JSON.stringify(n);
}

let entriesData = null;
const title = document.getElementById("title");
let showAllMutants = false;

function updateProgress(message, percent) {
  title.textContent = `Cargando calculadora... ${percent}% - ${message}`;
}

// --- Detectar "manuellewe" ---
let typed = "";
document.addEventListener('keydown', (e) => {
  if (e.key.length === 1 && e.key.match(/[a-z]/i)) {
    typed += e.key.toLowerCase();
    if (typed.length > "manuellewe".length) {
      typed = typed.slice(-"manuellewe".length);
    }
    if (typed === "manuellewe") {
      typed = "";
      showAllMutants = !showAllMutants;
      toggleShowAll(showAllMutants); // Notificar a renderer (opcional)
      // Recargar datos
      loadDataAndRender();
    }
  }
});

async function loadData() {
  updateProgress("Descargando archivos XML", 50);
  const [oldXML, announcedXML, newXML] = await Promise.all([
    fetch(`./data/gamedefinitions_old.xml?t=${Date.now()}`).then(r => r.text()),
    fetch(`./data/gamedefinitions_announcements.xml?t=${Date.now()}`).then(r => r.text()),
    fetch(`./data/gamedefinitions.xml?t=${Date.now()}`).then(r => r.text())
  ]);

  updateProgress("Parseando XML", 60);
  const oldData = parseXML(oldXML);
  const announcedData = parseXML(announcedXML);
  const newData = parseXML(newXML);

  updateProgress("Comparando datos", 70);
  const oldMap = Object.fromEntries(oldData.map(x => [x.id, x]));
  const announcedMap = Object.fromEntries(announcedData.map(x => [x.id, x]));
  const newMap = Object.fromEntries(newData.map(x => [x.id, x]));

  const allIds = new Set([...Object.keys(newMap), ...Object.keys(announcedMap)]);
  const entries = [];
  let updatedCount = 0;

  for (const id of allIds) {
    const old = oldMap[id] || null;
    const announced = announcedMap[id] || null;
    const current = newMap[id] || null;
    if (!current) continue;

    const hasRealChange = old && hasChanges(old, current);
    const hasAnnouncedChange = announced && old && hasChanges(old, announced);

    // Si el modo completo está activo, mostrar todos los mutantes
    if (showAllMutants) {
      entries.push({ id, old, announced, new: current });
      if (hasRealChange) updatedCount++;
    } else {
      // Filtro normal: solo los que cambiaron o tienen anuncio
      if (hasRealChange || hasAnnouncedChange) {
        entries.push({ id, old, announced, new: current });
        if (hasRealChange) updatedCount++;
      }
    }
  }

  entriesData = { entries, updatedCount };
  return entriesData;
}

async function loadDataAndRender() {
  await loadData();
  await setLanguage('es');
  render(entriesData.entries, entriesData.updatedCount);
}

async function init() {
  // Precarga de idiomas y nombres
  updateProgress("Cargando idiomas", 10);
  await preloadLangFiles();
  updateProgress("Cargando nombres de mutantes", 30);
  await preloadNames();

  // Carga de datos
  await loadData();

  // Renderizar
  updateProgress("Preparando vista", 90);
  await setLanguage('es');
  render(entriesData.entries, entriesData.updatedCount);
}

init();