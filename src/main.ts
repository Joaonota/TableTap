import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { router } from './router'
import './styles/main.css'

const app = createApp(App)
app.use(createPinia())
app.use(router)
// A sessão (Supabase Auth) e o contexto da empresa são carregados pelo
// guard do router, apenas nas áreas que precisam de autenticação.
app.mount('#app')
