import { repositories } from '@/repositories'
import type {
  TableInput,
  StartSessionInput,
  RegisterNfcTagsInput,
  AuthAccount,
  RegisterCompanyInput,
  CreateCompanyInput,
  PlaceOrderInput,
  CreateServiceRequestInput,
  PublicTableContext,
  PublicMenuContent,
  PublicOrderView,
  PlanChangeRequest,
  MediaKind
} from '@/repositories/interfaces'
import { countTables } from '@/domain/tableRules'
import type {
  User,
  Company,
  Restaurant,
  Table,
  TableSession,
  SessionParticipant,
  NfcTag,
  NfcTagEvent,
  Notification,
  Category,
  Product,
  Order,
  Payment,
  ServiceRequest,
  StaffMember,
  Plan,
  PaymentMethod,
  Subscription,
  SubscriptionHistory,
  OrderStatus,
  PaymentStatus,
  ServiceRequestStatus,
  DashboardMetrics,
  PlatformAuditLog,
  PlatformConfig
} from '@/types'

export type {
  TableInput,
  StartSessionInput,
  RegisterNfcTagsInput,
  AuthAccount,
  RegisterCompanyInput,
  CreateCompanyInput,
  PlaceOrderInput,
  CreateServiceRequestInput,
  PublicTableContext,
  PublicMenuContent,
  PublicOrderView,
  PlanChangeRequest,
  MediaKind
}

// Repositórios (fonte única em src/repositories/index.ts)
const {
  auth: authRepo,
  publicMenu: publicMenuRepo,
  media: mediaRepo,
  companies: companyRepo,
  restaurants: restaurantRepo,
  users: userRepo,
  tables: tableRepo,
  tableSessions: tableSessionRepo,
  nfcTags: nfcTagRepo,
  notifications: notificationRepo,
  categories: categoryRepo,
  products: productRepo,
  orders: orderRepo,
  payments: paymentRepo,
  serviceRequests: serviceRequestRepo,
  staff: staffRepo,
  plans: planRepo,
  subscriptions: subscriptionRepo,
  auditLogs: auditRepo,
  platformConfig: platformConfigRepo
} = repositories

// ================= Autenticação (Supabase Auth) =================
export const authService = {
  getAccount(): Promise<AuthAccount | null> {
    return authRepo.getAccount()
  },
  signIn(email: string, password: string): Promise<void> {
    return authRepo.signIn(email, password)
  },
  signUp(email: string, password: string, fullName: string, redirectTo: string) {
    return authRepo.signUp(email, password, fullName, redirectTo)
  },
  signOut(): Promise<void> {
    return authRepo.signOut()
  },
  sendPasswordReset(email: string, redirectTo: string): Promise<void> {
    return authRepo.sendPasswordReset(email, redirectTo)
  },
  updatePassword(password: string): Promise<void> {
    return authRepo.updatePassword(password)
  },
  claimInvitations(): Promise<number> {
    return authRepo.claimInvitations()
  },
  registerCompany(input: RegisterCompanyInput): Promise<string> {
    return authRepo.registerCompany(input)
  },
  onAuthChange(callback: (event: string) => void): () => void {
    return authRepo.onAuthChange(callback)
  }
}

export const userService = {
  getAllUsers(): Promise<User[]> {
    return userRepo.getAll()
  },
  getUsersByTenant(tenantId: string): Promise<User[]> {
    return userRepo.getByTenant(tenantId)
  }
}

// ================= Tenant & Restaurant Services =================
export const tenantService = {
  async getAllCompanies(): Promise<Company[]> {
    return companyRepo.getAll()
  },
  async getCompanyById(id: string): Promise<Company | null> {
    return companyRepo.getById(id)
  },
  async createCompany(data: CreateCompanyInput): Promise<Company> {
    return companyRepo.create(data)
  },
  async updateCompany(id: string, updates: Partial<Company>): Promise<Company> {
    return companyRepo.update(id, updates)
  }
}

export const restaurantService = {
  async getRestaurantsByTenant(tenantId: string): Promise<Restaurant[]> {
    return restaurantRepo.getByTenant(tenantId)
  },
  async getRestaurantById(id: string): Promise<Restaurant | null> {
    return restaurantRepo.getById(id)
  },
  async getRestaurantBySlug(slug: string): Promise<Restaurant | null> {
    return restaurantRepo.getBySlug(slug)
  },
  async getAllRestaurants(): Promise<Restaurant[]> {
    return restaurantRepo.getAll()
  },
  async createRestaurant(data: Omit<Restaurant, 'id' | 'createdAt'>): Promise<Restaurant> {
    return restaurantRepo.create(data)
  },
  async updateRestaurant(id: string, updates: Partial<Restaurant>): Promise<Restaurant> {
    return restaurantRepo.update(id, updates)
  }
}

// ================= Catalog (Product & Category) Services =================
export const categoryService = {
  async getCategories(restaurantId: string): Promise<Category[]> {
    return categoryRepo.getByRestaurant(restaurantId)
  },
  async createCategory(data: Omit<Category, 'id'>): Promise<Category> {
    return categoryRepo.create(data)
  },
  async updateCategory(id: string, updates: Partial<Category>): Promise<Category> {
    return categoryRepo.update(id, updates)
  },
  async deleteCategory(id: string): Promise<boolean> {
    return categoryRepo.delete(id)
  }
}

export const productService = {
  async getProducts(restaurantId: string): Promise<Product[]> {
    return productRepo.getByRestaurant(restaurantId)
  },
  async getProductById(id: string): Promise<Product | null> {
    return productRepo.getById(id)
  },
  async createProduct(data: Omit<Product, 'id'>): Promise<Product> {
    return productRepo.create(data)
  },
  async updateProduct(id: string, updates: Partial<Product>): Promise<Product> {
    return productRepo.update(id, updates)
  },
  async deleteProduct(id: string): Promise<boolean> {
    return productRepo.delete(id)
  }
}

// ================= Mesas =================
export const tableService = {
  async getTables(restaurantId: string): Promise<Table[]> {
    return tableRepo.getByRestaurant(restaurantId)
  },
  async getTableById(id: string): Promise<Table | null> {
    return tableRepo.getById(id)
  },
  async createTable(restaurantId: string, input: TableInput): Promise<Table> {
    return tableRepo.create(restaurantId, input)
  },
  async updateTable(id: string, input: Partial<TableInput>): Promise<Table> {
    return tableRepo.update(id, input)
  },
  async setTableStatus(id: string, status: 'free' | 'unavailable'): Promise<Table> {
    return tableRepo.setStatus(id, status)
  },
  async setTableActive(id: string, isActive: boolean): Promise<Table> {
    return tableRepo.setActive(id, isActive)
  },
  async deleteTable(id: string, actor: string): Promise<boolean> {
    return tableRepo.delete(id, actor)
  }
}

// ================= Acesso público (URL da etiqueta / QR Code) =================
export const publicTableService = {
  /**
   * Resolve a URL pública: restaurante → mesa → estado atual.
   * Aceita o slug permanente (/m/:restaurante/:mesa) e, por compatibilidade,
   * o número da mesa usado nas URLs antigas (/menu/:restaurante/:numero).
   */
  resolve(restaurantSlug: string, tableKey: string): Promise<PublicTableContext | null> {
    return publicMenuRepo.resolveTable(restaurantSlug, tableKey)
  },
  getMenu(restaurantId: string): Promise<PublicMenuContent> {
    return publicMenuRepo.getMenu(restaurantId)
  },
  placeOrder(input: PlaceOrderInput): Promise<Order> {
    return publicMenuRepo.placeOrder(input)
  },
  getSessionOrders(sessionId: string, participantToken?: string): Promise<Order[]> {
    return publicMenuRepo.getSessionOrders(sessionId, participantToken)
  },
  requestBill(sessionId: string, participantToken?: string, paymentMethod?: PaymentMethod, notes?: string): Promise<TableSession> {
    return publicMenuRepo.requestBill(sessionId, participantToken, paymentMethod, notes)
  },
  createServiceRequest(input: CreateServiceRequestInput) {
    return publicMenuRepo.createServiceRequest(input)
  },
  getOrder(orderId: string): Promise<PublicOrderView | null> {
    return publicMenuRepo.getOrder(orderId)
  }
}

// ================= Imagens (Supabase Storage) =================
export const mediaService = {
  uploadImage(file: File, scope: { tenantId: string; restaurantId?: string; kind: MediaKind }): Promise<string> {
    return mediaRepo.uploadImage(file, scope)
  },
  removeByUrl(url: string): Promise<void> {
    return mediaRepo.removeByUrl(url)
  }
}

// ================= Etiquetas NFC (gestão administrativa) =================
export const nfcTagService = {
  async getAllTags(): Promise<NfcTag[]> {
    return nfcTagRepo.getAll()
  },
  async getTags(restaurantId: string): Promise<NfcTag[]> {
    return nfcTagRepo.getByRestaurant(restaurantId)
  },
  async getTagByTable(tableId: string): Promise<NfcTag | null> {
    return nfcTagRepo.getByTable(tableId)
  },
  async getHistory(tagId: string): Promise<NfcTagEvent[]> {
    return nfcTagRepo.getHistory(tagId)
  },
  async registerTags(input: RegisterNfcTagsInput, actor: string): Promise<NfcTag[]> {
    return nfcTagRepo.register(input, actor)
  },
  async assignToTable(tagId: string, tableId: string, actor: string): Promise<NfcTag> {
    return nfcTagRepo.assign(tagId, tableId, actor)
  },
  async unassign(tagId: string, actor: string): Promise<NfcTag> {
    return nfcTagRepo.unassign(tagId, actor)
  },
  async markConfigured(tagId: string, actor: string, notes?: string): Promise<NfcTag> {
    return nfcTagRepo.markConfigured(tagId, actor, notes)
  },
  async activate(tagId: string, actor: string): Promise<NfcTag> {
    return nfcTagRepo.activate(tagId, actor)
  },
  async disable(tagId: string, actor: string, reason?: string): Promise<NfcTag> {
    return nfcTagRepo.disable(tagId, actor, reason)
  },
  async reactivate(tagId: string, actor: string): Promise<NfcTag> {
    return nfcTagRepo.reactivate(tagId, actor)
  }
}

// ================= Orders & Kitchen (KDS) Services =================
export const orderService = {
  async getOrders(restaurantId: string): Promise<Order[]> {
    return orderRepo.getByRestaurant(restaurantId)
  },
  async getOrderById(id: string): Promise<Order | null> {
    return orderRepo.getById(id)
  },
  async getAllOrders(limit?: number): Promise<Order[]> {
    return orderRepo.getAll(limit)
  },
  async updateOrderStatus(id: string, status: OrderStatus, note?: string): Promise<Order> {
    return orderRepo.updateStatus(id, status, note)
  },
  async updatePaymentStatus(id: string, paymentStatus: PaymentStatus): Promise<Order> {
    return orderRepo.updatePaymentStatus(id, paymentStatus)
  }
}

// ================= Payments Service =================
export const paymentService = {
  async getPayments(restaurantId: string): Promise<Payment[]> {
    return paymentRepo.getByRestaurant(restaurantId)
  },
  async getAllPayments(limit?: number): Promise<Payment[]> {
    return paymentRepo.getAll(limit)
  },
  async getPaymentById(id: string): Promise<Payment | null> {
    return paymentRepo.getById(id)
  },
  async createPayment(data: Omit<Payment, 'id' | 'createdAt'>): Promise<Payment> {
    return paymentRepo.create(data)
  },
  async updateStatus(id: string, status: PaymentStatus): Promise<Payment> {
    return paymentRepo.updateStatus(id, status)
  }
}

// ================= Service Requests (Atendimento Digital) =================
export const serviceRequestService = {
  async getRequests(restaurantId: string): Promise<ServiceRequest[]> {
    return serviceRequestRepo.getByRestaurant(restaurantId)
  },
  async updateStatus(id: string, status: ServiceRequestStatus, assignedToUserId?: string, assignedToName?: string): Promise<ServiceRequest> {
    return serviceRequestRepo.updateStatus(id, status, assignedToUserId, assignedToName)
  }
}

// ================= Staff Service =================
export const staffService = {
  async getStaffByTenant(tenantId: string): Promise<StaffMember[]> {
    return staffRepo.getByTenant(tenantId)
  },
  async getStaffByRestaurant(restaurantId: string): Promise<StaffMember[]> {
    return staffRepo.getByRestaurant(restaurantId)
  },
  async createStaff(data: Omit<StaffMember, 'id'>): Promise<StaffMember> {
    return staffRepo.create(data)
  },
  async updateStaff(id: string, updates: Partial<StaffMember>): Promise<StaffMember> {
    return staffRepo.update(id, updates)
  },
  async deleteStaff(id: string): Promise<boolean> {
    return staffRepo.delete(id)
  }
}

// ================= Subscriptions & Plans (SaaS) =================
export const planService = {
  async getAllPlans(): Promise<Plan[]> {
    return planRepo.getAll()
  },
  async getPlanById(id: string): Promise<Plan | null> {
    return planRepo.getById(id)
  },
  async getPlanBySlug(slug: string): Promise<Plan | null> {
    return planRepo.getBySlug(slug)
  },
  async createPlan(data: Omit<Plan, 'id'>): Promise<Plan> {
    return planRepo.create(data)
  },
  async updatePlan(id: string, updates: Partial<Plan>): Promise<Plan> {
    return planRepo.update(id, updates)
  },
  async deletePlan(id: string): Promise<boolean> {
    return planRepo.delete(id)
  }
}

export const subscriptionService = {
  async getAllPlans(): Promise<Plan[]> {
    return planRepo.getAll()
  },
  async getAllSubscriptions(): Promise<Subscription[]> {
    return subscriptionRepo.getAllSubscriptions()
  },
  async getByTenant(tenantId: string): Promise<Subscription | null> {
    return subscriptionRepo.getByTenant(tenantId)
  },
  async getById(id: string): Promise<Subscription | null> {
    return subscriptionRepo.getById(id)
  },
  async updateSubscription(id: string, updates: Parameters<typeof subscriptionRepo.updateSubscription>[1]): Promise<Subscription> {
    return subscriptionRepo.updateSubscription(id, updates)
  },
  async addHistoryEvent(id: string, event: Omit<SubscriptionHistory, 'id' | 'date'>): Promise<Subscription> {
    return subscriptionRepo.addHistoryEvent(id, event)
  },
  /**
   * O dono da empresa pede uma alteração de plano. Não há cobrança
   * automática: a equipa TapMenu aplica a alteração no Super Admin.
   */
  async requestPlanChange(planId: string, note?: string): Promise<PlanChangeRequest> {
    return subscriptionRepo.requestPlanChange(planId, note)
  },
  async getPlanChangeRequests(tenantId?: string): Promise<PlanChangeRequest[]> {
    return subscriptionRepo.getPlanChangeRequests(tenantId)
  },
  async resolvePlanChangeRequest(id: string, status: 'approved' | 'rejected'): Promise<void> {
    return subscriptionRepo.resolvePlanChangeRequest(id, status)
  }
}

// ================= Platform Audit & Config (Super Admin) =================
export const auditService = {
  async getLogs(filter?: { tenantId?: string; limit?: number }): Promise<PlatformAuditLog[]> {
    return auditRepo.getAll(filter)
  },
  async log(entry: Omit<PlatformAuditLog, 'id' | 'createdAt'>): Promise<PlatformAuditLog> {
    return auditRepo.create(entry)
  }
}

export const platformConfigService = {
  async getConfig(): Promise<PlatformConfig> {
    return platformConfigRepo.get()
  },
  async updateConfig(updates: Partial<PlatformConfig>): Promise<PlatformConfig> {
    return platformConfigRepo.update(updates)
  }
}

export * from './planAccessService'
export * from './menuCustomizationService'


// ================= Report & Metrics Service =================
export const reportService = {
  /**
   * Indicadores reais do restaurante. `periodDays`: 1 = hoje, 7 = hoje e os
   * 6 dias anteriores, etc. O período anterior tem a mesma duração.
   */
  async getDashboardMetrics(restaurantId: string, periodDays = 1): Promise<DashboardMetrics> {
    const orders = await orderRepo.getByRestaurant(restaurantId)
    const tables = await tableRepo.getByRestaurant(restaurantId)
    const requests = await serviceRequestRepo.getByRestaurant(restaurantId)
    const products = await productRepo.getByRestaurant(restaurantId)

    const validOrders = orders.filter(o => o.status !== 'cancelled')
    const totalRevenue = validOrders.reduce((sum, o) => sum + o.total, 0)
    const averageTicket = validOrders.length > 0 ? totalRevenue / validOrders.length : 0

    const tableCounts = countTables(tables)

    const pendingOrders = orders.filter(o => o.status === 'received' || o.status === 'confirmed').length
    const preparingOrders = orders.filter(o => o.status === 'preparing').length
    const readyOrders = orders.filter(o => o.status === 'ready').length

    const activeServiceRequests = requests.filter(r => r.status === 'new' || r.status === 'in_progress').length
    const unavailableProductsCount = products.filter(p => !p.isAvailable).length

    const periodStart = new Date()
    periodStart.setHours(0, 0, 0, 0)
    periodStart.setDate(periodStart.getDate() - (periodDays - 1))
    const previousStart = new Date(periodStart)
    previousStart.setDate(periodStart.getDate() - periodDays)
    const inRange = (o: Order, from: Date, to?: Date) => {
      const t = new Date(o.createdAt).getTime()
      return t >= from.getTime() && (!to || t < to.getTime())
    }
    const periodAll = orders.filter(o => inRange(o, periodStart))
    const periodValid = periodAll.filter(o => o.status !== 'cancelled')
    const round2 = (n: number) => Math.round(n * 100) / 100
    const cancelledOrders = orders.length - validOrders.length

    return {
      periodOrders: periodValid.length,
      periodRevenue: round2(periodValid.reduce((sum, o) => sum + o.total, 0)),
      previousPeriodRevenue: round2(
        validOrders.filter(o => inRange(o, previousStart, periodStart)).reduce((sum, o) => sum + o.total, 0)
      ),
      periodCancelledOrders: periodAll.length - periodValid.length,
      cancelledOrders,
      cancellationRate: periodAll.length ? Math.round(((periodAll.length - periodValid.length) / periodAll.length) * 1000) / 10 : 0,
      totalOrders: orders.length,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      averageTicket: Math.round(averageTicket * 100) / 100,
      totalTables: tableCounts.total,
      occupiedTables: tableCounts.occupied,
      availableTables: tableCounts.free,
      unavailableTables: tableCounts.unavailable,
      pendingOrders,
      preparingOrders,
      readyOrders,
      activeServiceRequests,
      unavailableProductsCount
    }
  },

  /** Vendas reais dos últimos 7 dias (pedidos não cancelados), do mais antigo para hoje. */
  async getSalesByDay(restaurantId: string): Promise<{ label: string; amount: number; orderCount: number }[]> {
    const orders = await orderRepo.getByRestaurant(restaurantId)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(today)
      date.setDate(today.getDate() - (6 - i))
      return {
        key: date.toDateString(),
        label: i === 6 ? 'Hoje' : date.toLocaleDateString('pt-MZ', { weekday: 'short', day: '2-digit' }),
        amount: 0,
        orderCount: 0
      }
    })
    for (const order of orders) {
      if (order.status === 'cancelled') continue
      const day = days.find(d => d.key === new Date(order.createdAt).toDateString())
      if (!day) continue
      day.amount += order.total
      day.orderCount++
    }
    return days.map(({ label, amount, orderCount }) => ({ label, amount: Math.round(amount * 100) / 100, orderCount }))
  },

  async getTopProducts(restaurantId: string): Promise<{ name: string; quantity: number; revenue: number }[]> {
    const orders = await orderRepo.getByRestaurant(restaurantId)
    const map = new Map<string, { quantity: number; revenue: number }>()

    orders.filter(o => o.status !== 'cancelled').forEach(order => {
      order.items.forEach(item => {
        const cur = map.get(item.productName) || { quantity: 0, revenue: 0 }
        cur.quantity += item.quantity
        cur.revenue += item.totalPrice
        map.set(item.productName, cur)
      })
    })

    const list = Array.from(map.entries()).map(([name, data]) => ({
      name,
      quantity: data.quantity,
      revenue: Math.round(data.revenue)
    }))

    list.sort((a, b) => b.quantity - a.quantity)
    return list.slice(0, 5)
  }
}

// ================= TableSession Service =================
export const tableSessionService = {
  async getSessions(restaurantId: string): Promise<TableSession[]> {
    return tableSessionRepo.getByRestaurant(restaurantId)
  },
  async getSessionsByTable(tableId: string): Promise<TableSession[]> {
    return tableSessionRepo.getByTable(tableId)
  },
  async getActiveSessionByTable(tableId: string): Promise<TableSession | null> {
    return tableSessionRepo.getActiveByTable(tableId)
  },
  async getSessionById(id: string): Promise<TableSession | null> {
    return tableSessionRepo.getById(id)
  },
  /** Livre → Ocupada. */
  async startSession(input: StartSessionInput): Promise<{ session: TableSession; participant: SessionParticipant | null }> {
    return tableSessionRepo.start(input)
  },
  async joinSession(sessionId: string, name: string): Promise<{ session: TableSession; participant: SessionParticipant }> {
    return tableSessionRepo.join(sessionId, name)
  },
  /** Ocupada → Livre (sessão encerrada). */
  async closeSession(sessionId: string, actor: string): Promise<TableSession> {
    return tableSessionRepo.close(sessionId, actor)
  },
  /** Ocupada → Livre (sessão cancelada). */
  async cancelSession(sessionId: string, actor: string, reason?: string): Promise<TableSession> {
    return tableSessionRepo.cancel(sessionId, actor, reason)
  }
}

// ================= Notification Service =================
export const notificationService = {
  async getNotifications(restaurantId: string): Promise<Notification[]> {
    return notificationRepo.getByRestaurant(restaurantId)
  },
  async markAsRead(id: string): Promise<Notification> {
    return notificationRepo.markAsRead(id)
  },
  async markAllAsRead(restaurantId: string): Promise<void> {
    return notificationRepo.markAllAsRead(restaurantId)
  }
}

// Reset Database Utility


// ================= Tempo real (Supabase Realtime) =================
export { subscribeToRestaurant as subscribeToRealtime } from '@/repositories/supabase/realtime'
export type { RealtimeTable } from '@/repositories/supabase/realtime'
