import { mockStorage } from './mockStorage'
import type {
  ICompanyRepository,
  IRestaurantRepository,
  IUserRepository,
  ITableRepository,
  ICategoryRepository,
  IProductRepository,
  IOrderRepository,
  IDigitalAccessRepository,
  IPaymentRepository,
  IServiceRequestRepository,
  IStaffRepository,
  ISubscriptionRepository
} from '../interfaces'
import type {
  Company,
  Restaurant,
  User,
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
  ServiceRequestStatus
} from '@/types'

export class MockCompanyRepository implements ICompanyRepository {
  async getAll(): Promise<Company[]> {
    return [...mockStorage.getDb().companies]
  }

  async getById(id: string): Promise<Company | null> {
    const item = mockStorage.getDb().companies.find(c => c.id === id)
    return item ? { ...item } : null
  }

  async create(company: Omit<Company, 'id' | 'createdAt'>): Promise<Company> {
    const newCompany: Company = {
      ...company,
      id: `tenant-${Date.now()}`,
      createdAt: new Date().toISOString()
    }
    mockStorage.getDb().companies.push(newCompany)
    mockStorage.commit()
    return newCompany
  }

  async update(id: string, updates: Partial<Company>): Promise<Company> {
    const db = mockStorage.getDb()
    const index = db.companies.findIndex(c => c.id === id)
    if (index === -1) throw new Error(`Empresa com id ${id} não encontrada`)
    db.companies[index] = { ...db.companies[index], ...updates }
    mockStorage.commit()
    return { ...db.companies[index] }
  }
}

export class MockRestaurantRepository implements IRestaurantRepository {
  async getByTenant(tenantId: string): Promise<Restaurant[]> {
    return mockStorage.getDb().restaurants.filter(r => r.tenantId === tenantId)
  }

  async getById(id: string): Promise<Restaurant | null> {
    const item = mockStorage.getDb().restaurants.find(r => r.id === id)
    return item ? { ...item } : null
  }

  async getBySlug(slug: string): Promise<Restaurant | null> {
    const item = mockStorage.getDb().restaurants.find(r => r.slug === slug)
    return item ? { ...item } : null
  }

  async getAll(): Promise<Restaurant[]> {
    return [...mockStorage.getDb().restaurants]
  }

  async create(restaurant: Omit<Restaurant, 'id' | 'createdAt'>): Promise<Restaurant> {
    const newRest: Restaurant = {
      ...restaurant,
      id: `rest-${Date.now()}`,
      createdAt: new Date().toISOString()
    }
    mockStorage.getDb().restaurants.push(newRest)
    mockStorage.commit()
    return newRest
  }

  async update(id: string, updates: Partial<Restaurant>): Promise<Restaurant> {
    const db = mockStorage.getDb()
    const index = db.restaurants.findIndex(r => r.id === id)
    if (index === -1) throw new Error(`Restaurante com id ${id} não encontrado`)
    db.restaurants[index] = { ...db.restaurants[index], ...updates }
    mockStorage.commit()
    return { ...db.restaurants[index] }
  }
}

export class MockUserRepository implements IUserRepository {
  async getAll(): Promise<User[]> {
    return [...mockStorage.getDb().users]
  }

  async getById(id: string): Promise<User | null> {
    const item = mockStorage.getDb().users.find(u => u.id === id)
    return item ? { ...item } : null
  }

  async getByEmail(email: string): Promise<User | null> {
    const item = mockStorage.getDb().users.find(u => u.email.toLowerCase() === email.toLowerCase())
    return item ? { ...item } : null
  }

  async getByTenant(tenantId: string): Promise<User[]> {
    return mockStorage.getDb().users.filter(u => u.tenantId === tenantId)
  }
}

export class MockTableRepository implements ITableRepository {
  async getByRestaurant(restaurantId: string): Promise<Table[]> {
    return mockStorage.getDb().tables.filter(t => t.restaurantId === restaurantId)
  }

  async getById(id: string): Promise<Table | null> {
    const item = mockStorage.getDb().tables.find(t => t.id === id)
    return item ? { ...item } : null
  }

  async getByNumber(restaurantId: string, number: string): Promise<Table | null> {
    const item = mockStorage.getDb().tables.find(t => t.restaurantId === restaurantId && t.number === number)
    return item ? { ...item } : null
  }

  async create(table: Omit<Table, 'id'>): Promise<Table> {
    const newTable: Table = {
      ...table,
      id: `tbl-${Date.now()}`
    }
    mockStorage.getDb().tables.push(newTable)
    mockStorage.commit()
    return newTable
  }

  async update(id: string, updates: Partial<Table>): Promise<Table> {
    const db = mockStorage.getDb()
    const index = db.tables.findIndex(t => t.id === id)
    if (index === -1) throw new Error(`Mesa com id ${id} não encontrada`)
    db.tables[index] = { ...db.tables[index], ...updates }
    mockStorage.commit()
    return { ...db.tables[index] }
  }

  async delete(id: string): Promise<boolean> {
    const db = mockStorage.getDb()
    const index = db.tables.findIndex(t => t.id === id)
    if (index === -1) return false
    db.tables.splice(index, 1)
    mockStorage.commit()
    return true
  }
}

export class MockCategoryRepository implements ICategoryRepository {
  async getByRestaurant(restaurantId: string): Promise<Category[]> {
    return mockStorage.getDb().categories
      .filter(c => c.restaurantId === restaurantId)
      .sort((a, b) => a.sortOrder - b.sortOrder)
  }

  async create(category: Omit<Category, 'id'>): Promise<Category> {
    const newCat: Category = {
      ...category,
      id: `cat-${Date.now()}`
    }
    mockStorage.getDb().categories.push(newCat)
    mockStorage.commit()
    return newCat
  }

  async update(id: string, updates: Partial<Category>): Promise<Category> {
    const db = mockStorage.getDb()
    const index = db.categories.findIndex(c => c.id === id)
    if (index === -1) throw new Error(`Categoria ${id} não encontrada`)
    db.categories[index] = { ...db.categories[index], ...updates }
    mockStorage.commit()
    return { ...db.categories[index] }
  }

  async delete(id: string): Promise<boolean> {
    const db = mockStorage.getDb()
    const index = db.categories.findIndex(c => c.id === id)
    if (index === -1) return false
    db.categories.splice(index, 1)
    mockStorage.commit()
    return true
  }
}

export class MockProductRepository implements IProductRepository {
  async getByRestaurant(restaurantId: string): Promise<Product[]> {
    return mockStorage.getDb().products
      .filter(p => p.restaurantId === restaurantId)
      .sort((a, b) => a.sortOrder - b.sortOrder)
  }

  async getById(id: string): Promise<Product | null> {
    const item = mockStorage.getDb().products.find(p => p.id === id)
    return item ? { ...item } : null
  }

  async create(product: Omit<Product, 'id'>): Promise<Product> {
    const newProd: Product = {
      ...product,
      id: `prod-${Date.now()}`
    }
    mockStorage.getDb().products.push(newProd)
    mockStorage.commit()
    return newProd
  }

  async update(id: string, updates: Partial<Product>): Promise<Product> {
    const db = mockStorage.getDb()
    const index = db.products.findIndex(p => p.id === id)
    if (index === -1) throw new Error(`Produto ${id} não encontrado`)
    db.products[index] = { ...db.products[index], ...updates }
    mockStorage.commit()
    return { ...db.products[index] }
  }

  async delete(id: string): Promise<boolean> {
    const db = mockStorage.getDb()
    const index = db.products.findIndex(p => p.id === id)
    if (index === -1) return false
    db.products.splice(index, 1)
    mockStorage.commit()
    return true
  }
}

export class MockOrderRepository implements IOrderRepository {
  async getByRestaurant(restaurantId: string): Promise<Order[]> {
    return mockStorage.getDb().orders
      .filter(o => o.restaurantId === restaurantId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }

  async getById(id: string): Promise<Order | null> {
    const item = mockStorage.getDb().orders.find(o => o.id === id)
    return item ? { ...item } : null
  }

  async create(orderData: Omit<Order, 'id' | 'orderCode' | 'createdAt' | 'updatedAt' | 'history'>): Promise<Order> {
    const orderNumber = Math.floor(100 + Math.random() * 900)
    const now = new Date().toISOString()
    const newOrder: Order = {
      ...orderData,
      id: `ord-${Date.now()}`,
      orderCode: `#ORD-${orderNumber}`,
      createdAt: now,
      updatedAt: now,
      history: [
        {
          status: orderData.status,
          timestamp: now,
          updatedBy: orderData.customerName || 'Cliente'
        }
      ]
    }
    mockStorage.getDb().orders.unshift(newOrder)

    // Update table status if tableId exists
    if (newOrder.tableId) {
      const table = mockStorage.getDb().tables.find(t => t.id === newOrder.tableId)
      if (table) {
        table.status = 'has_order'
        table.activeOrderId = newOrder.id
        table.lastActivityAt = now
      }
    }

    mockStorage.commit()
    return newOrder
  }

  async updateStatus(id: string, status: OrderStatus, updatedBy: string, note?: string): Promise<Order> {
    const db = mockStorage.getDb()
    const order = db.orders.find(o => o.id === id)
    if (!order) throw new Error(`Pedido ${id} não encontrado`)

    const now = new Date().toISOString()
    order.status = status
    order.updatedAt = now
    order.history.push({
      status,
      timestamp: now,
      updatedBy,
      note
    })

    // If delivered or cancelled, check table
    if (status === 'delivered' || status === 'cancelled') {
      if (order.tableId) {
        const table = db.tables.find(t => t.id === order.tableId)
        if (table && table.activeOrderId === order.id) {
          if (status === 'cancelled') {
            table.status = 'free'
            table.activeOrderId = undefined
          } else if (order.paymentStatus === 'paid') {
            table.status = 'free'
            table.activeOrderId = undefined
          }
        }
      }
    }

    mockStorage.commit()
    return { ...order }
  }

  async updatePaymentStatus(id: string, paymentStatus: PaymentStatus): Promise<Order> {
    const db = mockStorage.getDb()
    const order = db.orders.find(o => o.id === id)
    if (!order) throw new Error(`Pedido ${id} não encontrado`)

    order.paymentStatus = paymentStatus
    order.updatedAt = new Date().toISOString()

    if (paymentStatus === 'paid' && order.status === 'delivered' && order.tableId) {
      const table = db.tables.find(t => t.id === order.tableId)
      if (table && table.activeOrderId === order.id) {
        table.status = 'free'
        table.activeOrderId = undefined
      }
    }

    mockStorage.commit()
    return { ...order }
  }
}

export class MockDigitalAccessRepository implements IDigitalAccessRepository {
  async getByRestaurant(restaurantId: string): Promise<DigitalAccess[]> {
    return mockStorage.getDb().digitalAccessList.filter(d => d.restaurantId === restaurantId)
  }

  async getById(id: string): Promise<DigitalAccess | null> {
    const item = mockStorage.getDb().digitalAccessList.find(d => d.id === id)
    return item ? { ...item } : null
  }

  async create(access: Omit<DigitalAccess, 'id' | 'createdAt' | 'updatedAt'>): Promise<DigitalAccess> {
    const now = new Date().toISOString()
    const newAccess: DigitalAccess = {
      ...access,
      id: `da-${Date.now()}`,
      createdAt: now,
      updatedAt: now
    }
    mockStorage.getDb().digitalAccessList.push(newAccess)
    mockStorage.commit()
    return newAccess
  }

  async update(id: string, updates: Partial<DigitalAccess>): Promise<DigitalAccess> {
    const db = mockStorage.getDb()
    const index = db.digitalAccessList.findIndex(d => d.id === id)
    if (index === -1) throw new Error(`Acesso digital ${id} não encontrado`)
    db.digitalAccessList[index] = {
      ...db.digitalAccessList[index],
      ...updates,
      updatedAt: new Date().toISOString()
    }
    mockStorage.commit()
    return { ...db.digitalAccessList[index] }
  }

  async recordScan(id: string): Promise<void> {
    const db = mockStorage.getDb()
    const item = db.digitalAccessList.find(d => d.id === id)
    if (item) {
      item.scanCount = (item.scanCount || 0) + 1
      item.lastScannedAt = new Date().toISOString()
      mockStorage.commit()
    }
  }
}

export class MockPaymentRepository implements IPaymentRepository {
  async getByRestaurant(restaurantId: string): Promise<Payment[]> {
    return mockStorage.getDb().payments
      .filter(p => p.restaurantId === restaurantId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }

  async getById(id: string): Promise<Payment | null> {
    const item = mockStorage.getDb().payments.find(p => p.id === id)
    return item ? { ...item } : null
  }

  async create(payment: Omit<Payment, 'id' | 'createdAt'>): Promise<Payment> {
    const newPayment: Payment = {
      ...payment,
      id: `pay-${Date.now()}`,
      createdAt: new Date().toISOString()
    }
    mockStorage.getDb().payments.unshift(newPayment)
    mockStorage.commit()
    return newPayment
  }

  async updateStatus(id: string, status: PaymentStatus): Promise<Payment> {
    const db = mockStorage.getDb()
    const payment = db.payments.find(p => p.id === id)
    if (!payment) throw new Error(`Pagamento ${id} não encontrado`)
    payment.status = status
    mockStorage.commit()
    return { ...payment }
  }
}

export class MockServiceRequestRepository implements IServiceRequestRepository {
  async getByRestaurant(restaurantId: string): Promise<ServiceRequest[]> {
    return mockStorage.getDb().serviceRequests
      .filter(s => s.restaurantId === restaurantId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }

  async create(req: Omit<ServiceRequest, 'id' | 'createdAt'>): Promise<ServiceRequest> {
    const newReq: ServiceRequest = {
      ...req,
      id: `req-${Date.now()}`,
      createdAt: new Date().toISOString()
    }
    mockStorage.getDb().serviceRequests.unshift(newReq)

    // Update table status
    const table = mockStorage.getDb().tables.find(t => t.id === req.tableId)
    if (table) {
      if (req.type === 'bill') {
        table.status = 'waiting_bill'
      } else {
        table.status = 'waiting_service'
      }
      table.lastActivityAt = new Date().toISOString()
    }

    mockStorage.commit()
    return newReq
  }

  async updateStatus(id: string, status: ServiceRequestStatus, assignedToUserId?: string, assignedToName?: string): Promise<ServiceRequest> {
    const db = mockStorage.getDb()
    const req = db.serviceRequests.find(s => s.id === id)
    if (!req) throw new Error(`Solicitação ${id} não encontrada`)

    req.status = status
    if (assignedToUserId) req.assignedToUserId = assignedToUserId
    if (assignedToName) req.assignedToName = assignedToName
    if (status === 'completed' || status === 'cancelled') {
      req.resolvedAt = new Date().toISOString()

      // Reset table status if no pending orders
      const table = db.tables.find(t => t.id === req.tableId)
      if (table && (table.status === 'waiting_service' || table.status === 'waiting_bill')) {
        table.status = table.activeOrderId ? 'has_order' : 'occupied'
      }
    }

    mockStorage.commit()
    return { ...req }
  }
}

export class MockStaffRepository implements IStaffRepository {
  async getByTenant(tenantId: string): Promise<StaffMember[]> {
    return mockStorage.getDb().staff.filter(s => s.tenantId === tenantId)
  }

  async getByRestaurant(restaurantId: string): Promise<StaffMember[]> {
    return mockStorage.getDb().staff.filter(s => s.assignedRestaurantIds.includes(restaurantId))
  }

  async create(staff: Omit<StaffMember, 'id'>): Promise<StaffMember> {
    const newStaff: StaffMember = {
      ...staff,
      id: `staff-${Date.now()}`
    }
    mockStorage.getDb().staff.push(newStaff)
    mockStorage.commit()
    return newStaff
  }

  async update(id: string, updates: Partial<StaffMember>): Promise<StaffMember> {
    const db = mockStorage.getDb()
    const index = db.staff.findIndex(s => s.id === id)
    if (index === -1) throw new Error(`Funcionário ${id} não encontrado`)
    db.staff[index] = { ...db.staff[index], ...updates }
    mockStorage.commit()
    return { ...db.staff[index] }
  }

  async delete(id: string): Promise<boolean> {
    const db = mockStorage.getDb()
    const index = db.staff.findIndex(s => s.id === id)
    if (index === -1) return false
    db.staff.splice(index, 1)
    mockStorage.commit()
    return true
  }
}

export class MockSubscriptionRepository implements ISubscriptionRepository {
  async getAllPlans(): Promise<Plan[]> {
    return [...mockStorage.getDb().plans]
  }

  async getAllSubscriptions(): Promise<Subscription[]> {
    return [...mockStorage.getDb().subscriptions]
  }

  async getByTenant(tenantId: string): Promise<Subscription | null> {
    const item = mockStorage.getDb().subscriptions.find(s => s.tenantId === tenantId)
    return item ? { ...item } : null
  }

  async updateSubscription(id: string, updates: Partial<Subscription>): Promise<Subscription> {
    const db = mockStorage.getDb()
    const index = db.subscriptions.findIndex(s => s.id === id)
    if (index === -1) throw new Error(`Subscrição ${id} não encontrada`)
    db.subscriptions[index] = { ...db.subscriptions[index], ...updates }
    mockStorage.commit()
    return { ...db.subscriptions[index] }
  }
}
