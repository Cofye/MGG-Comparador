export function getDiff(oldVal, newVal, isAbility = false) {
  if (oldVal === newVal) return "-";

  let diff = newVal - oldVal;

  // corrección para negativos
  if (isAbility && oldVal < 0 && newVal < 0) {
    diff = -(newVal - oldVal);
  }

  const sign = diff > 0 ? "+" : "";
  return sign + diff + (isAbility ? "%" : "");
}

export function formatStat(val) {
  return Math.floor(val);
}

export function calcRealDamage(x) {
  if (!x) return 0;

  const part1 = Math.floor(x + (x * 0.1) * 24);
  const part2 = Math.floor(x + (x * 0.1) * 23);

  const diff = part1 - part2;

  const result = diff / 0.15;

  return Math.round(result);
}