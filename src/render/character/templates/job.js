import { resolveCharacterAssetPaths } from "../resolver";
import { loadCharacterParts } from "../spritePreview";

let headgearManifestPromise = null;

// ~95 KB manifest; loaded lazily into its own chunk the first time a headgear is equipped.
function loadHeadgearManifest() {
  if (!headgearManifestPromise) {
    headgearManifestPromise = import(/* webpackChunkName: "headgear-sprites" */ "@/db/headgearSprites.json")
      .then((module) => module.default || module)
      .catch((error) => {
        headgearManifestPromise = null;
        console.warn("[headgear] manifest failed to load:", error);
        return null;
      });
  }
  return headgearManifestPromise;
}

let garmentManifestPromise = null;

// Small manifest (garment view id -> robe folder), also loaded lazily on first use.
function loadGarmentManifest() {
  if (!garmentManifestPromise) {
    garmentManifestPromise = import(/* webpackChunkName: "garment-sprites" */ "@/db/garmentSprites.json")
      .then((module) => module.default || module)
      .catch((error) => {
        garmentManifestPromise = null;
        console.warn("[garment] manifest failed to load:", error);
        return null;
      });
  }
  return garmentManifestPromise;
}

export async function createJobTemplate(character) {
  const hasHeadgear = Array.isArray(character.headgear) && character.headgear.some((viewId) => Number(viewId) > 0);
  const hasGarment = Number(character.garment) > 0;
  const [headgear, garment] = await Promise.all([
    hasHeadgear ? loadHeadgearManifest() : null,
    hasGarment ? loadGarmentManifest() : null,
  ]);

  const resolvedAssets = resolveCharacterAssetPaths(character, { headgear, garment });
  const rendered = await loadCharacterParts(resolvedAssets, character);

  if (!rendered.ok) {
    console.warn(`[job ${resolvedAssets.jobId}] render failed:`, rendered.reason);
  }

  return {
    id: `template-job-${resolvedAssets.jobId}`,
    jobKey: resolvedAssets.jobName,
    character,
    resolvedAssets,
    rendered,
  };
}
