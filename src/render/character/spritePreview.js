import { decodeSpr } from "./sprDecoder";
import { decodeAct } from "./actDecoder";
import { decodeImf, getImfDrawOrder, getImfFrame } from "./imfDecoder";

const BODY_LAYER = 0;
const HEAD_LAYER = 1;

function withRelativeFallback(path) {
  const relative = path.startsWith("/") ? path.slice(1) : path;
  return relative === path ? [path] : [path, relative];
}

async function fetchArrayBuffer(pathCandidates) {
  for (const pathCandidate of pathCandidates) {
    for (const candidate of withRelativeFallback(pathCandidate)) {
      try {
        const response = await fetch(candidate);
        if (!response.ok) {
          continue;
        }
        const buffer = await response.arrayBuffer();
        // Dev server may return index.html for missing files; ensure it is binary data.
        const head = new Uint8Array(buffer, 0, Math.min(2, buffer.byteLength));
        if (head.length < 2 || head[0] === 0x3c) {
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

const sheetCache = new Map();

export async function loadSpriteSheet(sprCandidates, actCandidates) {
  const cacheKey = `${sprCandidates[0]}|${actCandidates[0]}`;
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
      const spr = decodeSpr(sprResult.buffer);
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

function motionToParts(sheet, motion, offset) {
  const parts = [];
  for (const layer of motion.layers) {
    if (layer.sprIndex < 0) {
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
  const bodySheet = await loadSpriteSheet(
    resolvedAssets.bodySpritePathCandidates,
    resolvedAssets.bodyActPathCandidates
  );

  if (!bodySheet.ok) {
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
    resolvedAssets.headActPathCandidates
  );

  const imf = await loadImf(resolvedAssets.imfPathCandidates);

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
            ...motionToParts(sheet, gearMotion, {
              x: gearOffset.x + headImf.x,
              y: gearOffset.y + headImf.y,
            })
          );
        }
      }
    }

    // Back-to-front order from IMF priority (without IMF: body first, head on top).
    const layerIds = Object.keys(layerParts).map(Number);
    const drawOrder = imf ? getImfDrawOrder(imf, layerIds, actionIndex, frameIndex) : layerIds;
    frames.push(drawOrder.flatMap((layerId) => layerParts[layerId]));
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
      imfLoaded: Boolean(imf),
      bodyActVersion: bodySheet.act.version,
      bodySprVersion: bodySheet.spr.version,
    },
  };
}
