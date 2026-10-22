import { resolveCharacterAssetPaths } from "../resolver";
import { loadCharacterParts } from "../spritePreview";

export async function createJobTemplate(character) {
  const resolvedAssets = resolveCharacterAssetPaths(character);
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
