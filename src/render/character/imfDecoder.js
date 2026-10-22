// Ragnarok Online IMF decoder.
// Header: version(f32), checksum(i32), maxLayer(i32)  -> layerCount = maxLayer + 1
// Layer:  actionCount(i32), actions...
// Action: frameCount(i32), frames...
// Frame:  priority(i32), cx(i32), cy(i32)
//
// Layer 0 is the body, layer 1 is the head (additional layers are accessories).
// A layer with a LOWER priority value is drawn on top of layers with higher values;
// e.g. idle poses use body=1 / head=0 so the head ends up in front of the body.

export function decodeImf(arrayBuffer) {
  const view = new DataView(arrayBuffer);
  if (arrayBuffer.byteLength < 12) {
    throw new Error("Invalid IMF file");
  }

  const version = view.getFloat32(0, true);
  const layerCount = view.getInt32(8, true) + 1;
  if (!(version > 0 && version < 10) || layerCount < 1 || layerCount > 32) {
    throw new Error("Invalid IMF header");
  }

  let cursor = 12;
  const readInt = () => {
    if (cursor + 4 > arrayBuffer.byteLength) {
      throw new Error("Unexpected end of IMF file");
    }
    const value = view.getInt32(cursor, true);
    cursor += 4;
    return value;
  };

  const layers = [];
  for (let layerIndex = 0; layerIndex < layerCount; layerIndex += 1) {
    const actionCount = readInt();
    const actions = [];
    for (let actionIndex = 0; actionIndex < actionCount; actionIndex += 1) {
      const frameCount = readInt();
      const frames = [];
      for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
        const priority = readInt();
        const x = readInt();
        const y = readInt();
        frames.push({ priority, x, y });
      }
      actions.push(frames);
    }
    layers.push(actions);
  }

  return {
    version: version.toFixed(2),
    layerCount,
    layers,
  };
}

// Returns { priority, x, y } for a layer at (action, frame); falls back to the last
// frame of the action and then to a neutral value when data is missing.
export function getImfFrame(imf, layerIndex, actionIndex, frameIndex) {
  const frames = imf?.layers[layerIndex]?.[actionIndex];
  if (!frames || frames.length === 0) {
    return { priority: layerIndex === 0 ? 1 : 0, x: 0, y: 0 };
  }
  return frames[Math.min(frameIndex, frames.length - 1)];
}

// Orders layer ids back-to-front: higher priority values are drawn first.
// Ties keep the layer order (stable sort).
export function getImfDrawOrder(imf, layerIds, actionIndex, frameIndex) {
  return layerIds
    .map((layerId, order) => ({
      layerId,
      order,
      priority: getImfFrame(imf, layerId, actionIndex, frameIndex).priority,
    }))
    .sort((a, b) => b.priority - a.priority || a.order - b.order)
    .map((entry) => entry.layerId);
}
