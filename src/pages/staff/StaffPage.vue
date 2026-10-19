<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { staffService } from '@/services'
import { useTenantStore } from '@/stores/tenant'
import { useToastStore } from '@/stores/toast'
import type { StaffMember, UserRole } from '@/types'
import AppButton from '@/components/ui/AppButton.vue'
import AppBadge from '@/components/ui/AppBadge.vue'
import AppModal from '@/components/ui/AppModal.vue'
import AppInput from '@/components/ui/AppInput.vue'
import AppSelect from '@/components/ui/AppSelect.vue'
import {
  Users,
  Plus,
  Edit2,
  Trash2,
  Mail,
  Phone,
  Shield,
  UserCheck
} from 'lucide-vue-next'

const tenantStore = useTenantStore()
const toastStore = useToastStore()

const staffList = ref<StaffMember[]>([])
const isLoading = ref(true)

const isModalOpen = ref(false)
const formId = ref<string | undefined>(undefined)
const formName = ref('')
const formEmail = ref('')
const formPhone = ref('')
const formRole = ref<UserRole>('waiter')
const formHireDate = ref('2024-01-20')
const formIsActive = ref(true)

const roleOptions = [
  { label: 'Administrador de Restaurante', value: 'restaurant_admin' },
  { label: 'Gerente Operacional', value: 'manager' },
  { label: 'Rececionista / Caixa', value: 'receptionist' },
  { label: 'Empregado de Mesa (Garçom)', value: 'waiter' },
  { label: 'Cozinheiro / Chefe (Cozinha)', value: 'kitchen_staff' }
]

const loadStaff = async () => {
  if (!tenantStore.currentCompany) return
  isLoading.value = true
  try {
    staffList.value = await staffService.getStaffByTenant(tenantStore.currentCompany.id)
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  loadStaff()
})

const openAddModal = () => {
  formId.value = undefined
  formName.value = ''
  formEmail.value = ''
  formPhone.value = '+258 84 '
  formRole.value = 'waiter'
  formHireDate.value = new Date().toISOString().split('T')[0]
  formIsActive.value = true
  isModalOpen.value = true
}

const openEditModal = (staff: StaffMember) => {
  formId.value = staff.id
  formName.value = staff.name
  formEmail.value = staff.email
  formPhone.value = staff.phone
  formRole.value = staff.role
  formHireDate.value = staff.hireDate
  formIsActive.value = staff.isActive
  isModalOpen.value = true
}

const handleSaveStaff = async () => {
  if (!formName.value.trim() || !formEmail.value.trim()) {
    toastStore.warning('Validação', 'Preencha o nome e email do colaborador.')
    return
  }

  if (!tenantStore.currentCompany || !tenantStore.currentRestaurant) return

  try {
    if (formId.value) {
      const updated = await staffService.updateStaff(formId.value, {
        name: formName.value,
        email: formEmail.value,
        phone: formPhone.value,
        role: formRole.value,
        hireDate: formHireDate.value,
        isActive: formIsActive.value
      })
      const index = staffList.value.findIndex(s => s.id === formId.value)
      if (index !== -1) staffList.value[index] = updated
      toastStore.success('Colaborador atualizado com sucesso!')
    } else {
      const created = await staffService.createStaff({
        tenantId: tenantStore.currentCompany.id,
        name: formName.value,
        email: formEmail.value,
        phone: formPhone.value,
        role: formRole.value,
        assignedRestaurantIds: [tenantStore.currentRestaurant.id],
        hireDate: formHireDate.value,
        isActive: formIsActive.value
      })
      staffList.value.push(created)
      toastStore.success('Novo colaborador registado!')
    }
    isModalOpen.value = false
  } catch (e) {
    toastStore.error('Erro ao guardar colaborador', (e as Error).message)
  }
}

const handleDeleteStaff = async (id: string) => {
  if (confirm('Tem a certeza de que deseja remover este membro da equipa?')) {
    await staffService.deleteStaff(id)
    staffList.value = staffList.value.filter(s => s.id !== id)
    toastStore.success('Colaborador removido')
  }
}
</script>

<template>
  <div class="staff-page">
    <div class="page-top-header">
      <div>
        <h1 class="page-title">Gestão de Funcionários</h1>
        <p class="page-subtitle">
          Equipa de <strong>{{ tenantStore.currentCompany?.name }}</strong> com atribuições e permissões por perfil
        </p>
      </div>

      <AppButton variant="primary" @click="openAddModal">
        <template #icon-left>
          <Plus :size="16" />
        </template>
        Adicionar Funcionário
      </AppButton>
    </div>

    <!-- Staff Cards Grid -->
    <div class="staff-grid">
      <div
        v-for="member in staffList"
        :key="member.id"
        class="staff-card"
        :class="{ 'is-inactive': !member.isActive }"
      >
        <div class="card-top">
          <div class="avatar-box">
            <img
              :src="member.avatarUrl || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&q=80'"
              :alt="member.name"
              class="staff-img"
            />
            <span class="status-indicator" :class="{ active: member.isActive }"></span>
          </div>

          <AppBadge :variant="member.isActive ? 'success' : 'neutral'">
            {{ member.isActive ? 'Ativo' : 'Inativo' }}
          </AppBadge>
        </div>

        <div class="staff-info">
          <h3 class="staff-name">{{ member.name }}</h3>
          <span class="staff-role-badge">{{ member.role.replace('_', ' ').toUpperCase() }}</span>
        </div>

        <div class="staff-contacts">
          <div class="contact-item">
            <Mail :size="14" />
            <span>{{ member.email }}</span>
          </div>
          <div class="contact-item">
            <Phone :size="14" />
            <span>{{ member.phone }}</span>
          </div>
        </div>

        <div class="card-footer">
          <span class="hire-date">Admissão: {{ member.hireDate }}</span>

          <div class="actions">
            <button class="btn-icon" title="Editar" @click="openEditModal(member)">
              <Edit2 :size="14" />
            </button>
            <button class="btn-icon danger" title="Eliminar" @click="handleDeleteStaff(member.id)">
              <Trash2 :size="14" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Add/Edit Staff Modal -->
    <AppModal
      :is-open="isModalOpen"
      :title="formId ? 'Editar Funcionário' : 'Novo Funcionário'"
      maxWidth="500px"
      @close="isModalOpen = false"
    >
      <form class="modal-form" @submit.prevent="handleSaveStaff">
        <AppInput
          v-model="formName"
          label="Nome Completo"
          placeholder="Ex: Alberto Mondlane"
          required
        />

        <AppInput
          v-model="formEmail"
          label="Email Profissional"
          type="email"
          placeholder="exemplo@restaurante.co.mz"
          required
        />

        <AppInput
          v-model="formPhone"
          label="Telefone (Moçambique)"
          type="tel"
          placeholder="+258 84 000 0000"
        />

        <AppSelect
          v-model="formRole"
          label="Função & Permissões"
          :options="roleOptions"
          required
        />

        <AppInput
          v-model="formHireDate"
          label="Data de Admissão"
          type="date"
        />

        <label class="active-checkbox">
          <input v-model="formIsActive" type="checkbox" />
          <span>Conta ativa para operações do restaurante</span>
        </label>
      </form>

      <template #footer>
        <AppButton variant="secondary" @click="isModalOpen = false">Cancelar</AppButton>
        <AppButton variant="primary" @click="handleSaveStaff">Guardar Funcionário</AppButton>
      </template>
    </AppModal>
  </div>
</template>

<style scoped>
.staff-page {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.page-top-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1rem;
}

.page-title {
  font-size: 1.75rem;
  font-weight: 800;
  color: var(--color-neutral-900);
}

.page-subtitle {
  font-size: 0.875rem;
  color: var(--text-muted);
}

.staff-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1.25rem;
}

.staff-card {
  background: #ffffff;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  padding: 1.25rem;
  box-shadow: var(--shadow-sm);
  display: flex;
  flex-direction: column;
  gap: 1rem;
  transition: transform var(--transition-fast);
}

.staff-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.staff-card.is-inactive {
  opacity: 0.65;
}

.card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.avatar-box {
  position: relative;
}

.staff-img {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid var(--border-subtle);
}

.status-indicator {
  position: absolute;
  bottom: 2px;
  right: 2px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #94a3b8;
  border: 2px solid #ffffff;
}

.status-indicator.active {
  background: var(--color-success-500);
}

.staff-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.staff-name {
  font-size: 1rem;
  font-weight: 700;
  color: var(--color-neutral-900);
}

.staff-role-badge {
  font-size: 0.6875rem;
  font-weight: 700;
  color: var(--color-primary-800);
  background: var(--color-primary-50);
  padding: 0.2rem 0.5rem;
  border-radius: var(--radius-sm);
  display: inline-block;
  align-self: flex-start;
}

.staff-contacts {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.8125rem;
  color: var(--text-muted);
}

.contact-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-top: 1px solid var(--border-subtle);
  padding-top: 0.75rem;
}

.hire-date {
  font-size: 0.75rem;
  color: var(--color-neutral-400);
}

.actions {
  display: flex;
  gap: 0.35rem;
}

.btn-icon {
  background: var(--color-neutral-50);
  border: 1px solid var(--border-subtle);
  width: 28px;
  height: 28px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--color-neutral-600);
}

.btn-icon:hover {
  background: var(--color-neutral-200);
}

.btn-icon.danger:hover {
  background: var(--color-danger-50);
  color: var(--color-danger-600);
}

.modal-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.active-checkbox {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: var(--color-neutral-800);
  cursor: pointer;
  padding-top: 0.5rem;
}
</style>
