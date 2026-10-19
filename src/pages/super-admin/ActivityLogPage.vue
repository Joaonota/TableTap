<script setup lang="ts">
import { ref } from 'vue'
import type { PlatformAuditLog } from '@/types'
import { Activity, ShieldCheck, UserCheck, Clock } from 'lucide-vue-next'

const logs = ref<PlatformAuditLog[]>([
  {
    id: 'log-1',
    userId: 'user-super',
    userName: 'Carlos Silva (Super Admin)',
    action: 'LOGIN',
    resource: 'Plataforma SaaS',
    details: 'Autenticação com privilégios de super administrador',
    timestamp: '2026-10-16T11:45:00Z'
  },
  {
    id: 'log-2',
    tenantId: 'tenant-1',
    userId: 'user-owner-1',
    userName: 'Amélia Cossa',
    action: 'SUBSCRIPTION_RENEWAL',
    resource: 'Plano Restaurante Pro',
    details: 'Renovação automática mensal de 4.490 MT processada',
    timestamp: '2026-10-16T08:00:00Z'
  },
  {
    id: 'log-3',
    tenantId: 'tenant-1',
    userId: 'user-admin-1',
    userName: 'Rui Mondlane',
    action: 'PRODUCT_UPDATE',
    resource: 'Catálogo Sabores Maputo',
    details: 'Atualização do preço promocional do Frango à Zambeziana',
    timestamp: '2026-10-15T18:22:00Z'
  },
  {
    id: 'log-4',
    tenantId: 'tenant-2',
    userId: 'user-owner-2',
    userName: 'David Matsinhe',
    action: 'TABLE_ACCESS_GENERATE',
    resource: 'Acesso Digital',
    details: 'Geração de novos códigos QR para o salão náutico',
    timestamp: '2026-10-15T14:10:00Z'
  },
  {
    id: 'log-5',
    tenantId: 'tenant-3',
    userId: 'user-super',
    userName: 'Carlos Silva (Super Admin)',
    action: 'TENANT_PROVISION',
    resource: 'Urban Dining Lda',
    details: 'Criação do tenant e provisionamento de base de dados mockada',
    timestamp: '2026-10-14T09:30:00Z'
  }
])
</script>

<template>
  <div class="super-page">
    <div class="page-top-header">
      <div>
        <h1 class="page-title">Registo de Auditoria & Atividade</h1>
        <p class="page-subtitle">Rastreabilidade completa de ações administrativas em todos os tenants</p>
      </div>
    </div>

    <div class="super-card log-card">
      <div class="log-timeline">
        <div
          v-for="log in logs"
          :key="log.id"
          class="log-item"
        >
          <div class="log-icon-col">
            <div class="log-icon-circle">
              <Activity :size="16" />
            </div>
            <div class="log-line"></div>
          </div>

          <div class="log-content">
            <div class="log-header-line">
              <span class="log-action">{{ log.action }}</span>
              <span class="log-resource">• {{ log.resource }}</span>
              <span class="log-time">{{ new Date(log.timestamp).toLocaleString('pt-PT') }}</span>
            </div>

            <p class="log-desc">{{ log.details }}</p>

            <div class="log-user-meta">
              <UserCheck :size="13" />
              <span>Realizado por <strong>{{ log.userName }}</strong></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.super-page {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.page-top-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.page-title {
  font-size: 1.75rem;
  font-weight: 800;
  color: #ffffff;
}

.page-subtitle {
  font-size: 0.875rem;
  color: #94a3b8;
}

.super-card {
  background: #0f172a;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--radius-lg);
  padding: 1.5rem;
}

.log-timeline {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.log-item {
  display: flex;
  gap: 1rem;
}

.log-icon-col {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.log-icon-circle {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(124, 58, 237, 0.2);
  color: #a78bfa;
  border: 1px solid rgba(124, 58, 237, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
}

.log-line {
  flex: 1;
  width: 1px;
  background: rgba(255, 255, 255, 0.1);
  margin-top: 0.5rem;
}

.log-content {
  flex: 1;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: var(--radius-md);
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.log-header-line {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8125rem;
}

.log-action {
  font-weight: 700;
  color: #c4b5fd;
}

.log-resource {
  color: #94a3b8;
}

.log-time {
  margin-left: auto;
  font-size: 0.75rem;
  color: #64748b;
}

.log-desc {
  font-size: 0.875rem;
  color: #cbd5e1;
}

.log-user-meta {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.75rem;
  color: #94a3b8;
  margin-top: 0.25rem;
}
</style>
