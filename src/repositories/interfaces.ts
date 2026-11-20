import type {
  Company,
  CompanyDeletionPreview,
  CompanyDeletionResult,
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
  PaymentMethod,
  EstablishmentInvitation,
  PlanFeature,
  PlanLimit,
  SubscriptionStatus,
  SessionClosure,
  ReviewDashboard
} from '@/types'
import type { ReviewDeviceType, ReviewTrackEvent } from '@/domain/reviews'
import type { ItemSelection, SessionBill, SplitMode } from '@/domain/groupBill'
import type { CompanyAlert, CompanyOverview, MenuCopyReport } from '@/domain/companyInsights'

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
  /** Marca o perfil da empresa (primeiro acesso do responsável) como concluído. */
  completeOnboarding(id: string): Promise<Company>
  /** Super Admin do Sistema: suspende (bloqueia o acesso, mantém os dados) ou reativa. */
  setActive(id: string, active: boolean): Promise<Company>
  /** Super Admin do Sistema: resumo dos dados que serão eliminados. */
  getDeletionPreview(id: string): Promise<CompanyDeletionPreview>
  /** Super Admin do Sistema: elimina permanentemente a empresa e todos os dados (Edge Function). */
  deletePermanently(id: string, confirmName: string): Promise<CompanyDeletionResult>
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
  /** Conta válida mas sem estabelecimento associado (aguarda a equipa TapMenu). */
  needsOnboarding: boolean
  /** Primeiro acesso: tem de definir uma palavra-passe antes de continuar. */
  mustSetPassword: boolean
  /** Empresa com o perfil por completar (primeiro acesso do dono). */
  setupCompanyId: string | null
  /** A empresa da conta foi suspensa pelo Super Admin do Sistema. */
  companySuspended: boolean
  email: string
  fullName: string
}

export interface IAuthRepository {
  getAccount(): Promise<AuthAccount | null>
  signIn(email: string, password: string): Promise<void>
  signOut(): Promise<void>
  sendPasswordReset(email: string, redirectTo: string): Promise<void>
  updatePassword(password: string): Promise<void>
  /** Liga convites de equipa pendentes ao utilizador (email confirmado). */
  claimInvitations(): Promise<number>
  /** Valida o token do link de convite/recuperação e inicia a sessão. */
  verifyEmailToken(tokenHash: string, type: 'invite' | 'recovery' | 'magiclink' | 'email'): Promise<void>
  /** Inicia a sessão com os tokens devolvidos no fragmento (#) de um link do Supabase. */
  setSessionFromTokens(accessToken: string, refreshToken: string): Promise<void>
  /** Depois de definir a palavra-passe: liga a conta ao estabelecimento e aceita o convite. */
  completeFirstAccess(): Promise<void>
  onAuthChange(callback: (event: string) => void): () => void
}

/** Dados do pré-registo de uma empresa cliente (Super Admin). */
export interface PreRegisterCompanyInput {
  /** Nome legal da empresa. */
  companyName: string
  /** Nome comercial (por omissão, igual ao nome legal). */
  commercialName: string
  ownerName: string
  ownerEmail: string
  ownerPhone: string
  country: string
  province: string
  city: string
  planId: string
  subscriptionStatus: SubscriptionStatus
  /** Estado da conta: empresa ativa ou suspensa. */
  accountActive: boolean
  /** AAAA-MM-DD */
  startDate: string
  internalNotes: string
  /** Condições comerciais ajustadas — omitir para usar as do plano. */
  customPrice?: number | null
  customFeatures?: PlanFeature[] | null
  customLimits?: PlanLimit[] | null
}

export type InviteDelivery = 'email' | 'link'

export interface InviteResult {
  delivery: InviteDelivery
  email: string
  /** Link de convite de uso único (apenas quando delivery = 'link'). */
  link: string | null
}

export interface IEstablishmentRepository {
  getAll(): Promise<EstablishmentInvitation[]>
  /** Cria empresa, subscrição e responsável (sem estabelecimentos). Devolve o pré-registo. */
  preregister(input: PreRegisterCompanyInput): Promise<EstablishmentInvitation>
  /** Emite (ou reemite) o convite de acesso do responsável. */
  invite(invitationId: string, delivery: InviteDelivery, redirectTo: string): Promise<InviteResult>
  update(
    id: string,
    updates: Partial<Pick<EstablishmentInvitation, 'ownerName' | 'ownerPhone' | 'country' | 'province' | 'city' | 'internalNotes'>>
  ): Promise<EstablishmentInvitation>
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
  join(sessionId: string, name: string, avatar?: string): Promise<{ session: TableSession; participant: SessionParticipant }>
  /**
   * Encerra a sessão e liberta a mesa (Ocupada → Livre). Com valores por
   * pagar é recusado (session_has_pending), excepto "force" por um gerente
   * com motivo (fica registado na auditoria).
   */
  close(sessionId: string, actor: string, options?: CloseSessionOptions): Promise<TableSession>
  /** Modo Grupo: conta da sessão vista pela equipa. */
  getBill(sessionId: string): Promise<SessionBill>
  /** Retira um dispositivo da sessão (o token deixa de funcionar). */
  revokeParticipant(participantId: string, reason?: string): Promise<TableSession>
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
  /**
   * Ecrã de agradecimento: estado final da sessão. Se estiver encerrada e o
   * estabelecimento tiver link do Google, regista o pedido como apresentado.
   */
  getSessionClosure(sessionId: string, participantToken: string, deviceType?: ReviewDeviceType): Promise<SessionClosure>
  /** Regista o clique ou o encaminhamento para o Google. Nunca indica avaliação publicada. */
  trackReviewRequest(requestId: string, participantToken: string, event: ReviewTrackEvent): Promise<string>
  /** Web Push (migração 1700): liga a subscrição deste dispositivo à sessão. */
  registerPushSubscription(input: PushSubscriptionInput): Promise<void>
  /** Modo Grupo (migração 1800): conta individual e da mesa. */
  getSessionBill(sessionId: string, participantToken: string): Promise<SessionBill>
  createSessionPayment(input: CreateSessionPaymentInput): Promise<SessionBill & { paymentId: string }>
  cancelSessionPayment(paymentId: string, participantToken: string): Promise<SessionBill>
  leaveSession(sessionId: string, participantToken: string): Promise<TableSession>
  updateParticipantAvatar(sessionId: string, participantToken: string, avatar: string): Promise<void>
  unregisterPushSubscription(participantToken: string, endpoint: string): Promise<void>
}

export interface CloseSessionOptions {
  force?: boolean
  reason?: string
}

export interface CreateSessionPaymentInput {
  sessionId: string
  participantToken: string
  mode: SplitMode
  method: PaymentMethod
  items?: ItemSelection[]
  notes?: string
}

export interface PushSubscriptionInput {
  sessionId: string
  participantToken: string
  endpoint: string
  p256dh: string
  auth: string
  pageUrl?: string
}

// =====================================================================
// AVALIAÇÕES (painel do proprietário)
// =====================================================================

export interface ReviewDashboardQuery {
  companyId: string
  /** Omitido = todos os estabelecimentos que o utilizador gere. */
  restaurantId?: string
  from: Date
  /** Omitido = agora, pela hora do servidor (evita erros de relógio do dispositivo). */
  to?: Date
  recentLimit?: number
}

/** Empresa com vários estabelecimentos (migração 1900) — só o proprietário. */
export interface ICompanyInsightsRepository {
  getOverview(companyId: string, from: Date, to: Date): Promise<CompanyOverview>
  getAlerts(companyId: string, from: Date, to: Date): Promise<CompanyAlert[]>
  copyMenu(sourceRestaurantId: string, targetRestaurantIds: string[], categoryIds: string[] | null, updateExisting: boolean): Promise<MenuCopyReport[]>
  applyPromotion(companyId: string, productNames: string[], discountPercent: number, restaurantIds: string[] | null): Promise<number>
  endPromotion(companyId: string, productNames: string[], restaurantIds: string[] | null): Promise<number>
}

export interface IReviewRepository {
  getDashboard(query: ReviewDashboardQuery): Promise<ReviewDashboard>
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
