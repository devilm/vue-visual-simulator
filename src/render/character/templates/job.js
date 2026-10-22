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

export async function createJobTemplate(character) {
  const hasHeadgear = Array.isArray(character.headgear) && character.headgear.some((viewId) => Number(viewId) > 0);
  const manifest = hasHeadgear ? await loadHeadgearManifest() : null;

  const resolvedAssets = resolveCharacterAssetPaths(character, manifest);
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
