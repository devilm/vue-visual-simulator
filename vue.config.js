const { defineConfig } = require('@vue/cli-service')

const repoName = process.env.GH_PAGES_REPO || 'vue-visual-simulator'
const includeLocalGameAssets =
    process.env.INCLUDE_LOCAL_GAME_ASSETS === 'true'

function excludeLocalGameAssets(config) {
    if (!includeLocalGameAssets) {
        config.plugin('copy').tap(([options]) => {
            options.patterns[0].globOptions.ignore.push('**/local-assets/**')
            return [options]
        })
    }
}

module.exports = defineConfig({
    transpileDependencies: true,
    publicPath: process.env.NODE_ENV === 'production' ? `/${repoName}/` : '/',
    outputDir: 'docs',
    chainWebpack: excludeLocalGameAssets,
    devServer: {
        static: {
            watch: {
                ignored: ['**/local-assets/**']
            }
        }
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
