// Ragnarok Online ACT decoder (versions 2.0 - 2.5).
// Header: "AC", minor(u8), major(u8), actionCount(u16), reserved(10 bytes)
// Action: motionCount(u32), motions...
// Motion: range(32 bytes), layerCount(u32), layers..., eventId(i32 v>=2.0),
//         anchorCount(i32 v>=2.3), anchors(16 bytes each)
// Layer: x(i32) y(i32) sprIndex(i32) mirror(i32)
//        [v>=2.0: color(rgba u8x4) xScale(f32) [v>=2.4: yScale(f32)] rotation(i32) sprType(i32)]
//        [v>=2.5: width(i32) height(i32)]

const DEFAULT_INTERVAL_MS = 4 * 24;

export function decodeAct(arrayBuffer) {
  const view = new DataView(arrayBuffer);
  if (arrayBuffer.byteLength < 16 || view.getUint8(0) !== 0x41 || view.getUint8(1) !== 0x43) {
    throw new Error("Invalid ACT signature");
  }

  const minor = view.getUint8(2);
  const major = view.getUint8(3);
  const version = major * 100 + minor;
  const actionCount = view.getUint16(4, true);
  let cursor = 16;

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

  const readFixedString = (length) => {
    let text = "";
    for (let index = 0; index < length; index += 1) {
      const code = view.getUint8(cursor + index);
      if (code === 0) {
        break;
      }
      text += String.fromCharCode(code);
    }
    cursor += length;
    return text;
  };

  const actions = [];
  for (let actionIndex = 0; actionIndex < actionCount; actionIndex += 1) {
    const motionCount = readInt();
    const motions = [];

    for (let motionIndex = 0; motionIndex < motionCount; motionIndex += 1) {
      cursor += 32; // range1 + range2

      const layerCount = readInt();
      const layers = [];

      for (let layerIndex = 0; layerIndex < layerCount; layerIndex += 1) {
        const layer = {
          x: readInt(),
          y: readInt(),
          sprIndex: readInt(),
          mirror: readInt() !== 0,
          color: [255, 255, 255, 255],
          xScale: 1,
          yScale: 1,
          rotation: 0,
          sprType: 0,
        };

        if (version >= 200) {
          layer.color = [
            view.getUint8(cursor),
            view.getUint8(cursor + 1),
            view.getUint8(cursor + 2),
            view.getUint8(cursor + 3),
          ];
          cursor += 4;
          layer.xScale = readFloat();
          layer.yScale = version >= 204 ? readFloat() : layer.xScale;
          layer.rotation = readInt();
          layer.sprType = readInt();
        }

        if (version >= 205) {
          cursor += 8; // width, height
        }

        layers.push(layer);
      }

      let eventId = -1;
      if (version >= 200) {
        eventId = readInt();
      }

      const anchors = [];
      if (version >= 203) {
        const anchorCount = readInt();
        for (let anchorIndex = 0; anchorIndex < anchorCount; anchorIndex += 1) {
          cursor += 4; // unknown
          const x = readInt();
          const y = readInt();
          cursor += 4; // attribute
          anchors.push({ x, y });
        }
      }

      motions.push({ layers, anchors, eventId });
    }

    actions.push({ motions, interval: DEFAULT_INTERVAL_MS });
  }

  // Sound table (v>=2.1): count(i32) + count * 40-byte strings.
  const sounds = [];
  if (version >= 201 && cursor + 4 <= arrayBuffer.byteLength) {
    const soundCount = readInt();
    for (let soundIndex = 0; soundIndex < soundCount; soundIndex += 1) {
      sounds.push(readFixedString(40));
    }
  }

  // Per-action frame interval (v>=2.2): float32, in units of 24ms.
  if (version >= 202) {
    for (const action of actions) {
      if (cursor + 4 > arrayBuffer.byteLength) {
        break;
      }
      const interval = readFloat();
      action.interval = interval > 0 ? interval * 24 : DEFAULT_INTERVAL_MS;
    }
  }

  return {
    version: `${major}.${minor}`,
    actionCount,
    actions,
    sounds,
  };
}
