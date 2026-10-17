<template>
  <canvas
    ref="canvas"
    class="character-canvas"
    role="img"
    aria-label="Rendered character"
    :width="width"
    :height="height"
  />
</template>

<script>
const imageCache = new Map();

function loadImage(src) {
  const shouldCache = !src.startsWith("blob:");
  if (!shouldCache || !imageCache.has(src)) {
    const imagePromise = new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(`Unable to load image: ${src}`));
      image.src = src;
    });
    if (!shouldCache) return imagePromise;

    imageCache.set(
      src,
      imagePromise.catch((error) => {
        imageCache.delete(src);
        throw error;
      })
    );
  }

  return imageCache.get(src);
}

export default {
  name: "CharacterCanvas",
  props: {
    imageSrc: {
      type: String,
      default: "",
    },
    layers: {
      type: Array,
      default: () => [],
    },
    width: {
      type: Number,
      default: 200,
    },
    height: {
      type: Number,
      default: 200,
    },
  },
  emits: ["render-error"],
  data() {
    return {
      renderId: 0,
    };
  },
  mounted() {
    this.renderCanvas();
  },
  watch: {
    imageSrc() {
      this.renderCanvas();
    },
    layers: {
      deep: true,
      handler() {
        this.renderCanvas();
      },
    },
    width() {
      this.renderCanvas();
    },
    height() {
      this.renderCanvas();
    },
  },
  methods: {
    async renderCanvas() {
      const renderId = (this.renderId || 0) + 1;
      this.renderId = renderId;

      const layers = this.layers.length
        ? this.layers
        : this.imageSrc
          ? [{ src: this.imageSrc, contain: true }]
          : [];

      try {
        const loadedLayers = await Promise.all(
          layers.map(async (layer) => ({
            ...layer,
            image: await loadImage(layer.src),
          }))
        );

        if (renderId !== this.renderId) return;

        const canvas = this.$refs.canvas;
        const context = canvas?.getContext("2d");
        if (!context) {
          throw new Error("Canvas 2D context is unavailable.");
        }

        const pixelRatio = window.devicePixelRatio || 1;
        canvas.width = Math.round(this.width * pixelRatio);
        canvas.height = Math.round(this.height * pixelRatio);
        canvas.style.width = `${this.width}px`;
        canvas.style.height = `${this.height}px`;

        context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
        context.clearRect(0, 0, this.width, this.height);
        context.imageSmoothingEnabled = false;

        loadedLayers.forEach((layer) => {
          const { image } = layer;
          const sourceX = layer.sx ?? 0;
          const sourceY = layer.sy ?? 0;
          const sourceWidth = layer.sw ?? image.naturalWidth;
          const sourceHeight = layer.sh ?? image.naturalHeight;
          const drawWidth = layer.width ?? sourceWidth;
          const drawHeight = layer.height ?? sourceHeight;
          let drawX = layer.x ?? 0;
          const drawY = layer.y ?? 0;

          if (layer.contain) {
            const scale = Math.min(
              this.width / sourceWidth,
              this.height / sourceHeight
            );
            const containedWidth = sourceWidth * scale;
            const containedHeight = sourceHeight * scale;
            drawX = (this.width - containedWidth) / 2;
            context.drawImage(
              image,
              sourceX,
              sourceY,
              sourceWidth,
              sourceHeight,
              drawX,
              (this.height - containedHeight) / 2,
              containedWidth,
              containedHeight
            );
            return;
          }

          context.save();
          if (layer.flipX) {
            context.translate(drawX * 2 + drawWidth, 0);
            context.scale(-1, 1);
          }
          context.drawImage(
            image,
            sourceX,
            sourceY,
            sourceWidth,
            sourceHeight,
            drawX,
            drawY,
            drawWidth,
            drawHeight
          );
          context.restore();
        });
      } catch (error) {
        if (renderId === this.renderId) {
          this.$emit("render-error", error);
        }
      }
    },
  },
};
</script>

<style scoped>
.character-canvas {
  display: block;
  max-width: 100%;
  image-rendering: pixelated;
}
</style>
