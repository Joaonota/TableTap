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
  initialNfcTags,
  initialNfcTagEvents,
  initialMenuCustomizations,
  initialPlatformAuditLogs,
  initialPlatformConfig
} from '@/mocks/initialData'
import { generateHistoricalReviews } from '@/mocks/historicalData'
import type { PlatformAuditLog } from '@/types'
import { sumOrderTotals } from '@/domain/tableRules'

const STORAGE_KEY = 'tapmenu_mock_database_v4'

/** Chaves de versões anteriores (inclui o antigo registo local de gravação Web NFC). */
const LEGACY_KEYS = ['tapmenu_mock_database_v3', 'tapmenu_nfc_registry_v2', 'tapmenu_nfc_tags_store_v1']

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value))

/** Totais das sessões derivados dos pedidos (fonte única: os pedidos). */
function recomputeSessionTotals(db: MockDatabase): void {
  for (const session of db.tableSessions) {
    const orders = db.orders.filter(o => session.orderIds.includes(o.id) || o.tableSessionId === session.id)
    session.total = sumOrderTotals(orders)
  }
}

function getInitialDatabase(): MockDatabase {
  const db: MockDatabase = {
    companies: clone(initialCompanies),
    restaurants: clone(initialRestaurants),
    users: clone(initialUsers),
    tables: clone(initialTables),
    tableSessions: clone(initialTableSessions),
    notifications: clone(initialNotifications),
    categories: clone(initialCategories),
    products: clone(initialProducts),
    orders: clone(initialOrders),
    payments: clone(initialPayments),
    serviceRequests: clone(initialServiceRequests),
    staff: clone(initialStaff),
    plans: clone(initialPlans),
    subscriptions: clone(initialSubscriptions),
    nfcTags: clone(initialNfcTags),
    nfcTagEvents: clone(initialNfcTagEvents),
    reviews: generateHistoricalReviews(),
    menuCustomizations: clone(initialMenuCustomizations),
    auditLogs: clone(initialPlatformAuditLogs),
    platformConfig: clone(initialPlatformConfig)
  }
  recomputeSessionTotals(db)
  return db
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
      LEGACY_KEYS.forEach(key => localStorage.removeItem(key))
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<MockDatabase>
        // Verificação mínima do esquema v4
        if (parsed.companies && parsed.restaurants && parsed.tables && parsed.tableSessions && parsed.nfcTags && parsed.nfcTagEvents && parsed.orders && parsed.plans) {
          return parsed as MockDatabase
        }
      }
    } catch (e) {
      console.warn('TapMenu: Erro ao ler a base mock do localStorage. A reiniciar com dados padrão.', e)
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

