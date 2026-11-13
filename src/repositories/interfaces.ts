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
  PlatformConfig,
  LimitKey,
  PaymentMethod
} from '@/types'

/** Empresa registada pelo Super Admin (o dono é convidado por email). */
export interface CreateCompanyInput {
  name: string
  legalName?: string
  taxId?: string
  phone?: string
  email?: string
  planId: string
  ownerName?: string
  ownerEmail?: string
}

export interface ICompanyRepository {
  getAll(): Promise<Company[]>
  getById(id: string): Promise<Company | null>
  create(input: CreateCompanyInput): Promise<Company>
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
  /** Todas as contas (Super Admin). */
  getAll(): Promise<User[]>
  getById(id: string): Promise<User | null>
  getByTenant(tenantId: string): Promise<User[]>
}

/** Conta autenticada: perfil + ligação à empresa (se existir). */
export interface AuthAccount {
  user: User | null
  /** Conta válida mas ainda sem empresa (precisa de concluir o registo). */
  needsOnboarding: boolean
  email: string
  fullName: string
}

export interface RegisterCompanyInput {
  companyName: string
  restaurantName: string
  legalName?: string
  taxId?: string
  phone?: string
  city?: string
}

export interface IAuthRepository {
  getAccount(): Promise<AuthAccount | null>
  signIn(email: string, password: string): Promise<void>
  /** Devolve `needsEmailConfirmation` quando o Supabase exige confirmar o email. */
  signUp(email: string, password: string, fullName: string, redirectTo: string): Promise<{ needsEmailConfirmation: boolean }>
  signOut(): Promise<void>
  sendPasswordReset(email: string, redirectTo: string): Promise<void>
  updatePassword(password: string): Promise<void>
  /** Liga convites de equipa pendentes ao utilizador (email confirmado). */
  claimInvitations(): Promise<number>
  registerCompany(input: RegisterCompanyInput): Promise<string>
  onAuthChange(callback: (event: string) => void): () => void
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

/**
 * Pedidos geridos pela equipa. A criação acontece no servidor
 * (IPublicMenuRepository.placeOrder), que calcula preços e totais.
 */
export interface IOrderRepository {
  getByRestaurant(restaurantId: string): Promise<Order[]>
  /** Todos os pedidos visíveis ao utilizador (Super Admin: plataforma). */
  getAll(limit?: number): Promise<Order[]>
  getById(id: string): Promise<Order | null>
  updateStatus(id: string, status: OrderStatus, note?: string): Promise<Order>
  updatePaymentStatus(id: string, paymentStatus: PaymentStatus): Promise<Order>
}

export interface IPaymentRepository {
  getByRestaurant(restaurantId: string): Promise<Payment[]>
  /** Todos os pagamentos visíveis ao utilizador (Super Admin: plataforma). */
  getAll(limit?: number): Promise<Payment[]>
  getById(id: string): Promise<Payment | null>
  create(payment: Omit<Payment, 'id' | 'createdAt'>): Promise<Payment>
  updateStatus(id: string, status: PaymentStatus): Promise<Payment>
}

export interface IServiceRequestRepository {
  getByRestaurant(restaurantId: string): Promise<ServiceRequest[]>
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

export interface PlanChangeRequest {
  id: string
  tenantId: string
  requestedPlanId: string
  requestedByName: string
  note?: string
  status: 'pending' | 'approved' | 'rejected'
  createdAt: string
  resolvedAt?: string
}

/**
 * Subscrições. O histórico (mudança de plano, estado, renovação) é gerado
 * automaticamente pela base de dados.
 */
export interface ISubscriptionRepository {
  getAllPlans(): Promise<Plan[]>
  getAllSubscriptions(): Promise<Subscription[]>
  getByTenant(tenantId: string): Promise<Subscription | null>
  getById(id: string): Promise<Subscription | null>
  /** Super Admin: altera plano, estado, renovação. */
  updateSubscription(
    id: string,
    updates: Partial<Pick<Subscription, 'planId' | 'status' | 'renewalDate' | 'isAutoRenew' | 'startDate'>>
  ): Promise<Subscription>
  addHistoryEvent(id: string, event: Omit<SubscriptionHistory, 'id' | 'date'>): Promise<Subscription>
  /** Dono da empresa pede uma alteração de plano (aplicada pela equipa TapMenu). */
  requestPlanChange(planId: string, note?: string): Promise<PlanChangeRequest>
  getPlanChangeRequests(tenantId?: string): Promise<PlanChangeRequest[]>
  resolvePlanChangeRequest(id: string, status: 'approved' | 'rejected'): Promise<void>
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

/**
 * Direitos do plano de cada empresa. A base de dados devolve o plano efetivo e o
 * consumo, e recusa (trigger) criações acima do limite.
 */
export interface IPlanAccessRepository {
  /** Plano efetivo da empresa (subscrição → empresa → plano por defeito). */
  getTenantPlan(tenantId: string): Promise<Plan | null>
  /** Consumo atual de um recurso no âmbito do limite (empresa ou restaurante). */
  countUsage(tenantId: string, key: LimitKey, restaurantId?: string): Promise<number>
}

/** Notificações criadas pelo servidor (pedidos, mesas, chamadas). */
export interface INotificationRepository {
  getByRestaurant(restaurantId: string): Promise<Notification[]>
  markAsRead(id: string): Promise<Notification>
  markAllAsRead(restaurantId: string): Promise<void>
}


// =====================================================================
// MENU PÚBLICO (cliente sem conta, através da URL da mesa)
// =====================================================================

export interface PublicTableContext {
  restaurant: Restaurant
  table: Table
  activeSession: TableSession | null
}

export interface PublicMenuContent {
  categories: Category[]
  products: Product[]
  customization: MenuCustomization['theme'] | null
}

export interface PlaceOrderItemInput {
  productId: string
  quantity: number
  variantId?: string
  addonIds?: string[]
  removedIngredients?: string[]
  notes?: string
}

export interface PlaceOrderInput {
  sessionId: string
  /** Token secreto do participante (guardado no dispositivo). */
  participantToken?: string
  items: PlaceOrderItemInput[]
  customerName?: string
  customerPhone?: string
  notes?: string
  paymentMethod?: PaymentMethod
}

export interface CreateServiceRequestInput {
  tableId: string
  type: ServiceRequest['type']
  sessionId?: string
  participantToken?: string
  customerName?: string
  notes?: string
}

export interface PublicOrderView {
  order: Order
  restaurant: { id: string; name: string; slug: string; logoUrl: string; phone: string }
}

export interface IPublicMenuRepository {
  /** Resolve /m/{restaurante}/{mesa} (ou o número da mesa, em URLs antigas). */
  resolveTable(restaurantSlug: string, tableKey: string): Promise<PublicTableContext | null>
  getMenu(restaurantId: string): Promise<PublicMenuContent>
  placeOrder(input: PlaceOrderInput): Promise<Order>
  getSessionOrders(sessionId: string, participantToken?: string): Promise<Order[]>
  requestBill(sessionId: string, participantToken?: string, paymentMethod?: PaymentMethod, notes?: string): Promise<TableSession>
  createServiceRequest(input: CreateServiceRequestInput): Promise<{ request: ServiceRequest; alreadyExisted: boolean }>
  getOrder(orderId: string): Promise<PublicOrderView | null>
}

// =====================================================================
// IMAGENS (Supabase Storage)
// =====================================================================

export type MediaKind = 'logo' | 'cover' | 'product' | 'category'

export interface IMediaRepository {
  /**
   * Envia uma imagem e devolve a URL pública.
   * Sem `restaurantId` = imagem da empresa (ex.: logótipo da empresa).
   */
  uploadImage(file: File, scope: { tenantId: string; restaurantId?: string; kind: MediaKind }): Promise<string>
  /** Remove uma imagem do Storage a partir da URL pública (ignora URLs externas). */
  removeByUrl(url: string): Promise<void>
}
