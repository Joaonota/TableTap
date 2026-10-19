import {
  MockCompanyRepository,
  MockRestaurantRepository,
  MockUserRepository,
  MockTableRepository,
  MockCategoryRepository,
  MockProductRepository,
  MockOrderRepository,
  MockDigitalAccessRepository,
  MockPaymentRepository,
  MockServiceRequestRepository,
  MockStaffRepository,
  MockSubscriptionRepository
} from '@/repositories/mock'
import { mockStorage } from '@/repositories/mock/mockStorage'
import type {
  User,
  Company,
  Restaurant,
  Table,
  Category,
  Product,
  Order,
  Payment,
  ServiceRequest,
  StaffMember,
  Plan,
  Subscription,
  DigitalAccess,
  OrderStatus,
  PaymentStatus,
  ServiceRequestStatus,
  DashboardMetrics
} from '@/types'

// Repositories instances
const companyRepo = new MockCompanyRepository()
const restaurantRepo = new MockRestaurantRepository()
const userRepo = new MockUserRepository()
const tableRepo = new MockTableRepository()
const categoryRepo = new MockCategoryRepository()
const productRepo = new MockProductRepository()
const orderRepo = new MockOrderRepository()
const digitalAccessRepo = new MockDigitalAccessRepository()
const paymentRepo = new MockPaymentRepository()
const serviceRequestRepo = new MockServiceRequestRepository()
const staffRepo = new MockStaffRepository()
const subscriptionRepo = new MockSubscriptionRepository()

// ================= AuthService =================
export const authService = {
  async getDemoUsers(): Promise<User[]> {
    return userRepo.getAll()
  },
  async loginAs(userId: string): Promise<User> {
    const user = await userRepo.getById(userId)
    if (!user) throw new Error('Utilizador não encontrado')
    localStorage.setItem('tapmenu_active_user_id', user.id)
    return user
  },
  async getCurrentUser(): Promise<User | null> {
    const savedId = localStorage.getItem('tapmenu_active_user_id')
    if (savedId) {
      const user = await userRepo.getById(savedId)
      if (user) return user
    }
    // Default to restaurant_admin (Rui Mondlane) if not chosen
    const defaultUser = await userRepo.getById('user-admin-1')
    return defaultUser || null
  },
  async logout(): Promise<void> {
    localStorage.removeItem('tapmenu_active_user_id')
  }
}

// ================= Tenant & Restaurant Services =================
export const tenantService = {
  async getAllCompanies(): Promise<Company[]> {
    return companyRepo.getAll()
  },
  async getCompanyById(id: string): Promise<Company | null> {
    return companyRepo.getById(id)
  },
  async createCompany(data: Omit<Company, 'id' | 'createdAt'>): Promise<Company> {
    return companyRepo.create(data)
  },
  async updateCompany(id: string, updates: Partial<Company>): Promise<Company> {
    return companyRepo.update(id, updates)
  }
}

export const restaurantService = {
  async getRestaurantsByTenant(tenantId: string): Promise<Restaurant[]> {
    return restaurantRepo.getByTenant(tenantId)
  },
  async getRestaurantById(id: string): Promise<Restaurant | null> {
    return restaurantRepo.getById(id)
  },
  async getRestaurantBySlug(slug: string): Promise<Restaurant | null> {
    return restaurantRepo.getBySlug(slug)
  },
  async getAllRestaurants(): Promise<Restaurant[]> {
    return restaurantRepo.getAll()
  },
  async createRestaurant(data: Omit<Restaurant, 'id' | 'createdAt'>): Promise<Restaurant> {
    return restaurantRepo.create(data)
  },
  async updateRestaurant(id: string, updates: Partial<Restaurant>): Promise<Restaurant> {
    return restaurantRepo.update(id, updates)
  }
}

// ================= Catalog (Product & Category) Services =================
export const categoryService = {
  async getCategories(restaurantId: string): Promise<Category[]> {
    return categoryRepo.getByRestaurant(restaurantId)
  },
  async createCategory(data: Omit<Category, 'id'>): Promise<Category> {
    return categoryRepo.create(data)
  },
  async updateCategory(id: string, updates: Partial<Category>): Promise<Category> {
    return categoryRepo.update(id, updates)
  },
  async deleteCategory(id: string): Promise<boolean> {
    return categoryRepo.delete(id)
  }
}

export const productService = {
  async getProducts(restaurantId: string): Promise<Product[]> {
    return productRepo.getByRestaurant(restaurantId)
  },
  async getProductById(id: string): Promise<Product | null> {
    return productRepo.getById(id)
  },
  async createProduct(data: Omit<Product, 'id'>): Promise<Product> {
    return productRepo.create(data)
  },
  async updateProduct(id: string, updates: Partial<Product>): Promise<Product> {
    return productRepo.update(id, updates)
  },
  async deleteProduct(id: string): Promise<boolean> {
    return productRepo.delete(id)
  }
}

// ================= Table & Digital Access Services =================
export const tableService = {
  async getTables(restaurantId: string): Promise<Table[]> {
    return tableRepo.getByRestaurant(restaurantId)
  },
  async getTableById(id: string): Promise<Table | null> {
    return tableRepo.getById(id)
  },
  async getTableByNumber(restaurantId: string, number: string): Promise<Table | null> {
    return tableRepo.getByNumber(restaurantId, number)
  },
  async createTable(data: Omit<Table, 'id'>): Promise<Table> {
    return tableRepo.create(data)
  },
  async updateTable(id: string, updates: Partial<Table>): Promise<Table> {
    return tableRepo.update(id, updates)
  },
  async deleteTable(id: string): Promise<boolean> {
    return tableRepo.delete(id)
  }
}

export const digitalAccessService = {
  async getAccessList(restaurantId: string): Promise<DigitalAccess[]> {
    return digitalAccessRepo.getByRestaurant(restaurantId)
  },
  async getAccessById(id: string): Promise<DigitalAccess | null> {
    return digitalAccessRepo.getById(id)
  },
  async createAccess(data: Omit<DigitalAccess, 'id' | 'createdAt' | 'updatedAt'>): Promise<DigitalAccess> {
    return digitalAccessRepo.create(data)
  },
  async updateAccess(id: string, updates: Partial<DigitalAccess>): Promise<DigitalAccess> {
    return digitalAccessRepo.update(id, updates)
  },
  async recordScan(id: string): Promise<void> {
    return digitalAccessRepo.recordScan(id)
  }
}

// ================= Orders & Kitchen (KDS) Services =================
export const orderService = {
  async getOrders(restaurantId: string): Promise<Order[]> {
    return orderRepo.getByRestaurant(restaurantId)
  },
  async getOrderById(id: string): Promise<Order | null> {
    return orderRepo.getById(id)
  },
  async createOrder(data: Omit<Order, 'id' | 'orderCode' | 'createdAt' | 'updatedAt' | 'history'>): Promise<Order> {
    return orderRepo.create(data)
  },
  async updateOrderStatus(id: string, status: OrderStatus, updatedBy: string, note?: string): Promise<Order> {
    return orderRepo.updateStatus(id, status, updatedBy, note)
  },
  async updatePaymentStatus(id: string, paymentStatus: PaymentStatus): Promise<Order> {
    return orderRepo.updatePaymentStatus(id, paymentStatus)
  }
}

// ================= Payments Service =================
export const paymentService = {
  async getPayments(restaurantId: string): Promise<Payment[]> {
    return paymentRepo.getByRestaurant(restaurantId)
  },
  async getPaymentById(id: string): Promise<Payment | null> {
    return paymentRepo.getById(id)
  },
  async createPayment(data: Omit<Payment, 'id' | 'createdAt'>): Promise<Payment> {
    return paymentRepo.create(data)
  },
  async updateStatus(id: string, status: PaymentStatus): Promise<Payment> {
    return paymentRepo.updateStatus(id, status)
  }
}

// ================= Service Requests (Atendimento Digital) =================
export const serviceRequestService = {
  async getRequests(restaurantId: string): Promise<ServiceRequest[]> {
    return serviceRequestRepo.getByRestaurant(restaurantId)
  },
  async createRequest(data: Omit<ServiceRequest, 'id' | 'createdAt'>): Promise<ServiceRequest> {
    return serviceRequestRepo.create(data)
  },
  async updateStatus(id: string, status: ServiceRequestStatus, assignedToUserId?: string, assignedToName?: string): Promise<ServiceRequest> {
    return serviceRequestRepo.updateStatus(id, status, assignedToUserId, assignedToName)
  }
}

// ================= Staff Service =================
export const staffService = {
  async getStaffByTenant(tenantId: string): Promise<StaffMember[]> {
    return staffRepo.getByTenant(tenantId)
  },
  async getStaffByRestaurant(restaurantId: string): Promise<StaffMember[]> {
    return staffRepo.getByRestaurant(restaurantId)
  },
  async createStaff(data: Omit<StaffMember, 'id'>): Promise<StaffMember> {
    return staffRepo.create(data)
  },
  async updateStaff(id: string, updates: Partial<StaffMember>): Promise<StaffMember> {
    return staffRepo.update(id, updates)
  },
  async deleteStaff(id: string): Promise<boolean> {
    return staffRepo.delete(id)
  }
}

// ================= Subscriptions & Plans (SaaS) =================
export const subscriptionService = {
  async getAllPlans(): Promise<Plan[]> {
    return subscriptionRepo.getAllPlans()
  },
  async getAllSubscriptions(): Promise<Subscription[]> {
    return subscriptionRepo.getAllSubscriptions()
  },
  async getByTenant(tenantId: string): Promise<Subscription | null> {
    return subscriptionRepo.getByTenant(tenantId)
  },
  async updateSubscription(id: string, updates: Partial<Subscription>): Promise<Subscription> {
    return subscriptionRepo.updateSubscription(id, updates)
  }
}

// ================= Report & Metrics Service =================
export const reportService = {
  async getDashboardMetrics(restaurantId: string): Promise<DashboardMetrics> {
    const orders = await orderRepo.getByRestaurant(restaurantId)
    const tables = await tableRepo.getByRestaurant(restaurantId)
    const requests = await serviceRequestRepo.getByRestaurant(restaurantId)
    const products = await productRepo.getByRestaurant(restaurantId)

    const validOrders = orders.filter(o => o.status !== 'cancelled')
    const totalRevenue = validOrders.reduce((sum, o) => sum + o.total, 0)
    const averageTicket = validOrders.length > 0 ? totalRevenue / validOrders.length : 0

    const occupiedTables = tables.filter(t => t.status === 'occupied' || t.status === 'has_order').length
    const availableTables = tables.filter(t => t.status === 'free').length

    const pendingOrders = orders.filter(o => o.status === 'received' || o.status === 'confirmed').length
    const preparingOrders = orders.filter(o => o.status === 'preparing').length
    const readyOrders = orders.filter(o => o.status === 'ready').length

    const activeServiceRequests = requests.filter(r => r.status === 'new' || r.status === 'in_progress').length
    const unavailableProductsCount = products.filter(p => !p.isAvailable).length

    return {
      totalOrders: orders.length,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      averageTicket: Math.round(averageTicket * 100) / 100,
      occupiedTables,
      availableTables,
      pendingOrders,
      preparingOrders,
      readyOrders,
      activeServiceRequests,
      unavailableProductsCount
    }
  },

  async getSalesByDay(restaurantId: string): Promise<{ label: string; amount: number; orderCount: number }[]> {
    const orders = await orderRepo.getByRestaurant(restaurantId)
    // Group last 7 days
    const days: { [key: string]: { amount: number; count: number } } = {
      'Segunda': { amount: 8400, count: 6 },
      'Terça': { amount: 11200, count: 9 },
      'Quarta': { amount: 14500, count: 11 },
      'Quinta': { amount: 18900, count: 14 },
      'Sexta': { amount: 28400, count: 22 },
      'Sábado': { amount: 34500, count: 26 },
      'Hoje': { amount: 0, count: 0 }
    }

    // Add today orders
    const todayOrders = orders.filter(o => o.status !== 'cancelled')
    const todaySum = todayOrders.reduce((sum, o) => sum + o.total, 0)
    days['Hoje'] = { amount: Math.round(todaySum), count: todayOrders.length }

    return Object.entries(days).map(([label, val]) => ({
      label,
      amount: val.amount,
      orderCount: val.count
    }))
  },

  async getTopProducts(restaurantId: string): Promise<{ name: string; quantity: number; revenue: number }[]> {
    const orders = await orderRepo.getByRestaurant(restaurantId)
    const map = new Map<string, { quantity: number; revenue: number }>()

    orders.filter(o => o.status !== 'cancelled').forEach(order => {
      order.items.forEach(item => {
        const cur = map.get(item.productName) || { quantity: 0, revenue: 0 }
        cur.quantity += item.quantity
        cur.revenue += item.totalPrice
        map.set(item.productName, cur)
      })
    })

    const list = Array.from(map.entries()).map(([name, data]) => ({
      name,
      quantity: data.quantity,
      revenue: Math.round(data.revenue)
    }))

    list.sort((a, b) => b.quantity - a.quantity)
    return list.slice(0, 5)
  }
}

// Reset Database Utility
export const resetDatabase = (): void => {
  mockStorage.reset()
}
