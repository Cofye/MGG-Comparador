import { parseXML } from './js/parser.js?v=2';
import { render, setLanguage, preloadLangFiles, preloadNames } from './js/renderer.js?v=2';

function hasChanges(o, n) {
  return JSON.stringify(o) !== JSON.stringify(n);
}

let entriesData = null;
const title = document.getElementById("title");

function updateProgress(message, percent) {
  title.textContent = `Cargando calculadora... ${percent}% - ${message}`;
}

async function loadData() {
  updateProgress("Buscando mutantes", 50);
  const [oldXML, announcedXML, newXML] = await Promise.all([
    fetch(`./data/gamedefinitions_old.xml?t=${Date.now()}`).then(r => r.text()),
    fetch(`./data/gamedefinitions_announcements.xml?t=${Date.now()}`).then(r => r.text()),
    fetch(`./data/gamedefinitions.xml?t=${Date.now()}`).then(r => r.text())
  ]);

  updateProgress("Comparando mutantes", 60);
  const oldData = parseXML(oldXML);
  const announcedData = parseXML(announcedXML);
  const newData = parseXML(newXML);

  updateProgress("Comparando mutantes", 70);
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

    if (hasRealChange || hasAnnouncedChange) {
      entries.push({ id, old, announced, new: current });
      if (hasRealChange) updatedCount++;
    }
  }

  entriesData = { entries, updatedCount };
  return entriesData;
}

async function init() {
  // Etapa 1: precargar idiomas (interfaz y nombres)
  updateProgress("Cargando idiomas", 10);
  await preloadLangFiles();
  updateProgress("Cargando nombres de mutantes", 30);
  await preloadNames();

  // Etapa 2: cargar datos del juego
  await loadData();

  // Etapa 3: establecer idioma por defecto (es) y renderizar
  updateProgress("Preparando vista", 90);
  await setLanguage('es'); // Actualiza langMap y namesMap (no renderiza porque currentData está vacío)
  // Ahora renderizar con los datos cargados
  render(entriesData.entries, entriesData.updatedCount);
  // El título se actualizará dentro de render con el template de idioma
}

init();