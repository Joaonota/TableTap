<script setup lang="ts">
import { supabaseConfigProblem } from '@/lib/supabase'
import { Settings, AlertTriangle } from 'lucide-vue-next'

/** Mostrada quando o Supabase não está configurado — nunca se usam dados fictícios. */
const problem = supabaseConfigProblem
</script>

<template>
  <div class="setup-page">
    <div class="setup-card">
      <div class="setup-icon" :class="{ danger: problem === 'secret_key' }">
        <AlertTriangle v-if="problem === 'secret_key'" :size="22" />
        <Settings v-else :size="22" />
      </div>
      <h1>{{ problem === 'secret_key' ? 'Chave secreta no frontend' : 'Ligação ao Supabase por configurar' }}</h1>

      <p v-if="problem === 'secret_key'">
        A chave configurada é a <strong>service_role</strong> (secreta). Ela ignora todas as regras de segurança e
        <strong>nunca</strong> pode ser usada no navegador. Substitua-a pela chave pública
        (<em>publishable</em> / <em>anon</em>) e, por precaução, gere uma nova chave secreta no Supabase.
      </p>
      <p v-else>
        O TapMenu precisa do endereço e da chave pública do projeto Supabase. Crie o ficheiro
        <code>.env.local</code> na raiz do projeto com:
      </p>

      <pre>VITE_SUPABASE_URL=https://&lt;projeto&gt;.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=&lt;chave pública&gt;</pre>

      <p class="muted">
        Encontra ambos em Supabase → <strong>Project Settings → API Keys</strong>. Depois reinicie o servidor
        (<code>npm run dev</code>). Em produção, defina as mesmas variáveis no serviço de alojamento.
      </p>
    </div>
  </div>
</template>

<style scoped>
.setup-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem 1rem;
  background: var(--bg-page);
}

.setup-card {
  max-width: 560px;
  width: 100%;
  background: #fff;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-xl);
  padding: 2rem;
  box-shadow: var(--shadow-md);
}

.setup-icon {
  width: 44px;
  height: 44px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-primary-50);
  color: var(--color-primary-700);
  margin-bottom: 1rem;
}

.setup-icon.danger {
  background: var(--color-danger-50);
  color: var(--color-danger-600);
}

h1 {
  font-size: 1.35rem;
  margin: 0 0 0.75rem;
}

p {
  font-size: 0.9rem;
  line-height: 1.6;
  color: var(--color-neutral-700);
}

.muted {
  color: var(--text-muted);
  font-size: 0.85rem;
}

pre {
  background: var(--color-neutral-900);
  color: #e2e8f0;
  padding: 0.9rem 1rem;
  border-radius: var(--radius-md);
  font-size: 0.8rem;
  overflow-x: auto;
}

code {
  background: var(--color-neutral-100);
  padding: 0.1rem 0.35rem;
  border-radius: 4px;
  font-size: 0.85em;
}
</style>
