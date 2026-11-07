<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { restaurantService, tenantService, menuCustomizationService } from '@/services'
import type { Restaurant, Company, MenuCustomization } from '@/types'
import AppButton from '@/components/ui/AppButton.vue'
import { UtensilsCrossed, ExternalLink, Palette, Layout, Eye } from 'lucide-vue-next'

const restaurants = ref<Restaurant[]>([])
const companies = ref<Company[]>([])
const customizations = ref<Record<string, MenuCustomization>>({})
const isLoading = ref(true)

onMounted(async () => {
  try {
    const [r, c] = await Promise.all([
      restaurantService.getAllRestaurants(),
      tenantService.getAllCompanies()
    ])
    restaurants.value = r
    companies.value = c

    // Load customization for each restaurant
    const custMap: Record<string, MenuCustomization> = {}
    for (const rest of r) {
      custMap[rest.id] = await menuCustomizationService.getCustomization(rest.id, rest.tenantId)
    }
    customizations.value = custMap
  } finally {
    isLoading.value = false
  }
})

const getCompanyName = (tenantId: string) => {
  return companies.value.find(c => c.id === tenantId)?.name || 'Empresa'
}

const getLayoutBadgeClass = (layout: string) => {
  switch (layout) {
    case 'modern': return 'badge-modern'
    case 'elegant': return 'badge-elegant'
    case 'compact': return 'badge-compact'
    case 'visual': return 'badge-visual'
    default: return 'badge-classic'
  }
}
</script>

<template>
  <div class="super-page">
    <div class="page-top-header">
      <div>
        <h1 class="page-title">Gestão Global de Menus Digitais</h1>
        <p class="page-subtitle">Acompanhe temas visuais, layouts ativos e experiência digital por filial e restaurante</p>
      </div>
    </div>

    <div class="super-card table-card">
      <div class="table-scroll">
        <table class="super-table">
          <thead>
            <tr>
              <th>Restaurante / Filial</th>
              <th>Empresa (Tenant)</th>
              <th>Layout Ativo</th>
              <th>Paleta de Cores</th>
              <th>Tipografia</th>
              <th>Última Atualização</th>
              <th class="text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in restaurants" :key="r.id">
              <td>
                <div class="rest-cell">
                  <strong class="text-white">{{ r.name }}</strong>
                  <span class="text-xs text-muted">/menu/{{ r.slug }}</span>
                </div>
              </td>
              <td>{{ getCompanyName(r.tenantId) }}</td>
              <td>
                <span
                  class="layout-badge"
                  :class="getLayoutBadgeClass(customizations[r.id]?.theme.layout || 'modern')"
                >
                  <Layout :size="12" />
                  {{ (customizations[r.id]?.theme.layout || 'modern').toUpperCase() }}
                </span>
              </td>
              <td>
                <div class="colors-preview" v-if="customizations[r.id]">
                  <span
                    class="color-dot"
                    :style="{ background: customizations[r.id].theme.primaryColor }"
                    title="Primária"
                  ></span>
                  <span
                    class="color-dot"
                    :style="{ background: customizations[r.id].theme.secondaryColor }"
                    title="Secundária"
                  ></span>
                  <span
                    class="color-dot"
                    :style="{ background: customizations[r.id].theme.accentColor }"
                    title="Destaque"
                  ></span>
                  <span class="color-hex font-mono">{{ customizations[r.id].theme.primaryColor }}</span>
                </div>
              </td>
              <td>
                <span class="font-tag">{{ customizations[r.id]?.theme.fontFamilyKey || 'inter' }}</span>
              </td>
              <td>
                <span class="text-xs text-muted">
                  {{ customizations[r.id]?.updatedAt ? new Date(customizations[r.id].updatedAt).toLocaleDateString('pt-MZ') : 'Padrão' }}
                </span>
              </td>
              <td class="text-right">
                <router-link :to="`/menu/${r.slug}/01`" target="_blank" class="action-link">
                  <AppButton variant="outline" size="sm">
                    <Eye :size="14" />
                    <span>Ver Menu</span>
                  </AppButton>
                </router-link>
              </td>
            </tr>
          </tbody>
        </table>
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
  margin-top: 0.2rem;
}

.super-card {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 12px;
  overflow: hidden;
}

.table-scroll {
  overflow-x: auto;
}

.super-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  font-size: 0.875rem;
}

.super-table th {
  background: #0f172a;
  color: #94a3b8;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0.85rem 1rem;
  border-bottom: 1px solid #334155;
}

.super-table td {
  padding: 0.85rem 1rem;
  border-bottom: 1px solid #334155;
  color: #cbd5e1;
}

.super-table tr:hover {
  background: rgba(255, 255, 255, 0.02);
}

.rest-cell {
  display: flex;
  flex-direction: column;
}

.layout-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.2rem 0.6rem;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 700;
}

.badge-modern { background: rgba(56, 189, 248, 0.15); color: #38bdf8; }
.badge-classic { background: rgba(148, 163, 184, 0.15); color: #cbd5e1; }
.badge-elegant { background: rgba(244, 114, 182, 0.15); color: #f472b6; }
.badge-compact { background: rgba(251, 146, 60, 0.15); color: #fb923c; }
.badge-visual { background: rgba(168, 85, 247, 0.15); color: #c084fc; }

.colors-preview {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.color-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 1.5px solid #334155;
  display: inline-block;
}

.color-hex {
  font-size: 0.75rem;
  color: #94a3b8;
  margin-left: 0.3rem;
}

.font-tag {
  font-size: 0.75rem;
  color: #94a3b8;
  text-transform: capitalize;
}

.text-right {
  text-align: right;
}

.action-link {
  text-decoration: none;
}
</style>

