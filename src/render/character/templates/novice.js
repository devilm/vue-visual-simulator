import { resolveNoviceAssetPaths } from "../resolver";
import { loadCharacterParts } from "../spritePreview";

export async function createNoviceTemplate(character) {
  const resolvedAssets = resolveNoviceAssetPaths(character);
  const rendered = await loadCharacterParts(resolvedAssets, character);

  if (!rendered.ok) {
    console.warn("[novice] render failed:", rendered.reason);
  }

  return {
    id: "template-novice",
    jobKey: "novice",
    character,
    resolvedAssets,
    rendered,
  };
}
