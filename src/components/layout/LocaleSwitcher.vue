<template>
  <select
    class="form-select language_select"
    :value="current_language"
    @change="switchLocale($event)"
  >
    <option
      v-for="locale in locales"
      :value="locale"
      :key="locale"
      class="language_option"
    >
      {{ locale.toUpperCase() }}
    </option>
  </select>
</template>

<script>
export default {
  name: "LocaleSwitcher",
  mounted() {
    this.loadLanguageFromLocalStorage();
  },
  methods: {
    switchLocale(event) {
      const locale = event.target.value;
      if (this.$i18n.locale !== locale) {
        this.$i18n.locale = locale;
      }
      this.current_language = locale;
      localStorage.setItem("current_language", locale);
    },
    loadLanguageFromLocalStorage: function () {
      const savedLanguage = localStorage.getItem("current_language");
      const defaultLanguage = process.env.VUE_APP_I18N_LOCALE || "th";
      const language = this.locales.includes(savedLanguage)
        ? savedLanguage
        : this.locales.includes(defaultLanguage)
          ? defaultLanguage
          : this.locales[0];

      this.current_language = language;
      if (this.$i18n.locale !== language) {
        this.$i18n.locale = language;
      }
      if (savedLanguage !== language) {
        localStorage.setItem("current_language", language);
      }
    },
  },
  data() {
    return {
      locales: process.env.VUE_APP_I18N_SUPPORTED_LOCALE.split(","),
      current_language: process.env.VUE_APP_I18N_LOCALE || "th",
    };
  },
};
</script>

<style scoped>
.language_select,
.language_option {
  text-transform: uppercase;
}

.language_select {
  background-color: rgba(255, 255, 255, 0.5) !important;
  border: none;
  color: #fff;
  -webkit-appearance: none;
  -moz-appearance: none;
}

.language_option {
  color: black;
}
</style>
