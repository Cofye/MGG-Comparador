import { parseXML } from './js/parser.js?v=2';
import { render } from './js/renderer.js?v=2';

function hasChanges(o, n) {
  return JSON.stringify(o) !== JSON.stringify(n);
}

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

  title.textContent = `🧪 ${entries.length} mutantes relevantes`;
  render(entries, updatedCount);
}

load();