<template>
    <div class="character-render position-relative d-inline-block">
        <img :src="img_src" alt="character" />
        <div
            v-if="isLoading"
            class="position-absolute top-50 start-50 translate-middle bg-light bg-opacity-75 rounded shadow-sm p-2 d-flex align-items-center gap-2 text-nowrap"
            role="status"
            aria-live="polite"
        >
            <span class="spinner-border spinner-border-sm" aria-hidden="true"></span>
            <span>{{ isWakingUp ? $t("renderServiceWaking") : $t("renderCharacterLoading") }}</span>
        </div>
    </div>
</template>

<script>
import { mapState } from 'vuex'
export default {
    name: "Character",
    data() {
        return {
            img_src: "",
            isLoading: false,
            isWakingUp: false,
            requestId: 0,
        }
    },
    methods: {
        requestCharacter: async function () {
            const requestId = ++this.requestId
            const character = JSON.stringify(this.character)
            const payload = JSON.stringify({
                job: this.character.job,
                action: this.character.action,
                headgear: this.character.headgear.filter((viewId) => Number(viewId) !== 0),
                garment: this.character.garment,
                weapon: 2,
                head: this.character.head,
                gender: this.character.gender,
                headdir: this.character.headdir,
                effect: "c_eye_of_necromancer",
            })
            const url = process.env.VUE_APP_API_URL
            this.isLoading = true
            this.isWakingUp = false
            const wakingTimer = setTimeout(() => {
                if (requestId === this.requestId) this.isWakingUp = true
            }, 1500)

            try {
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
                const image = await response.blob()
                if (requestId === this.requestId) {
                    this.img_src = URL.createObjectURL(image)
                }
            } catch (error) {
                console.error('There has been a problem with character fetch operation:', error);
            } finally {
                clearTimeout(wakingTimer)
                if (requestId === this.requestId) {
                    this.isLoading = false
                    this.isWakingUp = false
                }
            }

            localStorage.setItem('character', character)
        }
    },
    computed: {
        ...mapState({
            character: state => state.character,
        }),
    },
    watch: {
        '$store.state.character': {
            deep: true,
            handler: 'requestCharacter',
            immediate: true,
        }
    },
}
</script>

<style>
</style>