import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useTenantStore } from '@/stores/tenant'

// Layouts
import PublicLayout from '@/layouts/PublicLayout.vue'
import AdminLayout from '@/layouts/AdminLayout.vue'
import KitchenLayout from '@/layouts/KitchenLayout.vue'
import CustomerMenuLayout from '@/layouts/CustomerMenuLayout.vue'
import SuperAdminLayout from '@/layouts/SuperAdminLayout.vue'

// Public Pages
import LandingPage from '@/pages/public/LandingPage.vue'
import FeaturesPage from '@/pages/public/FeaturesPage.vue'
import PricingPage from '@/pages/public/PricingPage.vue'
import DemoPage from '@/pages/public/DemoPage.vue'
import LoginPage from '@/pages/auth/LoginPage.vue'
import CustomerMenuPage from '@/pages/public/CustomerMenuPage.vue'
import OrderTrackingPage from '@/pages/public/OrderTrackingPage.vue'

// Admin Pages
import DashboardPage from '@/pages/dashboard/DashboardPage.vue'
import OrdersPage from '@/pages/orders/OrdersPage.vue'
import KitchenKdsPage from '@/pages/kitchen/KitchenKdsPage.vue'
import ServiceRequestsPage from '@/pages/service/ServiceRequestsPage.vue'
import TablesPage from '@/pages/tables/TablesPage.vue'
import ProductsPage from '@/pages/products/ProductsPage.vue'
import CategoriesPage from '@/pages/categories/CategoriesPage.vue'
import DigitalAccessPage from '@/pages/digital-access/DigitalAccessPage.vue'
import PaymentsPage from '@/pages/payments/PaymentsPage.vue'
import StaffPage from '@/pages/staff/StaffPage.vue'
import ReportsPage from '@/pages/reports/ReportsPage.vue'
import SettingsPage from '@/pages/settings/SettingsPage.vue'

// Super Admin Pages
import SuperDashboardPage from '@/pages/super-admin/SuperDashboardPage.vue'
import CompaniesPage from '@/pages/super-admin/CompaniesPage.vue'
import RestaurantsPage from '@/pages/super-admin/RestaurantsPage.vue'
import UsersPage from '@/pages/super-admin/UsersPage.vue'
import PlansPage from '@/pages/super-admin/PlansPage.vue'
import SubscriptionsPage from '@/pages/super-admin/SubscriptionsPage.vue'
import ActivityLogPage from '@/pages/super-admin/ActivityLogPage.vue'

// Error Pages
import NotFoundPage from '@/pages/errors/NotFoundPage.vue'
import UnauthorizedPage from '@/pages/errors/UnauthorizedPage.vue'

const routes: RouteRecordRaw[] = [
  // Public Marketing Site
  {
    path: '/',
    component: PublicLayout,
    children: [
      { path: '', name: 'home', component: LandingPage },
      { path: 'funcionalidades', name: 'features', component: FeaturesPage },
      { path: 'precos', name: 'pricing', component: PricingPage },
      { path: 'demonstracao', name: 'demo', component: DemoPage },
      { path: 'login', name: 'login', component: LoginPage }
    ]
  },

  // Public Customer Digital Menu & Order Tracking
  {
    path: '/menu/:restaurantSlug/:tableCode',
    component: CustomerMenuLayout,
    children: [
      { path: '', name: 'customer-menu', component: CustomerMenuPage }
    ]
  },
  {
    path: '/pedido/:orderId',
    component: CustomerMenuLayout,
    children: [
      { path: '', name: 'order-tracking', component: OrderTrackingPage }
    ]
  },

  // Kitchen Display System (Dedicated Monitor Layout)
  {
    path: '/app/cozinha',
    component: KitchenLayout,
    children: [
      { path: '', name: 'kds-screen', component: KitchenKdsPage }
    ]
  },

  // Restaurant Admin Workspace
  {
    path: '/app',
    component: AdminLayout,
    children: [
      { path: '', redirect: '/app/dashboard' },
      { path: 'dashboard', name: 'admin-dashboard', component: DashboardPage },
      { path: 'pedidos', name: 'admin-orders', component: OrdersPage },
      { path: 'atendimento', name: 'admin-service', component: ServiceRequestsPage },
      { path: 'mesas', name: 'admin-tables', component: TablesPage },
      { path: 'menu/produtos', name: 'admin-products', component: ProductsPage },
      { path: 'menu/categorias', name: 'admin-categories', component: CategoriesPage },
      { path: 'acesso-digital', name: 'admin-digital-access', component: DigitalAccessPage },
      { path: 'pagamentos', name: 'admin-payments', component: PaymentsPage },
      { path: 'funcionarios', name: 'admin-staff', component: StaffPage },
      { path: 'relatorios', name: 'admin-reports', component: ReportsPage },
      { path: 'configuracoes', name: 'admin-settings', component: SettingsPage }
    ]
  },

  // Super Admin Workspace (Platform SaaS)
  {
    path: '/super-admin',
    component: SuperAdminLayout,
    children: [
      { path: '', redirect: '/super-admin/dashboard' },
      { path: 'dashboard', name: 'super-dashboard', component: SuperDashboardPage },
      { path: 'empresas', name: 'super-companies', component: CompaniesPage },
      { path: 'restaurantes', name: 'super-restaurants', component: RestaurantsPage },
      { path: 'utilizadores', name: 'super-users', component: UsersPage },
      { path: 'planos', name: 'super-plans', component: PlansPage },
      { path: 'subscricoes', name: 'super-subscriptions', component: SubscriptionsPage },
      { path: 'atividade', name: 'super-activity', component: ActivityLogPage }
    ]
  },

  // Error Pages
  {
    path: '/403',
    name: 'unauthorized',
    component: UnauthorizedPage
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: NotFoundPage
  }
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior() {
    return { top: 0 }
  }
})

// Route Guards for demo roles
router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore()

  // Initialize auth if not loaded
  if (!authStore.currentUser) {
    await authStore.init()
  }

  // Super Admin routes protection
  if (to.path.startsWith('/super-admin')) {
    if (!authStore.isSuperAdmin) {
      return next('/403')
    }
  }

  next()
})
