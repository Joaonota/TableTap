// ==========================================
// TAPMENU TYPES & DATA CONTRACTS
// Multi-Tenant SaaS, Menus, Orders, Tables & KDS
// ==========================================

export type UserRole =
  | 'super_admin'
  | 'company_owner'
  | 'restaurant_admin'
  | 'manager'
  | 'receptionist'
  | 'waiter'
  | 'kitchen_staff'

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  avatarUrl?: string
  phone?: string
  tenantId?: string // undefined for super_admin
  assignedRestaurantIds: string[] // List of restaurant IDs user has access to
  isActive: boolean
  createdAt: string
}

export interface Company {
  id: string
  name: string
  legalName: string
  slug: string
  taxId: string // NUIT em MoÃƒÂ§ambique
  logoUrl?: string
  primaryColor?: string
  phone: string
  email: string
  planId: string
  subscriptionId: string
  isActive: boolean
  createdAt: string
}

export interface Restaurant {
  id: string
  tenantId: string
  name: string
  slug: string
  description: string
  coverImage: string
  logoUrl: string
  address: {
    street: string
    city: string
    province: string
    country: string
  }
  phone: string
  email: string
  currency: string // Default 'MT'
  timezone: string // 'Africa/Maputo'
  openingHours: string
  isActive: boolean
  taxRate: number // percentual ex: 16 (IVA)
  settings: {
    allowCustomerOrdering: boolean
    requireTableForOrder: boolean
    serviceFeePercent: number
    themeAccentColor: string
    enabledPaymentMethods: PaymentMethod[]
    googleReviewUrl?: string
    enableGoogleReviewInvite?: boolean
  }
  createdAt: string
}

export interface Table {
  id: string
  tenantId: string
  restaurantId: string
  number: string
  name?: string
  area: 'Sala Principal' | 'Esplanada' | 'Varanda' | 'Piso 1' | 'Bar' | 'Privado'
  capacity: number
  status: TableStatus
  publicUrl: string
  qrCodeUrl?: string
  nfcTagId?: string
  activeOrderId?: string
  activeSessionId?: string
  activeCustomerName?: string
  partySize?: number
  sessionStartedAt?: string
  lastActivityAt?: string
  isActive: boolean
}

export type TableSessionStatus =
  | 'active'
  | 'awaiting_bill'
  | 'closing'
  | 'closed'

export interface TableSession {
  id: string
  tenantId: string
  restaurantId: string
  tableId: string
  customerName: string
  partySize?: number
  status: TableSessionStatus
  startedAt: string
  closedAt?: string
  notes?: string
  orderIds: string[]
}

export type TableStatus =
  | 'free'
  | 'occupied'
  | 'has_order'
  | 'waiting_service'
  | 'waiting_bill'
  | 'unavailable'

export interface DigitalAccess {
  id: string
  tenantId: string
  restaurantId: string
  tableId: string
  tableNumber: string
  url: string
  qrCodeDataUrl?: string
  nfcTagUid?: string
  nfcStatus: 'unprogrammed' | 'programmed' | 'simulated'
  scanCount: number
  lastScannedAt?: string
  createdAt: string
  updatedAt: string
}

// ==========================================
// NFC REAL — re-export of src/types/nfc.ts
// (registry, timeline, capabilities, errors)
// ==========================================

export * from './nfc'

export interface Category {
  id: string
  tenantId: string
  restaurantId: string
  name: string
  description?: string
  imageUrl?: string
  sortOrder: number
  isActive: boolean
}

export interface ProductVariant {
  id: string
  name: string
  priceDelta: number // added to base price
}

export interface ProductAddon {
  id: string
  name: string
  price: number
  isDefault?: boolean
}

export interface Product {
  id: string
  tenantId: string
  restaurantId: string
  categoryId: string
  name: string
  description: string
  imageUrl: string
  price: number // em MT (Meticais)
  promotionalPrice?: number
  isAvailable: boolean
  isFeatured: boolean
  preparationTimeMinutes: number
  categoryName?: string
  station: 'kitchen' | 'bar'
  variants?: ProductVariant[]
  addons?: ProductAddon[]
  removableIngredients?: string[]
  allergens?: string[]
  sortOrder: number
  isActive: boolean
}

export type OrderStatus =
  | 'received'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'delivered'
  | 'cancelled'

export type PaymentStatus =
  | 'pending'
  | 'awaiting_confirmation'
  | 'paid'
  | 'failed'
  | 'refunded'

export type PaymentMethod = 'mpesa' | 'emola' | 'card' | 'cash'

export type OrderType = 'dine_in' | 'takeaway'

export interface OrderItem {
  id: string
  productId: string
  productName: string
  productImage?: string
  quantity: number
  unitPrice: number
  totalPrice: number
  selectedVariant?: {
    id: string
    name: string
    priceDelta: number
  }
  selectedAddons?: {
    id: string
    name: string
    price: number
  }[]
  removedIngredients?: string[]
  notes?: string
  station: 'kitchen' | 'bar'
}

export interface OrderStatusHistory {
  status: OrderStatus
  timestamp: string
  updatedBy: string
  note?: string
}

export interface Order {
  id: string
  tenantId: string
  restaurantId: string
  tableId?: string
  tableNumber?: string
  tableSessionId?: string
  isAdditional?: boolean
  orderCode: string // e.g. #ORD-1042
  type: OrderType
  status: OrderStatus
  paymentStatus: PaymentStatus
  paymentMethod?: PaymentMethod
  items: OrderItem[]
  subtotal: number
  taxAmount: number
  serviceFee: number
  total: number
  customerName?: string
  customerPhone?: string
  notes?: string
  history: OrderStatusHistory[]
  createdAt: string
  updatedAt: string
}

export interface Payment {
  id: string
  tenantId: string
  restaurantId: string
  orderId: string
  orderCode: string
  tableNumber?: string
  amount: number
  method: PaymentMethod
  status: PaymentStatus
  transactionReference: string
  customerPhone?: string // e.g. 84/85 para M-Pesa, 86/87 para e-Mola
  notes?: string
  createdAt: string
}

export type ServiceRequestType =
  | 'waiter_call'
  | 'water'
  | 'cutlery'
  | 'bill'
  | 'general_help'

export type ServiceRequestStatus =
  | 'new'
  | 'in_progress'
  | 'completed'
  | 'cancelled'

export interface ServiceRequest {
  id: string
  tenantId: string
  restaurantId: string
  tableId: string
  tableNumber: string
  tableSessionId?: string
  customerName?: string
  type: ServiceRequestType
  status: ServiceRequestStatus
  notes?: string
  assignedTo?: string
  assignedToUserId?: string
  assignedToName?: string
  createdAt: string
  resolvedAt?: string
}

export type NotificationType =
  | 'table_occupied'
  | 'new_order'
  | 'additional_order'
  | 'waiter_call'
  | 'bill_requested'
  | 'service_request'

export interface Notification {
  id: string
  tenantId: string
  restaurantId: string
  type: NotificationType
  title: string
  message: string
  tableId?: string
  tableNumber?: string
  tableSessionId?: string
  orderId?: string
  serviceRequestId?: string
  createdAt: string
  readAt?: string
}

export interface StaffMember {
  id: string
  tenantId: string
  name: string
  email: string
  phone: string
  role: UserRole
  assignedRestaurantIds: string[]
  avatarUrl?: string
  hireDate: string
  isActive: boolean
}

export interface Plan {
  id: string
  name: string
  priceMonthly: number // MT
  maxRestaurants: number
  maxStaff: number
  maxTables: number
  features: string[]
  isActive: boolean
}

export type SubscriptionStatus = 'trial' | 'active' | 'suspended' | 'expired'

export interface Subscription {
  id: string
  tenantId: string
  companyName: string
  planId: string
  planName: string
  status: SubscriptionStatus
  startDate: string
  renewalDate: string
  monthlyPrice: number
  isAutoRenew: boolean
}

export interface PlatformAuditLog {
  id: string
  tenantId?: string
  userId: string
  userName: string
  action: string
  resource: string
  details: string
  timestamp: string
}

export interface DashboardMetrics {
  totalOrders: number
  totalRevenue: number
  averageTicket: number
  occupiedTables: number
  availableTables: number
  pendingOrders: number
  preparingOrders: number
  readyOrders: number
  activeServiceRequests: number
  unavailableProductsCount: number
}

// NFC real module types (registry, timeline, capabilities, errors)
// ==========================================
// CUSTOMER EXPERIENCE & REVIEWS TYPES
// ==========================================

export type WaitTimeRating = 'very_fast' | 'adequate' | 'slow' | 'very_slow'
export type ReviewStatus = 'pending' | 'analyzed' | 'resolved'

export interface CustomerReview {
  id: string
  tenantId: string
  restaurantId: string
  restaurantName: string
  tableId: string
  tableNumber: string
  tableSessionId?: string
  orderId?: string
  customerName?: string
  customerPhone?: string
  overallRating: number // 1 to 5
  foodRating: number // 1 to 5
  serviceRating: number // 1 to 5
  ambienceRating: number // 1 to 5
  waitTimeRating: WaitTimeRating
  comment?: string
  status: ReviewStatus
  isNegativeAlert: boolean // overallRating <= 2
  managerNotes?: string
  correctiveAction?: string
  resolvedAt?: string
  resolvedBy?: string
  createdAt: string
}

// ==========================================
// BUSINESS INTELLIGENCE (BI) TYPES
// ==========================================

export type BiPeriodType =
  | 'today'
  | 'last7days'
  | 'last30days'
  | 'thisMonth'
  | 'lastMonth'
  | 'last90days'
  | 'custom'

export interface BiIndicator {
  label: string
  value: number
  formattedValue: string
  previousValue: number
  formattedPreviousValue: string
  percentageChange: number
  trend: 'up' | 'down' | 'neutral'
  isPositive: boolean
  description: string
}

export interface BiExecutiveSummary {
  revenue: BiIndicator
  orders: BiIndicator
  averageTicket: BiIndicator
  customersServed: BiIndicator
  productsSold: BiIndicator
  revenuePerTable: BiIndicator
  cancellationRate: BiIndicator
  confirmedVsPaidPercent: number
  totalPaidRevenue: number
}

export interface ProductPerformance {
  productId: string
  productName: string
  categoryName: string
  imageUrl?: string
  price: number
  quantitySold: number
  revenue: number
  percentageOfTotal: number
  previousQuantity: number
  previousRevenue: number
  trendPercent: number
  isUnderperforming?: boolean
  recommendation?: string
}

export interface HourlySalesData {
  hour: number // 0 to 23
  label: string // e.g. "12h"
  orderCount: number
  revenue: number
  periodTag: 'Pequeno-almoÃƒÂ§o' | 'AlmoÃƒÂ§o' | 'Tarde' | 'Jantar' | 'Noite'
  isPeak: boolean
}

export interface DayOfWeekSalesData {
  dayIndex: number
  dayName: string
  orderCount: number
  revenue: number
  averageTicket: number
  isBestDay: boolean
}

export interface TablePerformance {
  tableId: string
  tableNumber: string
  tableName?: string
  area: string
  capacity: number
  sessionCount: number
  orderCount: number
  totalRevenue: number
  averageTicket: number
  averageOccupancyMinutes: number
  revenuePerSession: number
}

export interface BranchComparisonData {
  restaurantId: string
  restaurantName: string
  city: string
  totalRevenue: number
  totalOrders: number
  averageTicket: number
  topProductName: string
  topProductRevenue: number
  averagePreparationMinutes: number
  cancellationRate: number
  averageRating: number
  positiveReviewPercent: number
  revenueGrowthPercent: number
  rank: number
}

export interface DemandForecastItem {
  date: string
  formattedDate: string
  dayName: string
  historicalAverageOrders: number
  predictedOrders: number
  predictedRevenue: number
  confidenceLevel: number
  topPredictedProducts: { name: string; quantity: number }[]
  peakPredictedHour: string
}

export interface SmartInsight {
  id: string
  title: string
  description: string
  indicatorSource: string
  periodAnalyzed: string
  category: 'opportunity' | 'attention' | 'positive'
  actionUrl?: string
}


