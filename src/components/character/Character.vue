<template>
  <div ref="renderRoot" class="character-render-root" aria-label="character"></div>
</template>

<script>
import { mapState } from "vuex";
import { Application, Container } from "pixi.js";

export default {
  name: "Character",
  data() {
    return {
      app: null,
      scene: null,
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
        equippedItemIds: [
          this.$store.state.headgear_top_item,
          this.$store.state.headgear_mid_item,
          this.$store.state.headgear_bottom_item,
          this.$store.state.garment_item,
        ].map((item) => item?.id),
      });
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
        autoDensity: true,
      });

      root.appendChild(app.canvas);

      this.scene = new Container();
      app.stage.addChild(this.scene);
      this.app = app;

      this.renderCharacter();
    },
    requestCharacter(characterState = this.character) {
      this.renderRequestId += 1;
      this.renderCharacter(characterState);
      localStorage.setItem("character", JSON.stringify(characterState));
    },
    renderCharacter() {
      if (!this.scene) {
        return;
      }

      this.scene.removeChildren();
    },
  },
};
</script>

<style scoped>
.character-render-root {
  width: 100%;
  height: 100%;
  min-height: 200px;
}

.character-render-root :deep(canvas) {
  display: block;
  width: 100%;
  height: 100%;
}
</style>