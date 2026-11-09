/**
 * Registo único de repositórios.
 *
 * Hoje todos usam a implementação mock (localStorage). Para ligar a uma API,
 * criar implementações `Api*Repository` com as mesmas interfaces
 * (ver ./interfaces.ts) e trocá-las aqui — serviços, stores e páginas não
 * precisam de mudar.
 */
import {
  MockCompanyRepository,
  MockRestaurantRepository,
  MockUserRepository,
  MockTableRepository,
  MockTableSessionRepository,
  MockNfcTagRepository,
  MockCategoryRepository,
  MockProductRepository,
  MockOrderRepository,
  MockPaymentRepository,
  MockServiceRequestRepository,
  MockStaffRepository,
  MockPlanRepository,
  MockSubscriptionRepository,
  MockMenuCustomizationRepository,
  MockAuditLogRepository,
  MockPlatformConfigRepository,
  MockNotificationRepository
} from './mock'
import type {
  ICompanyRepository,
  IRestaurantRepository,
  IUserRepository,
  ITableRepository,
  ITableSessionRepository,
  INfcTagRepository,
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
} from './interfaces'

export interface RepositoryRegistry {
  companies: ICompanyRepository
  restaurants: IRestaurantRepository
  users: IUserRepository
  tables: ITableRepository
  tableSessions: ITableSessionRepository
  nfcTags: INfcTagRepository
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
}

export const repositories: RepositoryRegistry = {
  companies: new MockCompanyRepository(),
  restaurants: new MockRestaurantRepository(),
  users: new MockUserRepository(),
  tables: new MockTableRepository(),
  tableSessions: new MockTableSessionRepository(),
  nfcTags: new MockNfcTagRepository(),
  categories: new MockCategoryRepository(),
  products: new MockProductRepository(),
  orders: new MockOrderRepository(),
  payments: new MockPaymentRepository(),
  serviceRequests: new MockServiceRequestRepository(),
  staff: new MockStaffRepository(),
  plans: new MockPlanRepository(),
  subscriptions: new MockSubscriptionRepository(),
  menuCustomizations: new MockMenuCustomizationRepository(),
  auditLogs: new MockAuditLogRepository(),
  platformConfig: new MockPlatformConfigRepository(),
  notifications: new MockNotificationRepository()
}
