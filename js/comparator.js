export function compareData(oldData, newData) {
  const mapOld = Object.fromEntries(oldData.map(x => [x.id, x]));
  const changes = [];

  newData.forEach(n => {
    const o = mapOld[n.id];
    if (!o) return;

    if (hasChanges(o, n)) {
      changes.push({ old: o, new: n });
    }
  });

  return changes;
}

function hasChanges(o, n) {
  return JSON.stringify(o) !== JSON.stringify(n);
}