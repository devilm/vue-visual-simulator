const { defineConfig } = require('@vue/cli-service')

const repoName = process.env.GH_PAGES_REPO || 'vue-visual-simulator'

module.exports = defineConfig({
    transpileDependencies: true,
    publicPath: process.env.NODE_ENV === 'production' ? `/${repoName}/` : '/',
    outputDir: 'docs',

    chainWebpack: config => {
      config.module
        .rule('ragnarok-sprite-files')
        .test(/\.(act|spr)$/i)
        .type('asset/resource')
    },

    pluginOptions: {
      i18n: {
        locale: 'en',
        fallbackLocale: 'en',
        localeDir: 'locales',
        enableLegacy: true,
        runtimeOnly: false,
        compositionOnly: true,
        fullInstall: true
      }
    }
})
