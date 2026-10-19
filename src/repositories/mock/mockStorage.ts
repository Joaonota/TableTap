import {
  type MockDatabase,
  initialCompanies,
  initialRestaurants,
  initialUsers,
  initialTables,
  initialCategories,
  initialProducts,
  initialOrders,
  initialPayments,
  initialServiceRequests,
  initialStaff,
  initialPlans,
  initialSubscriptions,
  initialDigitalAccessList
} from '@/mocks/initialData'

const STORAGE_KEY = 'tapmenu_mock_database_v1'

function getInitialDatabase(): MockDatabase {
  return {
    companies: JSON.parse(JSON.stringify(initialCompanies)),
    restaurants: JSON.parse(JSON.stringify(initialRestaurants)),
    users: JSON.parse(JSON.stringify(initialUsers)),
    tables: JSON.parse(JSON.stringify(initialTables)),
    categories: JSON.parse(JSON.stringify(initialCategories)),
    products: JSON.parse(JSON.stringify(initialProducts)),
    orders: JSON.parse(JSON.stringify(initialOrders)),
    payments: JSON.parse(JSON.stringify(initialPayments)),
    serviceRequests: JSON.parse(JSON.stringify(initialServiceRequests)),
    staff: JSON.parse(JSON.stringify(initialStaff)),
    plans: JSON.parse(JSON.stringify(initialPlans)),
    subscriptions: JSON.parse(JSON.stringify(initialSubscriptions)),
    digitalAccessList: JSON.parse(JSON.stringify(initialDigitalAccessList))
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
        if (parsed.companies && parsed.restaurants && parsed.products && parsed.orders) {
          return parsed as MockDatabase
        }
      }
    } catch (e) {
      console.warn('TapMenu: Erro ao ler mock database do localStorage. A reiniciar com dados padrão.', e)
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
}

export const mockStorage = MockStorageService.getInstance()
