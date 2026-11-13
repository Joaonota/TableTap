import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useTenantStore } from '@/stores/tenant'
import { isSupabaseConfigured } from '@/lib/supabase'
import { homePathFor, pendingStepPath, ESTABLISHMENT_SETUP_PATH } from './homePath'

// Layouts
import PublicLayout from '@/layouts/PublicLayout.vue'
import AdminLayout from '@/layouts/AdminLayout.vue'
import KitchenLayout from '@/layouts/KitchenLayout.vue'
import CustomerMenuLayout from '@/layouts/CustomerMenuLayout.vue'
import SuperAdminLayout from '@/layouts/SuperAdminLayout.vue'

declare module 'vue-router' {
  interface RouteMeta {
    /** Exige sessão iniciada e ligação a uma empresa (ou Super Admin). */
    requiresAuth?: boolean
    /** Permissão da interface (ver authStore.can). O RLS aplica a real. */
    permission?: string
    superAdmin?: boolean
    /** Páginas que funcionam sem Supabase configurado. */
    worksWithoutBackend?: boolean
  }
}

// As páginas carregam sob pedido (divide o bundle por área).
const routes: RouteRecordRaw[] = [
  // Site público
  {
    path: '/',
    component: PublicLayout,
    children: [
      { path: '', name: 'home', component: () => import('@/pages/public/LandingPage.vue'), meta: { worksWithoutBackend: true } },
      { path: 'funcionalidades', name: 'features', component: () => import('@/pages/public/FeaturesPage.vue'), meta: { worksWithoutBackend: true } },
      { path: 'precos', name: 'pricing', component: () => import('@/pages/public/PricingPage.vue') },
      { path: 'login', name: 'login', component: () => import('@/pages/auth/LoginPage.vue') },
      // Não há registo público: os estabelecimentos são pré-registados pelo Super Admin.
      { path: 'registo', redirect: '/login' },
      { path: 'registo/empresa', redirect: '/sem-estabelecimento' },
      { path: 'convite', name: 'accept-invite', component: () => import('@/pages/auth/AcceptInvitePage.vue') },
      { path: 'sem-estabelecimento', name: 'no-establishment', component: () => import('@/pages/auth/NoEstablishmentPage.vue') },
      { path: 'recuperar-palavra-passe', name: 'forgot-password', component: () => import('@/pages/auth/ForgotPasswordPage.vue') },
      { path: 'redefinir-palavra-passe', name: 'reset-password', component: () => import('@/pages/auth/ResetPasswordPage.vue') },
      { path: 'demonstracao', redirect: '/login' }
    ]
  },

  // Menu público da mesa — URL permanente gravada na etiqueta NFC e no QR Code
  {
    path: '/m/:restaurantSlug/:tableSlug',
    component: CustomerMenuLayout,
    children: [{ path: '', name: 'customer-menu', component: () => import('@/pages/public/CustomerMenuPage.vue') }]
  },
  // URL antiga (/menu/:restaurante/:numero) — continua a resolver a mesa pelo número
  {
    path: '/menu/:restaurantSlug/:tableCode',
    component: CustomerMenuLayout,
    children: [{ path: '', name: 'customer-menu-legacy', component: () => import('@/pages/public/CustomerMenuPage.vue') }]
  },
  {
    path: '/pedido/:orderId',
    component: CustomerMenuLayout,
    children: [{ path: '', name: 'order-tracking', component: () => import('@/pages/public/OrderTrackingPage.vue') }]
  },

  // Primeiro acesso: assistente de configuração do estabelecimento
  {
    path: ESTABLISHMENT_SETUP_PATH,
    name: 'establishment-setup',
    component: () => import('@/pages/onboarding/EstablishmentSetupPage.vue'),
    meta: { requiresAuth: true }
  },

  // Ecrã de cozinha (KDS)
  {
    path: '/app/cozinha',
    component: KitchenLayout,
    meta: { requiresAuth: true, permission: 'kitchen_display' },
    children: [{ path: '', name: 'kds-screen', component: () => import('@/pages/kitchen/KitchenKdsPage.vue') }]
  },

  // Painel do restaurante
  {
    path: '/app',
    component: AdminLayout,
    meta: { requiresAuth: true },
    children: [
      { path: '', redirect: '/app/dashboard' },
      { path: 'dashboard', name: 'admin-dashboard', component: () => import('@/pages/dashboard/DashboardPage.vue') },
      { path: 'pedidos', name: 'admin-orders', component: () => import('@/pages/orders/OrdersPage.vue'), meta: { permission: 'manage_orders' } },
      { path: 'atendimento', name: 'admin-service', component: () => import('@/pages/service/ServiceRequestsPage.vue'), meta: { permission: 'service_requests' } },
      { path: 'mesas', name: 'admin-tables', component: () => import('@/pages/tables/TablesPage.vue') },
      { path: 'menu/produtos', name: 'admin-products', component: () => import('@/pages/products/ProductsPage.vue'), meta: { permission: 'manage_catalog' } },
      { path: 'menu/categorias', name: 'admin-categories', component: () => import('@/pages/categories/CategoriesPage.vue'), meta: { permission: 'manage_catalog' } },
      { path: 'menu/personalizacao', name: 'admin-menu-customization', component: () => import('@/pages/menu/MenuBuilderPage.vue'), meta: { permission: 'manage_catalog' } },
      { path: 'meu-plano', name: 'admin-my-plan', component: () => import('@/pages/tenant/MeuPlanoPage.vue') },
      { path: 'tags-nfc', name: 'admin-nfc-tags', component: () => import('@/pages/nfc-tags/NfcTagsPage.vue'), meta: { permission: 'manage_digital_access' } },
      { path: 'acesso-digital', redirect: '/app/tags-nfc' },
      { path: 'pagamentos', name: 'admin-payments', component: () => import('@/pages/payments/PaymentsPage.vue'), meta: { permission: 'manage_orders' } },
      { path: 'funcionarios', name: 'admin-staff', component: () => import('@/pages/staff/StaffPage.vue'), meta: { permission: 'manage_staff' } },
      { path: 'relatorios', name: 'admin-reports', component: () => import('@/pages/reports/ReportsPage.vue'), meta: { permission: 'view_reports' } },
      { path: 'configuracoes', name: 'admin-settings', component: () => import('@/pages/settings/SettingsPage.vue'), meta: { permission: 'manage_restaurants' } }
    ]
  },

  // Super Admin (equipa TapMenu)
  {
    path: '/super-admin',
    component: SuperAdminLayout,
    meta: { requiresAuth: true, superAdmin: true },
    children: [
      { path: '', redirect: '/super-admin/dashboard' },
      { path: 'dashboard', name: 'super-dashboard', component: () => import('@/pages/super-admin/SuperDashboardPage.vue') },
      { path: 'empresas', name: 'super-companies', component: () => import('@/pages/super-admin/CompaniesPage.vue') },
      { path: 'estabelecimentos', name: 'super-establishments', component: () => import('@/pages/super-admin/EstablishmentsPage.vue') },
      { path: 'restaurantes', name: 'super-restaurants', component: () => import('@/pages/super-admin/RestaurantsPage.vue') },
      { path: 'utilizadores', name: 'super-users', component: () => import('@/pages/super-admin/UsersPage.vue') },
      { path: 'menus', name: 'super-menus', component: () => import('@/pages/super-admin/SuperMenusPage.vue') },
      { path: 'pedidos', name: 'super-orders', component: () => import('@/pages/super-admin/SuperOrdersPage.vue') },
      { path: 'pagamentos', name: 'super-payments', component: () => import('@/pages/super-admin/SuperPaymentsPage.vue') },
      { path: 'planos', name: 'super-plans', component: () => import('@/pages/super-admin/PlansPage.vue') },
      { path: 'funcionalidades', name: 'super-features', component: () => import('@/pages/super-admin/FeaturesCatalogPage.vue') },
      { path: 'subscricoes', name: 'super-subscriptions', component: () => import('@/pages/super-admin/SubscriptionsPage.vue') },
      { path: 'relatorios', name: 'super-reports', component: () => import('@/pages/super-admin/SuperReportsPage.vue') },
      { path: 'atividade', name: 'super-activity', component: () => import('@/pages/super-admin/ActivityLogPage.vue') },
      { path: 'etiquetas-nfc', name: 'super-nfc-tags', component: () => import('@/pages/super-admin/SuperNfcTagsPage.vue') },
      { path: 'configuracoes', name: 'super-settings', component: () => import('@/pages/super-admin/SuperSettingsPage.vue') }
    ]
  },

  { path: '/configuracao-necessaria', name: 'setup-required', component: () => import('@/pages/errors/SetupRequiredPage.vue'), meta: { worksWithoutBackend: true } },
  { path: '/403', name: 'unauthorized', component: () => import('@/pages/errors/UnauthorizedPage.vue'), meta: { worksWithoutBackend: true } },
  { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('@/pages/errors/NotFoundPage.vue'), meta: { worksWithoutBackend: true } }
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior() {
    return { top: 0 }
  }
})

/**
 * Proteção de rotas (experiência). A proteção real dos dados é o RLS no
 * Supabase: mesmo contornando estas verificações, nada é lido nem gravado
 * sem permissão.
 */
router.beforeEach(async to => {
  if (!isSupabaseConfigured) {
    return to.meta.worksWithoutBackend ? true : { name: 'setup-required' }
  }

  // Configuração já feita: não deixar o utilizador preso no aviso.
  if (to.name === 'setup-required') return { path: '/' }

  if (!to.matched.some(r => r.meta.requiresAuth)) return true

  const authStore = useAuthStore()
  await authStore.init()

  if (!authStore.hasSession) return { name: 'login', query: { redirect: to.fullPath } }

  // Passos obrigatórios: palavra-passe → estabelecimento → configuração inicial.
  const pending = pendingStepPath(authStore)
  if (pending && pending !== to.path) return pending
  if (!pending && to.name === 'establishment-setup') return homePathFor(authStore)

  if (to.matched.some(r => r.meta.superAdmin) && !authStore.isSuperAdmin) return { name: 'unauthorized' }

  const permission = [...to.matched].reverse().find(r => r.meta.permission)?.meta.permission
  if (permission && !authStore.can(permission)) {
    // Ex.: cozinha a abrir o painel → ecrã da cozinha.
    const home = homePathFor(authStore)
    return home !== to.path ? home : { name: 'unauthorized' }
  }

  const tenantStore = useTenantStore()
  if (!tenantStore.hasLoaded) await tenantStore.loadContext()
  return true
})
