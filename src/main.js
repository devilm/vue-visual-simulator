import { createApp } from 'vue'
import VueLazyLoad from 'vue3-lazyload'
import App from './App.vue'
import router from './router'
import "bootstrap/dist/css/bootstrap.min.css"
import "bootstrap"
import store from './store'
import i18n from './i18n'
import { initializeAnalytics } from './analytics'

initializeAnalytics({
	measurementId: process.env.NODE_ENV === 'production'
		? process.env.VUE_APP_GA_MEASUREMENT_ID
		: undefined,
	store
})

createApp(App).use(VueLazyLoad).use(i18n).use(store).use(router).mount('#app')