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
      :sprite-sources="usingLocalCharacterPreview ? localCharacterSpriteSources : null"
      :sprite-action="Number(character.action)"
      :head-direction="Number(character.headdir)"
      :garment-draw-on-top="
        Number(character.garment) !== 0 &&
        Number(character.garment) !== 109
      "
      :garment-covers-hair="Number(character.garment) === 109"
      @render-error="handleRenderError"
    />
  </div>
</template>

<script>
import { mapState } from 'vuex'
import CharacterCanvas from './CharacterCanvas.vue'
import itemsJson from '../../db/items.json';

const renderCacheName = "character-renders-v1";
const localSupportedActionGroups = new Set([0, 1, 2, 3, 4, 5, 6, 8, 10, 11, 12]);
const localSpriteManifestRequests = new Map();

function loadLocalJobManifest() {
    if (!localSpriteManifestRequests.has("jobs")) {
        const source = `${process.env.BASE_URL}local-assets/jobs/manifest.json`;
        const request = fetch(source)
            .then((response) => {
                if (!response.ok) {
                    throw new Error(`Unable to load ${source}: ${response.status}`);
                }
                return response.json();
            })
            .then((manifest) => {
                if (!manifest.jobs || typeof manifest.jobs !== "object") {
                    throw new Error("Local job manifest has an invalid format.");
                }
                return manifest;
            })
            .catch((error) => {
                localSpriteManifestRequests.delete("jobs");
                throw error;
            });
        localSpriteManifestRequests.set("jobs", request);
    }

    return localSpriteManifestRequests.get("jobs");
}

function loadLocalJobSpriteViewIds(spriteType, gender) {
    return loadLocalSpriteViewIdsFrom(
        `jobs:${spriteType}:${gender}`,
        `local-assets/jobs/equipment/${spriteType}/${gender}/manifest.json`,
        spriteType
    );
}

function loadLocalSpriteViewIdsFrom(requestKey, sourcePath, spriteType) {
    if (!localSpriteManifestRequests.has(requestKey)) {
        const source = `${process.env.BASE_URL}${sourcePath}`;
        const request = fetch(source)
            .then((response) => {
                if (!response.ok) {
                    throw new Error(`Unable to load ${source}: ${response.status}`);
                }
                return response.json();
            })
            .then((manifest) => {
                if (!Array.isArray(manifest.viewIds)) {
                    throw new Error(`Local ${spriteType} manifest has an invalid format.`);
                }
                const viewIds = manifest.viewIds.map(Number);
                if (
                    viewIds.some(
                        (viewId) => !Number.isInteger(viewId) || viewId <= 0
                    )
                ) {
                    throw new Error(`Local ${spriteType} manifest contains an invalid view ID.`);
                }
                return new Set(viewIds);
            })
            .catch((error) => {
                localSpriteManifestRequests.delete(requestKey);
                throw error;
            });
        localSpriteManifestRequests.set(requestKey, request);
    }

    return localSpriteManifestRequests.get(requestKey);
}

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
            localJobManifest: null,
            usingLocalCharacterPreview: false,
        }
    },
    methods: {
        handleRenderError(error) {
            console.error("Unable to draw character on canvas:", error);
            this.previewError = this.usingLocalCharacterPreview
                ? this.$t("localPreviewMissing")
                : this.$t("characterPreviewError");
        },
        supportsLocalCharacterPreview(
            characterState,
            localJobManifest,
            localHeadgearViewIds
        ) {
            const jobId = Array.isArray(characterState.job)
                ? characterState.job[0]
                : characterState.job;
            const numericJobId = Number(jobId);
            const gender = Number(characterState.gender);
            const localJob = localJobManifest?.jobs?.[numericJobId]?.[gender];
            const action = Number(characterState.action);
            const hairPalettes =
                localJob?.hairstyles?.[Number(characterState.head)] || [];
            const equippedHeadgearItems = [
                this.$store.state.headgear_bottom_item,
                this.$store.state.headgear_top_item,
                this.$store.state.headgear_mid_item,
            ];
            const garmentItem = this.$store.state.garment_item;
            const localJobGarmentViewIds = new Set(
                localJob?.garmentViewIds || []
            );
            const hasHeadgear =
                (Array.isArray(characterState.headgear) &&
                    characterState.headgear.some((viewId) => Number(viewId) !== 0)) ||
                equippedHeadgearItems.some((item) => Boolean(Number(item?.id)));
            const hasGarment =
                Boolean(Number(characterState.garment)) ||
                Boolean(Number(garmentItem?.id));

            return (
                Boolean(localJob) &&
                Array.isArray(localJob.bodyPalettes) &&
                localJob.bodyPalettes.includes(Number(characterState.bodyPalette)) &&
                Array.isArray(hairPalettes) &&
                hairPalettes.includes(Number(characterState.headPalette)) &&
                Number.isInteger(Number(characterState.headPalette)) &&
                Number.isInteger(Number(characterState.head)) &&
                Number.isInteger(Number(characterState.bodyPalette)) &&
                Number.isInteger(action) &&
                action >= 0 &&
                localSupportedActionGroups.has(Math.floor(action / 8)) &&
                Number.isInteger(Number(characterState.headdir)) &&
                Number(characterState.headdir) >= 0 &&
                Number(characterState.headdir) <= 2 &&
                Number(characterState.outfit) === 0 &&
                (!hasHeadgear ||
                    (Array.isArray(characterState.headgear) &&
                        characterState.headgear.every(
                            (viewId) =>
                                Number(viewId) === 0 ||
                                localHeadgearViewIds?.has(Number(viewId))
                        ) &&
                        equippedHeadgearItems.every(
                            (item) =>
                                !Number(item?.id) ||
                                localHeadgearViewIds?.has(Number(item.viewID))
                        ))) &&
                (!hasGarment ||
                    ((Number(characterState.garment) === 0 ||
                        localJobGarmentViewIds.has(Number(characterState.garment))) &&
                        (!Number(garmentItem?.id) ||
                            (!garmentItem.effect &&
                                !garmentItem.texture &&
                                garmentItem.textureOffsetX == null &&
                                garmentItem.textureOffsetY == null &&
                                localJobGarmentViewIds.has(Number(garmentItem.viewID)))))) &&
                !this.$store.state.regular_mount_checked &&
                !this.$store.state.cash_mount_checked
            );
        },
        requestCharacter: async function (characterState = this.character) {
            const renderRequestId = ++this.renderRequestId;
            const character = JSON.stringify(characterState)
            localStorage.setItem('character', character);
            this.previewError = "";
            let localHeadgearViewIds;
            let localJobManifest;
            const requests = [
                loadLocalJobManifest().then((manifest) => {
                    localJobManifest = manifest;
                }),
            ];
            if (
                Array.isArray(characterState.headgear) &&
                characterState.headgear.some((viewId) => Number(viewId) !== 0)
            ) {
                requests.push(
                    loadLocalJobSpriteViewIds(
                        "headgear",
                        Number(characterState.gender)
                    ).then((viewIds) => {
                        localHeadgearViewIds = viewIds;
                    })
                );
            }
            try {
                await Promise.all(requests);
            } catch (error) {
                console.warn(
                    "Local character assets are unavailable; using the renderer API.",
                    error
                );
            }
            if (renderRequestId !== this.renderRequestId) return;
            this.localJobManifest = localJobManifest || null;
            this.usingLocalCharacterPreview = this.supportsLocalCharacterPreview(
                characterState,
                localJobManifest,
                localHeadgearViewIds
            );

            if (this.usingLocalCharacterPreview) {
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
        localCharacterSpriteSources() {
            const jobId = Array.isArray(this.character.job)
                ? Number(this.character.job[0])
                : Number(this.character.job);
            const gender = Number(this.character.gender);
            const localJob = this.localJobManifest?.jobs?.[jobId]?.[gender];
            if (!localJob) return null;

            const assetBase = `${process.env.BASE_URL}local-assets/jobs/${jobId}/${gender}`;
            const hairBase = `${process.env.BASE_URL}local-assets/jobs/hair/${localJob.race}/${gender}/${Number(this.character.head)}`;

            const hairStyle = Number(this.character.head);
            const hairColor = Number(this.character.headPalette);
            const bodyPalette = Number(this.character.bodyPalette);

            return {
                bodySpr: `${assetBase}/body.spr`,
                bodyAct: `${assetBase}/body.act`,
                bodyImf: localJob.hasImf ? `${assetBase}/body.imf` : null,
                bodyPalette: `${assetBase}/body_${bodyPalette}.pal`,
                headSpr: `${hairBase}.spr`,
                headAct: `${hairBase}.act`,
                headPalette: `${process.env.BASE_URL}local-assets/jobs/hair/${localJob.race}/${gender}/${hairStyle}_${hairColor}.pal`,
                headgear: this.character.headgear.map((viewId) => {
                    const id = Number(viewId);
                    if (!id) return null;
                    const headgearPath = `${process.env.BASE_URL}local-assets/jobs/equipment/headgear/${gender}/${id}`;
                    return {
                        spr: `${headgearPath}.spr`,
                        act: `${headgearPath}.act`,
                    };
                }),
                garment: Number(this.character.garment)
                    ? {
                          spr: `${assetBase}/garment/${Number(this.character.garment)}.spr`,
                          act: `${assetBase}/garment/${Number(this.character.garment)}.act`,
                      }
                    : null,
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