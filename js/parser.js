export function parseXML(xmlString) {
  const parser = new DOMParser();
  const xml = parser.parseFromString(xmlString, "text/xml");

  const entities = [...xml.getElementsByTagName("EntityDescriptor")];

  return entities.map(e => {
    const id = e.getAttribute("id");

    const tags = {};
    e.querySelectorAll("Tag").forEach(tag => {
      tags[tag.getAttribute("key")] = tag.getAttribute("value");
    });

    return {
      id,
      speed: calcSpeed(tags.spX100),
      life: +tags.lifePoint || 0,

      atk1: parseAttack(tags.atk1),
      atk1p: parseAttack(tags.atk1p),
      atk2: parseAttack(tags.atk2),
      atk2p: parseAttack(tags.atk2p),

      ability1: +tags.abilityPct1 || 0,
      ability2: +tags.abilityPct2 || 0,

      abilities: parseAbilities(tags.abilities),
      unlock: parseUnlock(tags.unlockAttack),

      dna: tags.dna
    };
  });
}

function calcSpeed(val) {
  if (!val) return 0;

  const res = 1000 / val;
  const rounded = Math.round(res * 100) / 100;

  return Number.isInteger(rounded)
    ? rounded
    : parseFloat(rounded.toFixed(2));
}

function parseAttack(val) {
  if (!val) return { value: 0, aoe: false };

  if (val.includes(":AOE")) {
    return {
      value: +val.split(":")[0],
      aoe: true
    };
  }

  return { value: +val, aoe: false };
}

function parseAbilities(val) {
  if (!val) return {};
  const parts = val.split(";");
  return {
    a1: parts[0]?.split(":")[1],
    a2: parts[1]?.split(":")[1]
  };
}

function parseUnlock(val) {
  if (!val) return {};
  const obj = {};

  val.split(";").forEach(p => {
    const [type, , gen] = p.split(":");
    obj[type] = gen;
  });

  return obj;
}