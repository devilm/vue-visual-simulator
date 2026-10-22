// Ragnarok Online SPR decoder.
// Header: "SP", minor(u8), major(u8), indexedCount(u16), [rgbaCount(u16) if version >= 2.0]
// Indexed frames: width(u16), height(u16), [compressedLength(u16) if version >= 2.1] data
// RGBA frames (ABGR byte order): width(u16), height(u16), w*h*4 bytes
// Palette: 256 * RGBA (1024 bytes) at end of file when version >= 1.1

function decodeRle(compressedBytes, pixelCount) {
  const indices = new Uint8Array(pixelCount);
  let sourceIndex = 0;
  let targetIndex = 0;

  while (sourceIndex < compressedBytes.length && targetIndex < pixelCount) {
    const value = compressedBytes[sourceIndex];
    sourceIndex += 1;

    if (value === 0) {
      const runLength = sourceIndex < compressedBytes.length ? compressedBytes[sourceIndex] : 0;
      sourceIndex += 1;
      targetIndex += runLength === 0 ? 1 : runLength;
      continue;
    }

    indices[targetIndex] = value;
    targetIndex += 1;
  }

  return indices;
}

function indexedToRgba(indexedPixels, paletteBytes) {
  const rgbaPixels = new Uint8ClampedArray(indexedPixels.length * 4);

  for (let pixelIndex = 0; pixelIndex < indexedPixels.length; pixelIndex += 1) {
    const paletteIndex = indexedPixels[pixelIndex];
    if (paletteIndex === 0) {
      continue;
    }

    const paletteOffset = paletteIndex * 4;
    const rgbaOffset = pixelIndex * 4;
    rgbaPixels[rgbaOffset] = paletteBytes[paletteOffset];
    rgbaPixels[rgbaOffset + 1] = paletteBytes[paletteOffset + 1];
    rgbaPixels[rgbaOffset + 2] = paletteBytes[paletteOffset + 2];
    rgbaPixels[rgbaOffset + 3] = 255;
  }

  return rgbaPixels;
}

function abgrToRgba(source, pixelCount) {
  const rgbaPixels = new Uint8ClampedArray(pixelCount * 4);
  for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex += 1) {
    const offset = pixelIndex * 4;
    rgbaPixels[offset] = source[offset + 3];
    rgbaPixels[offset + 1] = source[offset + 2];
    rgbaPixels[offset + 2] = source[offset + 1];
    rgbaPixels[offset + 3] = source[offset];
  }
  return rgbaPixels;
}

export function decodeSpr(arrayBuffer, options = {}) {
  const view = new DataView(arrayBuffer);
  if (arrayBuffer.byteLength < 8 || view.getUint8(0) !== 0x53 || view.getUint8(1) !== 0x50) {
    throw new Error("Invalid SPR signature");
  }

  const minor = view.getUint8(2);
  const major = view.getUint8(3);
  const version = major * 100 + minor;

  const indexedCount = view.getUint16(4, true);
  let rgbaCount = 0;
  let cursor = 6;
  if (version >= 200) {
    rgbaCount = view.getUint16(6, true);
    cursor = 8;
  }

  const hasPalette = version >= 101 && indexedCount > 0;
  let paletteBytes = options.paletteBytes || null;
  if (!paletteBytes && hasPalette) {
    paletteBytes = new Uint8Array(arrayBuffer, arrayBuffer.byteLength - 1024, 1024);
  }

  const indexedFrames = [];
  for (let frameIndex = 0; frameIndex < indexedCount; frameIndex += 1) {
    const width = view.getUint16(cursor, true);
    const height = view.getUint16(cursor + 2, true);
    cursor += 4;

    let indexedPixels;
    if (version >= 201) {
      const compressedLength = view.getUint16(cursor, true);
      cursor += 2;
      indexedPixels = decodeRle(new Uint8Array(arrayBuffer, cursor, compressedLength), width * height);
      cursor += compressedLength;
    } else {
      indexedPixels = new Uint8Array(arrayBuffer, cursor, width * height);
      cursor += width * height;
    }

    indexedFrames.push({
      width,
      height,
      rgbaPixels: paletteBytes
        ? indexedToRgba(indexedPixels, paletteBytes)
        : new Uint8ClampedArray(width * height * 4),
    });
  }

  const rgbaFrames = [];
  for (let frameIndex = 0; frameIndex < rgbaCount; frameIndex += 1) {
    const width = view.getUint16(cursor, true);
    const height = view.getUint16(cursor + 2, true);
    cursor += 4;
    const byteCount = width * height * 4;
    const source = new Uint8Array(arrayBuffer, cursor, byteCount);
    cursor += byteCount;
    rgbaFrames.push({ width, height, rgbaPixels: abgrToRgba(source, width * height) });
  }

  return {
    version: `${major}.${minor}`,
    indexedFrames,
    rgbaFrames,
  };
}
