<script setup lang="ts">
import { ref } from 'vue'
import { BellRing, Share, X } from 'lucide-vue-next'

/**
 * Convite para notificações do navegador — apresentado só depois de o
 * cliente fazer um pedido (nunca ao abrir o menu). A permissão só é pedida
 * quando o cliente toca em "Ativar".
 *
 * mode "install" (iPhone no Safari): os avisos com o ecrã bloqueado só
 * funcionam com o TapMenu no ecrã principal — explica como.
 */
withDefaults(defineProps<{ mode?: 'enable' | 'install' }>(), { mode: 'enable' })
const emit = defineEmits<{ (e: 'enable'): void; (e: 'dismiss'): void }>()
const busy = ref(false)

const enable = () => {
  busy.value = true
  emit('enable')
}
</script>

<template>
  <aside class="npc" role="region" aria-label="Notificações do pedido">
    <div class="npc-icon"><BellRing :size="18" /></div>
    <div v-if="mode === 'install'" class="npc-body">
      <strong>Avisos com o ecrã bloqueado</strong>
      <p>
        No iPhone, toque em <Share :size="13" class="npc-inline" /> <b>Partilhar</b> e depois em
        <b>Adicionar ao ecrã principal</b>. Abra o TapMenu a partir do ícone e ative as notificações.
      </p>
      <div class="npc-actions">
        <button type="button" class="npc-btn" @click="emit('dismiss')">Entendi</button>
      </div>
    </div>
    <div v-else class="npc-body">
      <strong>Quer ser avisado?</strong>
      <p>Receba atualizações do seu pedido, com som, mesmo com o telemóvel bloqueado.</p>
      <div class="npc-actions">
        <button type="button" class="npc-btn primary" :disabled="busy" @click="enable">Ativar</button>
        <button type="button" class="npc-btn" @click="emit('dismiss')">Agora não</button>
      </div>
    </div>
    <button type="button" class="npc-close" aria-label="Fechar" @click="emit('dismiss')"><X :size="15" /></button>
  </aside>
</template>

<style scoped>
.npc {
  position: relative;
  max-width: 1200px;
  margin: 0.75rem auto 0;
  display: flex;
  gap: 0.75rem;
  padding: 0.85rem 2.25rem 0.85rem 0.9rem;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: var(--radius-xl, 16px);
  color: #1e3a8a;
}

.npc-icon {
  flex-shrink: 0;
  width: 34px;
  height: 34px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fff;
  color: #2563eb;
}

.npc-body strong {
  font-size: 0.875rem;
}

.npc-body p {
  margin: 0.15rem 0 0.55rem;
  font-size: 0.8rem;
  line-height: 1.4;
}

.npc-inline {
  vertical-align: -2px;
}

.npc-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.npc-btn {
  min-height: 36px;
  padding: 0.4rem 0.9rem;
  border-radius: 9px;
  border: 1px solid #bfdbfe;
  background: #fff;
  color: #1e3a8a;
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
}

.npc-btn.primary {
  background: #2563eb;
  border-color: #2563eb;
  color: #fff;
}

.npc-btn:disabled {
  opacity: 0.6;
}

.npc-close {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: none;
  color: #1e3a8a;
  cursor: pointer;
  border-radius: 8px;
}
</style>
