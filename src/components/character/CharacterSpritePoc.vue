<template>
  <div class="sprite-poc">
    <canvas
      ref="canvas"
      class="sprite-canvas"
      width="180"
      height="200"
      aria-label="Ragnarok SPR and ACT sprite preview"
    ></canvas>
    <label class="sprite-action-picker">
      <span>ACT</span>
      <select v-model.number="selectedAction" aria-label="ACT action">
        <option
          v-for="option in availableActions"
          :key="option.index"
          :value="option.index"
        >
          {{ option.index }} ({{ option.frameCount }})
        </option>
      </select>
    </label>
    <div v-if="errorMessage" class="sprite-error" role="alert">
      {{ errorMessage }}
    </div>
  </div>
</template>

<script>
import actUrl from "@/data/sprite/로브/검아이템.act";
import sprUrl from "@/data/sprite/로브/검아이템.spr";
import { parseAct, parseSpr } from "@/utils/ragnarokSprite";

const frameDuration = 180;

export default {
  name: "CharacterSpritePoc",
  data() {
    return {
      actions: [],
      spriteCanvases: [],
      indexedSpriteCount: 0,
      selectedAction: 10,
      frameIndex: 0,
      errorMessage: "",
      animationTimer: null,
    };
  },
  computed: {
    availableActions() {
      return this.actions
        .map((frames, index) => ({
          index,
          frameCount: frames.length,
          hasSprites: frames.some((layers) =>
            layers.some((layer) => layer.spriteIndex >= 0)
          ),
        }))
        .filter((action) => action.frameCount && action.hasSprites);
    },
    currentFrames() {
      return this.actions[this.selectedAction] || [];
    },
  },
  watch: {
    selectedAction() {
      this.frameIndex = 0;
      this.drawFrame();
    },
  },
  async mounted() {
    try {
      const [actResponse, sprResponse] = await Promise.all([
        fetch(actUrl),
        fetch(sprUrl),
      ]);
      if (!actResponse.ok || !sprResponse.ok) {
        throw new Error("Unable to load the sample ACT/SPR files");
      }

      const [actBuffer, sprBuffer] = await Promise.all([
        actResponse.arrayBuffer(),
        sprResponse.arrayBuffer(),
      ]);
      const act = parseAct(actBuffer);
      const spr = parseSpr(sprBuffer);
      this.actions = act.actions;
      this.indexedSpriteCount = spr.indexedCount;
      this.spriteCanvases = this.createSpriteCanvases(spr);

      if (!this.availableActions.some(({ index }) => index === this.selectedAction)) {
        this.selectedAction = this.availableActions[0]?.index ?? 0;
      }
      this.drawFrame();
      this.animationTimer = window.setInterval(() => {
        if (this.currentFrames.length > 1) {
          this.frameIndex = (this.frameIndex + 1) % this.currentFrames.length;
          this.drawFrame();
        }
      }, frameDuration);
    } catch (error) {
      this.errorMessage = `Sprite POC failed: ${error.message}`;
      console.error(this.errorMessage, error);
    }
  },
  beforeUnmount() {
    if (this.animationTimer !== null) {
      window.clearInterval(this.animationTimer);
    }
  },
  methods: {
    createSpriteCanvases(spr) {
      return spr.frames.map((frame) => {
        const canvas = document.createElement("canvas");
        canvas.width = frame.width;
        canvas.height = frame.height;
        const context = canvas.getContext("2d");
        const imageData = context.createImageData(frame.width, frame.height);

        if (frame.type === "indexed") {
          for (let pixel = 0; pixel < frame.pixels.length; pixel += 1) {
            const colorIndex = frame.pixels[pixel];
            const source = colorIndex * 4;
            const target = pixel * 4;
            imageData.data[target] = spr.palette[source];
            imageData.data[target + 1] = spr.palette[source + 1];
            imageData.data[target + 2] = spr.palette[source + 2];
            imageData.data[target + 3] = colorIndex === 0 ? 0 : 255;
          }
        } else {
          for (let pixel = 0; pixel < frame.pixels.length; pixel += 4) {
            imageData.data[pixel] = frame.pixels[pixel + 2];
            imageData.data[pixel + 1] = frame.pixels[pixel + 1];
            imageData.data[pixel + 2] = frame.pixels[pixel];
            imageData.data[pixel + 3] = frame.pixels[pixel + 3];
          }
        }
        context.putImageData(imageData, 0, 0);
        return canvas;
      });
    },
    drawFrame() {
      const canvas = this.$refs.canvas;
      if (!canvas) {
        return;
      }
      const context = canvas.getContext("2d");
      context.clearRect(0, 0, canvas.width, canvas.height);
      const getDrawableLayers = (layers) =>
        layers
          .map((layer) => ({
            layer,
            canvas: this.spriteCanvases[
              layer.spriteType === 0
                ? layer.spriteIndex
                : this.indexedSpriteCount + layer.spriteIndex
            ],
          }))
          .filter(
            ({ layer, canvas: sprite }) =>
              sprite &&
              layer.scaleX !== 0 &&
              layer.scaleY !== 0 &&
              layer.color[3] !== 0
          );
      const drawableLayers = getDrawableLayers(
        this.currentFrames[this.frameIndex] || []
      );
      const actionLayers = getDrawableLayers(this.currentFrames.flat());

      if (!drawableLayers.length) {
        return;
      }

      const bounds = actionLayers.reduce(
        (result, { layer, canvas: sprite }) => {
          const width = sprite.width * Math.abs(layer.scaleX);
          const height = sprite.height * Math.abs(layer.scaleY);
          return {
            left: Math.min(result.left, layer.x),
            top: Math.min(result.top, layer.y),
            right: Math.max(result.right, layer.x + width),
            bottom: Math.max(result.bottom, layer.y + height),
          };
        },
        { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity }
      );
      const sceneWidth = bounds.right - bounds.left;
      const sceneHeight = bounds.bottom - bounds.top;
      const scale = Math.min(
        4.5,
        (canvas.width * 0.82) / sceneWidth,
        (canvas.height * 0.82) / sceneHeight
      );

      context.imageSmoothingEnabled = false;
      context.save();
      context.translate(canvas.width / 2, canvas.height / 2);
      context.scale(scale, scale);
      context.translate(
        -(bounds.left + sceneWidth / 2),
        -(bounds.top + sceneHeight / 2)
      );

      for (const { layer, canvas: sprite } of drawableLayers) {
        const width = sprite.width * layer.scaleX;
        const height = sprite.height * layer.scaleY;
        context.save();
        context.globalAlpha = layer.color[3] / 255;
        context.translate(layer.x + (layer.mirrored ? width : 0), layer.y);
        context.scale(layer.mirrored ? -1 : 1, 1);
        context.rotate((layer.angle * Math.PI) / 180);
        context.scale(layer.scaleX, layer.scaleY);
        context.drawImage(sprite, 0, 0);
        context.restore();
      }

      context.restore();
    },
  },
};
</script>

<style scoped>
.sprite-poc {
  position: relative;
  width: 100%;
  height: 100%;
}

.sprite-canvas {
  display: block;
  width: 100%;
  height: 100%;
  image-rendering: pixelated;
}

.sprite-action-picker {
  position: absolute;
  bottom: 0.25rem;
  left: 0.25rem;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.15rem 0.25rem;
  border-radius: 0.25rem;
  background: rgba(255, 255, 255, 0.85);
  font-size: 0.7rem;
}

.sprite-action-picker select {
  max-width: 6rem;
  font-size: inherit;
}

.sprite-error {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 1rem;
  background: rgba(255, 255, 255, 0.9);
  color: #a00;
  font-size: 0.8rem;
  text-align: center;
}
</style>
