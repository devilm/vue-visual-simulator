<template>
  <div class="character-preview">
    <p
      v-if="previewError"
      class="character-preview-error"
      role="alert"
    >
      {{ previewError }}
    </p>
    <CharacterCanvas
      :image-src="img_src"
      :sprite-sources="usingLocalNovicePreview ? localNoviceSpriteSources : null"
      :sprite-action="Number(character.action)"
      :head-direction="Number(character.headdir)"
      @render-error="handleRenderError"
    />
  </div>
</template>

<script>
import { mapState } from 'vuex'
import CharacterCanvas from './CharacterCanvas.vue'
import itemsJson from '../../db/items.json';

const renderCacheName = "character-renders-v1";
const localNoviceActionGroups = new Set([0, 1, 2, 3, 4, 5, 6, 8, 10, 11, 12]);
const localNoviceBodySpriteSources = {
    bodySpr: `${process.env.BASE_URL}local-assets/novice/body.spr`,
    bodyAct: `${process.env.BASE_URL}local-assets/novice/body.act`,
    bodyImf: `${process.env.BASE_URL}local-assets/novice/body.imf`,
};

async function getRenderCacheKey(url, payload) {
    if (
        typeof caches === "undefined" ||
        !window.crypto ||
        !window.crypto.subtle
    ) {
        return null;
    }

    const data = new TextEncoder().encode(`${url}\n${payload}`);
    const digest = await window.crypto.subtle.digest("SHA-256", data);
    const hash = Array.from(new Uint8Array(digest))
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");

    return new Request(
        `${window.location.origin}/__character-render-cache__/${hash}`
    );
}

export default {
    name: "Character",
    components: {
        CharacterCanvas,
    },
    data() {
        return {
            img_src: "",
            renderRequestId: 0,
            previewError: "",
            usingLocalNovicePreview: false,
        }
    },
    methods: {
        handleRenderError(error) {
            console.error("Unable to draw character on canvas:", error);
            this.previewError = this.usingLocalNovicePreview
                ? this.$t("novicePreviewMissing")
                : this.$t("characterPreviewError");
        },
        supportsLocalNovicePreview(characterState) {
            const jobId = Array.isArray(characterState.job)
                ? characterState.job[0]
                : characterState.job;
            const action = Number(characterState.action);
            const equippedItemIds = [
                this.$store.state.headgear_top_item,
                this.$store.state.headgear_mid_item,
                this.$store.state.headgear_bottom_item,
                this.$store.state.garment_item,
            ];

            return (
                Number(jobId) === 0 &&
                Number(characterState.gender) === 1 &&
                Number.isInteger(Number(characterState.head)) &&
                Number(characterState.head) >= 1 &&
                Number(characterState.head) <= 42 &&
                Number.isInteger(Number(characterState.headPalette)) &&
                Number(characterState.headPalette) >= 0 &&
                Number(characterState.headPalette) <= 8 &&
                Number.isInteger(Number(characterState.bodyPalette)) &&
                Number(characterState.bodyPalette) >= 0 &&
                Number(characterState.bodyPalette) <= 7 &&
                Number.isInteger(action) &&
                action >= 0 &&
                localNoviceActionGroups.has(Math.floor(action / 8)) &&
                Number.isInteger(Number(characterState.headdir)) &&
                Number(characterState.headdir) >= 0 &&
                Number(characterState.headdir) <= 2 &&
                Number(characterState.outfit) === 0 &&
                Number(characterState.garment) === 0 &&
                Array.isArray(characterState.headgear) &&
                characterState.headgear.every((viewId) => Number(viewId) === 0) &&
                equippedItemIds.every((item) => !Number(item?.id)) &&
                !this.$store.state.regular_mount_checked &&
                !this.$store.state.cash_mount_checked
            );
        },
        requestCharacter: async function (characterState = this.character) {
            const renderRequestId = ++this.renderRequestId;
            const character = JSON.stringify(characterState)
            localStorage.setItem('character', character);
            this.previewError = "";
            this.usingLocalNovicePreview = this.supportsLocalNovicePreview(characterState);

            if (this.usingLocalNovicePreview) {
                if (this.img_src.startsWith("blob:")) {
                    URL.revokeObjectURL(this.img_src);
                }
                this.img_src = "";
                return;
            }

            const equippedViewIds = new Set(
                [...characterState.headgear, characterState.garment].map(Number)
            )
            const equippedItemIds = new Set(
                [
                    this.$store.state.headgear_top_item,
                    this.$store.state.headgear_mid_item,
                    this.$store.state.headgear_bottom_item,
                    this.$store.state.garment_item,
                ]
                    .map((item) => Number(item?.id))
                    .filter(Boolean)
            )
            const effect =
                itemsJson.find(
                    (item) => item.effect && equippedItemIds.has(Number(item.id))
                )?.effect ||
                itemsJson.find(
                    (item) =>
                        item.effect &&
                        Number(item.viewID) !== 0 &&
                        equippedViewIds.has(Number(item.viewID))
                )?.effect
            const textureItem =
                itemsJson.find(
                    (item) =>
                        (item.texture ||
                            item.textureOffsetX != null ||
                            item.textureOffsetY != null) &&
                        equippedItemIds.has(Number(item.id))
                ) ||
                itemsJson.find(
                    (item) =>
                        (item.texture ||
                            item.textureOffsetX != null ||
                            item.textureOffsetY != null) &&
                        Number(item.viewID) !== 0 &&
                        equippedViewIds.has(Number(item.viewID))
                )
            const payload = JSON.stringify({
                job: characterState.job,
                action: characterState.action,
                headgear: characterState.headgear.filter((viewId) => Number(viewId) !== 0),
                garment: characterState.garment,
                weapon: 2,
                head: characterState.head,
                headPalette: characterState.headPalette,
                bodyPalette: characterState.bodyPalette,
                outfit: characterState.outfit,
                gender: characterState.gender,
                headdir: characterState.headdir,
                ...(effect ? { effect } : {}),
                ...(textureItem?.texture ? { texture: textureItem.texture } : {}),
                ...(textureItem?.textureOffsetX != null
                    ? { textureOffsetX: textureItem.textureOffsetX }
                    : {}),
                ...(textureItem?.textureOffsetY != null
                    ? { textureOffsetY: textureItem.textureOffsetY }
                    : {}),
            })
            const url = process.env.VUE_APP_API_URL
            const requestRender = async function () {
                const response = await fetch(url, {
                    method: "POST",
                    headers: {
                        'Content-Type': 'application/json',
                        'x-accesstoken': process.env.VUE_APP_API_KEY,
                    },
                    body: payload,
                })
                if (!response.ok) {
                    throw new Error(`Render request failed: ${response.status} ${response.statusText}`);
                }
                return response.blob();
            }

            try {
                let image
                let cacheKey

                try {
                    cacheKey = await getRenderCacheKey(url, payload)
                    if (cacheKey) {
                        const cache = await caches.open(renderCacheName)
                        const cachedResponse = await cache.match(cacheKey)
                        if (cachedResponse) {
                            image = await cachedResponse.blob()
                        }
                    }
                } catch (error) {
                    console.warn("Unable to read character render cache:", error)
                }

                if (!image) {
                    try {
                        image = await requestRender()
                    } catch {
                        const healthUrl = `${new URL(url).origin}/health`
                        const healthResponse = await fetch(healthUrl)
                        if (!healthResponse.ok) {
                            throw new Error(`Renderer health check failed: ${healthResponse.status} ${healthResponse.statusText}`)
                        }
                        image = await requestRender()
                    }

                    if (cacheKey) {
                        try {
                            const cache = await caches.open(renderCacheName)
                            await cache.put(
                                cacheKey,
                                new Response(image, {
                                    headers: image.type
                                        ? { "Content-Type": image.type }
                                        : {},
                                })
                            )
                        } catch (error) {
                            console.warn("Unable to save character render cache:", error)
                        }
                    }
                }

                if (renderRequestId === this.renderRequestId) {
                    if (this.img_src.startsWith("blob:")) {
                        URL.revokeObjectURL(this.img_src)
                    }
                    this.img_src = URL.createObjectURL(image)
                }
            } catch (error) {
                console.error('There has been a problem with character fetch operation: ' + error.message);
            }
        }
    },
    computed: {
        ...mapState({
            character: state => state.character,
        }),
        localNoviceSpriteSources() {
            const hairStyle = Number(this.character.head);
            const hairColor = Number(this.character.headPalette);
            const hairPath = `${process.env.BASE_URL}local-assets/novice/hair/${hairStyle}`;
            const bodyPalette = Number(this.character.bodyPalette);

            return {
                ...localNoviceBodySpriteSources,
                bodyPalette: `${process.env.BASE_URL}local-assets/novice/body_${bodyPalette}.pal`,
                headSpr: `${hairPath}.spr`,
                headAct: `${hairPath}.act`,
                headPalette: `${hairPath}_${hairColor}.pal`,
            };
        },
        renderKey() {
            return JSON.stringify({
                character: this.character,
                equippedItemIds: [
                    this.$store.state.headgear_top_item,
                    this.$store.state.headgear_mid_item,
                    this.$store.state.headgear_bottom_item,
                    this.$store.state.garment_item,
                ].map((item) => item?.id),
                mounts: [
                    this.$store.state.regular_mount_checked,
                    this.$store.state.cash_mount_checked,
                ],
            })
        },
    },
    watch: {
        renderKey: {
            handler() {
                this.requestCharacter(this.character)
            },
            immediate: true,
        },
    },
}
</script>

<style>
.character-preview {
    display: flex;
    flex-direction: column;
    align-items: center;
}

.character-preview-error {
    margin: 0 0 0.5rem;
    color: #a94442;
    font-size: 0.8rem;
    text-align: center;
}
</style>