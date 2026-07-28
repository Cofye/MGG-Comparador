import { parseXML } from './js/parser.js?v=2';
import { compareData } from './js/comparator.js?v=2';
import { render } from './js/renderer.js?v=2';

async function load() {
  const title = document.getElementById("title");
  title.textContent = "Cargando calculadora...";

  const [oldXML, announcedXML, newXML] = await Promise.all([
    fetch(`./data/gamedefinitions_old.xml?t=${Date.now()}`).then(r => r.text()),
    fetch(`./data/gamedefinitions_announcements.xml?t=${Date.now()}`).then(r => r.text()),
    fetch(`./data/gamedefinitions.xml?t=${Date.now()}`).then(r => r.text())
  ]);

  const oldData = parseXML(oldXML);
  const announcedData = parseXML(announcedXML);
  const newData = parseXML(newXML);

  // 1. Obtener solo los mutantes que cambiaron (igual que antes)
  const changes = compareData(oldData, newData);

  // 2. Mapear cambios para incluir los anuncios
  const announcedMap = Object.fromEntries(announcedData.map(x => [x.id, x]));

  const entries = changes.map(change => {
    const id = change.new.id;
    return {
      id,
      old: change.old,
      announced: announcedMap[id] || null,
      new: change.new
    };
  });

  // 3. Actualizar título y renderizar
  title.textContent = `🧪 ${entries.length} mutantes con cambios`;
  render(entries);
}

load();