import { Container, Graphics, Sprite, Texture, Ticker } from "pixi.js";

// Fixed render scale: native sprites are ~90-100px tall (feet to top of head/headgear); the in-game
// character appears ~144px tall, i.e. ~1.5x. The scale never depends on equipped headgear/garment.
const CHARACTER_SCALE = 1;
// Distance between the character's feet (sprite origin) and the bottom edge of the view.
const FEET_BOTTOM_MARGIN = 24;
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
  texture.source.scaleMode = "nearest";
  textureCache.set(frame, texture);
  return texture;
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

function stopAnimation(scene) {
  if (scene.__animationTick) {
    Ticker.shared.remove(scene.__animationTick);
    scene.__animationTick = null;
  }
}

function startAnimation(scene, frameContainers, interval) {
  if (frameContainers.length < 2) {
    return;
  }

  let elapsed = 0;
  let current = 0;
  const tick = (ticker) => {
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

  frameContainers.forEach((frameContainer, index) => {
    frameContainer.visible = index === 0;
  });
  // Locked scale and anchor: the sprite origin (feet) sits at the horizontal centre, a fixed distance
  // above the bottom edge, so equipping headgear/garment never rescales or shifts the character.
  content.scale.set(Math.max(1, Math.round(CHARACTER_SCALE * resolution)) / resolution);
  content.position.set(toDevice(viewWidth / 2), toDevice(viewHeight - FEET_BOTTOM_MARGIN));
  scene.addChild(content);

  startAnimation(scene, frameContainers, rendered?.interval || 96);
}

export function disposeCharacterScene(scene) {
  stopAnimation(scene);
}
