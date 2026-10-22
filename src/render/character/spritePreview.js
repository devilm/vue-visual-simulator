import { decodeSpr } from "./sprDecoder";
import { decodeAct } from "./actDecoder";
import { decodeImf, getImfDrawOrder, getImfFrame } from "./imfDecoder";

const BODY_LAYER = 0;
const HEAD_LAYER = 1;
// Action direction (action % 8): 0 S, 1 SW, 2 W, 3 NW, 4 N, 5 NE, 6 E, 7 SE.
const GARMENT_OVER_BODY_DIRECTIONS = new Set([3, 4, 5]);

function withRelativeFallback(path) {
  const relative = path.startsWith("/") ? path.slice(1) : path;
  return relative === path ? [path] : [path, relative];
}

async function fetchArrayBuffer(pathCandidates, { accept = isBinaryData } = {}) {
  for (const pathCandidate of pathCandidates) {
    for (const candidate of withRelativeFallback(pathCandidate)) {
      try {
        const response = await fetch(candidate);
        if (!response.ok) {
          continue;
        }
        const buffer = await response.arrayBuffer();
        if (!accept(buffer)) {
          continue;
        }
        return { ok: true, path: candidate, buffer };
      } catch {
        continue;
      }
    }
  }
  return { ok: false, path: pathCandidates[0], buffer: null };
}

// Dev server may return index.html for missing files; ensure it is binary data.
function isBinaryData(buffer) {
  const head = new Uint8Array(buffer, 0, Math.min(2, buffer.byteLength));
  return head.length >= 2 && head[0] !== 0x3c;
}

const PALETTE_BYTE_LENGTH = 1024;
const paletteCache = new Map();

// Loads the first available .pal (256 * RGBA) from the candidates; null means "keep the SPR's own palette".
export async function loadPalette(paletteCandidates) {
  if (!paletteCandidates || paletteCandidates.length === 0) {
    return null;
  }
  const cacheKey = paletteCandidates.join("|");
  if (paletteCache.has(cacheKey)) {
    return paletteCache.get(cacheKey);
  }

  const promise = (async () => {
    const result = await fetchArrayBuffer(paletteCandidates, {
      // Raw palettes have no signature, so they are validated by length instead.
      accept: (buffer) => buffer.byteLength === PALETTE_BYTE_LENGTH,
    });
    if (!result.ok) {
      return null;
    }
    return { path: result.path, bytes: new Uint8Array(result.buffer) };
  })();

  paletteCache.set(cacheKey, promise);
  return promise;
}

const sheetCache = new Map();

// `paletteCandidates` (optional) recolours the indexed frames; the first existing file wins.
export async function loadSpriteSheet(sprCandidates, actCandidates, paletteCandidates = []) {
  const palette = await loadPalette(paletteCandidates);
  const cacheKey = `${sprCandidates[0]}|${actCandidates[0]}|${palette ? palette.path : ""}`;
  if (sheetCache.has(cacheKey)) {
    return sheetCache.get(cacheKey);
  }

  const promise = (async () => {
    const [sprResult, actResult] = await Promise.all([
      fetchArrayBuffer(sprCandidates),
      fetchArrayBuffer(actCandidates),
    ]);

    if (!sprResult.ok || !actResult.ok) {
      return {
        ok: false,
        reason: !sprResult.ok ? `SPR not found: ${sprResult.path}` : `ACT not found: ${actResult.path}`,
      };
    }

    try {
      const spr = decodeSpr(sprResult.buffer, { paletteBytes: palette ? palette.bytes : null });
      const act = decodeAct(actResult.buffer);
      return { ok: true, sprPath: sprResult.path, actPath: actResult.path, spr, act };
    } catch (error) {
      return { ok: false, reason: error.message };
    }
  })();

  sheetCache.set(cacheKey, promise);
  const result = await promise;
  if (!result.ok) {
    sheetCache.delete(cacheKey);
  }
  return result;
}

const imfCache = new Map();

// IMF only defines layer draw order; a missing/invalid file falls back to body-then-head.
export async function loadImf(imfCandidates) {
  if (!imfCandidates || imfCandidates.length === 0) {
    return null;
  }
  const cacheKey = imfCandidates[0];
  if (imfCache.has(cacheKey)) {
    return imfCache.get(cacheKey);
  }

  const promise = (async () => {
    const result = await fetchArrayBuffer(imfCandidates);
    if (!result.ok) {
      return null;
    }
    try {
      return decodeImf(result.buffer);
    } catch {
      return null;
    }
  })();

  imfCache.set(cacheKey, promise);
  const imf = await promise;
  if (!imf) {
    imfCache.delete(cacheKey);
  }
  return imf;
}

function resolveMotion(sheet, actionIndex, motionIndex) {
  const actions = sheet.act.actions;
  const action = actions[actionIndex] || actions[0];
  if (!action || action.motions.length === 0) {
    return null;
  }
  return action.motions[motionIndex % action.motions.length] || action.motions[0];
}

// Headgear ACTs hide a layer for views where the hat should not show (e.g. facing away) by moving it
// far below the character (y ~ 235-300). Headgear never legitimately sits that far under the feet.
const HIDDEN_LAYER_MIN_Y = 150;
const HIDDEN_LAYER_MIN_X = 200;

function motionToParts(sheet, motion, offset, { skipHidden = false } = {}) {
  const parts = [];
  for (const layer of motion.layers) {
    if (layer.sprIndex < 0) {
      continue;
    }
    if (skipHidden && (layer.y >= HIDDEN_LAYER_MIN_Y || Math.abs(layer.x) >= HIDDEN_LAYER_MIN_X)) {
      continue;
    }
    const frames = layer.sprType === 1 ? sheet.spr.rgbaFrames : sheet.spr.indexedFrames;
    const frame = frames[layer.sprIndex];
    if (!frame || frame.width === 0 || frame.height === 0) {
      continue;
    }
    parts.push({
      frame,
      x: layer.x + offset.x,
      y: layer.y + offset.y,
      mirror: layer.mirror,
      xScale: layer.xScale,
      yScale: layer.yScale,
      rotation: layer.rotation,
      color: layer.color,
    });
  }
  return parts;
}

// Builds a flat list of drawable parts (body + head) for the requested pose.
export async function loadCharacterParts(resolvedAssets, character) {
  // Body sources in priority order (outfit sprites first, regular body last); the first one that loads wins.
  const bodyVariants = resolvedAssets.bodyVariants?.length
    ? resolvedAssets.bodyVariants
    : [
        {
          spritePathCandidates: resolvedAssets.bodySpritePathCandidates,
          actPathCandidates: resolvedAssets.bodyActPathCandidates,
          palettePathCandidates: [],
          imfPathCandidates: resolvedAssets.imfPathCandidates,
        },
      ];

  let bodySheet = null;
  let bodyVariant = null;
  for (const variant of bodyVariants) {
    const sheet = await loadSpriteSheet(
      variant.spritePathCandidates,
      variant.actPathCandidates,
      variant.palettePathCandidates
    );
    if (sheet.ok) {
      bodySheet = sheet;
      bodyVariant = variant;
      break;
    }
    bodySheet = sheet;
  }

  if (!bodyVariant) {
    return { ok: false, reason: bodySheet.reason, parts: [] };
  }

  const actionIndex = Math.max(0, Number(character?.action ?? 0));
  const direction = actionIndex % 8;
  const actionType = Math.floor(actionIndex / 8);
  // Head turn (0 front, 1 right, 2 left) only applies to idle (0) and sit (2) poses.
  const headTurn = actionType === 0 || actionType === 2 ? Number(character?.headdir ?? 0) : 0;
  // Idle/sit are static poses; every other action plays through all body motions.
  const isStaticPose = actionType === 0 || actionType === 2;

  const bodyAction = bodySheet.act.actions[actionIndex] || bodySheet.act.actions[0];
  if (!bodyAction || bodyAction.motions.length === 0) {
    return { ok: false, reason: "Body motion not found", parts: [], frames: [] };
  }

  const headSheet = await loadSpriteSheet(
    resolvedAssets.headSpritePathCandidates,
    resolvedAssets.headActPathCandidates,
    resolvedAssets.headPalettePathCandidates
  );

  const imf = await loadImf(bodyVariant.imfPathCandidates);

  // Headgear shares the head's ACT layout (same actions/motions) and is drawn together with the head layer.
  const headgearSheets = headSheet.ok
    ? (
        await Promise.all(
          (resolvedAssets.headgear || []).map(async (entry) => ({
            entry,
            sheet: await loadSpriteSheet(entry.spritePathCandidates, entry.actPathCandidates),
          }))
        )
      ).filter(({ sheet }) => sheet.ok)
    : [];

  const garmentAssets = resolvedAssets.garment;
  const garmentLoaded = garmentAssets
    ? await loadSpriteSheet(garmentAssets.spritePathCandidates, garmentAssets.actPathCandidates)
    : null;
  const garmentSheet = garmentLoaded?.ok ? garmentLoaded : null;
  // Robes hang behind the body when the character faces the camera and cover it when facing away
  // (NW/N/NE). The ACT shares the body's origin and anchors, so only the body IMF offset applies.
  const garmentOnTop = GARMENT_OVER_BODY_DIRECTIONS.has(direction);

  const frameCount = isStaticPose ? 1 : bodyAction.motions.length;
  const frames = [];
  let headOk = false;

  for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
    const bodyMotion = resolveMotion(bodySheet, actionIndex, frameIndex);
    const bodyImf = getImfFrame(imf, BODY_LAYER, actionIndex, frameIndex);
    const layerParts = {
      [BODY_LAYER]: motionToParts(bodySheet, bodyMotion, { x: bodyImf.x, y: bodyImf.y }),
    };

    if (headSheet.ok) {
      const headMotion = resolveMotion(headSheet, actionIndex, isStaticPose ? headTurn : frameIndex);
      if (headMotion) {
        const headImf = getImfFrame(imf, HEAD_LAYER, actionIndex, frameIndex);
        const bodyAnchor = bodyMotion.anchors[0];
        const headAnchor = headMotion.anchors[0];
        const offset =
          bodyAnchor && headAnchor
            ? { x: bodyAnchor.x - headAnchor.x, y: bodyAnchor.y - headAnchor.y }
            : { x: 0, y: 0 };
        layerParts[HEAD_LAYER] = motionToParts(headSheet, headMotion, {
          x: offset.x + headImf.x,
          y: offset.y + headImf.y,
        });
        headOk = true;

        for (const { sheet } of headgearSheets) {
          const gearMotion = resolveMotion(sheet, actionIndex, isStaticPose ? headTurn : frameIndex);
          if (!gearMotion) {
            continue;
          }
          // Same attachment rule as the head: align the headgear anchor with the body anchor.
          const gearAnchor = gearMotion.anchors[0];
          const gearOffset =
            bodyAnchor && gearAnchor
              ? { x: bodyAnchor.x - gearAnchor.x, y: bodyAnchor.y - gearAnchor.y }
              : offset;
          layerParts[HEAD_LAYER].push(
            ...motionToParts(
              sheet,
              gearMotion,
              {
                x: gearOffset.x + headImf.x,
                y: gearOffset.y + headImf.y,
              },
              { skipHidden: true }
            )
          );
        }
      }
    }

    // Back-to-front order from IMF priority (without IMF: body first, head on top).
    const layerIds = Object.keys(layerParts).map(Number);
    const drawOrder = imf ? getImfDrawOrder(imf, layerIds, actionIndex, frameIndex) : layerIds;
    const frameParts = drawOrder.flatMap((layerId) => layerParts[layerId]);

    if (garmentSheet) {
      const garmentMotion = resolveMotion(garmentSheet, actionIndex, frameIndex);
      if (garmentMotion) {
        const garmentParts = motionToParts(
          garmentSheet,
          garmentMotion,
          { x: bodyImf.x, y: bodyImf.y },
          { skipHidden: true }
        );
        if (garmentOnTop) {
          frameParts.push(...garmentParts);
        } else {
          frameParts.unshift(...garmentParts);
        }
      }
    }

    frames.push(frameParts);
  }

  const parts = frames[0];
  const bodyMotionIndex = 0;
  const headMotionIndex = isStaticPose ? headTurn : 0;

  return {
    ok: parts.length > 0,
    reason: parts.length > 0 ? "" : "No drawable layers",
    parts,
    frames,
    interval: bodyAction.interval || 96,
    meta: {
      direction,
      actionIndex,
      bodyMotionIndex,
      headMotionIndex,
      headOk,
      headgearCount: headgearSheets.length,
      garmentLoaded: Boolean(garmentSheet),
      imfLoaded: Boolean(imf),
      outfit: bodyVariant.outfit || 0,
      bodyActVersion: bodySheet.act.version,
      bodySprVersion: bodySheet.spr.version,
    },
  };
}
