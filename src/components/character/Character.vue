<template>
    <img :src="img_src" alt="character" />
</template>

<script>
import { mapState } from 'vuex'
import itemsJson from '../../db/items.json';

export default {
    name: "Character",
    data() {
        return {
            img_src: ""
        }
    },
    methods: {
        requestCharacter: async function (characterState = this.character) {
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
                this.img_src = URL.createObjectURL(image)
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