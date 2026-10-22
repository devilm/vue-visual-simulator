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

export function resolveCharacterAssetPaths(character) {
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
    bodySpritePathCandidates: createPathCandidates((form) => createBodyPath("spr", form)),
    bodyActPathCandidates: createPathCandidates((form) => createBodyPath("act", form)),
    headSpritePathCandidates: createPathCandidates((form) => createHeadPath("spr", form)),
    headActPathCandidates: createPathCandidates((form) => createHeadPath("act", form)),
  };
}
