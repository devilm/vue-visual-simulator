<template>
    <img :src="img_src" alt="character" />
</template>

<script>
import { mapState } from 'vuex'
import itemsJson from '../../db/items.json';

const renderCacheName = "character-renders-v1";

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
    data() {
        return {
            img_src: "",
            renderRequestId: 0,
        }
    },
    methods: {
        requestCharacter: async function (characterState = this.character) {
            const renderRequestId = ++this.renderRequestId;
            const character = JSON.stringify(characterState)
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
            localStorage.setItem('character', character);
        }
    },
    computed: {
        ...mapState({
            character: state => state.character,
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
</style>