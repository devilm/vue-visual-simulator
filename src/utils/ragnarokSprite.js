function createReader(buffer, format) {
  const view = new DataView(buffer);
  let offset = 0;

  function ensureAvailable(length) {
    if (length < 0 || offset + length > view.byteLength) {
      throw new Error(`${format} file ended unexpectedly`);
    }
  }

  return {
    get offset() {
      return offset;
    },
    get remaining() {
      return view.byteLength - offset;
    },
    readUint8() {
      ensureAvailable(1);
      return view.getUint8(offset++);
    },
    readUint16() {
      ensureAvailable(2);
      const value = view.getUint16(offset, true);
      offset += 2;
      return value;
    },
    readInt32() {
      ensureAvailable(4);
      const value = view.getInt32(offset, true);
      offset += 4;
      return value;
    },
    readUint32() {
      ensureAvailable(4);
      const value = view.getUint32(offset, true);
      offset += 4;
      return value;
    },
    readFloat32() {
      ensureAvailable(4);
      const value = view.getFloat32(offset, true);
      offset += 4;
      return value;
    },
    readBytes(length) {
      ensureAvailable(length);
      const bytes = new Uint8Array(buffer, offset, length);
      offset += length;
      return bytes;
    },
    skip(length) {
      ensureAvailable(length);
      offset += length;
    },
  };
}

function readSpriteDimensions(reader) {
  const width = reader.readUint16();
  const height = reader.readUint16();
  if (!width || !height || width * height > 16_777_216) {
    throw new Error("SPR contains invalid sprite dimensions");
  }
  return { width, height };
}

function decodeIndexedPixels(reader, width, height, rle) {
  const pixelCount = width * height;
  const pixels = new Uint8Array(pixelCount);

  if (!rle) {
    pixels.set(reader.readBytes(pixelCount));
    return pixels;
  }

  const encodedLength = reader.readUint16();
  const encoded = reader.readBytes(encodedLength);
  let source = 0;
  let destination = 0;

  while (source < encoded.length && destination < pixelCount) {
    const colorIndex = encoded[source++];
    pixels[destination++] = colorIndex;

    if (colorIndex === 0) {
      if (source >= encoded.length) {
        throw new Error("SPR contains a truncated transparent run");
      }
      const runLength = encoded[source++];
      if (runLength === 0) {
        if (destination >= pixelCount) {
          throw new Error("SPR transparent run exceeds its frame dimensions");
        }
        pixels[destination++] = 0;
      } else {
        const additionalPixels = runLength - 1;
        if (additionalPixels > pixelCount - destination) {
          throw new Error("SPR transparent run exceeds its frame dimensions");
        }
        destination += additionalPixels;
      }
    }
  }

  if (destination !== pixelCount || source !== encoded.length) {
    throw new Error("SPR image data does not match its dimensions");
  }
  return pixels;
}

export function parseSpr(buffer) {
  const reader = createReader(buffer, "SPR");
  if (reader.readUint8() !== 0x53 || reader.readUint8() !== 0x50) {
    throw new Error('SPR file must begin with "SP"');
  }

  const version = reader.readUint8() / 10 + reader.readUint8();
  const indexedCount = reader.readUint16();
  const rgbaCount = version > 1.1 ? reader.readUint16() : 0;
  if (indexedCount + rgbaCount > 16_384) {
    throw new Error("SPR contains too many frames");
  }

  const frames = [];
  for (let index = 0; index < indexedCount; index += 1) {
    const { width, height } = readSpriteDimensions(reader);
    frames.push({
      type: "indexed",
      width,
      height,
      pixels: decodeIndexedPixels(reader, width, height, version >= 2.1),
    });
  }

  for (let index = 0; index < rgbaCount; index += 1) {
    const width = reader.readUint16();
    const height = reader.readUint16();
    if (!width || !height || width * height > 16_777_216) {
      throw new Error("SPR contains invalid RGBA sprite dimensions");
    }
    frames.push({
      type: "rgba",
      width,
      height,
      pixels: reader.readBytes(width * height * 4),
    });
  }

  let palette = null;
  if (version > 1 && reader.remaining >= 1024) {
    const paletteOffset = buffer.byteLength - 1024;
    palette = new Uint8Array(buffer, paletteOffset, 1024);
  }
  if (frames.some((frame) => frame.type === "indexed") && !palette) {
    throw new Error("SPR indexed sprites are missing their color palette");
  }

  return { frames, indexedCount, palette };
}

function readActVersion(reader) {
  return reader.readUint8() / 10 + reader.readUint8();
}

export function parseAct(buffer) {
  const reader = createReader(buffer, "ACT");
  if (reader.readUint8() !== 0x41 || reader.readUint8() !== 0x43) {
    throw new Error('ACT file must begin with "AC"');
  }

  const version = readActVersion(reader);
  const actionCount = reader.readUint16();
  if (actionCount > 4096) {
    throw new Error("ACT contains too many actions");
  }
  reader.skip(10);

  const actions = [];
  let totalFrames = 0;
  for (let actionIndex = 0; actionIndex < actionCount; actionIndex += 1) {
    const frameCount = reader.readUint32();
    totalFrames += frameCount;
    if (frameCount > 10_000 || totalFrames > 100_000) {
      throw new Error("ACT contains too many animation frames");
    }

    const frames = [];
    for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
      reader.skip(32);
      const layerCount = reader.readUint32();
      if (layerCount > 256) {
        throw new Error("ACT frame contains too many sprite layers");
      }

      const layers = [];
      for (let layerIndex = 0; layerIndex < layerCount; layerIndex += 1) {
        const layer = {
          x: reader.readInt32(),
          y: reader.readInt32(),
          spriteIndex: reader.readInt32(),
          mirrored: reader.readInt32() !== 0,
          color: [255, 255, 255, 255],
          scaleX: 1,
          scaleY: 1,
          angle: 0,
          spriteType: 0,
        };

        if (version >= 2) {
          layer.color = [
            reader.readUint8(),
            reader.readUint8(),
            reader.readUint8(),
            reader.readUint8(),
          ];
          layer.scaleX = reader.readFloat32();
          layer.scaleY = version <= 2.3 ? layer.scaleX : reader.readFloat32();
          layer.angle = reader.readInt32();
          layer.spriteType = reader.readInt32();
          if (version >= 2.5) {
            layer.width = reader.readInt32();
            layer.height = reader.readInt32();
          }
        }
        layers.push(layer);
      }

      if (version >= 2) {
        reader.skip(4);
      }
      if (version >= 2.3) {
        const anchorCount = reader.readUint32();
        if (anchorCount > 4096) {
          throw new Error("ACT frame contains too many anchors");
        }
        reader.skip(anchorCount * 16);
      }
      frames.push(layers);
    }
    actions.push(frames);
  }

  if (version >= 2.1) {
    const soundCount = reader.readUint32();
    if (soundCount > 4096) {
      throw new Error("ACT contains too many sound entries");
    }
    reader.skip(soundCount * 40);
    if (version >= 2.2) {
      reader.skip(actionCount * 4);
    }
  }

  return { actions, version };
}
