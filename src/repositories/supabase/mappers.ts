/**
 * Conversão entre as linhas da base de dados (snake_case) e os tipos da
 * aplicação (camelCase). Um único sítio para manter os dois lados alinhados.
 */
import type {
  Category,
  Company,
  MenuCustomization,
  Notification,
  NfcTag,
  NfcTagEvent,
  Order,
  OrderItem,
  Payment,
  Plan,
  PlatformAuditLog,
  PlatformConfig,
  Product,
  Restaurant,
  ServiceRequest,
  StaffMember,
  Subscription,
  SubscriptionHistory,
  Table,
  TableSession,
  User
} from '@/types'
import type { PlanChangeRequest } from '../interfaces'

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>

const num = (v: unknown): number => (v === null || v === undefined || v === '' ? 0 : Number(v))
const optNum = (v: unknown): number | undefined => (v === null || v === undefined || v === '' ? undefined : Number(v))
const opt = <T>(v: T | null | undefined): T | undefined => (v === null ? undefined : v)
/** Relação 1:1 do PostgREST pode vir como objeto ou como lista. */
const one = (v: unknown): Row | null => (Array.isArray(v) ? (v[0] ?? null) : ((v as Row) ?? null))

// ---------------------------------------------------------------- Planos
export const mapPlan = (r: Row): Plan => ({
  id: r.id,
  name: r.name,
  slug: r.slug,
  description: r.description ?? '',
  price: num(r.price),
  currency: r.currency ?? 'MT',
  billingPeriod: r.billing_period,
  active: r.active,
  features: Array.isArray(r.features) ? r.features : [],
  limits: Array.isArray(r.limits) ? r.limits : [],
  highlighted: r.highlighted ?? false,
  displayOrder: r.display_order ?? 0
})

export const planToRow = (p: Partial<Plan>): Row => {
  const row: Row = {}
  if (p.name !== undefined) row.name = p.name.trim()
  if (p.slug !== undefined) row.slug = p.slug.trim()
  if (p.description !== undefined) row.description = p.description
  if (p.price !== undefined) row.price = p.price
  if (p.currency !== undefined) row.currency = p.currency
  if (p.billingPeriod !== undefined) row.billing_period = p.billingPeriod
  if (p.active !== undefined) row.active = p.active
  if (p.features !== undefined) row.features = p.features
  if (p.limits !== undefined) row.limits = p.limits
  if (p.highlighted !== undefined) row.highlighted = p.highlighted
  if (p.displayOrder !== undefined) row.display_order = p.displayOrder
  return row
}

/** Equivalente mensal do preço (para MRR). */
export const monthlyPrice = (plan: Pick<Plan, 'price' | 'billingPeriod'> | null | undefined): number =>
  !plan ? 0 : plan.billingPeriod === 'yearly' ? Math.round((plan.price / 12) * 100) / 100 : plan.price

// ------------------------------------------------- Empresas e subscrições
export const COMPANY_SELECT = '*, subscriptions(id, plan_id)'

export const mapCompany = (r: Row): Company => {
  const sub = one(r.subscriptions)
  return {
    id: r.id,
    name: r.name,
    legalName: r.legal_name ?? '',
    slug: r.slug,
    taxId: r.tax_id ?? '',
    logoUrl: opt(r.logo_url),
    primaryColor: opt(r.primary_color),
    phone: r.phone ?? '',
    email: r.email ?? '',
    planId: sub?.plan_id ?? '',
    subscriptionId: sub?.id ?? '',
    isActive: r.is_active,
    createdAt: r.created_at
  }
}

export const companyToRow = (c: Partial<Company>): Row => {
  const row: Row = {}
  if (c.name !== undefined) row.name = c.name.trim()
  if (c.legalName !== undefined) row.legal_name = c.legalName
  if (c.taxId !== undefined) row.tax_id = c.taxId
  if (c.logoUrl !== undefined) row.logo_url = c.logoUrl || null
  if (c.primaryColor !== undefined) row.primary_color = c.primaryColor || null
  if (c.phone !== undefined) row.phone = c.phone
  if (c.email !== undefined) row.email = c.email
  if (c.isActive !== undefined) row.is_active = c.isActive
  return row
}

export const SUBSCRIPTION_SELECT = '*, companies(name), plans(name, price, billing_period), subscription_events(*)'

export const mapSubscriptionEvent = (r: Row): SubscriptionHistory => ({
  id: r.id,
  date: r.created_at,
  event: r.event,
  fromPlanName: opt(r.from_plan_name),
  toPlanName: opt(r.to_plan_name),
  amount: optNum(r.amount),
  note: opt(r.note),
  performedBy: r.performed_by ?? ''
})

export const mapSubscription = (r: Row): Subscription => {
  const plan = one(r.plans)
  const company = one(r.companies)
  return {
    id: r.id,
    tenantId: r.company_id,
    companyName: company?.name ?? '',
    planId: r.plan_id,
    planName: plan?.name ?? '',
    status: r.status,
    startDate: r.start_date,
    renewalDate: r.renewal_date,
    monthlyPrice: plan ? monthlyPrice({ price: num(plan.price), billingPeriod: plan.billing_period }) : 0,
    isAutoRenew: r.is_auto_renew,
    history: ((r.subscription_events ?? []) as Row[])
      .map(mapSubscriptionEvent)
      .sort((a, b) => b.date.localeCompare(a.date))
  }
}

export const mapPlanChangeRequest = (r: Row): PlanChangeRequest => ({
  id: r.id,
  tenantId: r.company_id,
  requestedPlanId: r.requested_plan_id,
  requestedByName: r.requested_by_name ?? '',
  note: opt(r.note),
  status: r.status,
  createdAt: r.created_at,
  resolvedAt: opt(r.resolved_at)
})

// ----------------------------------------------------------- Restaurantes
const DEFAULT_SETTINGS: Restaurant['settings'] = {
  allowCustomerOrdering: true,
  requireTableForOrder: true,
  serviceFeePercent: 0,
  themeAccentColor: '#0d7a5f',
  enabledPaymentMethods: ['cash']
}

export const mapRestaurant = (r: Row): Restaurant => ({
  id: r.id,
  tenantId: r.company_id ?? r.tenantId,
  name: r.name,
  slug: r.slug,
  description: r.description ?? '',
  coverImage: r.cover_image_url ?? r.coverImage ?? '',
  logoUrl: r.logo_url ?? r.logoUrl ?? '',
  address: { street: '', city: '', province: '', country: 'Moçambique', ...(r.address ?? {}) },
  phone: r.phone ?? '',
  email: r.email ?? '',
  currency: r.currency ?? 'MT',
  timezone: r.timezone ?? 'Africa/Maputo',
  openingHours: r.opening_hours ?? r.openingHours ?? '',
  isActive: r.is_active ?? r.isActive,
  taxRate: num(r.tax_rate ?? r.taxRate),
  settings: { ...DEFAULT_SETTINGS, ...(r.settings ?? {}) },
  createdAt: r.created_at ?? r.createdAt
})

export const restaurantToRow = (r: Partial<Restaurant>): Row => {
  const row: Row = {}
  if (r.tenantId !== undefined) row.company_id = r.tenantId
  if (r.name !== undefined) row.name = r.name.trim()
  if (r.slug !== undefined) row.slug = r.slug
  if (r.description !== undefined) row.description = r.description
  if (r.coverImage !== undefined) row.cover_image_url = r.coverImage || null
  if (r.logoUrl !== undefined) row.logo_url = r.logoUrl || null
  if (r.address !== undefined) row.address = r.address
  if (r.phone !== undefined) row.phone = r.phone
  if (r.email !== undefined) row.email = r.email
  if (r.currency !== undefined) row.currency = r.currency
  if (r.timezone !== undefined) row.timezone = r.timezone
  if (r.openingHours !== undefined) row.opening_hours = r.openingHours
  if (r.isActive !== undefined) row.is_active = r.isActive
  if (r.taxRate !== undefined) row.tax_rate = r.taxRate
  if (r.settings !== undefined) row.settings = r.settings
  return row
}

// --------------------------------------------------- Equipa e utilizadores
export const mapStaff = (r: Row): StaffMember => ({
  id: r.id,
  tenantId: r.company_id,
  name: r.name,
  email: r.email,
  phone: r.phone ?? '',
  role: r.role,
  assignedRestaurantIds: r.restaurant_ids ?? [],
  avatarUrl: opt(r.avatar_url),
  hireDate: r.hire_date,
  isActive: r.is_active
})

export const staffToRow = (s: Partial<StaffMember>): Row => {
  const row: Row = {}
  if (s.tenantId !== undefined) row.company_id = s.tenantId
  if (s.name !== undefined) row.name = s.name.trim()
  if (s.email !== undefined) row.email = s.email.trim().toLowerCase()
  if (s.phone !== undefined) row.phone = s.phone
  if (s.role !== undefined) row.role = s.role
  if (s.assignedRestaurantIds !== undefined) row.restaurant_ids = s.assignedRestaurantIds
  if (s.avatarUrl !== undefined) row.avatar_url = s.avatarUrl || null
  if (s.hireDate !== undefined) row.hire_date = s.hireDate
  if (s.isActive !== undefined) row.is_active = s.isActive
  return row
}

/** Perfil + ligação à empresa → User da aplicação. */
export const mapUser = (profile: Row, membership: Row | null): User => ({
  id: profile.id,
  name: membership?.name || profile.full_name || profile.email,
  email: profile.email,
  role: profile.is_super_admin ? 'super_admin' : membership?.role,
  avatarUrl: opt(profile.avatar_url) ?? opt(membership?.avatar_url),
  phone: profile.phone || membership?.phone || undefined,
  tenantId: profile.is_super_admin ? undefined : membership?.company_id,
  assignedRestaurantIds: membership?.restaurant_ids ?? [],
  isActive: profile.is_super_admin ? true : (membership?.is_active ?? false),
  createdAt: profile.created_at
})

// --------------------------------------------------------- Mesas e sessões
export const mapTable = (r: Row): Table => ({
  id: r.id,
  tenantId: r.company_id ?? r.tenantId,
  restaurantId: r.restaurant_id ?? r.restaurantId,
  number: r.number,
  name: opt(r.name),
  slug: r.slug,
  area: r.area,
  capacity: r.capacity,
  status: r.status,
  activeSessionId: opt(r.active_session_id ?? r.activeSessionId),
  isActive: r.is_active ?? r.isActive,
  createdAt: r.created_at ?? r.createdAt,
  updatedAt: r.updated_at ?? r.updatedAt
})

export const SESSION_SELECT = '*, session_participants(id, name, joined_at, is_primary), orders(id, created_at)'

export const mapSession = (r: Row): TableSession => ({
  id: r.id,
  tenantId: r.company_id,
  restaurantId: r.restaurant_id,
  tableId: r.table_id,
  status: r.status,
  startedAt: r.started_at,
  closedAt: opt(r.closed_at),
  closedBy: opt(r.closed_by),
  cancelReason: opt(r.cancel_reason),
  primaryCustomerName: opt(r.primary_customer_name),
  participants: ((r.session_participants ?? []) as Row[])
    .map(p => ({ id: p.id, name: p.name, joinedAt: p.joined_at, isPrimary: p.is_primary }))
    .sort((a, b) => a.joinedAt.localeCompare(b.joinedAt)),
  partySize: optNum(r.party_size),
  notes: opt(r.notes),
  orderIds: ((r.orders ?? []) as Row[])
    .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
    .map(o => o.id),
  total: num(r.total),
  billRequestedAt: opt(r.bill_requested_at)
})

/** Sessão devolvida pelas funções SQL (já em camelCase). */
export const normalizeSessionJson = (j: Row): TableSession => ({
  ...(j as TableSession),
  closedAt: opt(j.closedAt),
  closedBy: opt(j.closedBy),
  cancelReason: opt(j.cancelReason),
  primaryCustomerName: opt(j.primaryCustomerName),
  partySize: optNum(j.partySize),
  notes: opt(j.notes),
  billRequestedAt: opt(j.billRequestedAt),
  total: num(j.total),
  participants: j.participants ?? [],
  orderIds: j.orderIds ?? []
})

// ----------------------------------------------------------------- Menu
export const mapCategory = (r: Row): Category => ({
  id: r.id,
  tenantId: r.company_id ?? r.tenantId,
  restaurantId: r.restaurant_id ?? r.restaurantId,
  name: r.name,
  description: opt(r.description),
  imageUrl: opt(r.image_url ?? r.imageUrl),
  sortOrder: r.sort_order ?? r.sortOrder ?? 0,
  isActive: r.is_active ?? r.isActive
})

export const categoryToRow = (c: Partial<Category>): Row => {
  const row: Row = {}
  if (c.restaurantId !== undefined) row.restaurant_id = c.restaurantId
  if (c.name !== undefined) row.name = c.name.trim()
  if (c.description !== undefined) row.description = c.description || null
  if (c.imageUrl !== undefined) row.image_url = c.imageUrl || null
  if (c.sortOrder !== undefined) row.sort_order = c.sortOrder
  if (c.isActive !== undefined) row.is_active = c.isActive
  return row
}

export const PRODUCT_SELECT = '*, categories(name), product_variants(*), product_addons(*)'

export const mapProduct = (r: Row): Product => ({
  id: r.id,
  tenantId: r.company_id,
  restaurantId: r.restaurant_id,
  categoryId: r.category_id,
  categoryName: one(r.categories)?.name,
  name: r.name,
  description: r.description ?? '',
  imageUrl: r.image_url ?? '',
  price: num(r.price),
  promotionalPrice: optNum(r.promotional_price),
  isAvailable: r.is_available,
  isFeatured: r.is_featured,
  preparationTimeMinutes: r.preparation_time_minutes,
  station: r.station,
  variants: ((r.product_variants ?? []) as Row[])
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(v => ({ id: v.id, name: v.name, priceDelta: num(v.price_delta) })),
  addons: ((r.product_addons ?? []) as Row[])
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(a => ({ id: a.id, name: a.name, price: num(a.price), isDefault: a.is_default })),
  removableIngredients: r.removable_ingredients ?? [],
  allergens: r.allergens ?? [],
  sortOrder: r.sort_order ?? 0,
  isActive: r.is_active,
  isPromotion: r.is_promotion,
  isSpicy: r.is_spicy,
  isVegetarian: r.is_vegetarian
})

/** Produto devolvido pelo menu público (já em camelCase). */
export const normalizeProductJson = (j: Row): Product => ({
  ...(j as Product),
  price: num(j.price),
  promotionalPrice: optNum(j.promotionalPrice),
  variants: ((j.variants ?? []) as Row[]).map(v => ({ id: v.id, name: v.name, priceDelta: num(v.priceDelta) })),
  addons: ((j.addons ?? []) as Row[]).map(a => ({ id: a.id, name: a.name, price: num(a.price), isDefault: a.isDefault })),
  removableIngredients: j.removableIngredients ?? [],
  allergens: j.allergens ?? []
})

export const productToRow = (p: Partial<Product>): Row => {
  const row: Row = {}
  if (p.restaurantId !== undefined) row.restaurant_id = p.restaurantId
  if (p.categoryId !== undefined) row.category_id = p.categoryId
  if (p.name !== undefined) row.name = p.name.trim()
  if (p.description !== undefined) row.description = p.description
  if (p.imageUrl !== undefined) row.image_url = p.imageUrl ?? ''
  if (p.price !== undefined) row.price = p.price
  if ('promotionalPrice' in p) row.promotional_price = p.promotionalPrice ?? null
  if (p.isAvailable !== undefined) row.is_available = p.isAvailable
  if (p.isFeatured !== undefined) row.is_featured = p.isFeatured
  if (p.preparationTimeMinutes !== undefined) row.preparation_time_minutes = p.preparationTimeMinutes
  if (p.station !== undefined) row.station = p.station
  if (p.removableIngredients !== undefined) row.removable_ingredients = p.removableIngredients
  if (p.allergens !== undefined) row.allergens = p.allergens
  if (p.sortOrder !== undefined) row.sort_order = p.sortOrder
  if (p.isActive !== undefined) row.is_active = p.isActive
  if (p.isPromotion !== undefined) row.is_promotion = p.isPromotion
  if (p.isSpicy !== undefined) row.is_spicy = p.isSpicy
  if (p.isVegetarian !== undefined) row.is_vegetarian = p.isVegetarian
  return row
}

// ---------------------------------------------------- Pedidos e pagamentos
export const ORDER_SELECT = '*, order_items(*), order_status_history(*)'

const mapOrderItem = (r: Row): OrderItem => ({
  id: r.id,
  productId: r.product_id ?? '',
  productName: r.product_name,
  productImage: opt(r.product_image),
  quantity: r.quantity,
  unitPrice: num(r.unit_price),
  totalPrice: num(r.total_price),
  selectedVariant: r.selected_variant
    ? { id: r.selected_variant.id, name: r.selected_variant.name, priceDelta: num(r.selected_variant.priceDelta) }
    : undefined,
  selectedAddons: ((r.selected_addons ?? []) as Row[]).map(a => ({ id: a.id, name: a.name, price: num(a.price) })),
  removedIngredients: r.removed_ingredients ?? [],
  notes: opt(r.notes),
  station: r.station
})

export const mapOrder = (r: Row): Order => ({
  id: r.id,
  tenantId: r.company_id,
  restaurantId: r.restaurant_id,
  tableId: opt(r.table_id),
  tableNumber: opt(r.table_number),
  tableSessionId: opt(r.table_session_id),
  isAdditional: r.is_additional,
  orderCode: r.order_code,
  type: r.type,
  status: r.status,
  paymentStatus: r.payment_status,
  paymentMethod: opt(r.payment_method),
  items: ((r.order_items ?? []) as Row[]).sort((a, b) => a.sort_order - b.sort_order).map(mapOrderItem),
  subtotal: num(r.subtotal),
  taxAmount: num(r.tax_amount),
  serviceFee: num(r.service_fee),
  total: num(r.total),
  customerName: opt(r.customer_name),
  customerPhone: opt(r.customer_phone),
  notes: opt(r.notes),
  history: ((r.order_status_history ?? []) as Row[])
    .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
    .map(h => ({ status: h.status, timestamp: h.created_at, updatedBy: h.updated_by, note: opt(h.note) })),
  createdAt: r.created_at,
  updatedAt: r.updated_at
})

/** Pedido devolvido pelas funções SQL (já em camelCase). */
export const normalizeOrderJson = (j: Row): Order => ({
  ...(j as Order),
  tableId: opt(j.tableId),
  tableNumber: opt(j.tableNumber),
  tableSessionId: opt(j.tableSessionId),
  paymentMethod: opt(j.paymentMethod),
  customerName: opt(j.customerName),
  customerPhone: opt(j.customerPhone),
  notes: opt(j.notes),
  subtotal: num(j.subtotal),
  taxAmount: num(j.taxAmount),
  serviceFee: num(j.serviceFee),
  total: num(j.total),
  items: ((j.items ?? []) as Row[]).map(i => ({
    ...(i as OrderItem),
    productId: i.productId ?? '',
    productImage: opt(i.productImage),
    unitPrice: num(i.unitPrice),
    totalPrice: num(i.totalPrice),
    selectedVariant: i.selectedVariant ? { ...i.selectedVariant, priceDelta: num(i.selectedVariant.priceDelta) } : undefined,
    selectedAddons: ((i.selectedAddons ?? []) as Row[]).map(a => ({ id: a.id, name: a.name, price: num(a.price) })),
    removedIngredients: i.removedIngredients ?? [],
    notes: opt(i.notes)
  })),
  history: ((j.history ?? []) as Row[]).map(h => ({ status: h.status, timestamp: h.timestamp, updatedBy: h.updatedBy, note: opt(h.note) }))
})

export const PAYMENT_SELECT = '*, orders(order_code, table_number)'

export const mapPayment = (r: Row): Payment => {
  const order = one(r.orders)
  return {
    id: r.id,
    tenantId: r.company_id,
    restaurantId: r.restaurant_id,
    orderId: r.order_id,
    orderCode: order?.order_code ?? '',
    tableNumber: opt(order?.table_number),
    amount: num(r.amount),
    method: r.method,
    status: r.status,
    transactionReference: r.transaction_reference ?? '',
    customerPhone: opt(r.customer_phone),
    notes: opt(r.notes),
    createdAt: r.created_at
  }
}

// ------------------------------------------------ Atendimento e notificações
export const mapServiceRequest = (r: Row): ServiceRequest => ({
  id: r.id,
  tenantId: r.company_id ?? r.tenantId,
  restaurantId: r.restaurant_id ?? r.restaurantId,
  tableId: r.table_id ?? r.tableId ?? '',
  tableNumber: r.table_number ?? r.tableNumber ?? '',
  tableSessionId: opt(r.table_session_id ?? r.tableSessionId),
  customerName: opt(r.customer_name ?? r.customerName),
  type: r.type,
  status: r.status,
  notes: opt(r.notes),
  assignedToUserId: opt(r.assigned_to_user_id ?? r.assignedToUserId),
  assignedToName: opt(r.assigned_to_name ?? r.assignedToName),
  createdAt: r.created_at ?? r.createdAt,
  resolvedAt: opt(r.resolved_at ?? r.resolvedAt)
})

export const mapNotification = (r: Row): Notification => ({
  id: r.id,
  tenantId: r.company_id,
  restaurantId: r.restaurant_id,
  type: r.type,
  title: r.title,
  message: r.message,
  tableId: opt(r.table_id),
  tableNumber: opt(r.table_number),
  tableSessionId: opt(r.table_session_id),
  orderId: opt(r.order_id),
  serviceRequestId: opt(r.service_request_id),
  createdAt: r.created_at,
  readAt: opt(r.read_at)
})

// ------------------------------------------------------------------ NFC
export const mapNfcTag = (r: Row): NfcTag => ({
  id: r.id,
  code: r.code,
  tenantId: r.company_id,
  restaurantId: r.restaurant_id,
  tableId: opt(r.table_id),
  targetPath: opt(r.target_path),
  configuredPath: opt(r.configured_path),
  status: r.status,
  configuredAt: opt(r.configured_at),
  configuredBy: opt(r.configured_by),
  notes: opt(r.notes),
  createdAt: r.created_at,
  updatedAt: r.updated_at
})

export const mapNfcTagEvent = (r: Row): NfcTagEvent => ({
  id: r.id,
  tagId: r.tag_id,
  type: r.type,
  description: r.description,
  actor: r.actor,
  createdAt: r.created_at,
  tableId: opt(r.table_id),
  tableLabel: opt(r.table_label),
  path: opt(r.path),
  fromStatus: opt(r.from_status),
  toStatus: opt(r.to_status)
})

// ------------------------------------------- Personalização, auditoria, config
export const mapCustomization = (r: Row): MenuCustomization => ({
  id: r.id,
  tenantId: r.company_id,
  restaurantId: r.restaurant_id,
  theme: r.theme,
  updatedAt: r.updated_at,
  updatedBy: r.updated_by ?? ''
})

export const mapAuditLog = (r: Row): PlatformAuditLog => ({
  id: r.id,
  tenantId: opt(r.company_id),
  userId: r.user_id ?? '',
  userName: r.user_name ?? '',
  action: r.action,
  resource: r.resource ?? '',
  details: r.details ?? '',
  createdAt: r.created_at,
  timestamp: r.created_at
})

export const mapPlatformConfig = (r: Row): PlatformConfig => ({
  platformName: r.platform_name,
  supportEmail: r.support_email,
  supportPhone: r.support_phone,
  defaultPlanId: r.default_plan_id ?? '',
  trialDays: r.trial_days,
  allowSelfSignup: r.allow_self_signup,
  maintenanceMode: r.maintenance_mode
})

export const platformConfigToRow = (c: Partial<PlatformConfig>): Row => {
  const row: Row = {}
  if (c.platformName !== undefined) row.platform_name = c.platformName
  if (c.supportEmail !== undefined) row.support_email = c.supportEmail
  if (c.supportPhone !== undefined) row.support_phone = c.supportPhone
  if (c.defaultPlanId !== undefined) row.default_plan_id = c.defaultPlanId || null
  if (c.trialDays !== undefined) row.trial_days = c.trialDays
  if (c.allowSelfSignup !== undefined) row.allow_self_signup = c.allowSelfSignup
  if (c.maintenanceMode !== undefined) row.maintenance_mode = c.maintenanceMode
  return row
}
