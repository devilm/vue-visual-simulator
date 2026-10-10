<template>
    <img :src="img_src" alt="character" />
</template>

<script>
import { mapState } from 'vuex'
export default {
    name: "Character",
    data() {
        return {
            img_src: ""
        }
    },
    methods: {
        requestCharacter: async function () {
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
            const self = this;
            const req = await fetch(url, {
                method: "POST",
                headers: {
                    'Content-Type': 'application/json',
                    'x-accesstoken': process.env.VUE_APP_API_KEY,
                },
                body: payload,
            }).then(function (response) {
                if (!response.ok) {
                    throw new Error(`Render request failed: ${response.status} ${response.statusText}`);
                }
                return response.blob();
            }).then(function (myBlob) {
                var objectURL = URL.createObjectURL(myBlob);
                self.img_src = objectURL;
            }).catch(function (error) {
                console.error('There has been a problem with character fetch operation: ' + error.message);
            });
            localStorage.setItem('character', character);
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
            handler: 'requestCharacter'
        }
    },
}
</script>

<style>
</style>