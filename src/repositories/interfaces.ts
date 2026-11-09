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
  NfcTag,
  NfcTagEvent,
  SessionParticipant,
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

/** Dados editáveis de uma mesa. O slug (URL) é gerado na criação e é imutável. */
export interface TableInput {
  number: string
  name?: string
  area: Table['area']
  capacity: number
}

export interface ITableRepository {
  getByRestaurant(restaurantId: string): Promise<Table[]>
  getById(id: string): Promise<Table | null>
  /** Resolve a mesa pela URL pública (slug permanente). */
  getBySlug(restaurantId: string, slug: string): Promise<Table | null>
  getByNumber(restaurantId: string, number: string): Promise<Table | null>
  create(restaurantId: string, input: TableInput): Promise<Table>
  update(id: string, input: Partial<TableInput>): Promise<Table>
  /** Livre ⇄ Indisponível. 'occupied' só acontece através de uma sessão. */
  setStatus(id: string, status: 'free' | 'unavailable'): Promise<Table>
  setActive(id: string, isActive: boolean): Promise<Table>
  /** Remove a mesa; recusa se tiver sessão ativa e desassocia etiquetas. */
  delete(id: string, actor: string): Promise<boolean>
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

export interface StartSessionInput {
  tableId: string
  primaryCustomerName?: string
  partySize?: number
  notes?: string
}

export interface ITableSessionRepository {
  getByRestaurant(restaurantId: string): Promise<TableSession[]>
  /** Histórico completo da mesa (mais recentes primeiro). */
  getByTable(tableId: string): Promise<TableSession[]>
  getActiveByTable(tableId: string): Promise<TableSession | null>
  getById(id: string): Promise<TableSession | null>
  /** Inicia sessão e coloca a mesa como Ocupada. Recusa se a mesa não estiver livre. */
  start(input: StartSessionInput): Promise<{ session: TableSession; participant: SessionParticipant | null }>
  /** Outro cliente/dispositivo junta-se à sessão ativa da mesa. */
  join(sessionId: string, name: string): Promise<{ session: TableSession; participant: SessionParticipant }>
  addOrder(sessionId: string, orderId: string): Promise<TableSession>
  requestBill(sessionId: string): Promise<TableSession>
  /** Encerra a sessão e liberta a mesa (Ocupada → Livre). */
  close(sessionId: string, actor: string): Promise<TableSession>
  /** Cancela a sessão e liberta a mesa. */
  cancel(sessionId: string, actor: string, reason?: string): Promise<TableSession>
}

export interface RegisterNfcTagsInput {
  restaurantId: string
  /** Códigos físicos já impressos; se vazio, gera `quantity` códigos sequenciais. */
  codes?: string[]
  quantity?: number
  notes?: string
}

/**
 * Registo administrativo de etiquetas NFC. Nenhuma operação grava hardware:
 * `markConfigured` regista que a equipa TapMenu gravou a URL com uma
 * aplicação externa.
 */
export interface INfcTagRepository {
  getAll(): Promise<NfcTag[]>
  getByRestaurant(restaurantId: string): Promise<NfcTag[]>
  getById(id: string): Promise<NfcTag | null>
  getByTable(tableId: string): Promise<NfcTag | null>
  getHistory(tagId: string): Promise<NfcTagEvent[]>
  register(input: RegisterNfcTagsInput, actor: string): Promise<NfcTag[]>
  /** Associa/altera/reatribui a mesa. Estado resultante segue as regras de domínio. */
  assign(tagId: string, tableId: string, actor: string): Promise<NfcTag>
  unassign(tagId: string, actor: string): Promise<NfcTag>
  markConfigured(tagId: string, actor: string, notes?: string): Promise<NfcTag>
  activate(tagId: string, actor: string): Promise<NfcTag>
  disable(tagId: string, actor: string, reason?: string): Promise<NfcTag>
  reactivate(tagId: string, actor: string): Promise<NfcTag>
}

export interface INotificationRepository {
  getByRestaurant(restaurantId: string): Promise<Notification[]>
  create(notification: Omit<Notification, 'id' | 'createdAt'>): Promise<Notification>
  markAsRead(id: string): Promise<Notification>
  markAllAsRead(restaurantId: string): Promise<void>
}

