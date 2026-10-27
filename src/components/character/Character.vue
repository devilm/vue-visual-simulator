<template>
  <div ref="renderRoot" class="character-render-root" aria-label="character"></div>
</template>

<script>
import { markRaw } from "vue";
import { mapState } from "vuex";
import { Application, Container } from "pixi.js";
import { createCharacterTemplate } from "@/render/character/templates";
import { renderCharacterTemplate, disposeCharacterScene } from "@/render/character/renderer";

export default {
  name: "Character",
  data() {
    return {
      app: null,
      scene: null,
      lastTemplate: null,
      renderRequestId: 0,
    };
  },
  computed: {
    ...mapState({
      character: (state) => state.character,
    }),
    renderKey() {
      return JSON.stringify({
        character: this.character,
        equippedItemIds: this.equippedItems.map((item) => item?.id),
      });
    },
    equippedItems() {
      return [
        this.$store.state.headgear_top_item,
        this.$store.state.headgear_mid_item,
        this.$store.state.headgear_bottom_item,
        this.$store.state.garment_item,
      ];
    },
  },
  watch: {
    renderKey: {
      handler() {
        this.requestCharacter(this.character);
      },
      immediate: true,
    },
  },
  async mounted() {
    await this.initRenderCore();
    this.requestCharacter(this.character);
  },
  beforeUnmount() {
    if (this.app) {
      if (this.scene) {
        disposeCharacterScene(this.scene);
      }
      this.app.destroy(true, { children: true, texture: true });
      this.app = null;
      this.scene = null;
    }
  },
  methods: {
    async initRenderCore() {
      const root = this.$refs.renderRoot;
      if (!root) {
        return;
      }

      const app = new Application();
      await app.init({
        resizeTo: root,
        backgroundAlpha: 0,
        antialias: false,
        // Without this the canvas renders at 1x and the browser upscales it on HiDPI screens (blurry).
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      });

      root.appendChild(app.canvas);

      // Pixi objects must stay out of Vue's reactivity: proxies break Pixi's identity-based scene graph.
      this.scene = markRaw(new Container());
      app.stage.addChild(this.scene);
      this.app = markRaw(app);
      app.renderer.on("resize", () => this.drawTemplate());

      this.renderCharacter();
    },
    async requestCharacter(characterState = this.character) {
      const requestId = ++this.renderRequestId;
      await this.renderCharacter(characterState, requestId);
      localStorage.setItem("character", JSON.stringify(characterState));
    },
    async renderCharacter(characterState = this.character, requestId = this.renderRequestId) {
      if (!this.scene) {
        return;
      }

      // Equipped items may carry an animated STR texture effect (item.texture).
      const textureItems = this.equippedItems.filter((item) => item?.texture).map((item) => ({ ...item }));
      const template = await createCharacterTemplate(characterState, { textureItems });
      if (requestId !== this.renderRequestId) {
        return;
      }
      this.lastTemplate = markRaw(template);
      this.drawTemplate();
    },
    drawTemplate() {
      if (!this.scene || !this.app || !this.lastTemplate) {
        return;
      }
      renderCharacterTemplate(this.scene, this.lastTemplate, {
        width: this.app.screen.width,
        height: this.app.screen.height,
        resolution: this.app.renderer.resolution,
      });
    },
  },
};
</script>

<style scoped>
/* The render area is at least 280px wide (the ROS 2026 circle is ~170px across) so wide effects are not
   clipped by the canvas edge, even when the column is narrower. The parent centers its flex items, so any
   extra width overflows equally on both sides and the character stays centered. The transparent overhang
   must not swallow clicks. */
.character-render-root {
  width: max(100%, 280px);
  height: 220px;
  flex: 0 0 auto;
  pointer-events: none;
}

/* Size comes from Pixi (autoDensity); forcing 100% would stretch the backing store by a fractional factor. */
.character-render-root :deep(canvas) {
  display: block;
}
</style>