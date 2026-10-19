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
  DigitalAccess
} from '@/types'

export interface MockDatabase {
  companies: Company[]
  restaurants: Restaurant[]
  users: User[]
  tables: Table[]
  categories: Category[]
  products: Product[]
  orders: Order[]
  payments: Payment[]
  serviceRequests: ServiceRequest[]
  staff: StaffMember[]
  plans: Plan[]
  subscriptions: Subscription[]
  digitalAccessList: DigitalAccess[]
}

export const initialCompanies: Company[] = [
  {
    id: 'tenant-1',
    name: 'Sabores de Moçambique Lda',
    legalName: 'Sabores de Moçambique, Sociedade Unipessoal Lda',
    slug: 'sabores-de-mocambique',
    taxId: '400192831',
    phone: '+258 84 100 2000',
    email: 'contacto@saboresmocambique.co.mz',
    planId: 'plan-pro',
    subscriptionId: 'sub-1',
    isActive: true,
    createdAt: '2024-01-15T08:00:00Z'
  },
  {
    id: 'tenant-2',
    name: 'Ocean Food Group',
    legalName: 'Ocean Food Group & Hospitality Lda',
    slug: 'ocean-food-group',
    taxId: '400889211',
    phone: '+258 84 222 3344',
    email: 'admin@oceanfood.co.mz',
    planId: 'plan-enterprise',
    subscriptionId: 'sub-2',
    isActive: true,
    createdAt: '2024-02-10T09:30:00Z'
  },
  {
    id: 'tenant-3',
    name: 'Urban Dining Lda',
    legalName: 'Urban Dining & Lounge Bar Lda',
    slug: 'urban-dining',
    taxId: '400554433',
    phone: '+258 82 999 8877',
    email: 'geral@urbandining.co.mz',
    planId: 'plan-starter',
    subscriptionId: 'sub-3',
    isActive: true,
    createdAt: '2024-03-01T11:00:00Z'
  }
]

export const initialRestaurants: Restaurant[] = [
  {
    id: 'rest-1',
    tenantId: 'tenant-1',
    name: 'Sabores Maputo',
    slug: 'sabores-maputo',
    description: 'Culinária tradicional moçambicana e grelhados contemporâneos no coração da Polana.',
    coverImage: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80',
    logoUrl: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=200&q=80',
    address: {
      street: 'Av. Julius Nyerere, nº 1420',
      city: 'Maputo',
      province: 'Maputo Cidade',
      country: 'Moçambique'
    },
    phone: '+258 84 311 9000',
    email: 'maputo@saboresmocambique.co.mz',
    currency: 'MT',
    timezone: 'Africa/Maputo',
    openingHours: 'Terça a Domingo: 11:30 - 23:00',
    isActive: true,
    taxRate: 16,
    settings: {
      allowCustomerOrdering: true,
      requireTableForOrder: true,
      serviceFeePercent: 10,
      themeAccentColor: '#1e40af',
      enabledPaymentMethods: ['mpesa', 'emola', 'card', 'cash']
    },
    createdAt: '2024-01-16T10:00:00Z'
  },
  {
    id: 'rest-2',
    tenantId: 'tenant-1',
    name: 'Sabores Matola',
    slug: 'sabores-matola',
    description: 'Ambiente familiar ao ar livre com pratos de marisco frescos e carnes de primeira.',
    coverImage: 'https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=1200&q=80',
    logoUrl: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=200&q=80',
    address: {
      street: 'Av. da Liberdade, nº 55',
      city: 'Matola',
      province: 'Maputo Província',
      country: 'Moçambique'
    },
    phone: '+258 84 311 9002',
    email: 'matola@saboresmocambique.co.mz',
    currency: 'MT',
    timezone: 'Africa/Maputo',
    openingHours: 'Quarta a Domingo: 12:00 - 22:30',
    isActive: true,
    taxRate: 16,
    settings: {
      allowCustomerOrdering: true,
      requireTableForOrder: true,
      serviceFeePercent: 5,
      themeAccentColor: '#059669',
      enabledPaymentMethods: ['mpesa', 'emola', 'card', 'cash']
    },
    createdAt: '2024-02-01T10:00:00Z'
  },
  {
    id: 'rest-3',
    tenantId: 'tenant-1',
    name: 'Sabores Beira',
    slug: 'sabores-beira',
    description: 'Especialidades costeiras da Beira em frente à praia do Macuti.',
    coverImage: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=1200&q=80',
    logoUrl: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=200&q=80',
    address: {
      street: 'Av. das F.P.L.M., Macuti',
      city: 'Beira',
      province: 'Sofala',
      country: 'Moçambique'
    },
    phone: '+258 84 311 9003',
    email: 'beira@saboresmocambique.co.mz',
    currency: 'MT',
    timezone: 'Africa/Maputo',
    openingHours: 'Todos os dias: 11:00 - 23:00',
    isActive: true,
    taxRate: 16,
    settings: {
      allowCustomerOrdering: true,
      requireTableForOrder: true,
      serviceFeePercent: 10,
      themeAccentColor: '#2563eb',
      enabledPaymentMethods: ['mpesa', 'emola', 'card', 'cash']
    },
    createdAt: '2024-03-10T10:00:00Z'
  },
  {
    id: 'rest-4',
    tenantId: 'tenant-2',
    name: 'Ocean Restaurant & Lounge',
    slug: 'ocean-restaurant',
    description: 'Vista privilegiada para a Baía de Maputo, mariscos requintados e carta de vinhos seletiva.',
    coverImage: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
    logoUrl: 'https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&w=200&q=80',
    address: {
      street: 'Av. 10 de Novembro, Clube Marítimo',
      city: 'Maputo',
      province: 'Maputo Cidade',
      country: 'Moçambique'
    },
    phone: '+258 84 555 7788',
    email: 'reservas@oceanrestaurant.co.mz',
    currency: 'MT',
    timezone: 'Africa/Maputo',
    openingHours: 'Segunda a Domingo: 12:00 - 00:00',
    isActive: true,
    taxRate: 16,
    settings: {
      allowCustomerOrdering: true,
      requireTableForOrder: true,
      serviceFeePercent: 10,
      themeAccentColor: '#0284c7',
      enabledPaymentMethods: ['mpesa', 'card', 'cash']
    },
    createdAt: '2024-02-12T14:00:00Z'
  },
  {
    id: 'rest-5',
    tenantId: 'tenant-3',
    name: 'Urban Grill & Bar',
    slug: 'urban-grill',
    description: 'Cortes nobres maturados, burgers artesanais e cocktails de autor.',
    coverImage: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1200&q=80',
    logoUrl: 'https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=200&q=80',
    address: {
      street: 'Rua de Kassuende, nº 88',
      city: 'Maputo',
      province: 'Maputo Cidade',
      country: 'Moçambique'
    },
    phone: '+258 84 990 0011',
    email: 'info@urbangrill.co.mz',
    currency: 'MT',
    timezone: 'Africa/Maputo',
    openingHours: 'Quarta a Domingo: 16:00 - 02:00',
    isActive: true,
    taxRate: 16,
    settings: {
      allowCustomerOrdering: true,
      requireTableForOrder: true,
      serviceFeePercent: 8,
      themeAccentColor: '#b91c1c',
      enabledPaymentMethods: ['mpesa', 'emola', 'card', 'cash']
    },
    createdAt: '2024-03-02T16:00:00Z'
  }
]

export const initialUsers: User[] = [
  {
    id: 'user-super',
    name: 'Carlos Silva (Super Admin)',
    email: 'superadmin@tapmenu.co.mz',
    role: 'super_admin',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80',
    phone: '+258 84 000 0001',
    assignedRestaurantIds: ['rest-1', 'rest-2', 'rest-3', 'rest-4', 'rest-5'],
    isActive: true,
    createdAt: '2024-01-01T00:00:00Z'
  },
  {
    id: 'user-owner-1',
    name: 'Amélia Cossa (Proprietária)',
    email: 'amelia.cossa@saboresmocambique.co.mz',
    role: 'company_owner',
    avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=120&q=80',
    phone: '+258 84 100 2001',
    tenantId: 'tenant-1',
    assignedRestaurantIds: ['rest-1', 'rest-2', 'rest-3'],
    isActive: true,
    createdAt: '2024-01-15T08:30:00Z'
  },
  {
    id: 'user-admin-1',
    name: 'Rui Mondlane (Admin Restaurante)',
    email: 'rui.mondlane@saboresmocambique.co.mz',
    role: 'restaurant_admin',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&q=80',
    phone: '+258 84 100 2002',
    tenantId: 'tenant-1',
    assignedRestaurantIds: ['rest-1', 'rest-2'],
    isActive: true,
    createdAt: '2024-01-16T09:00:00Z'
  },
  {
    id: 'user-manager-1',
    name: 'Inês Macuácua (Gerente)',
    email: 'ines.m@saboresmocambique.co.mz',
    role: 'manager',
    avatarUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=120&q=80',
    phone: '+258 84 100 2003',
    tenantId: 'tenant-1',
    assignedRestaurantIds: ['rest-1'],
    isActive: true,
    createdAt: '2024-01-18T10:00:00Z'
  },
  {
    id: 'user-waiter-1',
    name: 'Tomás Sitoe (Empregado de Mesa)',
    email: 'tomas.s@saboresmocambique.co.mz',
    role: 'waiter',
    avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=120&q=80',
    phone: '+258 84 100 2004',
    tenantId: 'tenant-1',
    assignedRestaurantIds: ['rest-1'],
    isActive: true,
    createdAt: '2024-01-20T11:00:00Z'
  },
  {
    id: 'user-kitchen-1',
    name: 'Chefe Helena Langa (Cozinha)',
    email: 'helena.l@saboresmocambique.co.mz',
    role: 'kitchen_staff',
    avatarUrl: 'https://images.unsplash.com/photo-1577219491135-ce391730fb2c?auto=format&fit=crop&w=120&q=80',
    phone: '+258 84 100 2005',
    tenantId: 'tenant-1',
    assignedRestaurantIds: ['rest-1'],
    isActive: true,
    createdAt: '2024-01-20T12:00:00Z'
  },
  {
    id: 'user-recep-1',
    name: 'Maria Guambe (Rececionista)',
    email: 'maria.g@saboresmocambique.co.mz',
    role: 'receptionist',
    avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=120&q=80',
    phone: '+258 84 100 2006',
    tenantId: 'tenant-1',
    assignedRestaurantIds: ['rest-1'],
    isActive: true,
    createdAt: '2024-01-22T08:00:00Z'
  },
  {
    id: 'user-owner-2',
    name: 'David Matsinhe (Dono Ocean Group)',
    email: 'david@oceanfood.co.mz',
    role: 'company_owner',
    avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=120&q=80',
    phone: '+258 84 222 3345',
    tenantId: 'tenant-2',
    assignedRestaurantIds: ['rest-4'],
    isActive: true,
    createdAt: '2024-02-10T10:00:00Z'
  }
]

export const initialTables: Table[] = [
  // Sabores Maputo (rest-1)
  {
    id: 'tbl-1',
    tenantId: 'tenant-1',
    restaurantId: 'rest-1',
    number: '01',
    name: 'Mesa Vista Jardim',
    area: 'Sala Principal',
    capacity: 4,
    status: 'occupied',
    publicUrl: '/menu/sabores-maputo/01',
    nfcTagId: 'NFC-SMP-01',
    activeOrderId: 'ord-101',
    lastActivityAt: '2026-10-16T11:20:00Z',
    isActive: true
  },
  {
    id: 'tbl-2',
    tenantId: 'tenant-1',
    restaurantId: 'rest-1',
    number: '02',
    name: 'Mesa Central',
    area: 'Sala Principal',
    capacity: 2,
    status: 'has_order',
    publicUrl: '/menu/sabores-maputo/02',
    nfcTagId: 'NFC-SMP-02',
    activeOrderId: 'ord-102',
    lastActivityAt: '2026-10-16T11:32:00Z',
    isActive: true
  },
  {
    id: 'tbl-3',
    tenantId: 'tenant-1',
    restaurantId: 'rest-1',
    number: '03',
    name: 'Mesa Familiar',
    area: 'Sala Principal',
    capacity: 6,
    status: 'waiting_service',
    publicUrl: '/menu/sabores-maputo/03',
    nfcTagId: 'NFC-SMP-03',
    lastActivityAt: '2026-10-16T11:40:00Z',
    isActive: true
  },
  {
    id: 'tbl-4',
    tenantId: 'tenant-1',
    restaurantId: 'rest-1',
    number: '04',
    name: 'Esplanada Brisa',
    area: 'Esplanada',
    capacity: 4,
    status: 'waiting_bill',
    publicUrl: '/menu/sabores-maputo/04',
    nfcTagId: 'NFC-SMP-04',
    activeOrderId: 'ord-104',
    lastActivityAt: '2026-10-16T11:15:00Z',
    isActive: true
  },
  {
    id: 'tbl-5',
    tenantId: 'tenant-1',
    restaurantId: 'rest-1',
    number: '05',
    name: 'Esplanada Pérgula',
    area: 'Esplanada',
    capacity: 4,
    status: 'free',
    publicUrl: '/menu/sabores-maputo/05',
    nfcTagId: 'NFC-SMP-05',
    isActive: true
  },
  {
    id: 'tbl-6',
    tenantId: 'tenant-1',
    restaurantId: 'rest-1',
    number: '06',
    name: 'Varanda Lounge',
    area: 'Varanda',
    capacity: 2,
    status: 'free',
    publicUrl: '/menu/sabores-maputo/06',
    nfcTagId: 'NFC-SMP-06',
    isActive: true
  },
  {
    id: 'tbl-7',
    tenantId: 'tenant-1',
    restaurantId: 'rest-1',
    number: '07',
    name: 'Balcão Cocktail',
    area: 'Bar',
    capacity: 2,
    status: 'free',
    publicUrl: '/menu/sabores-maputo/07',
    nfcTagId: 'NFC-SMP-07',
    isActive: true
  },
  {
    id: 'tbl-8',
    tenantId: 'tenant-1',
    restaurantId: 'rest-1',
    number: '08',
    name: 'Sala VIP Privada',
    area: 'Privado',
    capacity: 10,
    status: 'unavailable',
    publicUrl: '/menu/sabores-maputo/08',
    nfcTagId: 'NFC-SMP-08',
    isActive: true
  },
  // Sabores Matola (rest-2)
  {
    id: 'tbl-201',
    tenantId: 'tenant-1',
    restaurantId: 'rest-2',
    number: 'M1',
    name: 'Mesa Jardim Matola',
    area: 'Esplanada',
    capacity: 4,
    status: 'free',
    publicUrl: '/menu/sabores-matola/M1',
    nfcTagId: 'NFC-SMT-01',
    isActive: true
  },
  {
    id: 'tbl-202',
    tenantId: 'tenant-1',
    restaurantId: 'rest-2',
    number: 'M2',
    name: 'Mesa Familiar Matola',
    area: 'Sala Principal',
    capacity: 8,
    status: 'occupied',
    publicUrl: '/menu/sabores-matola/M2',
    nfcTagId: 'NFC-SMT-02',
    activeOrderId: 'ord-201',
    isActive: true
  },
  // Ocean Restaurant (rest-4, tenant-2)
  {
    id: 'tbl-401',
    tenantId: 'tenant-2',
    restaurantId: 'rest-4',
    number: 'O-01',
    name: 'Deck Baía Mar',
    area: 'Varanda',
    capacity: 4,
    status: 'free',
    publicUrl: '/menu/ocean-restaurant/O-01',
    nfcTagId: 'NFC-OCN-01',
    isActive: true
  },
  {
    id: 'tbl-402',
    tenantId: 'tenant-2',
    restaurantId: 'rest-4',
    number: 'O-02',
    name: 'Salão Náutico',
    area: 'Sala Principal',
    capacity: 6,
    status: 'has_order',
    publicUrl: '/menu/ocean-restaurant/O-02',
    nfcTagId: 'NFC-OCN-02',
    activeOrderId: 'ord-401',
    isActive: true
  }
]

export const initialCategories: Category[] = [
  // Sabores Maputo
  {
    id: 'cat-1',
    tenantId: 'tenant-1',
    restaurantId: 'rest-1',
    name: 'Destaques do Chefe',
    description: 'Os pratos mais icónicos e premiados de Moçambique.',
    imageUrl: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=400&q=80',
    sortOrder: 1,
    isActive: true
  },
  {
    id: 'cat-2',
    tenantId: 'tenant-1',
    restaurantId: 'rest-1',
    name: 'Especialidades Moçambicanas',
    description: 'Pratos de panela, caris e mariscos com tempero tradicional.',
    imageUrl: 'https://images.unsplash.com/photo-1541832676-9b763b0239ab?auto=format&fit=crop&w=400&q=80',
    sortOrder: 2,
    isActive: true
  },
  {
    id: 'cat-3',
    tenantId: 'tenant-1',
    restaurantId: 'rest-1',
    name: 'Hambúrgueres Artesanais',
    description: 'Pão brioche fresco, carnes selecionadas e molhos exclusivos.',
    imageUrl: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=400&q=80',
    sortOrder: 3,
    isActive: true
  },
  {
    id: 'cat-4',
    tenantId: 'tenant-1',
    restaurantId: 'rest-1',
    name: 'Grelhados & Carnes',
    description: 'Carnes nobres grelhadas no carvão vegetal com acompanhamentos.',
    imageUrl: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=400&q=80',
    sortOrder: 4,
    isActive: true
  },
  {
    id: 'cat-5',
    tenantId: 'tenant-1',
    restaurantId: 'rest-1',
    name: 'Pizzas no Forno',
    description: 'Massa fina artesanal e queijo mozzarella derretido.',
    imageUrl: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=400&q=80',
    sortOrder: 5,
    isActive: true
  },
  {
    id: 'cat-6',
    tenantId: 'tenant-1',
    restaurantId: 'rest-1',
    name: 'Entradas & Petiscos',
    description: 'Para partilhar enquanto aguarda o prato principal.',
    imageUrl: 'https://images.unsplash.com/photo-1541529086526-db283c563270?auto=format&fit=crop&w=400&q=80',
    sortOrder: 6,
    isActive: true
  },
  {
    id: 'cat-7',
    tenantId: 'tenant-1',
    restaurantId: 'rest-1',
    name: 'Bebidas & Sumos Naturais',
    description: 'Sumos de frutas da época, refrigerantes e águas.',
    imageUrl: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=400&q=80',
    sortOrder: 7,
    isActive: true
  },
  {
    id: 'cat-8',
    tenantId: 'tenant-1',
    restaurantId: 'rest-1',
    name: 'Cervejas, Cocktails & Vinhos',
    description: 'As clássicas 2M e Laurentina, vinhos e cocktails tropicais.',
    imageUrl: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=400&q=80',
    sortOrder: 8,
    isActive: true
  },
  {
    id: 'cat-9',
    tenantId: 'tenant-1',
    restaurantId: 'rest-1',
    name: 'Sobremesas Deliciosas',
    description: 'Doces artesanais para fechar a sua refeição com perfeição.',
    imageUrl: 'https://images.unsplash.com/photo-1551024601-bec78aea704b?auto=format&fit=crop&w=400&q=80',
    sortOrder: 9,
    isActive: true
  },
  // Tenant 2 - Ocean
  {
    id: 'cat-ocn-1',
    tenantId: 'tenant-2',
    restaurantId: 'rest-4',
    name: 'Mariscos Seleção Especial',
    description: 'Camarões Tigre, Lavagante e Lagosta da Costa Moçambicana.',
    imageUrl: 'https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?auto=format&fit=crop&w=400&q=80',
    sortOrder: 1,
    isActive: true
  }
]

export const initialProducts: Product[] = [
  // Categoria 1: Destaques do Chefe
  {
    id: 'prod-1',
    tenantId: 'tenant-1',
    restaurantId: 'rest-1',
    categoryId: 'cat-1',
    name: 'Frango à Zambeziana da Casa',
    description: 'Frango do campo marinado em leite de coco fresco, piripíri suave, alho e limão, grelhado nas brasas. Acompanha arroz de coco e batata frita.',
    imageUrl: 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?auto=format&fit=crop&w=600&q=80',
    price: 680,
    promotionalPrice: 620,
    isAvailable: true,
    isFeatured: true,
    preparationTimeMinutes: 25,
    station: 'kitchen',
    variants: [
      { id: 'v1-1', name: 'Meio Frango', priceDelta: 0 },
      { id: 'v1-2', name: 'Frango Inteiro', priceDelta: 380 }
    ],
    addons: [
      { id: 'a1-1', name: 'Arroz de Coco Extra', price: 120 },
      { id: 'a1-2', name: 'Molho Piripíri Especial', price: 50 },
      { id: 'a1-3', name: 'Salada Mista da Época', price: 90 }
    ],
    removableIngredients: ['Piripíri', 'Alho'],
    allergens: ['Coco'],
    sortOrder: 1,
    isActive: true
  },
  {
    id: 'prod-2',
    tenantId: 'tenant-1',
    restaurantId: 'rest-1',
    categoryId: 'cat-1',
    name: 'Camarão Tigre Grelhado à Lourenço Marques',
    description: 'Camarões tigre frescos grelhados com manteiga de alho aromatizada com ervas e piripíri caseiro. Servido com batata frita e salada.',
    imageUrl: 'https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?auto=format&fit=crop&w=600&q=80',
    price: 1350,
    isAvailable: true,
    isFeatured: true,
    preparationTimeMinutes: 20,
    station: 'kitchen',
    addons: [
      { id: 'a2-1', name: 'Dose Extra de Molho de Manteiga', price: 70 },
      { id: 'a2-2', name: 'Batata Frita Extra', price: 100 }
    ],
    allergens: ['Crustáceos', 'Laticínios'],
    sortOrder: 2,
    isActive: true
  },
  {
    id: 'prod-3',
    tenantId: 'tenant-1',
    restaurantId: 'rest-1',
    categoryId: 'cat-2',
    name: 'Matapa Tradicional com Caranguejo & Camarão',
    description: 'Folhas de mandioca finamente piladas com amendoim moído e leite de coco fresco, cozinhadas lentamente com caranguejo desfiado e camarão seco.',
    imageUrl: 'https://images.unsplash.com/photo-1541832676-9b763b0239ab?auto=format&fit=crop&w=600&q=80',
    price: 750,
    isAvailable: true,
    isFeatured: true,
    preparationTimeMinutes: 22,
    station: 'kitchen',
    variants: [
      { id: 'v3-1', name: 'Dose Individual', priceDelta: 0 },
      { id: 'v3-2', name: 'Dose para Dois', priceDelta: 450 }
    ],
    addons: [
      { id: 'a3-1', name: 'Xima de Milho Branco', price: 80 },
      { id: 'a3-2', name: 'Arroz Branco Basmati', price: 90 }
    ],
    allergens: ['Amendoim', 'Crustáceos'],
    sortOrder: 3,
    isActive: true
  },
  {
    id: 'prod-4',
    tenantId: 'tenant-1',
    restaurantId: 'rest-1',
    categoryId: 'cat-2',
    name: 'Caril de Camarão à Moda de Inhambane',
    description: 'Camarões suculentos cozinhados num caldo aromático de especiarias locais, gengibre, leite de coco e manga verde. Acompanha arroz de jasmim.',
    imageUrl: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=600&q=80',
    price: 890,
    isAvailable: true,
    isFeatured: false,
    preparationTimeMinutes: 24,
    station: 'kitchen',
    allergens: ['Crustáceos'],
    sortOrder: 4,
    isActive: true
  },

  // Categoria 3: Hambúrgueres
  {
    id: 'prod-5',
    tenantId: 'tenant-1',
    restaurantId: 'rest-1',
    categoryId: 'cat-3',
    name: 'Hambúrguer Especial Sabores (Picanha 180g)',
    description: 'Pão brioche tostado na manteiga, hambúrguer de picanha 180g, queijo cheddar inglês, bacon crocante, cebola caramelizada e maionese de piripíri suave. Acompanha batatas fritas rústicas.',
    imageUrl: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&q=80',
    price: 590,
    promotionalPrice: 530,
    isAvailable: true,
    isFeatured: true,
    preparationTimeMinutes: 18,
    station: 'kitchen',
    variants: [
      { id: 'v5-1', name: 'Simples (180g)', priceDelta: 0 },
      { id: 'v5-2', name: 'Duplo (360g)', priceDelta: 220 }
    ],
    addons: [
      { id: 'a5-1', name: 'Ovo Estalado', price: 40 },
      { id: 'a5-2', name: 'Bacon Extra', price: 70 },
      { id: 'a5-3', name: 'Queijo Cheddar Extra', price: 60 }
    ],
    removableIngredients: ['Cebola Caramelizada', 'Bacon', 'Pickles'],
    allergens: ['Glúten', 'Laticínios', 'Ovos'],
    sortOrder: 1,
    isActive: true
  },
  {
    id: 'prod-6',
    tenantId: 'tenant-1',
    restaurantId: 'rest-1',
    categoryId: 'cat-3',
    name: 'Hambúrguer Clássico Cheeseburger',
    description: 'Carne bovina 150g, queijo gouda, alface iceberg, tomate maduro, pickles artesanais e molho da casa no pão com sementes de sésamo.',
    imageUrl: 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=600&q=80',
    price: 450,
    isAvailable: true,
    isFeatured: false,
    preparationTimeMinutes: 15,
    station: 'kitchen',
    removableIngredients: ['Pickles', 'Cebola', 'Tomate'],
    allergens: ['Glúten', 'Laticínios'],
    sortOrder: 2,
    isActive: true
  },
  {
    id: 'prod-7',
    tenantId: 'tenant-1',
    restaurantId: 'rest-1',
    categoryId: 'cat-3',
    name: 'Hambúrguer Vegetariano de Grão & Cogumelos',
    description: 'Hambúrguer artesanal de grão-de-bico com cogumelos salteados, rúcula selvagem, tomate seco e maionese vegan de ervas aromáticas.',
    imageUrl: 'https://images.unsplash.com/photo-1525059696034-4967a8e1dca2?auto=format&fit=crop&w=600&q=80',
    price: 480,
    isAvailable: false, // Cenário de produto indisponível
    isFeatured: false,
    preparationTimeMinutes: 16,
    station: 'kitchen',
    sortOrder: 3,
    isActive: true
  },

  // Categoria 4: Grelhados & Carnes
  {
    id: 'prod-8',
    tenantId: 'tenant-1',
    restaurantId: 'rest-1',
    categoryId: 'cat-4',
    name: 'Bife à Portuguesa com Presunto & Ovo',
    description: 'Bife do lombo tenro salteado em alho e louro com fatia de presunto estaladiço, ovo a cavalo e batata às rodelas fritas na hora.',
    imageUrl: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80',
    price: 920,
    isAvailable: true,
    isFeatured: false,
    preparationTimeMinutes: 20,
    station: 'kitchen',
    sortOrder: 1,
    isActive: true
  },
  {
    id: 'prod-9',
    tenantId: 'tenant-1',
    restaurantId: 'rest-1',
    categoryId: 'cat-4',
    name: 'Costelinhas Barbecue de Porco Fumado (500g)',
    description: 'Costelinhas caramelizadas lentamente em molho barbecue doce e picante com batata frita e salada coleslaw.',
    imageUrl: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80',
    price: 850,
    isAvailable: true,
    isFeatured: false,
    preparationTimeMinutes: 22,
    station: 'kitchen',
    sortOrder: 2,
    isActive: true
  },

  // Categoria 5: Pizzas
  {
    id: 'prod-10',
    tenantId: 'tenant-1',
    restaurantId: 'rest-1',
    categoryId: 'cat-5',
    name: 'Pizza Maputo Chic (Camarão & Alho Francês)',
    description: 'Molho de tomate caseiro, mozzarella fresca, camarões salteados em azeite virgem, alho francês confitado e orégãos frescos.',
    imageUrl: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=600&q=80',
    price: 780,
    isAvailable: true,
    isFeatured: true,
    preparationTimeMinutes: 18,
    station: 'kitchen',
    variants: [
      { id: 'vp-1', name: 'Média (30cm)', priceDelta: 0 },
      { id: 'vp-2', name: 'Familiar (40cm)', priceDelta: 260 }
    ],
    addons: [
      { id: 'ap-1', name: 'Borda Recheada com Queijo', price: 120 },
      { id: 'ap-2', name: 'Cogumelos Frescos Extra', price: 80 }
    ],
    allergens: ['Glúten', 'Laticínios', 'Crustáceos'],
    sortOrder: 1,
    isActive: true
  },
  {
    id: 'prod-11',
    tenantId: 'tenant-1',
    restaurantId: 'rest-1',
    categoryId: 'cat-5',
    name: 'Pizza Quatro Queijos & Manjericão',
    description: 'Mozzarella, gorgonzola, provolone e parmesão envelhecido sobre molho de tomate e folhas frescas de manjericão.',
    imageUrl: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=600&q=80',
    price: 640,
    isAvailable: true,
    isFeatured: false,
    preparationTimeMinutes: 16,
    station: 'kitchen',
    allergens: ['Glúten', 'Laticínios'],
    sortOrder: 2,
    isActive: true
  },

  // Categoria 6: Entradas & Petiscos
  {
    id: 'prod-12',
    tenantId: 'tenant-1',
    restaurantId: 'rest-1',
    categoryId: 'cat-6',
    name: 'Chamuças Tradicionais (Dose de 4 unid.)',
    description: 'Chamuças crocantes e douradas recheadas com carne picada bem temperada ou vegetais aromatizados.',
    imageUrl: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=600&q=80',
    price: 240,
    isAvailable: true,
    isFeatured: true,
    preparationTimeMinutes: 10,
    station: 'kitchen',
    variants: [
      { id: 'vc-1', name: 'Carne Bovina', priceDelta: 0 },
      { id: 'vc-2', name: 'Frango & Queijo', priceDelta: 20 },
      { id: 'vc-3', name: 'Vegetarianas', priceDelta: 0 }
    ],
    allergens: ['Glúten'],
    sortOrder: 1,
    isActive: true
  },
  {
    id: 'prod-13',
    tenantId: 'tenant-1',
    restaurantId: 'rest-1',
    categoryId: 'cat-6',
    name: 'Batatas Bravas com Maionese de Alho & Piripíri',
    description: 'Cubos de batata fritos até dourarem, acompanhados de molho bravo da casa e aioli.',
    imageUrl: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=600&q=80',
    price: 220,
    isAvailable: true,
    isFeatured: false,
    preparationTimeMinutes: 10,
    station: 'kitchen',
    sortOrder: 2,
    isActive: true
  },

  // Categoria 7: Bebidas e Sumos
  {
    id: 'prod-14',
    tenantId: 'tenant-1',
    restaurantId: 'rest-1',
    categoryId: 'cat-7',
    name: 'Sumo Natural de Maracujá da Manhiça (400ml)',
    description: 'Polpa fresca batida no momento com gelo. Pode ser solicitado com açúcar ou mel silvestre.',
    imageUrl: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=600&q=80',
    price: 180,
    isAvailable: true,
    isFeatured: true,
    preparationTimeMinutes: 5,
    station: 'bar',
    addons: [
      { id: 'as-1', name: 'Sem Açúcar', price: 0 },
      { id: 'as-2', name: 'Com Hortelã Fresca', price: 20 }
    ],
    sortOrder: 1,
    isActive: true
  },
  {
    id: 'prod-15',
    tenantId: 'tenant-1',
    restaurantId: 'rest-1',
    categoryId: 'cat-7',
    name: 'Água Mineral da Namaacha (Sem Gás 500ml)',
    description: 'Água mineral límpida e pura captada nas montanhas da Namaacha.',
    imageUrl: 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?auto=format&fit=crop&w=600&q=80',
    price: 70,
    isAvailable: true,
    isFeatured: false,
    preparationTimeMinutes: 2,
    station: 'bar',
    sortOrder: 2,
    isActive: true
  },
  {
    id: 'prod-16',
    tenantId: 'tenant-1',
    restaurantId: 'rest-1',
    categoryId: 'cat-7',
    name: 'Água das Pedras com Gás (330ml)',
    description: 'Água gasosa natural refrescante com fatia de limão.',
    imageUrl: 'https://images.unsplash.com/photo-1523362628745-0c100150b504?auto=format&fit=crop&w=600&q=80',
    price: 110,
    isAvailable: true,
    isFeatured: false,
    preparationTimeMinutes: 2,
    station: 'bar',
    sortOrder: 3,
    isActive: true
  },
  {
    id: 'prod-17',
    tenantId: 'tenant-1',
    restaurantId: 'rest-1',
    categoryId: 'cat-7',
    name: 'Refrigerante Lata (Coca-Cola / Fanta / Sprite 330ml)',
    description: 'Servido bem fresco com copo com gelo e limão.',
    imageUrl: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=600&q=80',
    price: 90,
    isAvailable: true,
    isFeatured: false,
    preparationTimeMinutes: 2,
    station: 'bar',
    variants: [
      { id: 'vr-1', name: 'Coca-Cola Original', priceDelta: 0 },
      { id: 'vr-2', name: 'Coca-Cola Zero', priceDelta: 0 },
      { id: 'vr-3', name: 'Fanta Laranja', priceDelta: 0 },
      { id: 'vr-4', name: 'Sprite', priceDelta: 0 }
    ],
    sortOrder: 4,
    isActive: true
  },

  // Categoria 8: Cervejas e Bar
  {
    id: 'prod-18',
    tenantId: 'tenant-1',
    restaurantId: 'rest-1',
    categoryId: 'cat-8',
    name: 'Cerveja 2M Especial Garrafa (330ml)',
    description: 'A clássica e orgulhosa cerveja de Moçambique, servida estalando de fria.',
    imageUrl: 'https://images.unsplash.com/photo-1608270546103-97992762f026?auto=format&fit=crop&w=600&q=80',
    price: 120,
    isAvailable: true,
    isFeatured: true,
    preparationTimeMinutes: 3,
    station: 'bar',
    sortOrder: 1,
    isActive: true
  },
  {
    id: 'prod-19',
    tenantId: 'tenant-1',
    restaurantId: 'rest-1',
    categoryId: 'cat-8',
    name: 'Cerveja Laurentina Preta (330ml)',
    description: 'A cerveja preta mais premiada de África, encorpada e com notas tostadas.',
    imageUrl: 'https://images.unsplash.com/photo-1538488881522-4306c3c9843c?auto=format&fit=crop&w=600&q=80',
    price: 140,
    isAvailable: true,
    isFeatured: false,
    preparationTimeMinutes: 3,
    station: 'bar',
    sortOrder: 2,
    isActive: true
  },
  {
    id: 'prod-20',
    tenantId: 'tenant-1',
    restaurantId: 'rest-1',
    categoryId: 'cat-8',
    name: 'Cocktail Caipirinha de Maracujá & Rum',
    description: 'Cachaça ou rum nacional, lima fresca, polpa de maracujá e açúcar mascavado batidos com gelo picado.',
    imageUrl: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=600&q=80',
    price: 320,
    isAvailable: true,
    isFeatured: true,
    preparationTimeMinutes: 6,
    station: 'bar',
    sortOrder: 3,
    isActive: true
  },

  // Categoria 9: Sobremesas
  {
    id: 'prod-21',
    tenantId: 'tenant-1',
    restaurantId: 'rest-1',
    categoryId: 'cat-9',
    name: 'Pudim de Leite Condensado com Calda de Caramelo',
    description: 'Receita caseira tradicional, aveludado e com calda dourada rica.',
    imageUrl: 'https://images.unsplash.com/photo-1551024601-bec78aea704b?auto=format&fit=crop&w=600&q=80',
    price: 210,
    isAvailable: true,
    isFeatured: true,
    preparationTimeMinutes: 5,
    station: 'kitchen',
    allergens: ['Laticínios', 'Ovos'],
    sortOrder: 1,
    isActive: true
  },
  {
    id: 'prod-22',
    tenantId: 'tenant-1',
    restaurantId: 'rest-1',
    categoryId: 'cat-9',
    name: 'Mousse de Chocolate Preto & Flor de Sal',
    description: 'Chocolate belga 70% cacau, aerada com toque suave de flor de sal.',
    imageUrl: 'https://images.unsplash.com/photo-1541783245831-57d6fb0926d3?auto=format&fit=crop&w=600&q=80',
    price: 230,
    isAvailable: true,
    isFeatured: false,
    preparationTimeMinutes: 5,
    station: 'kitchen',
    allergens: ['Laticínios', 'Ovos'],
    sortOrder: 2,
    isActive: true
  },
  {
    id: 'prod-23',
    tenantId: 'tenant-1',
    restaurantId: 'rest-1',
    categoryId: 'cat-7',
    name: 'Café Espresso de Manica',
    description: 'Grãos arábica selecionados de Manica, extração cremosa e aroma intenso.',
    imageUrl: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=600&q=80',
    price: 80,
    isAvailable: true,
    isFeatured: false,
    preparationTimeMinutes: 3,
    station: 'bar',
    sortOrder: 5,
    isActive: true
  },

  // Produtos do Tenant 2 (Ocean Restaurant - Isolamento de Dados)
  {
    id: 'prod-ocn-1',
    tenantId: 'tenant-2',
    restaurantId: 'rest-4',
    categoryId: 'cat-ocn-1',
    name: 'Lavagante Grelhado no Forno a Lenha',
    description: 'Lavagante fresco selecionado no viveiro, servido com manteiga de trufas e batatas salteadas.',
    imageUrl: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=600&q=80',
    price: 2600,
    isAvailable: true,
    isFeatured: true,
    preparationTimeMinutes: 30,
    station: 'kitchen',
    sortOrder: 1,
    isActive: true
  }
]

export const initialOrders: Order[] = [
  {
    id: 'ord-101',
    tenantId: 'tenant-1',
    restaurantId: 'rest-1',
    tableId: 'tbl-1',
    tableNumber: '01',
    orderCode: '#ORD-101',
    type: 'dine_in',
    status: 'preparing',
    paymentStatus: 'pending',
    paymentMethod: 'mpesa',
    items: [
      {
        id: 'item-1',
        productId: 'prod-1',
        productName: 'Frango à Zambeziana da Casa',
        quantity: 1,
        unitPrice: 620,
        totalPrice: 620,
        selectedVariant: { id: 'v1-1', name: 'Meio Frango', priceDelta: 0 },
        selectedAddons: [{ id: 'a1-1', name: 'Arroz de Coco Extra', price: 120 }],
        station: 'kitchen',
        notes: 'Piripíri à parte, por favor.'
      },
      {
        id: 'item-2',
        productId: 'prod-14',
        productName: 'Sumo Natural de Maracujá da Manhiça',
        quantity: 2,
        unitPrice: 180,
        totalPrice: 360,
        station: 'bar'
      }
    ],
    subtotal: 1100,
    taxAmount: 176,
    serviceFee: 110,
    total: 1386,
    customerName: 'Manuel Machava',
    customerPhone: '+258 84 444 1234',
    notes: 'Cliente com ligeira pressa.',
    history: [
      { status: 'received', timestamp: '2026-10-16T11:15:00Z', updatedBy: 'Cliente (Mesa 01)' },
      { status: 'confirmed', timestamp: '2026-10-16T11:18:00Z', updatedBy: 'Tomás Sitoe' },
      { status: 'preparing', timestamp: '2026-10-16T11:20:00Z', updatedBy: 'Chefe Helena Langa' }
    ],
    createdAt: '2026-10-16T11:15:00Z',
    updatedAt: '2026-10-16T11:20:00Z'
  },
  {
    id: 'ord-102',
    tenantId: 'tenant-1',
    restaurantId: 'rest-1',
    tableId: 'tbl-2',
    tableNumber: '02',
    orderCode: '#ORD-102',
    type: 'dine_in',
    status: 'received',
    paymentStatus: 'pending',
    items: [
      {
        id: 'item-3',
        productId: 'prod-5',
        productName: 'Hambúrguer Especial Sabores',
        quantity: 2,
        unitPrice: 530,
        totalPrice: 1060,
        station: 'kitchen',
        removedIngredients: ['Cebola Caramelizada']
      },
      {
        id: 'item-4',
        productId: 'prod-18',
        productName: 'Cerveja 2M Especial Garrafa',
        quantity: 2,
        unitPrice: 120,
        totalPrice: 240,
        station: 'bar'
      }
    ],
    subtotal: 1300,
    taxAmount: 208,
    serviceFee: 130,
    total: 1638,
    customerName: 'Bárbara Sitoe',
    history: [
      { status: 'received', timestamp: '2026-10-16T11:32:00Z', updatedBy: 'Cliente (Mesa 02)' }
    ],
    createdAt: '2026-10-16T11:32:00Z',
    updatedAt: '2026-10-16T11:32:00Z'
  },
  {
    id: 'ord-103',
    tenantId: 'tenant-1',
    restaurantId: 'rest-1',
    tableId: 'tbl-3',
    tableNumber: '03',
    orderCode: '#ORD-103',
    type: 'dine_in',
    status: 'ready',
    paymentStatus: 'paid',
    paymentMethod: 'card',
    items: [
      {
        id: 'item-5',
        productId: 'prod-2',
        productName: 'Camarão Tigre Grelhado à Lourenço Marques',
        quantity: 1,
        unitPrice: 1350,
        totalPrice: 1350,
        station: 'kitchen'
      },
      {
        id: 'item-6',
        productId: 'prod-20',
        productName: 'Cocktail Caipirinha de Maracujá',
        quantity: 2,
        unitPrice: 320,
        totalPrice: 640,
        station: 'bar'
      }
    ],
    subtotal: 1990,
    taxAmount: 318.4,
    serviceFee: 199,
    total: 2507.4,
    history: [
      { status: 'received', timestamp: '2026-10-16T10:45:00Z', updatedBy: 'Cliente (Mesa 03)' },
      { status: 'confirmed', timestamp: '2026-10-16T10:48:00Z', updatedBy: 'Tomás Sitoe' },
      { status: 'preparing', timestamp: '2026-10-16T10:50:00Z', updatedBy: 'Chefe Helena Langa' },
      { status: 'ready', timestamp: '2026-10-16T11:12:00Z', updatedBy: 'Chefe Helena Langa' }
    ],
    createdAt: '2026-10-16T10:45:00Z',
    updatedAt: '2026-10-16T11:12:00Z'
  },
  {
    id: 'ord-104',
    tenantId: 'tenant-1',
    restaurantId: 'rest-1',
    tableId: 'tbl-4',
    tableNumber: '04',
    orderCode: '#ORD-104',
    type: 'dine_in',
    status: 'delivered',
    paymentStatus: 'awaiting_confirmation',
    paymentMethod: 'emola',
    items: [
      {
        id: 'item-7',
        productId: 'prod-10',
        productName: 'Pizza Maputo Chic',
        quantity: 1,
        unitPrice: 780,
        totalPrice: 780,
        station: 'kitchen'
      },
      {
        id: 'item-8',
        productId: 'prod-17',
        productName: 'Refrigerante Lata (Coca-Cola)',
        quantity: 2,
        unitPrice: 90,
        totalPrice: 180,
        station: 'bar'
      }
    ],
    subtotal: 960,
    taxAmount: 153.6,
    serviceFee: 96,
    total: 1209.6,
    history: [
      { status: 'received', timestamp: '2026-10-16T10:15:00Z', updatedBy: 'Cliente' },
      { status: 'confirmed', timestamp: '2026-10-16T10:18:00Z', updatedBy: 'Tomás Sitoe' },
      { status: 'preparing', timestamp: '2026-10-16T10:20:00Z', updatedBy: 'Cozinha' },
      { status: 'ready', timestamp: '2026-10-16T10:38:00Z', updatedBy: 'Cozinha' },
      { status: 'delivered', timestamp: '2026-10-16T10:42:00Z', updatedBy: 'Tomás Sitoe' }
    ],
    createdAt: '2026-10-16T10:15:00Z',
    updatedAt: '2026-10-16T10:42:00Z'
  },
  {
    id: 'ord-105',
    tenantId: 'tenant-1',
    restaurantId: 'rest-1',
    tableNumber: 'Balcão',
    orderCode: '#ORD-105',
    type: 'takeaway',
    status: 'delivered',
    paymentStatus: 'paid',
    paymentMethod: 'mpesa',
    items: [
      {
        id: 'item-9',
        productId: 'prod-12',
        productName: 'Chamuças Tradicionais (Dose)',
        quantity: 2,
        unitPrice: 240,
        totalPrice: 480,
        station: 'kitchen'
      }
    ],
    subtotal: 480,
    taxAmount: 76.8,
    serviceFee: 0,
    total: 556.8,
    customerName: 'Artur Bila',
    customerPhone: '+258 84 888 9900',
    history: [
      { status: 'received', timestamp: '2026-10-16T09:30:00Z', updatedBy: 'Maria Guambe' },
      { status: 'delivered', timestamp: '2026-10-16T09:45:00Z', updatedBy: 'Maria Guambe' }
    ],
    createdAt: '2026-10-16T09:30:00Z',
    updatedAt: '2026-10-16T09:45:00Z'
  },
  {
    id: 'ord-106',
    tenantId: 'tenant-1',
    restaurantId: 'rest-1',
    tableNumber: '05',
    orderCode: '#ORD-106',
    type: 'dine_in',
    status: 'cancelled',
    paymentStatus: 'refunded',
    items: [
      {
        id: 'item-10',
        productId: 'prod-7',
        productName: 'Hambúrguer Vegetariano de Grão',
        quantity: 1,
        unitPrice: 480,
        totalPrice: 480,
        station: 'kitchen'
      }
    ],
    subtotal: 480,
    taxAmount: 76.8,
    serviceFee: 48,
    total: 604.8,
    notes: 'Cancelado pelo cliente devido a ingrediente em falta.',
    history: [
      { status: 'received', timestamp: '2026-10-15T19:00:00Z', updatedBy: 'Cliente' },
      { status: 'cancelled', timestamp: '2026-10-15T19:05:00Z', updatedBy: 'Inês Macuácua', note: 'Ingrediente indisponível' }
    ],
    createdAt: '2026-10-15T19:00:00Z',
    updatedAt: '2026-10-15T19:05:00Z'
  },
  // Pedido do Tenant 2 (Ocean Restaurant - Isolamento de Dados)
  {
    id: 'ord-401',
    tenantId: 'tenant-2',
    restaurantId: 'rest-4',
    tableId: 'tbl-402',
    tableNumber: 'O-02',
    orderCode: '#ORD-401',
    type: 'dine_in',
    status: 'preparing',
    paymentStatus: 'pending',
    items: [
      {
        id: 'item-401',
        productId: 'prod-ocn-1',
        productName: 'Lavagante Grelhado no Forno a Lenha',
        quantity: 2,
        unitPrice: 2600,
        totalPrice: 5200,
        station: 'kitchen'
      }
    ],
    subtotal: 5200,
    taxAmount: 832,
    serviceFee: 520,
    total: 6552,
    customerName: 'Visitante Ocean VIP',
    history: [
      { status: 'received', timestamp: '2026-10-16T11:00:00Z', updatedBy: 'Cliente' },
      { status: 'preparing', timestamp: '2026-10-16T11:05:00Z', updatedBy: 'Cozinha Ocean' }
    ],
    createdAt: '2026-10-16T11:00:00Z',
    updatedAt: '2026-10-16T11:05:00Z'
  }
]

export const initialPayments: Payment[] = [
  {
    id: 'pay-1',
    tenantId: 'tenant-1',
    restaurantId: 'rest-1',
    orderId: 'ord-103',
    orderCode: '#ORD-103',
    tableNumber: '03',
    amount: 2507.4,
    method: 'card',
    status: 'paid',
    transactionReference: 'POS-SIM-98214',
    createdAt: '2026-10-16T11:15:00Z'
  },
  {
    id: 'pay-2',
    tenantId: 'tenant-1',
    restaurantId: 'rest-1',
    orderId: 'ord-104',
    orderCode: '#ORD-104',
    tableNumber: '04',
    amount: 1209.6,
    method: 'emola',
    status: 'awaiting_confirmation',
    transactionReference: 'EML-865123999',
    customerPhone: '+258 86 512 3999',
    createdAt: '2026-10-16T11:10:00Z'
  },
  {
    id: 'pay-3',
    tenantId: 'tenant-1',
    restaurantId: 'rest-1',
    orderId: 'ord-105',
    orderCode: '#ORD-105',
    amount: 556.8,
    method: 'mpesa',
    status: 'paid',
    transactionReference: 'MP-848889900-X7',
    customerPhone: '+258 84 888 9900',
    createdAt: '2026-10-16T09:35:00Z'
  },
  {
    id: 'pay-4',
    tenantId: 'tenant-1',
    restaurantId: 'rest-1',
    orderId: 'ord-106',
    orderCode: '#ORD-106',
    tableNumber: '05',
    amount: 604.8,
    method: 'card',
    status: 'refunded',
    transactionReference: 'POS-REF-1092',
    notes: 'Reembolso por cancelamento autorizado',
    createdAt: '2026-10-15T19:08:00Z'
  }
]

export const initialServiceRequests: ServiceRequest[] = [
  {
    id: 'req-1',
    tenantId: 'tenant-1',
    restaurantId: 'rest-1',
    tableId: 'tbl-3',
    tableNumber: '03',
    type: 'water',
    status: 'new',
    notes: 'Por favor, água com gás bem fresca.',
    createdAt: '2026-10-16T11:39:00Z'
  },
  {
    id: 'req-2',
    tenantId: 'tenant-1',
    restaurantId: 'rest-1',
    tableId: 'tbl-4',
    tableNumber: '04',
    type: 'bill',
    status: 'in_progress',
    notes: 'Pagamento via e-Mola.',
    assignedToUserId: 'user-waiter-1',
    assignedToName: 'Tomás Sitoe',
    createdAt: '2026-10-16T11:25:00Z'
  },
  {
    id: 'req-3',
    tenantId: 'tenant-1',
    restaurantId: 'rest-1',
    tableId: 'tbl-1',
    tableNumber: '01',
    type: 'cutlery',
    status: 'completed',
    notes: 'Mais dois conjuntos de talheres para a mesa.',
    assignedToUserId: 'user-waiter-1',
    assignedToName: 'Tomás Sitoe',
    createdAt: '2026-10-16T11:10:00Z',
    resolvedAt: '2026-10-16T11:13:00Z'
  },
  {
    id: 'req-4',
    tenantId: 'tenant-1',
    restaurantId: 'rest-1',
    tableId: 'tbl-2',
    tableNumber: '02',
    type: 'waiter_call',
    status: 'new',
    notes: 'Dúvida sobre a carta de vinhos.',
    createdAt: '2026-10-16T11:42:00Z'
  }
]

export const initialStaff: StaffMember[] = [
  {
    id: 'staff-1',
    tenantId: 'tenant-1',
    name: 'Rui Mondlane',
    email: 'rui.mondlane@saboresmocambique.co.mz',
    phone: '+258 84 100 2002',
    role: 'restaurant_admin',
    assignedRestaurantIds: ['rest-1', 'rest-2'],
    hireDate: '2024-01-16',
    isActive: true
  },
  {
    id: 'staff-2',
    tenantId: 'tenant-1',
    name: 'Inês Macuácua',
    email: 'ines.m@saboresmocambique.co.mz',
    phone: '+258 84 100 2003',
    role: 'manager',
    assignedRestaurantIds: ['rest-1'],
    hireDate: '2024-01-18',
    isActive: true
  },
  {
    id: 'staff-3',
    tenantId: 'tenant-1',
    name: 'Tomás Sitoe',
    email: 'tomas.s@saboresmocambique.co.mz',
    phone: '+258 84 100 2004',
    role: 'waiter',
    assignedRestaurantIds: ['rest-1'],
    hireDate: '2024-01-20',
    isActive: true
  },
  {
    id: 'staff-4',
    tenantId: 'tenant-1',
    name: 'Helena Langa',
    email: 'helena.l@saboresmocambique.co.mz',
    phone: '+258 84 100 2005',
    role: 'kitchen_staff',
    assignedRestaurantIds: ['rest-1'],
    hireDate: '2024-01-20',
    isActive: true
  },
  {
    id: 'staff-5',
    tenantId: 'tenant-1',
    name: 'Maria Guambe',
    email: 'maria.g@saboresmocambique.co.mz',
    phone: '+258 84 100 2006',
    role: 'receptionist',
    assignedRestaurantIds: ['rest-1'],
    hireDate: '2024-01-22',
    isActive: true
  }
]

export const initialPlans: Plan[] = [
  {
    id: 'plan-starter',
    name: 'Plano Básico / Café',
    priceMonthly: 1990,
    maxRestaurants: 1,
    maxStaff: 5,
    maxTables: 15,
    features: [
      'Menu digital por QR Code',
      'Atendimento digital simples',
      'Gestão básica de mesas',
      'Relatórios mensais'
    ],
    isActive: true
  },
  {
    id: 'plan-pro',
    name: 'Plano Restaurante Pro',
    priceMonthly: 4490,
    maxRestaurants: 3,
    maxStaff: 20,
    maxTables: 50,
    features: [
      'Pedidos no menu digital',
      'Kitchen Display System (KDS Cozinha & Bar)',
      'Acesso NFC e QR Code com estatísticas',
      'Pagamentos simulados M-Pesa e Cartão',
      'Relatórios avançados e exportação',
      'Multi-restaurante (até 3)'
    ],
    isActive: true
  },
  {
    id: 'plan-enterprise',
    name: 'Plano Enterprise Redes & Franquias',
    priceMonthly: 9990,
    maxRestaurants: 20,
    maxStaff: 100,
    maxTables: 200,
    features: [
      'Todos os recursos do plano Pro',
      'Restaurantes e filiais ilimitadas',
      'Permissões personalizadas por função',
      'Gestão de cadeia e inventário',
      'Suporte prioritário 24/7'
    ],
    isActive: true
  }
]

export const initialSubscriptions: Subscription[] = [
  {
    id: 'sub-1',
    tenantId: 'tenant-1',
    companyName: 'Sabores de Moçambique Lda',
    planId: 'plan-pro',
    planName: 'Plano Restaurante Pro',
    status: 'active',
    startDate: '2024-01-15',
    renewalDate: '2026-11-15',
    monthlyPrice: 4490,
    isAutoRenew: true
  },
  {
    id: 'sub-2',
    tenantId: 'tenant-2',
    companyName: 'Ocean Food Group',
    planId: 'plan-enterprise',
    planName: 'Plano Enterprise Redes & Franquias',
    status: 'active',
    startDate: '2024-02-10',
    renewalDate: '2026-12-10',
    monthlyPrice: 9990,
    isAutoRenew: true
  },
  {
    id: 'sub-3',
    tenantId: 'tenant-3',
    companyName: 'Urban Dining Lda',
    planId: 'plan-starter',
    planName: 'Plano Básico / Café',
    status: 'trial',
    startDate: '2026-10-01',
    renewalDate: '2026-10-31',
    monthlyPrice: 1990,
    isAutoRenew: false
  }
]

export const initialDigitalAccessList: DigitalAccess[] = [
  {
    id: 'da-1',
    tenantId: 'tenant-1',
    restaurantId: 'rest-1',
    tableId: 'tbl-1',
    tableNumber: '01',
    url: '/menu/sabores-maputo/01',
    nfcTagUid: 'NFC-SMP-01',
    nfcStatus: 'simulated',
    scanCount: 142,
    lastScannedAt: '2026-10-16T11:15:00Z',
    createdAt: '2024-01-17T09:00:00Z',
    updatedAt: '2026-10-16T11:15:00Z'
  },
  {
    id: 'da-2',
    tenantId: 'tenant-1',
    restaurantId: 'rest-1',
    tableId: 'tbl-2',
    tableNumber: '02',
    url: '/menu/sabores-maputo/02',
    nfcTagUid: 'NFC-SMP-02',
    nfcStatus: 'simulated',
    scanCount: 98,
    lastScannedAt: '2026-10-16T11:32:00Z',
    createdAt: '2024-01-17T09:00:00Z',
    updatedAt: '2026-10-16T11:32:00Z'
  },
  {
    id: 'da-3',
    tenantId: 'tenant-1',
    restaurantId: 'rest-1',
    tableId: 'tbl-3',
    tableNumber: '03',
    url: '/menu/sabores-maputo/03',
    nfcTagUid: 'NFC-SMP-03',
    nfcStatus: 'simulated',
    scanCount: 115,
    lastScannedAt: '2026-10-16T10:45:00Z',
    createdAt: '2024-01-17T09:00:00Z',
    updatedAt: '2026-10-16T10:45:00Z'
  },
  {
    id: 'da-4',
    tenantId: 'tenant-1',
    restaurantId: 'rest-1',
    tableId: 'tbl-4',
    tableNumber: '04',
    url: '/menu/sabores-maputo/04',
    nfcTagUid: 'NFC-SMP-04',
    nfcStatus: 'simulated',
    scanCount: 84,
    lastScannedAt: '2026-10-16T10:15:00Z',
    createdAt: '2024-01-17T09:00:00Z',
    updatedAt: '2026-10-16T10:15:00Z'
  },
  {
    id: 'da-5',
    tenantId: 'tenant-1',
    restaurantId: 'rest-1',
    tableId: 'tbl-5',
    tableNumber: '05',
    url: '/menu/sabores-maputo/05',
    nfcTagUid: 'NFC-SMP-05',
    nfcStatus: 'unprogrammed',
    scanCount: 41,
    createdAt: '2024-01-17T09:00:00Z',
    updatedAt: '2024-01-17T09:00:00Z'
  }
]
