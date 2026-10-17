const sprCache = new Map();
const actCache = new Map();
const paletteCache = new Map();
const imfCache = new Map();
const spriteSetCache = new Map();
const decodedSprCache = new Map();
const decodedActCache = new Map();
const decodedImfCache = new Map();
const tintedImageCache = new WeakMap();

function readUInt16(view, offset, label) {
  if (offset + 2 > view.byteLength) {
    throw new Error(`Unexpected end of ${label} data.`);
  }
  return view.getUint16(offset, true);
}

function readUInt32(view, offset, label) {
  if (offset + 4 > view.byteLength) {
    throw new Error(`Unexpected end of ${label} data.`);
  }
  return view.getUint32(offset, true);
}

function readInt32(view, offset, label) {
  if (offset + 4 > view.byteLength) {
    throw new Error(`Unexpected end of ${label} data.`);
  }
  return view.getInt32(offset, true);
}

function readFloat32(view, offset, label) {
  if (offset + 4 > view.byteLength) {
    throw new Error(`Unexpected end of ${label} data.`);
  }
  return view.getFloat32(offset, true);
}

function assertRange(view, offset, length, label) {
  if (offset < 0 || length < 0 || offset + length > view.byteLength) {
    throw new Error(`Invalid ${label} data range.`);
  }
}

async function loadBuffer(src, cache) {
  if (!cache.has(src)) {
    const request = fetch(src).then((response) => {
      if (!response.ok) {
        throw new Error(`Unable to load ${src}: ${response.status}`);
      }
      return response.arrayBuffer();
    });
    cache.set(
      src,
      request.catch((error) => {
        cache.delete(src);
        throw error;
      })
    );
  }
  return cache.get(src);
}

function loadDecoded(cache, key, decode) {
  if (!cache.has(key)) {
    cache.set(
      key,
      decode().catch((error) => {
        cache.delete(key);
        throw error;
      })
    );
  }
  return cache.get(key);
}

function createImageCanvas(width, height, pixels) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas 2D context is unavailable.");
  }
  context.putImageData(new ImageData(pixels, width, height), 0, 0);
  return canvas;
}

function decodeSpr(buffer, customPalette) {
  const view = new DataView(buffer);
  if (view.byteLength < 1032 || view.getUint8(0) !== 0x53 || view.getUint8(1) !== 0x50) {
    throw new Error("Invalid or truncated Ragnarok SPR file.");
  }

  const version = readUInt16(view, 2, "SPR");
  const paletteImageCount = readUInt16(view, 4, "SPR");
  const rgbaImageCount = version >= 0x0200 ? readUInt16(view, 6, "SPR") : 0;
  const embeddedPaletteOffset = view.byteLength - 1024;
  if (version >= 0x0200 && 8 + paletteImageCount * 4 > embeddedPaletteOffset) {
    throw new Error("SPR image table overlaps its palette.");
  }

  const paletteBytes =
    customPalette && customPalette.byteLength >= 1024
      ? new Uint8Array(customPalette, 0, 1024)
      : new Uint8Array(buffer, embeddedPaletteOffset, 1024);
  const palette = new Uint8ClampedArray(paletteBytes);
  const images = [[], []];
  let offset = 6;

  if (version >= 0x0200) {
    offset = 8;
  }

  for (let index = 0; index < paletteImageCount; index += 1) {
    const width = readUInt16(view, offset, "SPR");
    const height = readUInt16(view, offset + 2, "SPR");
    offset += 4;
    const pixelCount = width * height;
    const encodedLength =
      version >= 0x0201 ? readUInt16(view, offset, "SPR") : pixelCount;
    if (version >= 0x0201) offset += 2;
    assertRange(view, offset, encodedLength, "SPR indexed image");

    const indexes = new Uint8Array(pixelCount);
    let sourceOffset = offset;
    let destinationOffset = 0;
    const sourceEnd = offset + encodedLength;
    while (sourceOffset < sourceEnd && destinationOffset < pixelCount) {
      const paletteIndex = view.getUint8(sourceOffset);
      sourceOffset += 1;

      if (paletteIndex === 0 && version >= 0x0201) {
        if (sourceOffset >= sourceEnd) {
          throw new Error("Truncated transparent run in SPR image.");
        }
        const transparentLength = view.getUint8(sourceOffset);
        sourceOffset += 1;
        if (transparentLength === 0 || destinationOffset + transparentLength > pixelCount) {
          throw new Error("Invalid transparent run in SPR image.");
        }
        destinationOffset += transparentLength;
      } else {
        indexes[destinationOffset] = paletteIndex;
        destinationOffset += 1;
      }
    }

    if (destinationOffset !== pixelCount || sourceOffset !== sourceEnd) {
      throw new Error("SPR indexed image data does not match its dimensions.");
    }

    const pixels = new Uint8ClampedArray(pixelCount * 4);
    for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex += 1) {
      const paletteIndex = indexes[pixelIndex];
      const source = paletteIndex * 4;
      const destination = pixelIndex * 4;
      pixels[destination] = palette[source];
      pixels[destination + 1] = palette[source + 1];
      pixels[destination + 2] = palette[source + 2];
      pixels[destination + 3] = paletteIndex === 0 ? 0 : 255;
    }

    images[0].push({
      width,
      height,
      canvas: createImageCanvas(width, height, pixels),
    });
    offset += encodedLength;
  }

  for (let index = 0; index < rgbaImageCount; index += 1) {
    const width = readUInt16(view, offset, "SPR");
    const height = readUInt16(view, offset + 2, "SPR");
    offset += 4;
    const byteLength = width * height * 4;
    assertRange(view, offset, byteLength, "SPR RGBA image");

    const source = new Uint8ClampedArray(buffer, offset, byteLength);
    const pixels = new Uint8ClampedArray(byteLength);
    for (let y = 0; y < height; y += 1) {
      const sourceRow = (height - y - 1) * width * 4;
      pixels.set(source.subarray(sourceRow, sourceRow + width * 4), y * width * 4);
    }
    images[1].push({
      width,
      height,
      canvas: createImageCanvas(width, height, pixels),
    });
    offset += byteLength;
  }

  return { version, images };
}

function decodeAct(buffer) {
  const view = new DataView(buffer);
  if (view.byteLength < 30 || view.getUint8(0) !== 0x41 || view.getUint8(1) !== 0x43) {
    throw new Error("Invalid or truncated Ragnarok ACT file.");
  }

  const version = readUInt16(view, 2, "ACT");
  const actionCount = readUInt16(view, 4, "ACT");
  if (actionCount === 0 || actionCount > 600) {
    throw new Error("ACT file has an invalid action count.");
  }
  let offset = 16;
  const actions = [];

  for (let actionIndex = 0; actionIndex < actionCount; actionIndex += 1) {
    const frameCount = readUInt32(view, offset, "ACT");
    offset += 4;
    if (frameCount > 1000) {
      throw new Error("ACT file has an invalid frame count.");
    }
    const frames = [];

    for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
      assertRange(view, offset, 36, "ACT frame");
      offset += 32;
      const spriteCount = readUInt32(view, offset, "ACT");
      offset += 4;
      if (spriteCount > 1000) {
        throw new Error("ACT frame has an invalid sprite count.");
      }
      const sprites = [];

      for (let spriteIndex = 0; spriteIndex < spriteCount; spriteIndex += 1) {
        const sprite = {
          x: readInt32(view, offset, "ACT"),
          y: readInt32(view, offset + 4, "ACT"),
          spriteId: readInt32(view, offset + 8, "ACT"),
          flags: readUInt32(view, offset + 12, "ACT"),
          tint: readUInt32(view, offset + 16, "ACT"),
          scaleX: readFloat32(view, offset + 20, "ACT"),
          scaleY: version >= 0x0204 ? readFloat32(view, offset + 24, "ACT") : 0,
          rotation: readInt32(view, offset + (version >= 0x0204 ? 28 : 24), "ACT"),
          spriteType: readInt32(view, offset + (version >= 0x0204 ? 32 : 28), "ACT"),
        };
        if (version < 0x0204) sprite.scaleY = sprite.scaleX;
        offset += version >= 0x0205 ? 44 : version >= 0x0204 ? 36 : 32;
        if (version >= 0x0205) {
          sprite.width = readInt32(view, offset - 8, "ACT");
          sprite.height = readInt32(view, offset - 4, "ACT");
        }
        sprites.push(sprite);
      }

      const frame = { sprites, attachPoints: [] };
      if (version >= 0x0200) {
        frame.eventId = readInt32(view, offset, "ACT");
        offset += 4;
      }
      if (version >= 0x0203) {
        const attachPointCount = readUInt32(view, offset, "ACT");
        offset += 4;
        if (attachPointCount > 1000) {
          throw new Error("ACT frame has an invalid attach-point count.");
        }
        for (let pointIndex = 0; pointIndex < attachPointCount; pointIndex += 1) {
          assertRange(view, offset, 16, "ACT attach point");
          offset += 4;
          frame.attachPoints.push({
            x: readInt32(view, offset, "ACT"),
            y: readInt32(view, offset + 4, "ACT"),
            attribute: readInt32(view, offset + 8, "ACT"),
          });
          offset += 12;
        }
      }
      frames.push(frame);
    }
    actions.push({ frames });
  }

  if (version >= 0x0201) {
    const eventCount = readUInt32(view, offset, "ACT");
    offset += 4;
    assertRange(view, offset, eventCount * 40, "ACT event table");
    offset += eventCount * 40;
    if (version >= 0x0202) {
      assertRange(view, offset, actionCount * 4, "ACT action intervals");
      for (let index = 0; index < actionCount; index += 1) {
        actions[index].interval = readFloat32(view, offset, "ACT");
        offset += 4;
      }
    }
  }

  if (offset !== view.byteLength) {
    throw new Error("ACT file contains unsupported trailing data.");
  }
  return { version, actions };
}

function decodeImf(buffer) {
  const view = new DataView(buffer);
  if (view.byteLength < 12) {
    throw new Error("Invalid or truncated Ragnarok IMF file.");
  }
  let offset = 8;
  const maxLayer = readUInt32(view, offset, "IMF");
  offset += 4;
  if (maxLayer > 20) {
    throw new Error("IMF file has an invalid layer count.");
  }

  const layers = [];
  for (let layerIndex = 0; layerIndex <= maxLayer; layerIndex += 1) {
    const actionCount = readUInt32(view, offset, "IMF");
    offset += 4;
    if (actionCount > 600) {
      throw new Error("IMF file has an invalid action count.");
    }
    const actions = [];
    for (let actionIndex = 0; actionIndex < actionCount; actionIndex += 1) {
      const frameCount = readUInt32(view, offset, "IMF");
      offset += 4;
      if (frameCount > 1000) {
        throw new Error("IMF file has an invalid frame count.");
      }
      const priorities = [];
      for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
        priorities.push(readInt32(view, offset, "IMF"));
        offset += 12;
      }
      actions.push(priorities);
    }
    layers.push(actions);
  }

  if (offset !== view.byteLength) {
    throw new Error("IMF file contains unsupported trailing data.");
  }
  return layers;
}

export function loadRagnarokSpriteSet(sources) {
  const cacheKey = JSON.stringify(sources);
  if (!spriteSetCache.has(cacheKey)) {
    const request = Promise.all([
      loadDecoded(
        decodedSprCache,
        `${sources.bodySpr}\n${sources.bodyPalette}`,
        async () =>
          decodeSpr(
            await loadBuffer(sources.bodySpr, sprCache),
            await loadBuffer(sources.bodyPalette, paletteCache)
          )
      ),
      loadDecoded(
        decodedActCache,
        sources.bodyAct,
        async () => decodeAct(await loadBuffer(sources.bodyAct, actCache))
      ),
      loadDecoded(
        decodedImfCache,
        sources.bodyImf,
        async () => decodeImf(await loadBuffer(sources.bodyImf, imfCache))
      ),
      loadDecoded(
        decodedSprCache,
        `${sources.headSpr}\n${sources.headPalette}`,
        async () =>
          decodeSpr(
            await loadBuffer(sources.headSpr, sprCache),
            await loadBuffer(sources.headPalette, paletteCache)
          )
      ),
      loadDecoded(
        decodedActCache,
        sources.headAct,
        async () => decodeAct(await loadBuffer(sources.headAct, actCache))
      ),
    ]).then(([bodySpr, bodyAct, bodyImf, headSpr, headAct]) => ({
      bodySpr,
      bodyAct,
      bodyImf,
      headSpr,
      headAct,
    }));
    spriteSetCache.set(
      cacheKey,
      request.catch((error) => {
        spriteSetCache.delete(cacheKey);
        throw error;
      })
    );
  }
  return spriteSetCache.get(cacheKey);
}

function getFrame(spriteSet, actionIndex, frameIndex, spriteName) {
  const frame = spriteSet[`${spriteName}Act`].actions[actionIndex]?.frames[frameIndex];
  if (!frame) {
    throw new Error(`${spriteName} ACT has no frame ${frameIndex} for direction ${actionIndex}.`);
  }
  return frame;
}

function getTintedImage(image, tint) {
  if ((tint >>> 24) === 0) return null;
  if ((tint & 0x00ffffff) === 0x00ffffff && (tint >>> 24) === 0xff) {
    return image.canvas;
  }

  let imageTintCache = tintedImageCache.get(image.canvas);
  if (!imageTintCache) {
    imageTintCache = new Map();
    tintedImageCache.set(image.canvas, imageTintCache);
  }
  if (imageTintCache.has(tint)) return imageTintCache.get(tint);

  const context = image.canvas.getContext("2d");
  const pixels = context.getImageData(0, 0, image.width, image.height);
  const tintRed = tint & 0xff;
  const tintGreen = (tint >>> 8) & 0xff;
  const tintBlue = (tint >>> 16) & 0xff;
  const tintAlpha = (tint >>> 24) & 0xff;
  for (let offset = 0; offset < pixels.data.length; offset += 4) {
    pixels.data[offset] = (pixels.data[offset] * tintRed) / 255;
    pixels.data[offset + 1] = (pixels.data[offset + 1] * tintGreen) / 255;
    pixels.data[offset + 2] = (pixels.data[offset + 2] * tintBlue) / 255;
    pixels.data[offset + 3] = (pixels.data[offset + 3] * tintAlpha) / 255;
  }
  const tintedImage = createImageCanvas(image.width, image.height, pixels.data);
  imageTintCache.set(tint, tintedImage);
  return tintedImage;
}

function drawFrame(context, frame, images, offsetX, offsetY) {
  frame.sprites.forEach((sprite) => {
    if (sprite.spriteId < 0 || sprite.spriteType < 0 || sprite.spriteType > 1) return;
    const image = images[sprite.spriteType][sprite.spriteId];
    if (!image) return;

    const tintedImage = getTintedImage(image, sprite.tint);
    if (!tintedImage) return;
    context.save();
    context.translate(offsetX + sprite.x, offsetY + sprite.y);
    context.rotate((sprite.rotation * Math.PI) / 180);
    context.scale(sprite.scaleX * ((sprite.flags & 1) ? -1 : 1), sprite.scaleY);
    context.drawImage(
      tintedImage,
      Math.round(-image.width / 2),
      Math.round(-image.height / 2)
    );
    context.restore();
  });
}

export function renderRagnarokCharacter(
  context,
  spriteSet,
  action,
  headDirection,
  width,
  height,
  animationFrame = 0
) {
  const direction = action % 8;
  const actionGroup = Math.floor(action / 8);
  const isHeadDirectionPose = actionGroup === 0 || actionGroup === 2;
  const bodyAction = spriteSet.bodyAct.actions[action];
  const headAction = spriteSet.headAct.actions[action];
  if (!bodyAction?.frames.length || !headAction?.frames.length) {
    throw new Error(`ACT action ${action} has no renderable frames.`);
  }
  const bodyFrameIndex = isHeadDirectionPose
    ? headDirection
    : animationFrame % bodyAction.frames.length;
  const headFrameIndex = isHeadDirectionPose
    ? headDirection
    : animationFrame % headAction.frames.length;
  const bodyFrame = getFrame(spriteSet, action, bodyFrameIndex, "body");
  const headFrame = getFrame(spriteSet, action, headFrameIndex, "head");
  const bodyAnchor = bodyFrame.attachPoints[0] || { x: 0, y: 0 };
  const headAnchor = headFrame.attachPoints[0] || { x: 0, y: 0 };
  const headOffsetX = bodyAnchor.x - headAnchor.x;
  const headOffsetY = bodyAnchor.y - headAnchor.y;
  const imfPriority = spriteSet.bodyImf[1]?.[action]?.[bodyFrameIndex];
  const drawHeadBehindBody = direction >= 2 && direction <= 5 && imfPriority === 1;

  context.clearRect(0, 0, width, height);
  context.imageSmoothingEnabled = false;
  const originX = width / 2;
  const originY = height * 0.75;
  if (drawHeadBehindBody) {
    drawFrame(context, headFrame, spriteSet.headSpr.images, originX + headOffsetX, originY + headOffsetY);
    drawFrame(context, bodyFrame, spriteSet.bodySpr.images, originX, originY);
  } else {
    drawFrame(context, bodyFrame, spriteSet.bodySpr.images, originX, originY);
    drawFrame(context, headFrame, spriteSet.headSpr.images, originX + headOffsetX, originY + headOffsetY);
  }
}
