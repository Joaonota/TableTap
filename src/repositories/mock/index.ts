import { mockStorage } from './mockStorage'
import { recalculateSessionTotal } from './tableSessionRepository'
import { assertWithinPlanLimit } from './planAccessRepository'
import { normalizePlanEntitlements } from '@/domain/planLimits'
import { DomainError } from '@/domain/errors'

export { MockTableRepository } from './tableRepository'
export { MockTableSessionRepository } from './tableSessionRepository'
export { MockNfcTagRepository } from './nfcTagRepository'
export { MockPlanAccessRepository } from './planAccessRepository'
import type {
  ICompanyRepository,
  IRestaurantRepository,
  IUserRepository,
  ICategoryRepository,
  IProductRepository,
  IOrderRepository,
  IPaymentRepository,
  IServiceRequestRepository,
  IStaffRepository,
  IPlanRepository,
  ISubscriptionRepository,
  IMenuCustomizationRepository,
  IAuditLogRepository,
  IPlatformConfigRepository,
  INotificationRepository
} from '../interfaces'
import type {
  Company,
  Restaurant,
  User,
  Notification,
  Category,
  Product,
  Order,
  Payment,
  ServiceRequest,
  StaffMember,
  Plan,
  Subscription,
  SubscriptionHistory,
  OrderStatus,
  PaymentStatus,
  ServiceRequestStatus,
  MenuCustomization,
  PlatformAuditLog,
  PlatformConfig
} from '@/types'

export class MockCompanyRepository implements ICompanyRepository {
  async getAll(): Promise<Company[]> {
    return [...mockStorage.getDb().companies]
  }

  async getById(id: string): Promise<Company | null> {
    const item = mockStorage.getDb().companies.find(c => c.id === id)
    return item ? { ...item } : null
  }

  async create(company: Omit<Company, 'id' | 'createdAt'>): Promise<Company> {
    const newCompany: Company = {
      ...company,
      id: `tenant-${Date.now()}`,
      createdAt: new Date().toISOString()
    }
    mockStorage.getDb().companies.push(newCompany)
    mockStorage.commit()
    return newCompany
  }

  async update(id: string, updates: Partial<Company>): Promise<Company> {
    const db = mockStorage.getDb()
    const index = db.companies.findIndex(c => c.id === id)
    if (index === -1) throw new Error(`Empresa com id ${id} não encontrada`)
    db.companies[index] = { ...db.companies[index], ...updates }
    mockStorage.commit()
    return { ...db.companies[index] }
  }
}

export class MockRestaurantRepository implements IRestaurantRepository {
  async getByTenant(tenantId: string): Promise<Restaurant[]> {
    return mockStorage.getDb().restaurants.filter(r => r.tenantId === tenantId)
  }

  async getById(id: string): Promise<Restaurant | null> {
    const item = mockStorage.getDb().restaurants.find(r => r.id === id)
    return item ? { ...item } : null
  }

  async getBySlug(slug: string): Promise<Restaurant | null> {
    const item = mockStorage.getDb().restaurants.find(r => r.slug === slug)
    return item ? { ...item } : null
  }

  async getAll(): Promise<Restaurant[]> {
    return [...mockStorage.getDb().restaurants]
  }

  async create(restaurant: Omit<Restaurant, 'id' | 'createdAt'>): Promise<Restaurant> {
    assertWithinPlanLimit(restaurant.tenantId, 'RESTAURANTS')
    const newRest: Restaurant = {
      ...restaurant,
      id: `rest-${Date.now()}`,
      createdAt: new Date().toISOString()
    }
    mockStorage.getDb().restaurants.push(newRest)
    mockStorage.commit()
    return newRest
  }

  async update(id: string, updates: Partial<Restaurant>): Promise<Restaurant> {
    const db = mockStorage.getDb()
    const index = db.restaurants.findIndex(r => r.id === id)
    if (index === -1) throw new Error(`Restaurante com id ${id} não encontrado`)
    db.restaurants[index] = { ...db.restaurants[index], ...updates }
    mockStorage.commit()
    return { ...db.restaurants[index] }
  }
}

export class MockUserRepository implements IUserRepository {
  async getAll(): Promise<User[]> {
    return [...mockStorage.getDb().users]
  }

  async getById(id: string): Promise<User | null> {
    const item = mockStorage.getDb().users.find(u => u.id === id)
    return item ? { ...item } : null
  }

  async getByEmail(email: string): Promise<User | null> {
    const item = mockStorage.getDb().users.find(u => u.email.toLowerCase() === email.toLowerCase())
    return item ? { ...item } : null
  }

  async getByTenant(tenantId: string): Promise<User[]> {
    return mockStorage.getDb().users.filter(u => u.tenantId === tenantId)
  }
}

export class MockCategoryRepository implements ICategoryRepository {
  async getByRestaurant(restaurantId: string): Promise<Category[]> {
    return mockStorage.getDb().categories
      .filter(c => c.restaurantId === restaurantId)
      .sort((a, b) => a.sortOrder - b.sortOrder)
  }

  async create(category: Omit<Category, 'id'>): Promise<Category> {
    assertWithinPlanLimit(category.tenantId, 'CATEGORIES', category.restaurantId)
    const newCat: Category = {
      ...category,
      id: `cat-${Date.now()}`
    }
    mockStorage.getDb().categories.push(newCat)
    mockStorage.commit()
    return newCat
  }

  async update(id: string, updates: Partial<Category>): Promise<Category> {
    const db = mockStorage.getDb()
    const index = db.categories.findIndex(c => c.id === id)
    if (index === -1) throw new Error(`Categoria ${id} não encontrada`)
    db.categories[index] = { ...db.categories[index], ...updates }
    mockStorage.commit()
    return { ...db.categories[index] }
  }

  async delete(id: string): Promise<boolean> {
    const db = mockStorage.getDb()
    const index = db.categories.findIndex(c => c.id === id)
    if (index === -1) return false
    db.categories.splice(index, 1)
    mockStorage.commit()
    return true
  }
}

export class MockProductRepository implements IProductRepository {
  async getByRestaurant(restaurantId: string): Promise<Product[]> {
    return mockStorage.getDb().products
      .filter(p => p.restaurantId === restaurantId)
      .sort((a, b) => a.sortOrder - b.sortOrder)
  }

  async getById(id: string): Promise<Product | null> {
    const item = mockStorage.getDb().products.find(p => p.id === id)
    return item ? { ...item } : null
  }

  async create(product: Omit<Product, 'id'>): Promise<Product> {
    assertWithinPlanLimit(product.tenantId, 'PRODUCTS', product.restaurantId)
    const newProd: Product = {
      ...product,
      id: `prod-${Date.now()}`
    }
    mockStorage.getDb().products.push(newProd)
    mockStorage.commit()
    return newProd
  }

  async update(id: string, updates: Partial<Product>): Promise<Product> {
    const db = mockStorage.getDb()
    const index = db.products.findIndex(p => p.id === id)
    if (index === -1) throw new Error(`Produto ${id} não encontrado`)
    db.products[index] = { ...db.products[index], ...updates }
    mockStorage.commit()
    return { ...db.products[index] }
  }

  async delete(id: string): Promise<boolean> {
    const db = mockStorage.getDb()
    const index = db.products.findIndex(p => p.id === id)
    if (index === -1) return false
    db.products.splice(index, 1)
    mockStorage.commit()
    return true
  }
}

export class MockOrderRepository implements IOrderRepository {
  async getByRestaurant(restaurantId: string): Promise<Order[]> {
    return mockStorage.getDb().orders
      .filter(o => o.restaurantId === restaurantId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }

  async getById(id: string): Promise<Order | null> {
    const item = mockStorage.getDb().orders.find(o => o.id === id)
    return item ? { ...item } : null
  }

  async create(orderData: Omit<Order, 'id' | 'orderCode' | 'createdAt' | 'updatedAt' | 'history'>): Promise<Order> {
    const orderNumber = Math.floor(100 + Math.random() * 900)
    const now = new Date().toISOString()
    const newOrder: Order = {
      ...orderData,
      id: `ord-${Date.now()}`,
      orderCode: `#ORD-${orderNumber}`,
      createdAt: now,
      updatedAt: now,
      history: [
        {
          status: orderData.status,
          timestamp: now,
          updatedBy: orderData.customerName || 'Cliente'
        }
      ]
    }
    mockStorage.getDb().orders.unshift(newOrder)
    // O estado da mesa não depende de pedidos — só da sessão.
    mockStorage.commit()
    return newOrder
  }

  async updateStatus(id: string, status: OrderStatus, updatedBy: string, note?: string): Promise<Order> {
    const db = mockStorage.getDb()
    const order = db.orders.find(o => o.id === id)
    if (!order) throw new Error(`Pedido ${id} não encontrado`)

    const now = new Date().toISOString()
    order.status = status
    order.updatedAt = now
    order.history.push({
      status,
      timestamp: now,
      updatedBy,
      note
    })

    // Cancelamentos alteram o total da sessão
    const session = db.tableSessions.find(s => s.id === order.tableSessionId || s.orderIds.includes(order.id))
    if (session) recalculateSessionTotal(session)

    mockStorage.commit()
    return { ...order }
  }

  async updatePaymentStatus(id: string, paymentStatus: PaymentStatus): Promise<Order> {
    const db = mockStorage.getDb()
    const order = db.orders.find(o => o.id === id)
    if (!order) throw new Error(`Pedido ${id} não encontrado`)

    order.paymentStatus = paymentStatus
    order.updatedAt = new Date().toISOString()

    mockStorage.commit()
    return { ...order }
  }
}

export class MockPaymentRepository implements IPaymentRepository {
  async getByRestaurant(restaurantId: string): Promise<Payment[]> {
    return mockStorage.getDb().payments
      .filter(p => p.restaurantId === restaurantId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }

  async getById(id: string): Promise<Payment | null> {
    const item = mockStorage.getDb().payments.find(p => p.id === id)
    return item ? { ...item } : null
  }

  async create(payment: Omit<Payment, 'id' | 'createdAt'>): Promise<Payment> {
    const newPayment: Payment = {
      ...payment,
      id: `pay-${Date.now()}`,
      createdAt: new Date().toISOString()
    }
    mockStorage.getDb().payments.unshift(newPayment)
    mockStorage.commit()
    return newPayment
  }

  async updateStatus(id: string, status: PaymentStatus): Promise<Payment> {
    const db = mockStorage.getDb()
    const payment = db.payments.find(p => p.id === id)
    if (!payment) throw new Error(`Pagamento ${id} não encontrado`)
    payment.status = status
    mockStorage.commit()
    return { ...payment }
  }
}

export class MockServiceRequestRepository implements IServiceRequestRepository {
  async getByRestaurant(restaurantId: string): Promise<ServiceRequest[]> {
    return mockStorage.getDb().serviceRequests
      .filter(s => s.restaurantId === restaurantId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }

  async create(req: Omit<ServiceRequest, 'id' | 'createdAt'>): Promise<ServiceRequest> {
    const newReq: ServiceRequest = {
      ...req,
      id: `req-${Date.now()}`,
      createdAt: new Date().toISOString()
    }
    mockStorage.getDb().serviceRequests.unshift(newReq)
    mockStorage.commit()
    return newReq
  }

  async updateStatus(id: string, status: ServiceRequestStatus, assignedToUserId?: string, assignedToName?: string): Promise<ServiceRequest> {
    const db = mockStorage.getDb()
    const req = db.serviceRequests.find(s => s.id === id)
    if (!req) throw new Error(`Solicitação ${id} não encontrada`)

    req.status = status
    if (assignedToUserId) req.assignedToUserId = assignedToUserId
    if (assignedToName) req.assignedToName = assignedToName
    if (status === 'completed' || status === 'cancelled') {
      req.resolvedAt = new Date().toISOString()
    }

    mockStorage.commit()
    return { ...req }
  }
}

export class MockStaffRepository implements IStaffRepository {
  async getByTenant(tenantId: string): Promise<StaffMember[]> {
    return mockStorage.getDb().staff.filter(s => s.tenantId === tenantId)
  }

  async getByRestaurant(restaurantId: string): Promise<StaffMember[]> {
    return mockStorage.getDb().staff.filter(s => s.assignedRestaurantIds.includes(restaurantId))
  }

  async create(staff: Omit<StaffMember, 'id'>): Promise<StaffMember> {
    if (staff.isActive) assertWithinPlanLimit(staff.tenantId, 'STAFF')
    const newStaff: StaffMember = {
      ...staff,
      id: `staff-${Date.now()}`
    }
    mockStorage.getDb().staff.push(newStaff)
    mockStorage.commit()
    return newStaff
  }

  async update(id: string, updates: Partial<StaffMember>): Promise<StaffMember> {
    const db = mockStorage.getDb()
    const index = db.staff.findIndex(s => s.id === id)
    if (index === -1) throw new Error(`Funcionário ${id} não encontrado`)
    // Reativar um utilizador conta para o limite do plano
    if (updates.isActive === true && !db.staff[index].isActive) assertWithinPlanLimit(db.staff[index].tenantId, 'STAFF')
    db.staff[index] = { ...db.staff[index], ...updates }
    mockStorage.commit()
    return { ...db.staff[index] }
  }

  async delete(id: string): Promise<boolean> {
    const db = mockStorage.getDb()
    const index = db.staff.findIndex(s => s.id === id)
    if (index === -1) return false
    db.staff.splice(index, 1)
    mockStorage.commit()
    return true
  }
}

export class MockPlanRepository implements IPlanRepository {
  async getAll(): Promise<Plan[]> {
    return [...mockStorage.getDb().plans].sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0))
  }

  async getById(id: string): Promise<Plan | null> {
    const item = mockStorage.getDb().plans.find(p => p.id === id)
    return item ? { ...item } : null
  }

  async getBySlug(slug: string): Promise<Plan | null> {
    const item = mockStorage.getDb().plans.find(p => p.slug === slug)
    return item ? { ...item } : null
  }

  async create(plan: Omit<Plan, 'id'>): Promise<Plan> {
    const newPlan: Plan = {
      ...plan,
      ...normalizePlanEntitlements(plan),
      id: `plan-${Date.now()}`
    }
    mockStorage.getDb().plans.push(newPlan)
    mockStorage.commit()
    return newPlan
  }

  async update(id: string, updates: Partial<Plan>): Promise<Plan> {
    const db = mockStorage.getDb()
    const index = db.plans.findIndex(p => p.id === id)
    if (index === -1) throw new Error(`Plano ${id} não encontrado`)
    const merged = { ...db.plans[index], ...updates }
    db.plans[index] = { ...merged, ...normalizePlanEntitlements(merged) }
    mockStorage.commit()
    return { ...db.plans[index] }
  }

  async delete(id: string): Promise<boolean> {
    const db = mockStorage.getDb()
    const index = db.plans.findIndex(p => p.id === id)
    if (index === -1) return false
    const inUse = db.subscriptions.filter(sub => sub.planId === id).length + db.companies.filter(c => c.planId === id && !db.subscriptions.some(sub => sub.tenantId === c.id)).length
    if (inUse > 0) {
      throw new DomainError('plan_in_use', `O plano ${db.plans[index].name} está atribuído a ${inUse} ${inUse === 1 ? 'empresa' : 'empresas'}. Mude essas empresas para outro plano ou desative-o em vez de o eliminar.`)
    }
    db.plans.splice(index, 1)
    mockStorage.commit()
    return true
  }
}

export class MockSubscriptionRepository implements ISubscriptionRepository {
  async getAllPlans(): Promise<Plan[]> {
    return [...mockStorage.getDb().plans]
  }

  async getAllSubscriptions(): Promise<Subscription[]> {
    return [...mockStorage.getDb().subscriptions]
  }

  async getByTenant(tenantId: string): Promise<Subscription | null> {
    const item = mockStorage.getDb().subscriptions.find(s => s.tenantId === tenantId)
    return item ? { ...item } : null
  }

  async getById(id: string): Promise<Subscription | null> {
    const item = mockStorage.getDb().subscriptions.find(s => s.id === id)
    return item ? { ...item } : null
  }

  async create(sub: Omit<Subscription, 'id'>): Promise<Subscription> {
    const newSub: Subscription = {
      ...sub,
      id: `sub-${Date.now()}`
    }
    mockStorage.getDb().subscriptions.push(newSub)
    mockStorage.commit()
    return newSub
  }

  async updateSubscription(id: string, updates: Partial<Subscription>): Promise<Subscription> {
    const db = mockStorage.getDb()
    const index = db.subscriptions.findIndex(s => s.id === id)
    if (index === -1) throw new Error(`Subscrição ${id} não encontrada`)
    db.subscriptions[index] = { ...db.subscriptions[index], ...updates }
    mockStorage.commit()
    return { ...db.subscriptions[index] }
  }

  async addHistoryEvent(id: string, event: Omit<SubscriptionHistory, 'id' | 'date'>): Promise<Subscription> {
    const db = mockStorage.getDb()
    const index = db.subscriptions.findIndex(s => s.id === id)
    if (index === -1) throw new Error(`Subscrição ${id} não encontrada`)
    const sub = db.subscriptions[index]
    if (!sub.history) sub.history = []
    const newEvent: SubscriptionHistory = {
      ...event,
      id: `subh-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      date: new Date().toISOString()
    }
    sub.history.unshift(newEvent)
    mockStorage.commit()
    return { ...sub }
  }
}

export class MockMenuCustomizationRepository implements IMenuCustomizationRepository {
  async getByRestaurant(restaurantId: string): Promise<MenuCustomization | null> {
    const item = mockStorage.getDb().menuCustomizations?.find(mc => mc.restaurantId === restaurantId)
    return item ? JSON.parse(JSON.stringify(item)) : null
  }

  async save(customization: Omit<MenuCustomization, 'id' | 'updatedAt'> & { id?: string }): Promise<MenuCustomization> {
    const db = mockStorage.getDb()
    if (!db.menuCustomizations) db.menuCustomizations = []
    const index = db.menuCustomizations.findIndex(mc => mc.restaurantId === customization.restaurantId)
    const now = new Date().toISOString()

    if (index >= 0) {
      db.menuCustomizations[index] = {
        ...db.menuCustomizations[index],
        ...customization,
        updatedAt: now
      }
      mockStorage.commit()
      return JSON.parse(JSON.stringify(db.menuCustomizations[index]))
    } else {
      const newMC: MenuCustomization = {
        id: customization.id || `mc-${customization.restaurantId}-${Date.now()}`,
        tenantId: customization.tenantId,
        restaurantId: customization.restaurantId,
        theme: customization.theme,
        updatedAt: now,
        updatedBy: customization.updatedBy || 'Administrador'
      }
      db.menuCustomizations.push(newMC)
      mockStorage.commit()
      return JSON.parse(JSON.stringify(newMC))
    }
  }

  async delete(restaurantId: string): Promise<boolean> {
    const db = mockStorage.getDb()
    if (!db.menuCustomizations) return false
    const index = db.menuCustomizations.findIndex(mc => mc.restaurantId === restaurantId)
    if (index === -1) return false
    db.menuCustomizations.splice(index, 1)
    mockStorage.commit()
    return true
  }
}

export class MockAuditLogRepository implements IAuditLogRepository {
  async getAll(filter?: { tenantId?: string; limit?: number }): Promise<PlatformAuditLog[]> {
    let logs = [...(mockStorage.getDb().auditLogs || [])]
    if (filter?.tenantId) {
      logs = logs.filter(l => l.tenantId === filter.tenantId)
    }
    logs.sort(
      (a, b) =>
        new Date(b.createdAt ?? b.timestamp ?? 0).getTime() -
        new Date(a.createdAt ?? a.timestamp ?? 0).getTime()
    )
    if (filter?.limit) {
      logs = logs.slice(0, filter.limit)
    }
    return logs
  }

  async create(log: Omit<PlatformAuditLog, 'id' | 'createdAt'>): Promise<PlatformAuditLog> {
    return mockStorage.addAuditLog(log)
  }
}

export class MockPlatformConfigRepository implements IPlatformConfigRepository {
  async get(): Promise<PlatformConfig> {
    return { ...mockStorage.getDb().platformConfig }
  }

  async update(updates: Partial<PlatformConfig>): Promise<PlatformConfig> {
    const db = mockStorage.getDb()
    db.platformConfig = { ...db.platformConfig, ...updates }
    mockStorage.commit()
    return { ...db.platformConfig }
  }
}

export class MockNotificationRepository implements INotificationRepository {
  async getByRestaurant(restaurantId: string): Promise<Notification[]> {
    return mockStorage.getDb().notifications.filter(n => n.restaurantId === restaurantId)
  }

  async create(notification: Omit<Notification, 'id' | 'createdAt'>): Promise<Notification> {
    const newNotif: Notification = {
      ...notification,
      id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      createdAt: new Date().toISOString()
    }
    mockStorage.getDb().notifications.unshift(newNotif)
    mockStorage.commit()
    return newNotif
  }

  async markAsRead(id: string): Promise<Notification> {
    const db = mockStorage.getDb()
    const index = db.notifications.findIndex(n => n.id === id)
    if (index === -1) throw new Error(`Notificação ${id} não encontrada`)
    db.notifications[index].readAt = new Date().toISOString()
    mockStorage.commit()
    return { ...db.notifications[index] }
  }

  async markAllAsRead(restaurantId: string): Promise<void> {
    const db = mockStorage.getDb()
    const now = new Date().toISOString()
    db.notifications.forEach(n => {
      if (n.restaurantId === restaurantId && !n.readAt) {
        n.readAt = now
      }
    })
    mockStorage.commit()
  }
}

