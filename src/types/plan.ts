// ==========================================
// PLANS, FEATURES & LIMITS CONTRACTS
// Sistema de Planos Funcional TapMenu
// SaaS multi-tenant
// ==========================================

// ------------------------------------------
// Feature Catalog (chaves do sistema)
// ------------------------------------------
export type FeatureKey =
  | 'MENU_DIGITAL'
  | 'QR_CODE'
  | 'NFC'
  | 'ORDERS'
  | 'KDS'
  | 'WAITER_CALL'
  | 'PAYMENTS'
  | 'TABLES'
  | 'STOCK'
  | 'RECIPES'
  | 'WASTE'
  | 'REVIEWS'
  | 'GOOGLE_REVIEWS'
  | 'BUSINESS_INTELLIGENCE'
  | 'DEMAND_FORECAST'
  | 'STAFF'
  | 'REPORTS'
  | 'CSV_EXPORT'
  | 'MULTI_RESTAURANT'
  | 'MULTI_BRANCH'
  | 'MENU_CUSTOMIZATION'

export interface FeatureCatalogEntry {
  key: FeatureKey
  name: string
  description: string
  module: 'Menu & Mesas' | 'Operação' | 'Pagamentos' | 'Inteligência' | 'Equipa' | 'Avançado'
}

export const FEATURE_CATALOG: FeatureCatalogEntry[] = [
  { key: 'MENU_DIGITAL', name: 'Menu Digital', description: 'Criação e edição de produtos, categorias e descrições', module: 'Menu & Mesas' },
  { key: 'QR_CODE', name: 'QR Code', description: 'Gestão e impressão de códigos QR por mesa', module: 'Menu & Mesas' },
  { key: 'NFC', name: 'Tap Digital (NFC)', description: 'URL permanente por mesa, gestão de etiquetas NFC e QR Code', module: 'Menu & Mesas' },
  { key: 'ORDERS', name: 'Pedidos no Menu', description: 'Clientes efetuam pedidos no menu digital', module: 'Operação' },
  { key: 'KDS', name: 'Ecrã de Cozinha (KDS)', description: 'Kitchen Display System com estações cozinha e bar', module: 'Operação' },
  { key: 'WAITER_CALL', name: 'Chamada de Atendimento', description: 'Solicitações digitais: empregado, conta, talheres', module: 'Operação' },
  { key: 'PAYMENTS', name: 'Pagamentos Digitais', description: 'M-Pesa, e-Mola, cartão e dinheiro com confirmação', module: 'Pagamentos' },
  { key: 'TABLES', name: 'Gestão de Mesas', description: 'Sessões de mesa, ocupação e estados em tempo real', module: 'Operação' },
  { key: 'STOCK', name: 'Stock e Inventário', description: 'Contagem de stock e alertas por produto', module: 'Avançado' },
  { key: 'RECIPES', name: 'Fichas Técnicas', description: 'Fichas técnicas de receita e cálculo de custos', module: 'Avançado' },
  { key: 'WASTE', name: 'Desperdício', description: 'Controlo de desperdícios por produto e estação', module: 'Avançado' },
  { key: 'REVIEWS', name: 'Avaliações do Cliente', description: 'Pesquisas de satisfação no menu digital', module: 'Inteligência' },
  { key: 'GOOGLE_REVIEWS', name: 'Invite Google Reviews', description: 'Convites automáticos para avaliação Google', module: 'Inteligência' },
  { key: 'BUSINESS_INTELLIGENCE', name: 'Business Intelligence', description: 'Resumo executivo, comparação de filiais e insights', module: 'Inteligência' },
  { key: 'DEMAND_FORECAST', name: 'Previsão de Procura', description: 'Projeções de pedidos e receita com base histórica', module: 'Inteligência' },
  { key: 'STAFF', name: 'Gestão de Equipa', description: 'Equipa, funções e atribuição de restaurantes', module: 'Equipa' },
  { key: 'REPORTS', name: 'Relatórios', description: 'Dashboard de indicadores e relatório de desempenho', module: 'Inteligência' },
  { key: 'CSV_EXPORT', name: 'Exportação CSV', description: 'Exportação de pedidos, produtos e pagamentos', module: 'Inteligência' },
  { key: 'MULTI_RESTAURANT', name: 'Multi-Restaurante', description: 'Vários restaurantes sob a mesma empresa', module: 'Avançado' },
  { key: 'MULTI_BRANCH', name: 'Cadeia e Filiais', description: 'Comparação de filiais e gestão de cadeia', module: 'Avançado' },
  { key: 'MENU_CUSTOMIZATION', name: 'Personalização do Menu', description: 'Layout, cores, tipografia e construção visual por restaurante', module: 'Avançado' }
]

// ------------------------------------------
// Limit Catalog (recursos com limites)
// ------------------------------------------
export type LimitKey =
  | 'RESTAURANTS'
  | 'PRODUCTS'
  | 'CATEGORIES'
  | 'TABLES'
  | 'STAFF'
  | 'ORDERS_PER_MONTH'

export interface LimitCatalogEntry {
  key: LimitKey
  name: string
  description: string
  unit: string
}

export const LIMIT_CATALOG: LimitCatalogEntry[] = [
  { key: 'RESTAURANTS', name: 'Restaurantes', description: 'Restaurantes ativos que a empresa pode registar', unit: 'restaurantes' },
  { key: 'PRODUCTS', name: 'Produtos', description: 'Produtos ativos no menu por restaurante', unit: 'produtos' },
  { key: 'CATEGORIES', name: 'Categorias', description: 'Categorias de menu por restaurante', unit: 'categorias' },
  { key: 'TABLES', name: 'Mesas', description: 'Mesas registadas por restaurante', unit: 'mesas' },
  { key: 'STAFF', name: 'Colaboradores', description: 'Membros da equipa da empresa (funcionários)', unit: 'colaboradores' },
  { key: 'ORDERS_PER_MONTH', name: 'Pedidos / Mês', description: 'Pedidos recebidos no mês corrente por restaurante', unit: 'pedidos/mês' }
]

// ------------------------------------------
// Plan
// ------------------------------------------
export type PlanBillingPeriod = 'monthly' | 'yearly'

export interface PlanFeature {
  featureKey: FeatureKey
  enabled: boolean
}

export interface PlanLimit {
  resourceKey: LimitKey
  limit: number | null // null = ilimitado (nunca usar 999999)
}

export interface Plan {
  id: string
  name: string
  slug: string
  description: string
  price: number // em MT, pelo período de cobrança
  currency: string // 'MT'
  billingPeriod: PlanBillingPeriod
  active: boolean
  features: PlanFeature[]
  limits: PlanLimit[]
  highlighted?: boolean
  displayOrder?: number
}

export type SubscriptionStatusV2 =
  | 'trial'
  | 'active'
  | 'suspended'
  | 'expired'
  | 'cancelled'

export type SubscriptionStatus = SubscriptionStatusV2

export interface SubscriptionHistory {
  id: string
  date: string
  event: 'created' | 'plan_changed' | 'activated' | 'suspended' | 'renewed' | 'cancelled' | 'trial_started' | 'expired'
  fromPlanName?: string
  toPlanName?: string
  amount?: number
  note?: string
  performedBy: string
}

export interface Subscription {
  id: string
  tenantId: string
  companyName: string
  planId: string
  planName: string
  status: SubscriptionStatusV2
  startDate: string
  renewalDate: string
  monthlyPrice: number // derivado do plano (equivalente mensal, para MRR)
  isAutoRenew: boolean
  history: SubscriptionHistory[]
}

// ------------------------------------------
// Helpers
// ------------------------------------------
export const getFeatureCatalogEntry = (key: FeatureKey): FeatureCatalogEntry | undefined => {
  return FEATURE_CATALOG.find(f => f.key === key)
}

export const getLimitCatalogEntry = (key: LimitKey): LimitCatalogEntry | undefined => {
  return LIMIT_CATALOG.find(l => l.key === key)
}

export const getPlanLimit = (plan: Plan, key: LimitKey): number | null => {
  const found = plan.limits?.find(l => l.resourceKey === key)
  return found !== undefined ? found.limit : null
}

export const isPlanFeatureEnabled = (plan: Plan, key: FeatureKey): boolean => {
  const found = plan.features?.find(f => f.featureKey === key)
  return found ? found.enabled : false
}

