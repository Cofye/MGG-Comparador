import { parseXML } from './js/parser.js';
import { compareData } from './js/comparator.js';
import { render } from './js/renderer.js';

async function load() {
  const title = document.getElementById("title");

  // 🔄 estado inicial
  title.textContent = "Buscando cambios...";

  // 🔥 evitar caché (usar backticks)
  const oldXML = await fetch(`./data/gamedefinitions_old.xml?t=${Date.now()}`)
    .then(r => r.text());

  const newXML = await fetch(`./data/gamedefinitions.xml?t=${Date.now()}`)
    .then(r => r.text());

  const oldData = parseXML(oldXML);
  const newData = parseXML(newXML);

  const changes = compareData(oldData, newData);

  // 🎯 actualizar título correctamente
  title.textContent = changes.length === 1
    ? "1 mutante fue actualizado"
    : `${changes.length} mutantes fueron actualizados`;

  render(changes);
}

// 🚀 iniciar
load();