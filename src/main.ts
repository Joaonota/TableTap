import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { router } from './router'
import { useAuthStore } from './stores/auth'
import { useTenantStore } from './stores/tenant'
import './styles/main.css'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)

// Initialize demo authentication & tenant context
const authStore = useAuthStore()
const tenantStore = useTenantStore()

Promise.all([
  authStore.init(),
  tenantStore.loadContext()
]).then(() => {
  app.mount('#app')
})
