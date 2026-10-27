// Decoders for the image formats used by Ragnarok effect textures (TGA and BMP).
// Both return { width, height, rgbaPixels, hasAlpha } with rows stored top-down.
// `hasAlpha` is false for formats without an alpha channel (BMP, 24-bit TGA): those textures use a black
// background that the client hides by blending additively.

// Effect BMPs have no alpha channel; the client treats pure magenta as transparent.
function isColorKey(red, green, blue) {
  return red >= 248 && green <= 8 && blue >= 248;
}

export function decodeTga(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  if (bytes.length < 18) {
    throw new Error("Invalid TGA header");
  }

  const idLength = bytes[0];
  const colorMapType = bytes[1];
  const imageType = bytes[2];
  const colorMapLength = bytes[5] | (bytes[6] << 8);
  const colorMapEntryBits = bytes[7];
  const width = bytes[12] | (bytes[13] << 8);
  const height = bytes[14] | (bytes[15] << 8);
  const bitsPerPixel = bytes[16];
  const topDown = (bytes[17] & 0x20) !== 0;
  const rightToLeft = (bytes[17] & 0x10) !== 0;

  const isRle = imageType === 9 || imageType === 10 || imageType === 11;
  const isColorMapped = imageType === 1 || imageType === 9;
  const isGray = imageType === 3 || imageType === 11;
  if (![1, 2, 3, 9, 10, 11].includes(imageType)) {
    throw new Error(`Unsupported TGA type ${imageType}`);
  }
  if (width === 0 || height === 0) {
    throw new Error("Empty TGA image");
  }

  const bytesPerPixel = bitsPerPixel >> 3;
  let cursor = 18 + idLength;

  let colorMap = null;
  if (colorMapType === 1) {
    const entryBytes = colorMapEntryBits >> 3;
    colorMap = bytes.subarray(cursor, cursor + colorMapLength * entryBytes);
    cursor += colorMapLength * entryBytes;
  }

  // Raw pixel bytes in file order.
  const pixelCount = width * height;
  const raw = new Uint8Array(pixelCount * bytesPerPixel);
  if (isRle) {
    let target = 0;
    while (target < raw.length && cursor < bytes.length) {
      const packet = bytes[cursor];
      cursor += 1;
      const count = (packet & 0x7f) + 1;
      if (packet & 0x80) {
        for (let repeat = 0; repeat < count && target < raw.length; repeat += 1) {
          for (let byteIndex = 0; byteIndex < bytesPerPixel; byteIndex += 1) {
            raw[target + byteIndex] = bytes[cursor + byteIndex];
          }
          target += bytesPerPixel;
        }
        cursor += bytesPerPixel;
      } else {
        const byteCount = Math.min(count * bytesPerPixel, raw.length - target);
        raw.set(bytes.subarray(cursor, cursor + byteCount), target);
        target += byteCount;
        cursor += count * bytesPerPixel;
      }
    }
  } else {
    raw.set(bytes.subarray(cursor, cursor + raw.length));
  }

  const rgbaPixels = new Uint8ClampedArray(pixelCount * 4);
  for (let row = 0; row < height; row += 1) {
    const targetRow = topDown ? row : height - 1 - row;
    for (let column = 0; column < width; column += 1) {
      const targetColumn = rightToLeft ? width - 1 - column : column;
      const source = (row * width + column) * bytesPerPixel;
      const target = (targetRow * width + targetColumn) * 4;

      let red;
      let green;
      let blue;
      let alpha = 255;
      if (isColorMapped && colorMap) {
        const entryBytes = colorMapEntryBits >> 3;
        const entry = raw[source] * entryBytes;
        blue = colorMap[entry];
        green = colorMap[entry + 1];
        red = colorMap[entry + 2];
        alpha = entryBytes === 4 ? colorMap[entry + 3] : 255;
      } else if (isGray) {
        red = green = blue = raw[source];
        alpha = bytesPerPixel === 2 ? raw[source + 1] : 255;
      } else if (bytesPerPixel >= 3) {
        blue = raw[source];
        green = raw[source + 1];
        red = raw[source + 2];
        alpha = bytesPerPixel === 4 ? raw[source + 3] : 255;
      } else {
        const value = raw[source] | (raw[source + 1] << 8);
        red = ((value >> 10) & 0x1f) << 3;
        green = ((value >> 5) & 0x1f) << 3;
        blue = (value & 0x1f) << 3;
      }

      rgbaPixels[target] = red;
      rgbaPixels[target + 1] = green;
      rgbaPixels[target + 2] = blue;
      rgbaPixels[target + 3] = alpha;
    }
  }

  const hasAlpha =
    (isColorMapped && colorMapEntryBits === 32) || (isGray ? bytesPerPixel === 2 : bytesPerPixel === 4);
  return { width, height, rgbaPixels, hasAlpha };
}

export function decodeBmp(arrayBuffer) {
  const view = new DataView(arrayBuffer);
  if (arrayBuffer.byteLength < 54 || view.getUint16(0, true) !== 0x4d42) {
    throw new Error("Invalid BMP signature");
  }

  const dataOffset = view.getUint32(10, true);
  const headerSize = view.getUint32(14, true);
  const width = view.getInt32(18, true);
  const signedHeight = view.getInt32(22, true);
  const bitsPerPixel = view.getUint16(28, true);
  const compression = view.getUint32(30, true);
  const colorsUsed = view.getUint32(46, true);
  const height = Math.abs(signedHeight);
  const topDown = signedHeight < 0;
  if (compression !== 0 && compression !== 3) {
    throw new Error(`Unsupported BMP compression ${compression}`);
  }

  const bytes = new Uint8Array(arrayBuffer);
  let palette = null;
  if (bitsPerPixel <= 8) {
    const paletteSize = colorsUsed || 1 << bitsPerPixel;
    palette = bytes.subarray(14 + headerSize, 14 + headerSize + paletteSize * 4);
  }

  const rowStride = Math.floor((width * bitsPerPixel + 31) / 32) * 4;
  const rgbaPixels = new Uint8ClampedArray(width * height * 4);

  for (let row = 0; row < height; row += 1) {
    const sourceRow = topDown ? row : height - 1 - row;
    const rowOffset = dataOffset + sourceRow * rowStride;
    for (let column = 0; column < width; column += 1) {
      let red;
      let green;
      let blue;
      let alpha = 255;

      if (bitsPerPixel === 8) {
        const entry = bytes[rowOffset + column] * 4;
        blue = palette[entry];
        green = palette[entry + 1];
        red = palette[entry + 2];
      } else if (bitsPerPixel === 4) {
        const byte = bytes[rowOffset + (column >> 1)];
        const entry = ((column & 1) === 0 ? byte >> 4 : byte & 0x0f) * 4;
        blue = palette[entry];
        green = palette[entry + 1];
        red = palette[entry + 2];
      } else if (bitsPerPixel === 16) {
        const value = view.getUint16(rowOffset + column * 2, true);
        red = ((value >> 10) & 0x1f) << 3;
        green = ((value >> 5) & 0x1f) << 3;
        blue = (value & 0x1f) << 3;
      } else if (bitsPerPixel === 24 || bitsPerPixel === 32) {
        const pixelOffset = rowOffset + column * (bitsPerPixel >> 3);
        blue = bytes[pixelOffset];
        green = bytes[pixelOffset + 1];
        red = bytes[pixelOffset + 2];
      } else {
        throw new Error(`Unsupported BMP depth ${bitsPerPixel}`);
      }

      if (isColorKey(red, green, blue)) {
        red = green = blue = alpha = 0;
      }

      const target = (row * width + column) * 4;
      rgbaPixels[target] = red;
      rgbaPixels[target + 1] = green;
      rgbaPixels[target + 2] = blue;
      rgbaPixels[target + 3] = alpha;
    }
  }

  return { width, height, rgbaPixels, hasAlpha: false };
}

const EDGE_ALPHA_THRESHOLD = 4;
const EDGE_FADE_RATIO = 0.1;
const EDGE_FADE_MAX = 24;

// Some effect textures (water fields, rings, smoke) carry faint but non-zero alpha right up to the image
// border, so the quad they are drawn on shows up as a hard straight cut through the glow. Every border that
// holds visible alpha is faded out smoothly over a short band; clean borders are left untouched.
function fadeEdgeAlpha(rgbaPixels, width, height) {
  const alphaAt = (x, y) => rgbaPixels[(y * width + x) * 4 + 3];
  let left = 0;
  let right = 0;
  let top = 0;
  let bottom = 0;
  for (let y = 0; y < height; y += 1) {
    left = Math.max(left, alphaAt(0, y));
    right = Math.max(right, alphaAt(width - 1, y));
  }
  for (let x = 0; x < width; x += 1) {
    top = Math.max(top, alphaAt(x, 0));
    bottom = Math.max(bottom, alphaAt(x, height - 1));
  }

  const fadeLeft = left >= EDGE_ALPHA_THRESHOLD;
  const fadeRight = right >= EDGE_ALPHA_THRESHOLD;
  const fadeTop = top >= EDGE_ALPHA_THRESHOLD;
  const fadeBottom = bottom >= EDGE_ALPHA_THRESHOLD;
  if (!fadeLeft && !fadeRight && !fadeTop && !fadeBottom) {
    return;
  }

  const bandX = Math.max(1, Math.min(Math.round(width * EDGE_FADE_RATIO), EDGE_FADE_MAX));
  const bandY = Math.max(1, Math.min(Math.round(height * EDGE_FADE_RATIO), EDGE_FADE_MAX));
  const smooth = (distance, band) => {
    const t = Math.min(Math.max(distance / band, 0), 1);
    return t * t * (3 - 2 * t);
  };

  for (let y = 0; y < height; y += 1) {
    let factorY = 1;
    if (fadeTop) {
      factorY *= smooth(y + 0.5, bandY);
    }
    if (fadeBottom) {
      factorY *= smooth(height - y - 0.5, bandY);
    }
    for (let x = 0; x < width; x += 1) {
      let factor = factorY;
      if (fadeLeft) {
        factor *= smooth(x + 0.5, bandX);
      }
      if (fadeRight) {
        factor *= smooth(width - x - 0.5, bandX);
      }
      if (factor < 1) {
        const index = (y * width + x) * 4 + 3;
        rgbaPixels[index] = Math.round(rgbaPixels[index] * factor);
      }
    }
  }
}

// Converts a texture meant for additive blending into one that stays correct on a transparent canvas.
// The client draws such layers onto an opaque back buffer, so black simply adds nothing. Pixi's additive
// blend also accumulates alpha, which would turn black texels into opaque black boxes on our transparent
// canvas. Here the light a texel contributes (rgb * alpha) becomes the new alpha instead, so black is
// fully transparent and bright texels keep their colour.
export function toLightTexture(image) {
  const { width, height, rgbaPixels } = image;
  const light = new Uint8ClampedArray(rgbaPixels.length);

  for (let offset = 0; offset < rgbaPixels.length; offset += 4) {
    const weight = rgbaPixels[offset + 3] / 255;
    const red = rgbaPixels[offset] * weight;
    const green = rgbaPixels[offset + 1] * weight;
    const blue = rgbaPixels[offset + 2] * weight;
    const peak = Math.max(red, green, blue);
    if (peak < 1) {
      continue;
    }
    light[offset] = (red * 255) / peak;
    light[offset + 1] = (green * 255) / peak;
    light[offset + 2] = (blue * 255) / peak;
    light[offset + 3] = peak;
  }

  // Alpha-carrying textures were already faded when decoded; only alpha-less (BMP) ones still need it here.
  if (!image.hasAlpha) {
    fadeEdgeAlpha(light, width, height);
  }
  return { width, height, rgbaPixels: light, hasAlpha: true };
}

export function decodeEffectTexture(name, arrayBuffer) {
  if (/\.bmp$/i.test(name)) {
    return decodeBmp(arrayBuffer);
  }
  const image = decodeTga(arrayBuffer);
  if (image.hasAlpha) {
    fadeEdgeAlpha(image.rgbaPixels, image.width, image.height);
  }
  return image;
}
