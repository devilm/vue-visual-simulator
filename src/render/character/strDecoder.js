// Ragnarok STR (effect script) decoder.
// Header: "STRM", version(u32), fps(u32), maxKey(u32), layerCount(u32), reserved(16 bytes)
// Layer:  textureCount(i32), textureCount * name(128 bytes), keyCount(i32), keys...
// Key (124 bytes): frame(i32) type(u32) pos(f32 x2) uv(f32 x8) xy(f32 x8: x0..x3, y0..y3)
//                  aniframe(f32) anitype(u32) delay(f32) angle(f32) color(f32 x4 RGBA 0-255)
//                  srcBlend(u32) destBlend(u32) mtPreset(u32)
// Key type 0 is an absolute state; a following type 1 key holds the per-frame deltas applied to it.

const STR_SIGNATURE = 0x4d525453; // "STRM" read as little endian
const HEADER_SIZE = 36;
const TEXTURE_NAME_LENGTH = 128;
const KEY_SIZE = 124;

export function decodeStr(arrayBuffer) {
  const view = new DataView(arrayBuffer);
  if (arrayBuffer.byteLength < HEADER_SIZE || view.getUint32(0, true) !== STR_SIGNATURE) {
    throw new Error("Invalid STR signature");
  }

  let cursor = 4;
  const readUint = () => {
    const value = view.getUint32(cursor, true);
    cursor += 4;
    return value;
  };
  const readInt = () => {
    const value = view.getInt32(cursor, true);
    cursor += 4;
    return value;
  };
  const readFloat = () => {
    const value = view.getFloat32(cursor, true);
    cursor += 4;
    return value;
  };
  const readFloats = (count) => Array.from({ length: count }, readFloat);
  const ensure = (byteCount) => {
    if (cursor + byteCount > arrayBuffer.byteLength) {
      throw new Error("Truncated STR file");
    }
  };

  const version = readUint();
  const fps = readUint() || 60;
  const maxKey = readUint();
  const layerCount = readUint();
  cursor += 16;

  const layers = [];
  for (let layerIndex = 0; layerIndex < layerCount; layerIndex += 1) {
    ensure(4);
    const textureCount = readInt();
    ensure(textureCount * TEXTURE_NAME_LENGTH + 4);

    const textures = [];
    for (let textureIndex = 0; textureIndex < textureCount; textureIndex += 1) {
      let name = "";
      for (let index = 0; index < TEXTURE_NAME_LENGTH; index += 1) {
        const code = view.getUint8(cursor + index);
        if (code === 0) {
          break;
        }
        name += String.fromCharCode(code);
      }
      cursor += TEXTURE_NAME_LENGTH;
      textures.push(name);
    }

    const keyCount = readInt();
    ensure(keyCount * KEY_SIZE);

    const keys = [];
    for (let keyIndex = 0; keyIndex < keyCount; keyIndex += 1) {
      keys.push({
        frame: readInt(),
        type: readUint(),
        pos: readFloats(2),
        uv: readFloats(8),
        xy: readFloats(8),
        aniframe: readFloat(),
        anitype: readUint(),
        delay: readFloat(),
        angle: readFloat(),
        color: readFloats(4),
        srcBlend: readUint(),
        destBlend: readUint(),
        mtPreset: readUint(),
      });
    }

    layers.push({ textures, keys });
  }

  return { version, fps, maxKey, layers };
}
