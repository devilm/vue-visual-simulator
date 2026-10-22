import { Container, Graphics, Sprite, Texture, Ticker } from "pixi.js";

const MAX_SCALE = 2;
const VIEW_PADDING = 16;
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
    sprite.position.set(part.x, part.y);
    sprite.scale.set(part.xScale * (part.mirror ? -1 : 1), part.yScale);
    sprite.angle = part.rotation;
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

// Union of the shadow and every part of every frame, in content-local coordinates.
function computeContentBounds(frames) {
  let minX = -SHADOW_RADIUS_X;
  let maxX = SHADOW_RADIUS_X;
  let minY = -SHADOW_RADIUS_Y;
  let maxY = SHADOW_RADIUS_Y;

  if (frames.length === 0) {
    // Fallback placeholder rectangle.
    minX = -12;
    maxX = 12;
    minY = -50;
    maxY = Math.max(maxY, -16);
  }

  for (const parts of frames) {
    for (const part of parts) {
      const halfWidth = (part.frame.width * Math.abs(part.xScale)) / 2;
      const halfHeight = (part.frame.height * Math.abs(part.yScale)) / 2;
      const radians = (part.rotation * Math.PI) / 180;
      const cos = Math.abs(Math.cos(radians));
      const sin = Math.abs(Math.sin(radians));
      const extentX = halfWidth * cos + halfHeight * sin;
      const extentY = halfWidth * sin + halfHeight * cos;
      minX = Math.min(minX, part.x - extentX);
      maxX = Math.max(maxX, part.x + extentX);
      minY = Math.min(minY, part.y - extentY);
      maxY = Math.max(maxY, part.y + extentY);
    }
  }

  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
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

  // Fit the whole character using the union of all frames so the scale stays stable while animating.
  // Bounds come from the part data (not Container.getLocalBounds on a live node), and the transform
  // is applied before the content is attached to the scene.
  const bounds = computeContentBounds(rendered?.ok ? rendered.frames || [rendered.parts] : []);
  frameContainers.forEach((frameContainer, index) => {
    frameContainer.visible = index === 0;
  });
  const scale = Math.min(
    MAX_SCALE,
    (viewWidth - VIEW_PADDING * 2) / Math.max(bounds.width, 1),
    (viewHeight - VIEW_PADDING * 2) / Math.max(bounds.height, 1)
  );
  content.scale.set(scale);
  content.position.set(
    Math.round(viewWidth / 2 - (bounds.x + bounds.width / 2) * scale),
    Math.round(viewHeight / 2 - (bounds.y + bounds.height / 2) * scale)
  );
  scene.addChild(content);

  startAnimation(scene, frameContainers, rendered?.interval || 96);
}

export function disposeCharacterScene(scene) {
  stopAnimation(scene);
}
