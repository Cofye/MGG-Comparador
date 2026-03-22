import { parseXML } from './js/parser.js';
import { compareData } from './js/comparator.js';
import { render } from './js/renderer.js';

async function load() {
  const oldXML = await fetch('./data/gamedefinitions_old.xml').then(r => r.text());
  const newXML = await fetch('./data/gamedefinitions.xml').then(r => r.text());

  const oldData = parseXML(oldXML);
  const newData = parseXML(newXML);

  const changes = compareData(oldData, newData);

  render(changes);
}

load();