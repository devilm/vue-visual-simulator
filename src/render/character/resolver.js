import { RACE_DORAM, getPaletteNames, resolveJobSprite } from "./jobs";

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

// Outfit sprites live in data/sprite/<race>/몸통/<gender>/costume_<n>/, their palettes in data/palette/몸/costume_<n>/.
const OUTFIT_FOLDER_PREFIX = "costume_";
const MAX_OUTFIT = 1;

// Palette files: <root>/<name>_<gender>_<index>.pal (body), 머리<head id>_<gender>_<index>.pal (head).
// Index 0 is the default colour and is already embedded in the SPR, so it is never fetched.
const PALETTE_ROOT = {
  human: { body: "몸", head: "머리" },
  doram: { body: "도람족/body", head: "도람족/머리" },
};

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

// Normalizes every segment of a slash separated path.
function normalizePath(path, form) {
  return path
    .split("/")
    .map((segment) => normalizeSegment(segment, form))
    .join("/");
}

function toPaletteIndex(value) {
  const index = Math.floor(Number(value));
  return Number.isFinite(index) && index > 0 ? index : 0;
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

  // Many robes ship a single shared SPR at 로브/<folder>/<folder>[_doram].spr instead of one per job
  // (e.g. wing_of_angel_move_rd); a per-job SPR, when present, still takes priority.
  const createSharedSprPaths = (stem, form) =>
    `/data/sprite/${normalizeSegment(ROBE_FOLDER, form)}/${normalizeSegment(folder, form)}/${normalizeSegment(stem, form)}.spr`;
  const sharedStems =
    sprite.race === RACE_DORAM ? [`${folder}${DORAM_SUFFIX}`, folder] : [folder, `${folder}${DORAM_SUFFIX}`];

  const spritePathCandidates = [
    ...createPathCandidates((form) => createPath("spr", form)),
    ...sharedStems.flatMap((stem) => createPathCandidates((form) => createSharedSprPaths(stem, form))),
  ];

  return {
    viewId,
    spritePathCandidates: [...new Set(spritePathCandidates)],
    actPathCandidates: createPathCandidates((form) => createPath("act", form)),
  };
}

export function resolveCharacterAssetPaths(character, { headgear: headgearManifest = null, garment: garmentManifest = null } = {}) {
  const sprite = resolveJobSprite(character.job, normalizeGender(character.gender));
  const genderSuffix = GENDER_SUFFIX[sprite.gender];
  const raceFolder = RACE_FOLDER[sprite.race];
  const headId = Math.min(MAX_HEAD_ID[sprite.race], Math.max(1, Number(character.head) || 1));

  const outfit = Math.min(MAX_OUTFIT, Math.max(0, Math.floor(Number(character.outfit)) || 0));
  const bodyPaletteIndex = toPaletteIndex(character.bodyPalette);
  const headPaletteIndex = toPaletteIndex(character.headPalette);
  const paletteRoot = PALETTE_ROOT[sprite.race];

  const createImfPaths = (imfNames, form) => {
    const gender = normalizeSegment(genderSuffix, form);
    return imfNames.map((imfName) => `/data/imf/${normalizeSegment(imfName, form)}_${gender}.imf`);
  };

  const createImfCandidates = (imfNames) => {
    const candidates = [];
    for (const form of ["NFD", "NFC"]) {
      for (const path of createImfPaths(imfNames, form)) {
        if (!candidates.includes(path)) {
          candidates.push(path);
        }
      }
    }
    return candidates;
  };

  const createHeadPath = (extension, form) => {
    const race = normalizeSegment(raceFolder, form);
    const head = normalizeSegment(HEAD_FOLDER, form);
    const gender = normalizeSegment(genderSuffix, form);

    return `/data/sprite/${race}/${head}/${gender}/${headId}_${gender}.${extension}`;
  };

  // One body sprite source. `outfitIndex` 0 is the regular body; otherwise the sprite sits in costume_<n>/.
  // `stemSuffix` is appended to "<name>_<gender>" (outfit sprites are usually "<name>_<gender>_<n>").
  const createBodyVariant = ({ name, outfitIndex = 0, stemSuffix = "", paletteNames, imfNames }) => {
    const createPath = (extension, form) => {
      const segments = [
        normalizeSegment(raceFolder, form),
        normalizeSegment(BODY_FOLDER, form),
        normalizeSegment(genderSuffix, form),
      ];
      if (outfitIndex > 0) {
        segments.push(`${OUTFIT_FOLDER_PREFIX}${outfitIndex}`);
      }
      segments.push(`${normalizeSegment(name, form)}_${normalizeSegment(genderSuffix, form)}${stemSuffix}.${extension}`);
      return `/data/sprite/${segments.join("/")}`;
    };

    const createPalettePath = (paletteName, form) => {
      const folders = outfitIndex > 0 ? `${paletteRoot.body}/${OUTFIT_FOLDER_PREFIX}${outfitIndex}` : paletteRoot.body;
      const outfitSuffix = outfitIndex > 0 ? `_${outfitIndex}` : "";
      return normalizePath(
        `/data/palette/${folders}/${paletteName}_${genderSuffix}_${bodyPaletteIndex}${outfitSuffix}.pal`,
        form
      );
    };

    return {
      outfit: outfitIndex,
      name,
      spritePathCandidates: createPathCandidates((form) => createPath("spr", form)),
      actPathCandidates: createPathCandidates((form) => createPath("act", form)),
      palettePathCandidates:
        bodyPaletteIndex > 0
          ? paletteNames.flatMap((paletteName) => createPathCandidates((form) => createPalettePath(paletteName, form)))
          : [],
      imfPathCandidates: createImfCandidates([...new Set([...imfNames, ...sprite.imfNames])]),
    };
  };

  const regularImfNames = sprite.imfNames;
  const regularBody = createBodyVariant({
    name: sprite.name,
    paletteNames: getPaletteNames(sprite.name),
    imfNames: regularImfNames,
  });

  // Outfit sources in priority order. A 4th class (or mount) uses the costume of its 3rd class counterpart;
  // jobs without a costume sprite fall through to the regular body.
  const bodyVariants = [];
  if (outfit > 0 && sprite.race !== RACE_DORAM) {
    if (sprite.outfitBaseName) {
      bodyVariants.push(
        createBodyVariant({
          name: sprite.outfitBaseName,
          outfitIndex: outfit,
          stemSuffix: `_${outfit}`,
          paletteNames: getPaletteNames(sprite.outfitBaseName),
          imfNames: [sprite.outfitBaseName],
        })
      );
    }
    const ownPaletteNames = getPaletteNames(sprite.name);
    bodyVariants.push(
      createBodyVariant({
        name: sprite.name,
        outfitIndex: outfit,
        stemSuffix: `_${outfit}`,
        paletteNames: ownPaletteNames,
        imfNames: regularImfNames,
      }),
      createBodyVariant({
        name: sprite.name,
        outfitIndex: outfit,
        paletteNames: ownPaletteNames,
        imfNames: regularImfNames,
      })
    );
  }
  bodyVariants.push(regularBody);

  const createHeadPalettePath = (form) =>
    normalizePath(`/data/palette/${paletteRoot.head}/머리${headId}_${genderSuffix}_${headPaletteIndex}.pal`, form);

  return {
    characterType: "player",
    jobId: sprite.jobId,
    jobName: sprite.name,
    race: sprite.race,
    isDoram: sprite.race === RACE_DORAM,
    gender: sprite.gender,
    imfPathCandidates: createImfCandidates(regularImfNames),
    headgear: resolveHeadgearAssets(character, sprite, headgearManifest),
    garment: resolveGarmentAssets(character, sprite, garmentManifest),
    bodyVariants,
    bodySpritePathCandidates: regularBody.spritePathCandidates,
    bodyActPathCandidates: regularBody.actPathCandidates,
    headSpritePathCandidates: createPathCandidates((form) => createHeadPath("spr", form)),
    headActPathCandidates: createPathCandidates((form) => createHeadPath("act", form)),
    headPalettePathCandidates: headPaletteIndex > 0 ? createPathCandidates(createHeadPalettePath) : [],
  };
}
