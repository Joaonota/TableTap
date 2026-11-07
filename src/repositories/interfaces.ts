import type {
  Company,
  Restaurant,
  User,
  Table,
  TableSession,
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
  DigitalAccess,
  OrderStatus,
  PaymentStatus,
  ServiceRequestStatus,
  MenuCustomization,
  PlatformAuditLog,
  PlatformConfig
} from '@/types'

export interface ICompanyRepository {
  getAll(): Promise<Company[]>
  getById(id: string): Promise<Company | null>
  create(company: Omit<Company, 'id' | 'createdAt'>): Promise<Company>
  update(id: string, updates: Partial<Company>): Promise<Company>
}

export interface IRestaurantRepository {
  getByTenant(tenantId: string): Promise<Restaurant[]>
  getById(id: string): Promise<Restaurant | null>
  getBySlug(slug: string): Promise<Restaurant | null>
  getAll(): Promise<Restaurant[]> // For super admin
  create(restaurant: Omit<Restaurant, 'id' | 'createdAt'>): Promise<Restaurant>
  update(id: string, updates: Partial<Restaurant>): Promise<Restaurant>
}

export interface IUserRepository {
  getAll(): Promise<User[]>
  getById(id: string): Promise<User | null>
  getByEmail(email: string): Promise<User | null>
  getByTenant(tenantId: string): Promise<User[]>
}

export interface ITableRepository {
  getByRestaurant(restaurantId: string): Promise<Table[]>
  getById(id: string): Promise<Table | null>
  getByNumber(restaurantId: string, number: string): Promise<Table | null>
  create(table: Omit<Table, 'id'>): Promise<Table>
  update(id: string, updates: Partial<Table>): Promise<Table>
  delete(id: string): Promise<boolean>
}

export interface ICategoryRepository {
  getByRestaurant(restaurantId: string): Promise<Category[]>
  create(category: Omit<Category, 'id'>): Promise<Category>
  update(id: string, updates: Partial<Category>): Promise<Category>
  delete(id: string): Promise<boolean>
}

export interface IProductRepository {
  getByRestaurant(restaurantId: string): Promise<Product[]>
  getById(id: string): Promise<Product | null>
  create(product: Omit<Product, 'id'>): Promise<Product>
  update(id: string, updates: Partial<Product>): Promise<Product>
  delete(id: string): Promise<boolean>
}

export interface IOrderRepository {
  getByRestaurant(restaurantId: string): Promise<Order[]>
  getById(id: string): Promise<Order | null>
  create(order: Omit<Order, 'id' | 'orderCode' | 'createdAt' | 'updatedAt' | 'history'>): Promise<Order>
  updateStatus(id: string, status: OrderStatus, updatedBy: string, note?: string): Promise<Order>
  updatePaymentStatus(id: string, paymentStatus: PaymentStatus): Promise<Order>
}

export interface IDigitalAccessRepository {
  getByRestaurant(restaurantId: string): Promise<DigitalAccess[]>
  getById(id: string): Promise<DigitalAccess | null>
  create(access: Omit<DigitalAccess, 'id' | 'createdAt' | 'updatedAt'>): Promise<DigitalAccess>
  update(id: string, updates: Partial<DigitalAccess>): Promise<DigitalAccess>
  recordScan(id: string): Promise<void>
}

export interface IPaymentRepository {
  getByRestaurant(restaurantId: string): Promise<Payment[]>
  getById(id: string): Promise<Payment | null>
  create(payment: Omit<Payment, 'id' | 'createdAt'>): Promise<Payment>
  updateStatus(id: string, status: PaymentStatus): Promise<Payment>
}

export interface IServiceRequestRepository {
  getByRestaurant(restaurantId: string): Promise<ServiceRequest[]>
  create(req: Omit<ServiceRequest, 'id' | 'createdAt'>): Promise<ServiceRequest>
  updateStatus(id: string, status: ServiceRequestStatus, assignedToUserId?: string, assignedToName?: string): Promise<ServiceRequest>
}

export interface IStaffRepository {
  getByTenant(tenantId: string): Promise<StaffMember[]>
  getByRestaurant(restaurantId: string): Promise<StaffMember[]>
  create(staff: Omit<StaffMember, 'id'>): Promise<StaffMember>
  update(id: string, updates: Partial<StaffMember>): Promise<StaffMember>
  delete(id: string): Promise<boolean>
}

export interface IPlanRepository {
  getAll(): Promise<Plan[]>
  getById(id: string): Promise<Plan | null>
  getBySlug(slug: string): Promise<Plan | null>
  create(plan: Omit<Plan, 'id'>): Promise<Plan>
  update(id: string, updates: Partial<Plan>): Promise<Plan>
  delete(id: string): Promise<boolean>
}

export interface ISubscriptionRepository {
  getAllPlans(): Promise<Plan[]>
  getAllSubscriptions(): Promise<Subscription[]>
  getByTenant(tenantId: string): Promise<Subscription | null>
  getById(id: string): Promise<Subscription | null>
  create(sub: Omit<Subscription, 'id'>): Promise<Subscription>
  updateSubscription(id: string, updates: Partial<Subscription>): Promise<Subscription>
  addHistoryEvent(id: string, event: Omit<SubscriptionHistory, 'id' | 'date'>): Promise<Subscription>
}

export interface IMenuCustomizationRepository {
  getByRestaurant(restaurantId: string): Promise<MenuCustomization | null>
  save(customization: Omit<MenuCustomization, 'id' | 'updatedAt'> & { id?: string }): Promise<MenuCustomization>
  delete(restaurantId: string): Promise<boolean>
}

export interface IAuditLogRepository {
  getAll(filter?: { tenantId?: string; limit?: number }): Promise<PlatformAuditLog[]>
  create(log: Omit<PlatformAuditLog, 'id' | 'createdAt'>): Promise<PlatformAuditLog>
}

export interface IPlatformConfigRepository {
  get(): Promise<PlatformConfig>
  update(updates: Partial<PlatformConfig>): Promise<PlatformConfig>
}

export interface ITableSessionRepository {
  getByRestaurant(restaurantId: string): Promise<TableSession[]>
  getActiveByTable(tableId: string): Promise<TableSession | null>
  getById(id: string): Promise<TableSession | null>
  create(session: Omit<TableSession, 'id' | 'startedAt' | 'orderIds'>): Promise<TableSession>
  update(id: string, updates: Partial<TableSession>): Promise<TableSession>
  addOrder(sessionId: string, orderId: string): Promise<TableSession>
  closeSession(sessionId: string): Promise<TableSession>
}

export interface INotificationRepository {
  getByRestaurant(restaurantId: string): Promise<Notification[]>
  create(notification: Omit<Notification, 'id' | 'createdAt'>): Promise<Notification>
  markAsRead(id: string): Promise<Notification>
  markAllAsRead(restaurantId: string): Promise<void>
}

