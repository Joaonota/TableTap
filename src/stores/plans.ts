// src/stores/plans.ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Plan } from '@/types'
import { planService } from '@/services'
import { useToastStore } from './toast'

export const usePlansStore = defineStore('plans', () => {
  const toastStore = useToastStore()
  const plans = ref<Plan[]>([])
  const isLoading = ref(false)

  const activePlans = computed(() => plans.value.filter(p => p.active))

  const fetchPlans = async () => {
    isLoading.value = true
    try {
      plans.value = await planService.getAllPlans()
    } catch (e: any) {
      toastStore.error('Erro ao carregar planos', e.message)
    } finally {
      isLoading.value = false
    }
  }

  const getPlanById = (id: string): Plan | undefined => {
    return plans.value.find(p => p.id === id)
  }

  const savePlan = async (data: Partial<Plan> & { id?: string }): Promise<Plan> => {
    isLoading.value = true
    try {
      let saved: Plan
      if (data.id) {
        saved = await planService.updatePlan(data.id, data)
        const idx = plans.value.findIndex(p => p.id === data.id)
        if (idx !== -1) plans.value[idx] = saved
        toastStore.success('Plano Atualizado', `O plano ${saved.name} foi guardado com sucesso.`)
      } else {
        saved = await planService.createPlan(data as Omit<Plan, 'id'>)
        plans.value.push(saved)
        toastStore.success('Plano Criado', `O plano ${saved.name} foi criado com sucesso.`)
      }
      return saved
    } catch (e: any) {
      toastStore.error('Erro ao guardar plano', e.message)
      throw e
    } finally {
      isLoading.value = false
    }
  }

  const deletePlan = async (id: string): Promise<boolean> => {
    isLoading.value = true
    try {
      const ok = await planService.deletePlan(id)
      if (ok) {
        plans.value = plans.value.filter(p => p.id !== id)
        toastStore.success('Plano Removido', 'O plano foi eliminado do catálogo.')
      }
      return ok
    } catch (e: any) {
      toastStore.error('Erro ao eliminar plano', e.message)
      return false
    } finally {
      isLoading.value = false
    }
  }

  const togglePlanActive = async (id: string): Promise<void> => {
    const target = plans.value.find(p => p.id === id)
    if (!target) return
    const newStatus = !target.active
    await savePlan({ id, active: newStatus })
  }

  return {
    plans,
    activePlans,
    isLoading,
    fetchPlans,
    getPlanById,
    savePlan,
    deletePlan,
    togglePlanActive
  }
})

