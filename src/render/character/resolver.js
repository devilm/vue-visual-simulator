const GENDER_SUFFIX = {
  male: "남",
  female: "여",
};

const JOB_NAME_BY_ID = {
  0: "초보자",
};

const HUMAN_RACE_FOLDER = "인간족";
const BODY_FOLDER = "몸통";
const HEAD_FOLDER = "머리통";

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

export function resolveJobName(jobId) {
  return JOB_NAME_BY_ID[Number(jobId)] || "";
}

export function resolveNoviceAssetPaths(character) {
  const normalizedGender = normalizeGender(character.gender);
  const genderSuffix = toSpriteGenderSuffix(character.gender);
  const jobName = JOB_NAME_BY_ID[0];

  const createBodyPath = (extension, form) => {
    const race = normalizeSegment(HUMAN_RACE_FOLDER, form);
    const body = normalizeSegment(BODY_FOLDER, form);
    const gender = normalizeSegment(genderSuffix, form);
    const job = normalizeSegment(jobName, form);

    return `/data/sprite/${race}/${body}/${gender}/${job}_${gender}.${extension}`;
  };

  const createImfPath = (form) => {
    const job = normalizeSegment(jobName, form);
    const gender = normalizeSegment(genderSuffix, form);

    return `/data/imf/${job}_${gender}.imf`;
  };

  const createHeadPath = (extension, form) => {
    const race = normalizeSegment(HUMAN_RACE_FOLDER, form);
    const head = normalizeSegment(HEAD_FOLDER, form);
    const gender = normalizeSegment(genderSuffix, form);
    const headId = Math.max(1, Number(character.head) || 1);

    return `/data/sprite/${race}/${head}/${gender}/${headId}_${gender}.${extension}`;
  };

  const headSpriteCandidates = createPathCandidates((form) => createHeadPath("spr", form));
  const headActCandidates = createPathCandidates((form) => createHeadPath("act", form));
  const bodySpriteCandidates = createPathCandidates((form) => createBodyPath("spr", form));
  const bodyActCandidates = createPathCandidates((form) => createBodyPath("act", form));
  const imfCandidates = createPathCandidates(createImfPath);

  return {
    characterType: "player",
    jobId: 0,
    jobName,
    gender: normalizedGender,
    imfPathCandidates: imfCandidates,
    bodySpritePathCandidates: bodySpriteCandidates,
    bodyActPathCandidates: bodyActCandidates,
    headSpritePathCandidates: headSpriteCandidates,
    headActPathCandidates: headActCandidates,
  };
}
