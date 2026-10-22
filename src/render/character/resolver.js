import { RACE_DORAM, resolveJobSprite } from "./jobs";

const GENDER_SUFFIX = {
  male: "남",
  female: "여",
};

const RACE_FOLDER = {
  human: "인간족",
  doram: "도람족",
};
const BODY_FOLDER = "몸통";
const HEAD_FOLDER = "머리통";
const ACCESSORY_FOLDER = "악세사리";
const ROBE_FOLDER = "로브";
const DORAM_SUFFIX = "_doram";

// character.headgear holds view ids as [bottom, top, mid]. Draw order is bottom -> mid -> top.
const HEADGEAR_SLOTS = [
  { slot: "bottom", index: 0 },
  { slot: "mid", index: 2 },
  { slot: "top", index: 1 },
];

const MAX_HEAD_ID = {
  human: 42,
  doram: 10,
};

function normalizeSegment(value, form) {
  return String(value).normalize(form);
}

function createPathCandidates(pathBuilder) {
  const nfdPath = pathBuilder("NFD");
  const nfcPath = pathBuilder("NFC");

  if (nfdPath === nfcPath) {
    return [nfdPath];
  }

  return [nfdPath, nfcPath];
}

export function normalizeGender(gender) {
  return Number(gender) === 1 ? "male" : "female";
}

export function toSpriteGenderSuffix(gender) {
  const normalizedGender = normalizeGender(gender);
  return GENDER_SUFFIX[normalizedGender];
}

// `manifest` maps headgear view id -> [male, female, male doram, female doram] sprite stems (see db/headgearSprites.json).
// Doram characters prefer the doram sprite and fall back to the regular one (same ACT layout and anchors).
function resolveHeadgearAssets(character, sprite, manifest) {
  if (!manifest) {
    return [];
  }

  const genderOffset = sprite.gender === "male" ? 0 : 1;
  const genderSuffix = GENDER_SUFFIX[sprite.gender];
  const headgear = Array.isArray(character.headgear) ? character.headgear : [];
  const resolved = [];

  for (const { slot, index } of HEADGEAR_SLOTS) {
    const viewId = Number(headgear[index]) || 0;
    const row = viewId > 0 ? manifest[viewId] : null;
    if (!row) {
      continue;
    }

    const variants = [];
    if (sprite.race === RACE_DORAM && row[genderOffset + 2]) {
      variants.push({ folder: `${genderSuffix}${DORAM_SUFFIX}`, stem: row[genderOffset + 2] });
    }
    if (row[genderOffset]) {
      variants.push({ folder: genderSuffix, stem: row[genderOffset] });
    }
    if (variants.length === 0) {
      continue;
    }

    const createPath = (variant, extension, form) => {
      const accessory = normalizeSegment(ACCESSORY_FOLDER, form);
      const folder = normalizeSegment(variant.folder, form);
      const stem = normalizeSegment(variant.stem, form);
      return `/data/sprite/${accessory}/${folder}/${stem}.${extension}`;
    };

    const collect = (extension) =>
      variants.flatMap((variant) => createPathCandidates((form) => createPath(variant, extension, form)));

    resolved.push({
      slot,
      viewId,
      spritePathCandidates: collect("spr"),
      actPathCandidates: collect("act"),
    });
  }

  return resolved;
}

// `manifest` maps garment view id -> robe folder under data/sprite/로브 (see db/garmentSprites.json).
// Robe files follow the body naming: 로브/<folder>/<gender>/<job sprite name>_<gender>.{spr,act}.
function resolveGarmentAssets(character, sprite, manifest) {
  const viewId = Number(character.garment) || 0;
  const folder = viewId > 0 && manifest ? manifest[viewId] : null;
  if (!folder) {
    return null;
  }

  const genderSuffix = GENDER_SUFFIX[sprite.gender];
  const createPath = (extension, form) => {
    const robeRoot = normalizeSegment(ROBE_FOLDER, form);
    const robe = normalizeSegment(folder, form);
    const gender = normalizeSegment(genderSuffix, form);
    const name = normalizeSegment(sprite.name, form);
    return `/data/sprite/${robeRoot}/${robe}/${gender}/${name}_${gender}.${extension}`;
  };

  return {
    viewId,
    spritePathCandidates: createPathCandidates((form) => createPath("spr", form)),
    actPathCandidates: createPathCandidates((form) => createPath("act", form)),
  };
}

export function resolveCharacterAssetPaths(character, { headgear: headgearManifest = null, garment: garmentManifest = null } = {}) {
  const sprite = resolveJobSprite(character.job, normalizeGender(character.gender));
  const genderSuffix = GENDER_SUFFIX[sprite.gender];
  const raceFolder = RACE_FOLDER[sprite.race];
  const headId = Math.min(MAX_HEAD_ID[sprite.race], Math.max(1, Number(character.head) || 1));

  const createBodyPath = (extension, form) => {
    const race = normalizeSegment(raceFolder, form);
    const body = normalizeSegment(BODY_FOLDER, form);
    const gender = normalizeSegment(genderSuffix, form);
    const name = normalizeSegment(sprite.name, form);

    return `/data/sprite/${race}/${body}/${gender}/${name}_${gender}.${extension}`;
  };

  const createImfPaths = (form) => {
    const gender = normalizeSegment(genderSuffix, form);
    return sprite.imfNames.map((imfName) => `/data/imf/${normalizeSegment(imfName, form)}_${gender}.imf`);
  };

  const createHeadPath = (extension, form) => {
    const race = normalizeSegment(raceFolder, form);
    const head = normalizeSegment(HEAD_FOLDER, form);
    const gender = normalizeSegment(genderSuffix, form);

    return `/data/sprite/${race}/${head}/${gender}/${headId}_${gender}.${extension}`;
  };

  const imfCandidates = [];
  for (const form of ["NFD", "NFC"]) {
    for (const path of createImfPaths(form)) {
      if (!imfCandidates.includes(path)) {
        imfCandidates.push(path);
      }
    }
  }

  return {
    characterType: "player",
    jobId: sprite.jobId,
    jobName: sprite.name,
    race: sprite.race,
    isDoram: sprite.race === RACE_DORAM,
    gender: sprite.gender,
    imfPathCandidates: imfCandidates,
    headgear: resolveHeadgearAssets(character, sprite, headgearManifest),
    garment: resolveGarmentAssets(character, sprite, garmentManifest),
    bodySpritePathCandidates: createPathCandidates((form) => createBodyPath("spr", form)),
    bodyActPathCandidates: createPathCandidates((form) => createBodyPath("act", form)),
    headSpritePathCandidates: createPathCandidates((form) => createHeadPath("spr", form)),
    headActPathCandidates: createPathCandidates((form) => createHeadPath("act", form)),
  };
}
