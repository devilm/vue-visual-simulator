import { Container, Graphics, Sprite, Texture, Ticker } from "pixi.js";
import { STR_ORIGIN_X, STR_ORIGIN_Y, sampleStrLayer } from "./strEffect";
import { toLightTexture } from "./textureDecoder";

// Fixed render scale: native sprites are ~90-100px tall (feet to top of head/headgear); the in-game
// character appears ~144px tall, i.e. ~1.5x. The scale never depends on equipped headgear/garment.
const CHARACTER_SCALE = 1;
// Distance between the character's feet (sprite origin) and the bottom edge of the view. The view reaches
// below the feet so ground effects (ROS circle extends ~54px below the feet) are not clipped.
const FEET_BOTTOM_MARGIN = 64;
const SHADOW_RADIUS_X = 14;
const SHADOW_RADIUS_Y = 5;

const textureCache = new WeakMap();

function getFrameTexture(frame) {
  let texture = textureCache.get(frame);
  if (texture && !texture.destroyed) {
    return texture;
  }

  const canvas = document.createElement("canvas");
  canvas.width = frame.width;
  canvas.height = frame.height;
  const context = canvas.getContext("2d");
  context.putImageData(new ImageData(frame.rgbaPixels, frame.width, frame.height), 0, 0);

  texture = Texture.from(canvas);
  // The game client samples sprites with bilinear filtering; "nearest" at non-integer ratios gives
  // the blocky, uneven pixels seen in the old render.
  texture.source.scaleMode = "linear";
  textureCache.set(frame, texture);
  return texture;
}

const lightImageCache = new WeakMap();

// Additive layers are drawn from a "light" copy (black -> transparent); see toLightTexture().
function getLightImage(image) {
  let light = lightImageCache.get(image);
  if (!light) {
    light = toLightTexture(image);
    lightImageCache.set(image, light);
  }
  return light;
}

function drawShadow(container) {
  const shadow = new Graphics();
  shadow.ellipse(0, 0, SHADOW_RADIUS_X, SHADOW_RADIUS_Y).fill({ color: 0x000000, alpha: 0.25 });
  container.addChild(shadow);
}

function drawParts(container, parts) {
  for (const part of parts) {
    const sprite = new Sprite(getFrameTexture(part.frame));
    sprite.anchor.set(0.5);
    sprite.scale.set(part.xScale * (part.mirror ? -1 : 1), part.yScale);
    sprite.angle = part.rotation;
    if (part.rotation === 0) {
      // ACT layer coordinates are sprite centres, so odd sizes land on half pixels. Snap the top-left
      // corner to the pixel grid (like the game client) so texels map 1:1 and edges stay crisp.
      const width = part.frame.width * Math.abs(part.xScale);
      const height = part.frame.height * Math.abs(part.yScale);
      sprite.position.set(Math.round(part.x - width / 2) + width / 2, Math.round(part.y - height / 2) + height / 2);
    } else {
      sprite.position.set(part.x, part.y);
    }
    sprite.tint = (part.color[0] << 16) | (part.color[1] << 8) | part.color[2];
    sprite.alpha = part.color[3] / 255;
    container.addChild(sprite);
  }
}

function drawFallback(container) {
  const fallback = new Graphics();
  fallback.roundRect(-12, -50, 24, 34, 6).fill({ color: 0xcc4455 });
  container.addChild(fallback);
}

// Builds the display objects of one STR effect. `update(elapsedMs)` advances every layer to the matching key.
function createStrEffectRunner(effect, container) {
  const { str, textures, offsetX, offsetY } = effect;
  const keyCount = Math.max(str.maxKey, 1);

  const layers = [];
  for (const layer of str.layers) {
    if (layer.keys.length === 0 || layer.textures.length === 0) {
      continue;
    }
    const node = new Container();
    const sprite = new Sprite();
    sprite.anchor.set(0.5);
    node.addChild(sprite);
    node.visible = false;
    container.addChild(node);
    layers.push({
      layer,
      node,
      sprite,
      images: layer.textures.map((name) => textures.get(name) || null),
    });
  }

  const update = (elapsedMs) => {
    const keyIndex = Math.floor((elapsedMs * str.fps) / 1000) % keyCount;
    for (const { layer, node, sprite, images } of layers) {
      const state = sampleStrLayer(layer, keyIndex);
      const image = state ? images[state.textureIndex] : null;
      if (!state || !image || state.maxX <= state.minX || state.maxY <= state.minY) {
        node.visible = false;
        continue;
      }

      node.visible = true;
      // Rotation pivots around the key position, like the quad vertices do in the client.
      node.position.set(state.x - STR_ORIGIN_X + offsetX, state.y - STR_ORIGIN_Y + offsetY);
      node.angle = state.angleDegrees;

      // Additive layers and textures without alpha (BMP) rely on black being invisible, so they are drawn
      // from a brightness-as-alpha copy; everything else keeps its own alpha channel.
      const asLight = state.additive || !image.hasAlpha;
      sprite.texture = getFrameTexture(asLight ? getLightImage(image) : image);
      sprite.position.set((state.minX + state.maxX) / 2, (state.minY + state.maxY) / 2);
      sprite.scale.set(
        ((state.maxX - state.minX) / image.width) * (state.flipX ? -1 : 1),
        ((state.maxY - state.minY) / image.height) * (state.flipY ? -1 : 1)
      );
      sprite.tint = (Math.round(state.color[0]) << 16) | (Math.round(state.color[1]) << 8) | Math.round(state.color[2]);
      sprite.alpha = state.color[3] / 255;
      sprite.blendMode = asLight ? "add" : "normal";
    }
  };

  update(0);
  return { update };
}

function stopAnimation(scene) {
  if (scene.__animationTick) {
    Ticker.shared.remove(scene.__animationTick);
    scene.__animationTick = null;
  }
}

function startAnimation(scene, frameContainers, interval, effectRunners = []) {
  if (frameContainers.length < 2 && effectRunners.length === 0) {
    return;
  }

  let elapsed = 0;
  let total = 0;
  let current = 0;
  const tick = (ticker) => {
    total += ticker.deltaMS;
    for (const runner of effectRunners) {
      runner.update(total);
    }

    if (frameContainers.length < 2) {
      return;
    }
    elapsed += ticker.deltaMS;
    if (elapsed < interval) {
      return;
    }
    const advance = Math.floor(elapsed / interval);
    elapsed -= advance * interval;
    frameContainers[current].visible = false;
    current = (current + advance) % frameContainers.length;
    frameContainers[current].visible = true;
  };

  scene.__animationTick = tick;
  Ticker.shared.add(tick);
}

export function renderCharacterTemplate(scene, template, viewSize = { width: 200, height: 200 }) {
  stopAnimation(scene);
  const resolution = Math.max(viewSize.resolution || 1, 1);
  // Snap to whole device pixels so every texel covers an integer number of screen pixels (no uneven stretching).
  const toDevice = (value) => Math.round(value * resolution) / resolution;
  scene.removeChildren().forEach((child) => child.destroy({ children: true }));
  const viewWidth = Math.max(viewSize.width, 1);
  const viewHeight = Math.max(viewSize.height, 1);

  const content = new Container();
  drawShadow(content);

  // Texture effects (item.texture .str) follow the client's isRenderBeforeCharacter flag (item.effectBehind):
  // flagged effects are drawn behind the character, the rest on top of it.
  const effectsBehind = new Container();
  const effectsFront = new Container();
  // Garment effects (e.g. ROS) are drawn first so every other equipped effect stays visible on top of them.
  const orderedEffects = [...(template.textureEffects || [])].sort(
    (a, b) => Number(Boolean(b.garment)) - Number(Boolean(a.garment))
  );
  const effectRunners = orderedEffects.map((effect) =>
    createStrEffectRunner(effect, effect.behind ? effectsBehind : effectsFront)
  );
  content.addChild(effectsBehind);

  const rendered = template.rendered;
  const frameContainers = [];
  if (rendered?.ok) {
    const frames = rendered.frames?.length ? rendered.frames : [rendered.parts];
    for (const frameParts of frames) {
      const frameContainer = new Container();
      drawParts(frameContainer, frameParts);
      content.addChild(frameContainer);
      frameContainers.push(frameContainer);
    }
  } else {
    drawFallback(content);
  }
  content.addChild(effectsFront);

  frameContainers.forEach((frameContainer, index) => {
    frameContainer.visible = index === 0;
  });
  // Locked scale and anchor: the sprite origin (feet) sits at the horizontal centre, a fixed distance
  // above the bottom edge, so equipping headgear/garment never rescales or shifts the character.
  content.scale.set(CHARACTER_SCALE);
  content.position.set(toDevice(viewWidth / 2), toDevice(viewHeight - FEET_BOTTOM_MARGIN));
  scene.addChild(content);

  startAnimation(scene, frameContainers, rendered?.interval || 96, effectRunners);
}

export function disposeCharacterScene(scene) {
  stopAnimation(scene);
}
