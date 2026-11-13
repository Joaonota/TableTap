/**
 * Registo único de repositórios — fonte de dados: Supabase.
 *
 * Serviços, stores e páginas usam apenas estas interfaces
 * (ver ./interfaces.ts); nenhuma consulta ao Supabase é feita fora de
 * ./supabase. Não existem dados de demonstração: sem registos na base de
 * dados, as páginas mostram estados vazios.
 */
import {
  SupabaseAuthRepository,
  SupabaseCompanyRepository,
  SupabaseRestaurantRepository,
  SupabaseUserRepository,
  SupabaseTableRepository,
  SupabaseTableSessionRepository,
  SupabaseNfcTagRepository,
  SupabasePlanAccessRepository,
  SupabaseCategoryRepository,
  SupabaseProductRepository,
  SupabaseOrderRepository,
  SupabasePaymentRepository,
  SupabaseServiceRequestRepository,
  SupabaseStaffRepository,
  SupabasePlanRepository,
  SupabaseSubscriptionRepository,
  SupabaseMenuCustomizationRepository,
  SupabaseAuditLogRepository,
  SupabasePlatformConfigRepository,
  SupabaseNotificationRepository,
  SupabasePublicMenuRepository,
  SupabaseMediaRepository,
  SupabaseEstablishmentRepository
} from './supabase'
import type {
  IAuthRepository,
  ICompanyRepository,
  IRestaurantRepository,
  IUserRepository,
  ITableRepository,
  ITableSessionRepository,
  INfcTagRepository,
  IPlanAccessRepository,
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
  INotificationRepository,
  IPublicMenuRepository,
  IMediaRepository,
  IEstablishmentRepository
} from './interfaces'

export interface RepositoryRegistry {
  auth: IAuthRepository
  companies: ICompanyRepository
  restaurants: IRestaurantRepository
  users: IUserRepository
  tables: ITableRepository
  tableSessions: ITableSessionRepository
  nfcTags: INfcTagRepository
  planAccess: IPlanAccessRepository
  categories: ICategoryRepository
  products: IProductRepository
  orders: IOrderRepository
  payments: IPaymentRepository
  serviceRequests: IServiceRequestRepository
  staff: IStaffRepository
  plans: IPlanRepository
  subscriptions: ISubscriptionRepository
  menuCustomizations: IMenuCustomizationRepository
  auditLogs: IAuditLogRepository
  platformConfig: IPlatformConfigRepository
  notifications: INotificationRepository
  publicMenu: IPublicMenuRepository
  media: IMediaRepository
  establishments: IEstablishmentRepository
}

export const repositories: RepositoryRegistry = {
  auth: new SupabaseAuthRepository(),
  companies: new SupabaseCompanyRepository(),
  restaurants: new SupabaseRestaurantRepository(),
  users: new SupabaseUserRepository(),
  tables: new SupabaseTableRepository(),
  tableSessions: new SupabaseTableSessionRepository(),
  nfcTags: new SupabaseNfcTagRepository(),
  planAccess: new SupabasePlanAccessRepository(),
  categories: new SupabaseCategoryRepository(),
  products: new SupabaseProductRepository(),
  orders: new SupabaseOrderRepository(),
  payments: new SupabasePaymentRepository(),
  serviceRequests: new SupabaseServiceRequestRepository(),
  staff: new SupabaseStaffRepository(),
  plans: new SupabasePlanRepository(),
  subscriptions: new SupabaseSubscriptionRepository(),
  menuCustomizations: new SupabaseMenuCustomizationRepository(),
  auditLogs: new SupabaseAuditLogRepository(),
  platformConfig: new SupabasePlatformConfigRepository(),
  notifications: new SupabaseNotificationRepository(),
  publicMenu: new SupabasePublicMenuRepository(),
  media: new SupabaseMediaRepository(),
  establishments: new SupabaseEstablishmentRepository()
}
