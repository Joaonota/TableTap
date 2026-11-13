/**
 * Implementações Supabase dos repositórios (ver ../interfaces.ts).
 *
 * Todas as consultas ao Supabase vivem aqui — páginas, stores e serviços
 * nunca chamam o cliente diretamente. As regras de negócio e as
 * permissões são aplicadas pela base de dados (RLS, triggers e funções em
 * supabase/migrations); estes repositórios apenas leem, escrevem e
 * convertem dados.
 */
import { supabase, MEDIA_BUCKET } from '@/lib/supabase'
import { toDomainError, unwrap, unwrapOne } from '@/lib/supabaseErrors'
import { DomainError } from '@/domain/errors'
import { normalizePlanEntitlements } from '@/domain/planLimits'
import type {
  Category,
  Company,
  EstablishmentInvitation,
  LimitKey,
  MenuCustomization,
  Notification,
  NfcTag,
  NfcTagEvent,
  Order,
  OrderStatus,
  Payment,
  PaymentMethod,
  PaymentStatus,
  Plan,
  PlatformAuditLog,
  PlatformConfig,
  Product,
  Restaurant,
  ServiceRequest,
  ServiceRequestStatus,
  SessionParticipant,
  StaffMember,
  Subscription,
  SubscriptionHistory,
  Table,
  TableSession,
  User
} from '@/types'
import type {
  AuthAccount,
  CreateCompanyInput,
  CreateServiceRequestInput,
  IAuditLogRepository,
  IAuthRepository,
  IEstablishmentRepository,
  InviteDelivery,
  InviteResult,
  PreRegisterEstablishmentInput,
  ICategoryRepository,
  ICompanyRepository,
  IMediaRepository,
  IMenuCustomizationRepository,
  INfcTagRepository,
  INotificationRepository,
  IOrderRepository,
  IPaymentRepository,
  IPlanAccessRepository,
  IPlanRepository,
  IPlatformConfigRepository,
  IProductRepository,
  IPublicMenuRepository,
  IRestaurantRepository,
  IServiceRequestRepository,
  IStaffRepository,
  ISubscriptionRepository,
  ITableRepository,
  ITableSessionRepository,
  IUserRepository,
  MediaKind,
  PlaceOrderInput,
  PlanChangeRequest,
  PublicMenuContent,
  PublicOrderView,
  PublicTableContext,
  RegisterNfcTagsInput,
  StartSessionInput,
  TableInput
} from '../interfaces'
import {
  COMPANY_SELECT,
  INVITATION_SELECT,
  ORDER_SELECT,
  PAYMENT_SELECT,
  PRODUCT_SELECT,
  SESSION_SELECT,
  SUBSCRIPTION_SELECT,
  categoryToRow,
  companyToRow,
  mapAuditLog,
  mapCategory,
  mapCompany,
  mapCustomization,
  mapInvitation,
  mapNfcTag,
  mapNfcTagEvent,
  mapNotification,
  mapOrder,
  mapPayment,
  mapPlan,
  mapPlanChangeRequest,
  mapPlatformConfig,
  mapProduct,
  mapRestaurant,
  mapServiceRequest,
  mapSession,
  mapStaff,
  mapSubscription,
  mapTable,
  mapUser,
  normalizeOrderJson,
  normalizeProductJson,
  normalizeSessionJson,
  planToRow,
  platformConfigToRow,
  productToRow,
  restaurantToRow,
  staffToRow
} from './mappers'

/* eslint-disable @typescript-eslint/no-explicit-any */
type Json = Record<string, any>

async function rpc<T = any>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) throw toDomainError(error)
  return data as T
}

/** Remove `undefined` (o PostgREST trata-os como null). */
const clean = (o: Json): Json => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined))

// =====================================================================
// Autenticação
// =====================================================================
export class SupabaseAuthRepository implements IAuthRepository {
  async getAccount(): Promise<AuthAccount | null> {
    const { data: auth } = await supabase.auth.getUser()
    if (!auth.user) return null
    const profile = unwrap(await supabase.from('profiles').select('*').eq('id', auth.user.id).maybeSingle())
    if (!profile) return null
    const membership = unwrap(await supabase.from('staff_members').select('*').eq('user_id', auth.user.id).maybeSingle())
    const user = profile.is_super_admin || (membership && membership.is_active) ? mapUser(profile, membership) : null

    // Dono de um estabelecimento pré-registado que ainda não concluiu a configuração inicial.
    let setupRestaurantId: string | null = null
    if (!profile.is_super_admin && membership?.is_active && membership.role === 'company_owner') {
      const pending = unwrap(
        await supabase
          .from('restaurants')
          .select('id')
          .eq('company_id', membership.company_id)
          .is('onboarding_completed_at', null)
          .order('created_at')
          .limit(1)
      ) as Json[]
      setupRestaurantId = pending[0]?.id ?? null
    }

    return {
      user,
      needsOnboarding: !profile.is_super_admin && !membership,
      mustSetPassword: !!profile.must_change_password,
      setupRestaurantId,
      email: profile.email,
      fullName: profile.full_name
    }
  }

  async signIn(email: string, password: string): Promise<void> {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) throw toDomainError(error)
  }

  async signOut(): Promise<void> {
    const { error } = await supabase.auth.signOut()
    if (error) throw toDomainError(error)
  }

  async sendPasswordReset(email: string, redirectTo: string): Promise<void> {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo })
    if (error) throw toDomainError(error)
  }

  async updatePassword(password: string): Promise<void> {
    const { error } = await supabase.auth.updateUser({ password })
    if (error) throw toDomainError(error)
  }

  async claimInvitations(): Promise<number> {
    return rpc<number>('claim_staff_invitations')
  }

  async verifyEmailToken(tokenHash: string, type: 'invite' | 'recovery' | 'magiclink' | 'email'): Promise<void> {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
    if (error) throw toDomainError(error)
  }

  async setSessionFromTokens(accessToken: string, refreshToken: string): Promise<void> {
    const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
    if (error) throw toDomainError(error)
  }

  async completeFirstAccess(): Promise<void> {
    await rpc('complete_first_access')
  }

  onAuthChange(callback: (event: string) => void): () => void {
    const { data } = supabase.auth.onAuthStateChange(event => callback(event))
    return () => data.subscription.unsubscribe()
  }
}

// =====================================================================
// Empresas, restaurantes e utilizadores
// =====================================================================
export class SupabaseCompanyRepository implements ICompanyRepository {
  async getAll(): Promise<Company[]> {
    return unwrap(await supabase.from('companies').select(COMPANY_SELECT).order('name')).map(mapCompany)
  }

  async getById(id: string): Promise<Company | null> {
    const row = unwrap(await supabase.from('companies').select(COMPANY_SELECT).eq('id', id).maybeSingle())
    return row ? mapCompany(row) : null
  }

  async create(input: CreateCompanyInput): Promise<Company> {
    const id = await rpc<string>('admin_create_company', {
      p_name: input.name,
      p_plan_id: input.planId,
      p_legal_name: input.legalName ?? null,
      p_tax_id: input.taxId ?? null,
      p_phone: input.phone ?? null,
      p_email: input.email ?? null,
      p_owner_name: input.ownerName ?? null,
      p_owner_email: input.ownerEmail ?? null
    })
    const created = await this.getById(id)
    if (!created) throw new DomainError('not_found', 'Empresa criada, mas não foi possível carregá-la.')
    return created
  }

  async update(id: string, updates: Partial<Company>): Promise<Company> {
    const row = companyToRow(updates)
    if (Object.keys(row).length) {
      unwrap(await supabase.from('companies').update(row).eq('id', id))
    }
    if (updates.planId) {
      const sub = unwrap(await supabase.from('subscriptions').select('id, plan_id').eq('company_id', id).maybeSingle())
      if (sub && sub.plan_id !== updates.planId) {
        unwrap(await supabase.from('subscriptions').update({ plan_id: updates.planId }).eq('id', sub.id))
      }
    }
    const company = await this.getById(id)
    if (!company) throw new DomainError('not_found', 'Empresa não encontrada.')
    return company
  }
}

export class SupabaseRestaurantRepository implements IRestaurantRepository {
  async getByTenant(tenantId: string): Promise<Restaurant[]> {
    return unwrap(await supabase.from('restaurants').select('*').eq('company_id', tenantId).order('name')).map(mapRestaurant)
  }

  async getById(id: string): Promise<Restaurant | null> {
    const row = unwrap(await supabase.from('restaurants').select('*').eq('id', id).maybeSingle())
    return row ? mapRestaurant(row) : null
  }

  async getBySlug(slug: string): Promise<Restaurant | null> {
    const row = unwrap(await supabase.from('restaurants').select('*').eq('slug', slug).maybeSingle())
    return row ? mapRestaurant(row) : null
  }

  async getAll(): Promise<Restaurant[]> {
    return unwrap(await supabase.from('restaurants').select('*').order('name')).map(mapRestaurant)
  }

  async create(restaurant: Omit<Restaurant, 'id' | 'createdAt'>): Promise<Restaurant> {
    const row = restaurantToRow(restaurant)
    row.slug = row.slug ?? ''
    return mapRestaurant(unwrapOne(await supabase.from('restaurants').insert(row).select('*').single()))
  }

  async update(id: string, updates: Partial<Restaurant>): Promise<Restaurant> {
    const row = restaurantToRow(updates)
    delete row.company_id
    delete row.slug // imutável: está gravado nas etiquetas NFC
    return mapRestaurant(unwrapOne(await supabase.from('restaurants').update(row).eq('id', id).select('*').single()))
  }

  async completeOnboarding(id: string): Promise<Restaurant> {
    return mapRestaurant(await rpc('complete_restaurant_onboarding', { p_restaurant_id: id }))
  }
}

// =====================================================================
// Pré-registo de estabelecimentos (Super Admin)
// =====================================================================
export class SupabaseEstablishmentRepository implements IEstablishmentRepository {
  private async getById(id: string): Promise<EstablishmentInvitation> {
    const row = unwrap(await supabase.from('establishment_invitations').select(INVITATION_SELECT).eq('id', id).maybeSingle())
    if (!row) throw new DomainError('not_found', 'Pré-registo não encontrado.')
    return mapInvitation(row)
  }

  async getAll(): Promise<EstablishmentInvitation[]> {
    return unwrap(
      await supabase.from('establishment_invitations').select(INVITATION_SELECT).order('created_at', { ascending: false })
    ).map(mapInvitation)
  }

  async preregister(input: PreRegisterEstablishmentInput): Promise<EstablishmentInvitation> {
    const id = await rpc<string>('admin_preregister_establishment', {
      p_data: {
        establishmentName: input.establishmentName,
        companyName: input.companyName,
        ownerName: input.ownerName,
        ownerEmail: input.ownerEmail,
        ownerPhone: input.ownerPhone,
        country: input.country,
        city: input.city,
        planId: input.planId,
        subscriptionStatus: input.subscriptionStatus,
        startDate: input.startDate,
        internalNotes: input.internalNotes,
        customPrice: input.customPrice ?? null,
        customFeatures: input.customFeatures ?? null,
        customLimits: input.customLimits ?? null
      }
    })
    return this.getById(id)
  }

  async invite(invitationId: string, delivery: InviteDelivery, redirectTo: string): Promise<InviteResult> {
    const { data, error } = await supabase.functions.invoke('invite-establishment', {
      body: { invitationId, delivery, redirectTo }
    })
    if (error) {
      // A função responde { error: { code, message } } com o detalhe.
      let detail: { code?: string; message?: string } | undefined
      try {
        const context = (error as { context?: Response }).context
        detail = context ? (await context.json())?.error : undefined
      } catch {
        detail = undefined
      }
      if (detail?.message) throw new DomainError(detail.code ?? 'invite_failed', detail.message)
      throw new DomainError(
        'invite_failed',
        'Não foi possível contactar o serviço de convites. Confirme que a Edge Function "invite-establishment" está publicada.'
      )
    }
    return { delivery: data.delivery, email: data.email, link: data.link ?? null }
  }

  async update(
    id: string,
    updates: Partial<Pick<EstablishmentInvitation, 'ownerName' | 'ownerPhone' | 'country' | 'city' | 'internalNotes'>>
  ): Promise<EstablishmentInvitation> {
    const row = clean({
      owner_name: updates.ownerName,
      owner_phone: updates.ownerPhone,
      country: updates.country,
      city: updates.city,
      internal_notes: updates.internalNotes
    })
    if (Object.keys(row).length) unwrap(await supabase.from('establishment_invitations').update(row).eq('id', id))
    return this.getById(id)
  }
}

export class SupabaseUserRepository implements IUserRepository {
  private async withMemberships(profiles: Json[]): Promise<User[]> {
    if (!profiles.length) return []
    const memberships = unwrap(
      await supabase.from('staff_members').select('*').in('user_id', profiles.map(p => p.id))
    ) as Json[]
    return profiles
      .map(p => mapUser(p, memberships.find(m => m.user_id === p.id) ?? null))
      .filter(u => u.role !== undefined)
  }

  async getAll(): Promise<User[]> {
    return this.withMemberships(unwrap(await supabase.from('profiles').select('*').order('full_name')))
  }

  async getById(id: string): Promise<User | null> {
    const profile = unwrap(await supabase.from('profiles').select('*').eq('id', id).maybeSingle())
    return profile ? ((await this.withMemberships([profile]))[0] ?? null) : null
  }

  async getByTenant(tenantId: string): Promise<User[]> {
    const memberships = unwrap(
      await supabase.from('staff_members').select('user_id').eq('company_id', tenantId).not('user_id', 'is', null)
    ) as Json[]
    if (!memberships.length) return []
    return this.withMemberships(
      unwrap(await supabase.from('profiles').select('*').in('id', memberships.map(m => m.user_id)))
    )
  }
}

export class SupabaseStaffRepository implements IStaffRepository {
  async getByTenant(tenantId: string): Promise<StaffMember[]> {
    return unwrap(await supabase.from('staff_members').select('*').eq('company_id', tenantId).order('name')).map(mapStaff)
  }

  async getByRestaurant(restaurantId: string): Promise<StaffMember[]> {
    return unwrap(
      await supabase.from('staff_members').select('*').contains('restaurant_ids', [restaurantId]).order('name')
    ).map(mapStaff)
  }

  async create(staff: Omit<StaffMember, 'id'>): Promise<StaffMember> {
    return mapStaff(unwrapOne(await supabase.from('staff_members').insert(staffToRow(staff)).select('*').single()))
  }

  async update(id: string, updates: Partial<StaffMember>): Promise<StaffMember> {
    const row = staffToRow(updates)
    delete row.company_id
    return mapStaff(unwrapOne(await supabase.from('staff_members').update(row).eq('id', id).select('*').single()))
  }

  async delete(id: string): Promise<boolean> {
    const rows = unwrap(await supabase.from('staff_members').delete().eq('id', id).select('id'))
    return rows.length > 0
  }
}

// =====================================================================
// Mesas e sessões
// =====================================================================
export class SupabaseTableRepository implements ITableRepository {
  async getByRestaurant(restaurantId: string): Promise<Table[]> {
    return (unwrap(await supabase.from('dining_tables').select('*').eq('restaurant_id', restaurantId)) as Json[])
      .map(mapTable)
      .sort((a: Table, b: Table) => a.number.localeCompare(b.number, 'pt', { numeric: true }))
  }

  async getById(id: string): Promise<Table | null> {
    const row = unwrap(await supabase.from('dining_tables').select('*').eq('id', id).maybeSingle())
    return row ? mapTable(row) : null
  }

  async getBySlug(restaurantId: string, slug: string): Promise<Table | null> {
    const row = unwrap(
      await supabase.from('dining_tables').select('*').eq('restaurant_id', restaurantId).eq('slug', slug).maybeSingle()
    )
    return row ? mapTable(row) : null
  }

  async getByNumber(restaurantId: string, number: string): Promise<Table | null> {
    const row = unwrap(
      await supabase.from('dining_tables').select('*').eq('restaurant_id', restaurantId).ilike('number', number).maybeSingle()
    )
    return row ? mapTable(row) : null
  }

  async create(restaurantId: string, input: TableInput): Promise<Table> {
    const row = clean({
      restaurant_id: restaurantId,
      number: input.number.trim(),
      name: input.name?.trim() || undefined,
      area: input.area,
      capacity: input.capacity
    })
    return mapTable(unwrapOne(await supabase.from('dining_tables').insert(row).select('*').single()))
  }

  async update(id: string, input: Partial<TableInput>): Promise<Table> {
    const row = clean({
      number: input.number?.trim(),
      name: input.name !== undefined ? input.name.trim() : undefined,
      area: input.area,
      capacity: input.capacity
    })
    return mapTable(unwrapOne(await supabase.from('dining_tables').update(row).eq('id', id).select('*').single()))
  }

  async setStatus(id: string, status: 'free' | 'unavailable'): Promise<Table> {
    return mapTable(await rpc('set_table_status', { p_table_id: id, p_status: status }))
  }

  async setActive(id: string, isActive: boolean): Promise<Table> {
    return mapTable(unwrapOne(await supabase.from('dining_tables').update({ is_active: isActive }).eq('id', id).select('*').single()))
  }

  async delete(id: string, _actor: string): Promise<boolean> {
    const rows = unwrap(await supabase.from('dining_tables').delete().eq('id', id).select('id'))
    return rows.length > 0
  }
}

const mapParticipant = (p: Json): SessionParticipant & { token?: string } => ({
  id: p.id,
  name: p.name,
  joinedAt: p.joinedAt,
  isPrimary: p.isPrimary,
  token: p.token
})

export class SupabaseTableSessionRepository implements ITableSessionRepository {
  async getByRestaurant(restaurantId: string): Promise<TableSession[]> {
    return unwrap(
      await supabase.from('table_sessions').select(SESSION_SELECT).eq('restaurant_id', restaurantId)
        .order('started_at', { ascending: false }).limit(500)
    ).map(mapSession)
  }

  async getByTable(tableId: string): Promise<TableSession[]> {
    return unwrap(
      await supabase.from('table_sessions').select(SESSION_SELECT).eq('table_id', tableId).order('started_at', { ascending: false })
    ).map(mapSession)
  }

  async getActiveByTable(tableId: string): Promise<TableSession | null> {
    const row = unwrap(
      await supabase.from('table_sessions').select(SESSION_SELECT).eq('table_id', tableId).eq('status', 'active').maybeSingle()
    )
    return row ? mapSession(row) : null
  }

  async getById(id: string): Promise<TableSession | null> {
    const row = unwrap(await supabase.from('table_sessions').select(SESSION_SELECT).eq('id', id).maybeSingle())
    return row ? mapSession(row) : null
  }

  async start(input: StartSessionInput) {
    const result = await rpc<Json>('start_table_session', {
      p_table_id: input.tableId,
      p_customer_name: input.primaryCustomerName?.trim() || null,
      p_party_size: input.partySize ?? null,
      p_notes: input.notes ?? null
    })
    return {
      session: normalizeSessionJson(result.session),
      participant: result.participant ? mapParticipant(result.participant) : null
    }
  }

  async join(sessionId: string, name: string) {
    const result = await rpc<Json>('join_table_session', { p_session_id: sessionId, p_name: name })
    return { session: normalizeSessionJson(result.session), participant: mapParticipant(result.participant) }
  }

  async close(sessionId: string, _actor: string): Promise<TableSession> {
    return normalizeSessionJson(await rpc('close_table_session', { p_session_id: sessionId }))
  }

  async cancel(sessionId: string, _actor: string, reason?: string): Promise<TableSession> {
    return normalizeSessionJson(await rpc('cancel_table_session', { p_session_id: sessionId, p_reason: reason ?? null }))
  }
}

// =====================================================================
// Etiquetas NFC (registo administrativo — sem gravação pelo navegador)
// =====================================================================
export class SupabaseNfcTagRepository implements INfcTagRepository {
  async getAll(): Promise<NfcTag[]> {
    return unwrap(await supabase.from('nfc_tags').select('*').order('code')).map(mapNfcTag)
  }

  async getByRestaurant(restaurantId: string): Promise<NfcTag[]> {
    return unwrap(await supabase.from('nfc_tags').select('*').eq('restaurant_id', restaurantId).order('code')).map(mapNfcTag)
  }

  async getById(id: string): Promise<NfcTag | null> {
    const row = unwrap(await supabase.from('nfc_tags').select('*').eq('id', id).maybeSingle())
    return row ? mapNfcTag(row) : null
  }

  async getByTable(tableId: string): Promise<NfcTag | null> {
    const row = unwrap(
      await supabase.from('nfc_tags').select('*').eq('table_id', tableId).neq('status', 'disabled').maybeSingle()
    )
    return row ? mapNfcTag(row) : null
  }

  async getHistory(tagId: string): Promise<NfcTagEvent[]> {
    return unwrap(
      await supabase.from('nfc_tag_events').select('*').eq('tag_id', tagId).order('created_at', { ascending: false })
    ).map(mapNfcTagEvent)
  }

  async register(input: RegisterNfcTagsInput, _actor: string): Promise<NfcTag[]> {
    const rows = await rpc<Json[]>('nfc_register_tags', {
      p_restaurant_id: input.restaurantId,
      p_codes: input.codes?.length ? input.codes : null,
      p_quantity: input.codes?.length ? null : (input.quantity ?? 1),
      p_notes: input.notes ?? null
    })
    return rows.map(mapNfcTag)
  }

  async assign(tagId: string, tableId: string): Promise<NfcTag> {
    return mapNfcTag(await rpc('nfc_assign_tag', { p_tag_id: tagId, p_table_id: tableId }))
  }

  async unassign(tagId: string): Promise<NfcTag> {
    return mapNfcTag(await rpc('nfc_unassign_tag', { p_tag_id: tagId }))
  }

  async markConfigured(tagId: string, _actor: string, notes?: string): Promise<NfcTag> {
    return mapNfcTag(await rpc('nfc_mark_tag_configured', { p_tag_id: tagId, p_notes: notes ?? null }))
  }

  async activate(tagId: string): Promise<NfcTag> {
    return mapNfcTag(await rpc('nfc_activate_tag', { p_tag_id: tagId }))
  }

  async disable(tagId: string, _actor: string, reason?: string): Promise<NfcTag> {
    return mapNfcTag(await rpc('nfc_disable_tag', { p_tag_id: tagId, p_reason: reason ?? null }))
  }

  async reactivate(tagId: string): Promise<NfcTag> {
    return mapNfcTag(await rpc('nfc_reactivate_tag', { p_tag_id: tagId }))
  }
}

// =====================================================================
// Menu
// =====================================================================
export class SupabaseCategoryRepository implements ICategoryRepository {
  async getByRestaurant(restaurantId: string): Promise<Category[]> {
    return unwrap(
      await supabase.from('categories').select('*').eq('restaurant_id', restaurantId).order('sort_order').order('name')
    ).map(mapCategory)
  }

  async create(category: Omit<Category, 'id'>): Promise<Category> {
    return mapCategory(unwrapOne(await supabase.from('categories').insert(categoryToRow(category)).select('*').single()))
  }

  async update(id: string, updates: Partial<Category>): Promise<Category> {
    const row = categoryToRow(updates)
    delete row.restaurant_id
    return mapCategory(unwrapOne(await supabase.from('categories').update(row).eq('id', id).select('*').single()))
  }

  async delete(id: string): Promise<boolean> {
    const { data, error } = await supabase.from('categories').delete().eq('id', id).select('id')
    if (error) {
      if (error.code === '23503') {
        throw new DomainError('category_in_use', 'Esta categoria tem produtos. Mova ou remova os produtos antes de a eliminar.')
      }
      throw toDomainError(error)
    }
    return (data ?? []).length > 0
  }
}

export class SupabaseProductRepository implements IProductRepository {
  async getByRestaurant(restaurantId: string): Promise<Product[]> {
    return unwrap(
      await supabase.from('products').select(PRODUCT_SELECT).eq('restaurant_id', restaurantId).order('sort_order').order('name')
    ).map(mapProduct)
  }

  async getById(id: string): Promise<Product | null> {
    const row = unwrap(await supabase.from('products').select(PRODUCT_SELECT).eq('id', id).maybeSingle())
    return row ? mapProduct(row) : null
  }

  /** Substitui variantes e adicionais do produto pela lista atual do formulário. */
  private async saveOptions(productId: string, product: Partial<Product>) {
    if (product.variants !== undefined) {
      unwrap(await supabase.from('product_variants').delete().eq('product_id', productId))
      if (product.variants.length) {
        unwrap(await supabase.from('product_variants').insert(
          product.variants.map((v, i) => ({ product_id: productId, name: v.name.trim(), price_delta: v.priceDelta, sort_order: i }))
        ))
      }
    }
    if (product.addons !== undefined) {
      unwrap(await supabase.from('product_addons').delete().eq('product_id', productId))
      if (product.addons.length) {
        unwrap(await supabase.from('product_addons').insert(
          product.addons.map((a, i) => ({ product_id: productId, name: a.name.trim(), price: a.price, is_default: !!a.isDefault, sort_order: i }))
        ))
      }
    }
  }

  async create(product: Omit<Product, 'id'>): Promise<Product> {
    const created = unwrapOne(await supabase.from('products').insert(productToRow(product)).select('id').single())
    await this.saveOptions(created.id, product)
    return (await this.getById(created.id))!
  }

  async update(id: string, updates: Partial<Product>): Promise<Product> {
    const row = productToRow(updates)
    delete row.restaurant_id
    if (Object.keys(row).length) unwrap(await supabase.from('products').update(row).eq('id', id))
    await this.saveOptions(id, updates)
    const product = await this.getById(id)
    if (!product) throw new DomainError('not_found', 'Produto não encontrado.')
    return product
  }

  async delete(id: string): Promise<boolean> {
    const rows = unwrap(await supabase.from('products').delete().eq('id', id).select('id'))
    return rows.length > 0
  }
}

export class SupabaseMenuCustomizationRepository implements IMenuCustomizationRepository {
  async getByRestaurant(restaurantId: string): Promise<MenuCustomization | null> {
    const row = unwrap(await supabase.from('menu_customizations').select('*').eq('restaurant_id', restaurantId).maybeSingle())
    return row ? mapCustomization(row) : null
  }

  async save(customization: Omit<MenuCustomization, 'id' | 'updatedAt'> & { id?: string }): Promise<MenuCustomization> {
    return mapCustomization(unwrapOne(
      await supabase.from('menu_customizations')
        .upsert(
          { restaurant_id: customization.restaurantId, theme: customization.theme, updated_by: customization.updatedBy },
          { onConflict: 'restaurant_id' }
        )
        .select('*')
        .single()
    ))
  }

  async delete(restaurantId: string): Promise<boolean> {
    const rows = unwrap(await supabase.from('menu_customizations').delete().eq('restaurant_id', restaurantId).select('id'))
    return rows.length > 0
  }
}

// =====================================================================
// Operação: pedidos, pagamentos, atendimento, notificações
// =====================================================================
export class SupabaseOrderRepository implements IOrderRepository {
  async getByRestaurant(restaurantId: string): Promise<Order[]> {
    return unwrap(
      await supabase.from('orders').select(ORDER_SELECT).eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: false }).limit(500)
    ).map(mapOrder)
  }

  async getAll(limit = 500): Promise<Order[]> {
    return unwrap(
      await supabase.from('orders').select(ORDER_SELECT).order('created_at', { ascending: false }).limit(limit)
    ).map(mapOrder)
  }

  async getById(id: string): Promise<Order | null> {
    const row = unwrap(await supabase.from('orders').select(ORDER_SELECT).eq('id', id).maybeSingle())
    return row ? mapOrder(row) : null
  }

  async updateStatus(id: string, status: OrderStatus, note?: string): Promise<Order> {
    return normalizeOrderJson(await rpc('update_order_status', { p_order_id: id, p_status: status, p_note: note ?? null }))
  }

  async updatePaymentStatus(id: string, paymentStatus: PaymentStatus): Promise<Order> {
    unwrap(await supabase.from('orders').update({ payment_status: paymentStatus }).eq('id', id))
    const order = await this.getById(id)
    if (!order) throw new DomainError('not_found', 'Pedido não encontrado.')
    return order
  }
}

export class SupabasePaymentRepository implements IPaymentRepository {
  async getByRestaurant(restaurantId: string): Promise<Payment[]> {
    return unwrap(
      await supabase.from('payments').select(PAYMENT_SELECT).eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: false }).limit(500)
    ).map(mapPayment)
  }

  async getAll(limit = 500): Promise<Payment[]> {
    return unwrap(
      await supabase.from('payments').select(PAYMENT_SELECT).order('created_at', { ascending: false }).limit(limit)
    ).map(mapPayment)
  }

  async getById(id: string): Promise<Payment | null> {
    const row = unwrap(await supabase.from('payments').select(PAYMENT_SELECT).eq('id', id).maybeSingle())
    return row ? mapPayment(row) : null
  }

  async create(payment: Omit<Payment, 'id' | 'createdAt'>): Promise<Payment> {
    const row = clean({
      restaurant_id: payment.restaurantId,
      order_id: payment.orderId,
      amount: payment.amount,
      method: payment.method,
      status: payment.status,
      transaction_reference: payment.transactionReference ?? '',
      customer_phone: payment.customerPhone,
      notes: payment.notes
    })
    return mapPayment(unwrapOne(await supabase.from('payments').insert(row).select(PAYMENT_SELECT).single()))
  }

  async updateStatus(id: string, status: PaymentStatus): Promise<Payment> {
    return mapPayment(unwrapOne(await supabase.from('payments').update({ status }).eq('id', id).select(PAYMENT_SELECT).single()))
  }
}

export class SupabaseServiceRequestRepository implements IServiceRequestRepository {
  async getByRestaurant(restaurantId: string): Promise<ServiceRequest[]> {
    return unwrap(
      await supabase.from('service_requests').select('*').eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: false }).limit(300)
    ).map(mapServiceRequest)
  }

  async updateStatus(id: string, status: ServiceRequestStatus, assignedToUserId?: string, assignedToName?: string): Promise<ServiceRequest> {
    const row = clean({ status, assigned_to_user_id: assignedToUserId, assigned_to_name: assignedToName })
    return mapServiceRequest(unwrapOne(await supabase.from('service_requests').update(row).eq('id', id).select('*').single()))
  }
}

export class SupabaseNotificationRepository implements INotificationRepository {
  async getByRestaurant(restaurantId: string): Promise<Notification[]> {
    return unwrap(
      await supabase.from('notifications').select('*').eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: false }).limit(100)
    ).map(mapNotification)
  }

  async markAsRead(id: string): Promise<Notification> {
    return mapNotification(unwrapOne(
      await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id).select('*').single()
    ))
  }

  async markAllAsRead(restaurantId: string): Promise<void> {
    unwrap(await supabase.from('notifications').update({ read_at: new Date().toISOString() })
      .eq('restaurant_id', restaurantId).is('read_at', null))
  }
}

// =====================================================================
// Planos, subscrições e acesso
// =====================================================================
export class SupabasePlanRepository implements IPlanRepository {
  async getAll(): Promise<Plan[]> {
    return unwrap(await supabase.from('plans').select('*').order('display_order').order('price')).map(mapPlan)
  }

  async getById(id: string): Promise<Plan | null> {
    const row = unwrap(await supabase.from('plans').select('*').eq('id', id).maybeSingle())
    return row ? mapPlan(row) : null
  }

  async getBySlug(slug: string): Promise<Plan | null> {
    const row = unwrap(await supabase.from('plans').select('*').eq('slug', slug).maybeSingle())
    return row ? mapPlan(row) : null
  }

  async create(plan: Omit<Plan, 'id'>): Promise<Plan> {
    const normalized = normalizePlanEntitlements(plan)
    return mapPlan(unwrapOne(await supabase.from('plans').insert(planToRow({ ...plan, ...normalized })).select('*').single()))
  }

  async update(id: string, updates: Partial<Plan>): Promise<Plan> {
    const row = planToRow(updates)
    if (updates.features || updates.limits) {
      const current = await this.getById(id)
      if (!current) throw new DomainError('not_found', 'Plano não encontrado.')
      const normalized = normalizePlanEntitlements({ ...current, ...updates })
      row.features = normalized.features
      row.limits = normalized.limits
    }
    return mapPlan(unwrapOne(await supabase.from('plans').update(row).eq('id', id).select('*').single()))
  }

  async delete(id: string): Promise<boolean> {
    const rows = unwrap(await supabase.from('plans').delete().eq('id', id).select('id'))
    return rows.length > 0
  }
}

export class SupabaseSubscriptionRepository implements ISubscriptionRepository {
  async getAllPlans(): Promise<Plan[]> {
    return new SupabasePlanRepository().getAll()
  }

  async getAllSubscriptions(): Promise<Subscription[]> {
    return unwrap(await supabase.from('subscriptions').select(SUBSCRIPTION_SELECT).order('created_at', { ascending: false }))
      .map(mapSubscription)
  }

  async getByTenant(tenantId: string): Promise<Subscription | null> {
    const row = unwrap(await supabase.from('subscriptions').select(SUBSCRIPTION_SELECT).eq('company_id', tenantId).maybeSingle())
    return row ? mapSubscription(row) : null
  }

  async getById(id: string): Promise<Subscription | null> {
    const row = unwrap(await supabase.from('subscriptions').select(SUBSCRIPTION_SELECT).eq('id', id).maybeSingle())
    return row ? mapSubscription(row) : null
  }

  async updateSubscription(
    id: string,
    updates: Partial<Pick<Subscription, 'planId' | 'status' | 'renewalDate' | 'isAutoRenew' | 'startDate'>>
  ): Promise<Subscription> {
    const row = clean({
      plan_id: updates.planId,
      status: updates.status,
      renewal_date: updates.renewalDate,
      is_auto_renew: updates.isAutoRenew,
      start_date: updates.startDate
    })
    unwrap(await supabase.from('subscriptions').update(row).eq('id', id))
    const sub = await this.getById(id)
    if (!sub) throw new DomainError('not_found', 'Subscrição não encontrada.')
    return sub
  }

  async addHistoryEvent(id: string, event: Omit<SubscriptionHistory, 'id' | 'date'>): Promise<Subscription> {
    const sub = await this.getById(id)
    if (!sub) throw new DomainError('not_found', 'Subscrição não encontrada.')
    unwrap(await supabase.from('subscription_events').insert(clean({
      subscription_id: id,
      company_id: sub.tenantId,
      event: event.event,
      from_plan_name: event.fromPlanName,
      to_plan_name: event.toPlanName,
      amount: event.amount,
      note: event.note,
      performed_by: event.performedBy
    })))
    return (await this.getById(id))!
  }

  async requestPlanChange(planId: string, note?: string): Promise<PlanChangeRequest> {
    return mapPlanChangeRequest(await rpc('request_plan_change', { p_plan_id: planId, p_note: note ?? null }))
  }

  async getPlanChangeRequests(tenantId?: string): Promise<PlanChangeRequest[]> {
    let query = supabase.from('plan_change_requests').select('*').order('created_at', { ascending: false })
    if (tenantId) query = query.eq('company_id', tenantId)
    return unwrap(await query).map(mapPlanChangeRequest)
  }

  async resolvePlanChangeRequest(id: string, status: 'approved' | 'rejected'): Promise<void> {
    unwrap(await supabase.from('plan_change_requests').update({ status, resolved_at: new Date().toISOString() }).eq('id', id))
  }
}

export class SupabasePlanAccessRepository implements IPlanAccessRepository {
  async getTenantPlan(tenantId: string): Promise<Plan | null> {
    const row = await rpc<Json | null>('get_company_plan', { p_company_id: tenantId })
    return row && row.id ? mapPlan(row) : null
  }

  async countUsage(tenantId: string, key: LimitKey, restaurantId?: string): Promise<number> {
    return rpc<number>('get_plan_usage', { p_company_id: tenantId, p_key: key, p_restaurant_id: restaurantId ?? null })
  }
}

// =====================================================================
// Plataforma: auditoria e configuração
// =====================================================================
export class SupabaseAuditLogRepository implements IAuditLogRepository {
  async getAll(filter?: { tenantId?: string; limit?: number }): Promise<PlatformAuditLog[]> {
    let query = supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(filter?.limit ?? 200)
    if (filter?.tenantId) query = query.eq('company_id', filter.tenantId)
    return unwrap(await query).map(mapAuditLog)
  }

  async create(log: Omit<PlatformAuditLog, 'id' | 'createdAt'>): Promise<PlatformAuditLog> {
    // Autor (user_id / user_name) é carimbado pela base de dados.
    return mapAuditLog(unwrapOne(
      await supabase.from('audit_logs')
        .insert(clean({ company_id: log.tenantId, action: log.action, resource: log.resource, details: log.details }))
        .select('*')
        .single()
    ))
  }
}

export class SupabasePlatformConfigRepository implements IPlatformConfigRepository {
  async get(): Promise<PlatformConfig> {
    return mapPlatformConfig(unwrapOne(await supabase.from('platform_config').select('*').eq('id', true).maybeSingle(),
      'Configuração da plataforma em falta. Aplique as migrations do Supabase.'))
  }

  async update(updates: Partial<PlatformConfig>): Promise<PlatformConfig> {
    return mapPlatformConfig(unwrapOne(
      await supabase.from('platform_config').update(platformConfigToRow(updates)).eq('id', true).select('*').single()
    ))
  }
}

// =====================================================================
// Menu público (cliente sem conta)
// =====================================================================
export class SupabasePublicMenuRepository implements IPublicMenuRepository {
  async resolveTable(restaurantSlug: string, tableKey: string): Promise<PublicTableContext | null> {
    const result = await rpc<Json | null>('get_public_table', { p_restaurant_slug: restaurantSlug, p_table_key: tableKey })
    if (!result) return null
    return {
      restaurant: mapRestaurant(result.restaurant),
      table: mapTable(result.table),
      activeSession: result.activeSession ? normalizeSessionJson(result.activeSession) : null
    }
  }

  async getMenu(restaurantId: string): Promise<PublicMenuContent> {
    const result = await rpc<Json | null>('get_public_menu', { p_restaurant_id: restaurantId })
    return {
      categories: ((result?.categories ?? []) as Json[]).map(mapCategory),
      products: ((result?.products ?? []) as Json[]).map(normalizeProductJson),
      customization: result?.customization ?? null
    }
  }

  async placeOrder(input: PlaceOrderInput): Promise<Order> {
    return normalizeOrderJson(await rpc('place_order', {
      p_session_id: input.sessionId,
      p_participant_token: input.participantToken ?? null,
      p_items: input.items,
      p_customer_name: input.customerName ?? null,
      p_customer_phone: input.customerPhone ?? null,
      p_notes: input.notes ?? null,
      p_payment_method: input.paymentMethod ?? null
    }))
  }

  async getSessionOrders(sessionId: string, participantToken?: string): Promise<Order[]> {
    const rows = await rpc<Json[]>('get_session_orders', { p_session_id: sessionId, p_participant_token: participantToken ?? null })
    return (rows ?? []).map(normalizeOrderJson)
  }

  async requestBill(sessionId: string, participantToken?: string, paymentMethod?: PaymentMethod, notes?: string): Promise<TableSession> {
    return normalizeSessionJson(await rpc('request_bill', {
      p_session_id: sessionId,
      p_participant_token: participantToken ?? null,
      p_payment_method: paymentMethod ?? null,
      p_notes: notes?.trim() || null
    }))
  }

  async createServiceRequest(input: CreateServiceRequestInput) {
    const result = await rpc<Json>('create_service_request', {
      p_table_id: input.tableId,
      p_type: input.type,
      p_session_id: input.sessionId ?? null,
      p_participant_token: input.participantToken ?? null,
      p_customer_name: input.customerName ?? null,
      p_notes: input.notes ?? null
    })
    return { request: mapServiceRequest(result), alreadyExisted: !!result.alreadyExisted }
  }

  async getOrder(orderId: string): Promise<PublicOrderView | null> {
    const result = await rpc<Json | null>('get_public_order', { p_order_id: orderId })
    if (!result) return null
    return { order: normalizeOrderJson(result.order), restaurant: result.restaurant }
  }
}

// =====================================================================
// Imagens (Supabase Storage)
// =====================================================================
const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']

export class SupabaseMediaRepository implements IMediaRepository {
  async uploadImage(file: File, scope: { tenantId: string; restaurantId?: string; kind: MediaKind }): Promise<string> {
    if (!IMAGE_TYPES.includes(file.type)) {
      throw new DomainError('invalid_image', 'Formato não suportado. Use JPG, PNG, WebP, GIF ou SVG.')
    }
    if (file.size > MAX_IMAGE_BYTES) {
      throw new DomainError('image_too_large', 'A imagem tem mais de 5 MB. Reduza o tamanho e tente novamente.')
    }
    const ext = (file.name.split('.').pop() || file.type.split('/')[1] || 'img').toLowerCase().replace(/[^a-z0-9]/g, '')
    const path = `${scope.tenantId}/${scope.restaurantId ?? 'company'}/${scope.kind}/${crypto.randomUUID()}.${ext}`
    const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, file, {
      contentType: file.type,
      cacheControl: '31536000',
      upsert: false
    })
    if (error) throw toDomainError(error, 'Não foi possível enviar a imagem.')
    return supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path).data.publicUrl
  }

  async removeByUrl(url: string): Promise<void> {
    const marker = `/storage/v1/object/public/${MEDIA_BUCKET}/`
    const index = url.indexOf(marker)
    if (index === -1) return
    const path = decodeURIComponent(url.slice(index + marker.length))
    const { error } = await supabase.storage.from(MEDIA_BUCKET).remove([path])
    if (error) throw toDomainError(error)
  }
}
