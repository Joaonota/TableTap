import {
  type MockDatabase,
  initialCompanies,
  initialRestaurants,
  initialUsers,
  initialTables,
  initialTableSessions,
  initialNotifications,
  initialCategories,
  initialProducts,
  initialOrders,
  initialPayments,
  initialServiceRequests,
  initialStaff,
  initialPlans,
  initialSubscriptions,
  initialDigitalAccessList,
  initialMenuCustomizations,
  initialPlatformAuditLogs,
  initialPlatformConfig
} from '@/mocks/initialData'
import { generateHistoricalReviews } from '@/mocks/historicalData'
import type { MenuCustomization, PlatformAuditLog, PlatformConfig } from '@/types'

const STORAGE_KEY = 'tapmenu_mock_database_v3'

function getInitialDatabase(): MockDatabase {
  return {
    companies: JSON.parse(JSON.stringify(initialCompanies)),
    restaurants: JSON.parse(JSON.stringify(initialRestaurants)),
    users: JSON.parse(JSON.stringify(initialUsers)),
    tables: JSON.parse(JSON.stringify(initialTables)),
    tableSessions: JSON.parse(JSON.stringify(initialTableSessions)),
    notifications: JSON.parse(JSON.stringify(initialNotifications)),
    categories: JSON.parse(JSON.stringify(initialCategories)),
    products: JSON.parse(JSON.stringify(initialProducts)),
    orders: JSON.parse(JSON.stringify(initialOrders)),
    payments: JSON.parse(JSON.stringify(initialPayments)),
    serviceRequests: JSON.parse(JSON.stringify(initialServiceRequests)),
    staff: JSON.parse(JSON.stringify(initialStaff)),
    plans: JSON.parse(JSON.stringify(initialPlans)),
    subscriptions: JSON.parse(JSON.stringify(initialSubscriptions)),
    digitalAccessList: JSON.parse(JSON.stringify(initialDigitalAccessList)),
    reviews: generateHistoricalReviews(),
    menuCustomizations: JSON.parse(JSON.stringify(initialMenuCustomizations)),
    auditLogs: JSON.parse(JSON.stringify(initialPlatformAuditLogs)),
    platformConfig: JSON.parse(JSON.stringify(initialPlatformConfig))
  }
}

export class MockStorageService {
  private static instance: MockStorageService
  private db: MockDatabase

  private constructor() {
    this.db = this.loadFromStorage()
  }

  public static getInstance(): MockStorageService {
    if (!MockStorageService.instance) {
      MockStorageService.instance = new MockStorageService()
    }
    return MockStorageService.instance
  }

  private loadFromStorage(): MockDatabase {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        // Basic schema check
        if (parsed.companies && parsed.restaurants && parsed.products && parsed.orders && parsed.plans) {
          if (!parsed.tableSessions) {
            parsed.tableSessions = JSON.parse(JSON.stringify(initialTableSessions))
          }
          if (!parsed.notifications) {
            parsed.notifications = JSON.parse(JSON.stringify(initialNotifications))
          }
          if (!parsed.menuCustomizations) {
            parsed.menuCustomizations = JSON.parse(JSON.stringify(initialMenuCustomizations))
          }
          if (!parsed.auditLogs) {
            parsed.auditLogs = JSON.parse(JSON.stringify(initialPlatformAuditLogs))
          }
          if (!parsed.platformConfig) {
            parsed.platformConfig = JSON.parse(JSON.stringify(initialPlatformConfig))
          }
          return parsed as MockDatabase
        }
      }
    } catch (e) {
      console.warn('TapMenu: Erro ao ler mock database v3 do localStorage. A reiniciar com dados padrão.', e)
    }

    const initial = getInitialDatabase()
    this.saveToStorage(initial)
    return initial
  }

  private saveToStorage(db: MockDatabase): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(db))
    } catch (e) {
      console.error('TapMenu: Erro ao guardar no localStorage', e)
    }
  }

  public getDb(): MockDatabase {
    return this.db
  }

  public commit(): void {
    this.saveToStorage(this.db)
  }

  public reset(): void {
    this.db = getInitialDatabase()
    this.saveToStorage(this.db)
  }

  public addAuditLog(entry: Omit<PlatformAuditLog, 'id' | 'createdAt'>): PlatformAuditLog {
    const log: PlatformAuditLog = {
      ...entry,
      id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      createdAt: new Date().toISOString()
    }
    this.db.auditLogs.unshift(log)
    this.commit()
    return log
  }
}

export const mockStorage = MockStorageService.getInstance()

