import { decodeStr } from "./strDecoder";
import { decodeEffectTexture } from "./textureDecoder";
import { fetchArrayBuffer } from "./spritePreview";

// STR coordinates are authored for a 640x480 client view. An item's textureOffsetX/Y shifts the effect
// from the origin below onto the character's feet:
//   offset from feet = (pos.x - STR_ORIGIN_X + textureOffsetX, pos.y - STR_ORIGIN_Y + textureOffsetY)
export const STR_ORIGIN_X = 320;
export const STR_ORIGIN_Y = 290;
// Angles are stored in 1/1024ths of a full turn.
const ANGLE_UNITS_PER_DEGREE = 1024 / 360;
// D3D blend factors: 2 = ONE, 7 = DESTALPHA (the client's back buffer is opaque, so both add light).
const ADDITIVE_DEST_BLENDS = new Set([2, 7]);

function toDataPath(path) {
  const normalized = String(path).replace(/\\/g, "/").replace(/^\/+/, "");
  return `/data/${normalized}`;
}

// Client file names are case-insensitive; the files on disk are lower case.
function withLowerCase(paths) {
  return [...new Set(paths.flatMap((path) => [path, path.toLowerCase()]))];
}

const effectCache = new Map();

// Loads and decodes a STR effect plus every texture it references. Missing textures are skipped
// (their layers simply do not draw).
export function loadStrEffect(texturePath) {
  const strPath = toDataPath(texturePath);
  if (effectCache.has(strPath)) {
    return effectCache.get(strPath);
  }

  const promise = (async () => {
    const strFile = await fetchArrayBuffer(withLowerCase([strPath]));
    if (!strFile.ok) {
      return { ok: false, reason: `STR not found: ${strPath}` };
    }

    let str;
    try {
      str = decodeStr(strFile.buffer);
    } catch (error) {
      return { ok: false, reason: error.message };
    }

    const baseDirectory = strPath.slice(0, strPath.lastIndexOf("/"));
    const names = new Set(str.layers.flatMap((layer) => layer.textures));
    const textures = new Map();
    await Promise.all(
      [...names].map(async (name) => {
        const cleanName = name.replace(/\\/g, "/");
        const file = await fetchArrayBuffer(
          withLowerCase([`${baseDirectory}/${cleanName}`, `/data/texture/effect/${cleanName}`])
        );
        if (!file.ok) {
          return;
        }
        try {
          textures.set(name, decodeEffectTexture(name, file.buffer));
        } catch {
          // Unsupported/corrupt texture: leave the layer blank.
        }
      })
    );

    return { ok: true, str, textures };
  })();

  effectCache.set(strPath, promise);
  promise.then((result) => {
    if (!result.ok) {
      effectCache.delete(strPath);
    }
  });
  return promise;
}

// `items` are equipped item records; those with a `texture` (.str path) get an effect entry.
export async function loadTextureEffects(items) {
  const unique = new Map();
  for (const item of items || []) {
    if (item?.texture && !unique.has(item.id)) {
      unique.set(item.id, item);
    }
  }

  const effects = await Promise.all(
    [...unique.values()].map(async (item) => {
      const effect = await loadStrEffect(item.texture);
      if (!effect.ok) {
        console.warn(`[texture ${item.id}] effect failed:`, effect.reason);
        return null;
      }
      return {
        itemId: item.id,
        garment: Boolean(item.garment),
        str: effect.str,
        textures: effect.textures,
        offsetX: Number(item.textureOffsetX) || 0,
        offsetY: Number(item.textureOffsetY) || 0,
      };
    })
  );
  return effects.filter(Boolean);
}

function wrapIndex(value, count) {
  return ((Math.floor(value) % count) + count) % count;
}

// Resolves one layer at `keyIndex`. A type 0 key is an absolute state; the type 1 key right after it holds
// per-frame deltas. Returns null while the layer is not visible.
export function sampleStrLayer(layer, keyIndex) {
  const { keys, textures } = layer;
  if (keys.length === 0 || textures.length === 0) {
    return null;
  }

  let fromId = -1;
  for (let index = 0; index < keys.length; index += 1) {
    const key = keys[index];
    if (key.type === 0 && key.frame <= keyIndex && (fromId < 0 || key.frame >= keys[fromId].frame)) {
      fromId = index;
    }
  }
  if (fromId < 0) {
    return null;
  }

  const from = keys[fromId];
  const next = keys[fromId + 1]?.type === 1 ? keys[fromId + 1] : null;
  const delta = next ? keyIndex - from.frame : 0;
  const mix = (base, change) => (next ? base + change * delta : base);

  let frame = from.aniframe;
  if (next) {
    const count = textures.length;
    switch (from.anitype) {
      case 1:
        frame = from.aniframe + next.aniframe * delta;
        break;
      case 2:
        frame = Math.min(from.aniframe + from.delay * delta, count - 1);
        break;
      case 3:
        frame = from.aniframe + from.delay * delta;
        break;
      case 4:
        frame = from.aniframe - from.delay * delta;
        break;
      default:
        break;
    }
  }

  const xs = [0, 1, 2, 3].map((index) => mix(from.xy[index], next ? next.xy[index] : 0));
  const ys = [4, 5, 6, 7].map((index) => mix(from.xy[index], next ? next.xy[index] : 0));
  const color = from.color.map((value, index) =>
    Math.min(255, Math.max(0, mix(value, next ? next.color[index] : 0)))
  );

  return {
    x: mix(from.pos[0], next ? next.pos[0] : 0),
    y: mix(from.pos[1], next ? next.pos[1] : 0),
    angleDegrees: mix(from.angle, next ? next.angle : 0) / ANGLE_UNITS_PER_DEGREE,
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
    // Corner order is TL, TR, BR, BL; a reversed edge means the quad is mirrored.
    flipX: xs[0] > xs[1],
    flipY: ys[0] > ys[3],
    color,
    textureIndex: wrapIndex(frame, textures.length),
    additive: ADDITIVE_DEST_BLENDS.has(from.destBlend),
  };
}
