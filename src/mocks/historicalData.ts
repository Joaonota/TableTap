import type { Order, Payment, CustomerReview, OrderItem, OrderStatus, PaymentStatus, PaymentMethod } from '@/types'

// Deterministic Pseudo-Random Generator (LCG) for reproducible mock numbers
class SeededRandom {
  private seed: number
  constructor(seed: number = 123456789) {
    this.seed = seed
  }
  next(): number {
    this.seed = (this.seed * 1664525 + 1013904223) % 4294967296
    return this.seed / 4294967296
  }
  range(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min
  }
  pick<T>(arr: T[]): T {
    return arr[Math.floor(this.next() * arr.length)]
  }
}

const customerNames = [
  'Carlos Sitoe', 'Marta Cossa', 'Paulo Tembe', 'Amélia Mondlane', 'Fátima Guambe',
  'Jorge Chissano', 'Nelson Matsinhe', 'Helena Langa', 'Inês Macuácua', 'Tomás Macamo',
  'Beatriz Nhaca', 'Armando Zandamela', 'Cláudia Mabote', 'Dário Nhantumbo', 'Sérgio Manave',
  'Graça Machel', 'Edson Da Silva', 'Telma Mucavele', 'Zacarias Tivane', 'Lurdes Maposse'
]

const dishesCatalog = [
  { id: 'prod-1', name: 'Frango à Zambeziana da Casa', price: 680, station: 'kitchen' as const, isTop: true },
  { id: 'prod-2', name: 'Camarão Tigre Grelhado', price: 1350, station: 'kitchen' as const, isTop: true },
  { id: 'prod-3', name: 'Matapa Tradicional com Caranguejo', price: 750, station: 'kitchen' as const, isTop: true },
  { id: 'prod-4', name: 'Caril de Camarão à Moda Inhambane', price: 890, station: 'kitchen' as const, isTop: false },
  { id: 'prod-5', name: 'Hambúrguer Especial Sabores (180g)', price: 590, station: 'kitchen' as const, isTop: true },
  { id: 'prod-6', name: 'Hambúrguer Clássico Cheeseburger', price: 450, station: 'kitchen' as const, isTop: false },
  { id: 'prod-7', name: 'Hambúrguer Vegetariano de Grão', price: 480, station: 'kitchen' as const, isLow: true },
  { id: 'prod-8', name: 'Bife à Portuguesa com Presunto', price: 920, station: 'kitchen' as const, isTop: false },
  { id: 'prod-9', name: 'Costelinhas Barbecue de Porco', price: 850, station: 'kitchen' as const, isLow: true },
  { id: 'prod-10', name: 'Pizza Maputo Chic (Camarão)', price: 780, station: 'kitchen' as const, isTop: true },
  { id: 'prod-11', name: 'Pizza Quatro Queijos', price: 640, station: 'kitchen' as const, isTop: false },
  { id: 'prod-12', name: 'Chamuças Tradicionais (4 un.)', price: 240, station: 'kitchen' as const, isLow: true },
  { id: 'prod-14', name: 'Sumo Natural de Maracujá (400ml)', price: 180, station: 'bar' as const, isTop: true }
]

const tableConfigs = [
  { id: 'tbl-1', number: '01', area: 'Sala Principal', capacity: 4, mult: 1.4 },
  { id: 'tbl-2', number: '02', area: 'Sala Principal', capacity: 2, mult: 1.1 },
  { id: 'tbl-3', number: '03', area: 'Sala Principal', capacity: 6, mult: 1.5 },
  { id: 'tbl-4', number: '04', area: 'Esplanada', capacity: 4, mult: 1.3 },
  { id: 'tbl-5', number: '05', area: 'Esplanada', capacity: 4, mult: 1.0 },
  { id: 'tbl-6', number: '06', area: 'Varanda', capacity: 2, mult: 0.8 },
  { id: 'tbl-7', number: '07', area: 'Bar', capacity: 2, mult: 0.7 },
  { id: 'tbl-8', number: '08', area: 'Privado', capacity: 10, mult: 1.8 }
]

export function generateHistoricalOrders(): Order[] {
  const rng = new SeededRandom(42)
  const orders: Order[] = []
  let orderSeq = 1000

  // Reference base date: 2026-11-03 (Today)
  const baseDate = new Date('2026-11-03T12:00:00Z')

  // Generate for 95 days in the past (Aug 1, 2026 to Nov 3, 2026)
  for (let daysAgo = 94; daysAgo >= 0; daysAgo--) {
    const targetDate = new Date(baseDate.getTime() - daysAgo * 24 * 60 * 60 * 1000)
    const dayOfWeek = targetDate.getDay() // 0 = Sun, 5 = Fri, 6 = Sat
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 5 || dayOfWeek === 6

    // Number of orders per restaurant per day
    const restCounts: { [key: string]: number } = {
      'rest-1': isWeekend ? rng.range(7, 11) : rng.range(4, 7),
      'rest-2': isWeekend ? rng.range(5, 8) : rng.range(3, 5),
      'rest-3': isWeekend ? rng.range(4, 6) : rng.range(2, 4),
      'rest-4': isWeekend ? rng.range(6, 10) : rng.range(3, 6)
    }

    // Generate for each restaurant
    for (const [restaurantId, count] of Object.entries(restCounts)) {
      const tenantId = restaurantId === 'rest-4' ? 'tenant-2' : 'tenant-1'

      for (let i = 0; i < count; i++) {
        orderSeq++
        const table = rng.pick(tableConfigs)

        // Determine hour of day: 45% lunch (12h-14h), 45% dinner (19h-22h), 10% afternoon (15h-17h)
        const hourCategory = rng.next()
        let hour: number
        let minute = rng.range(0, 59)

        if (hourCategory < 0.45) {
          hour = rng.pick([12, 12, 13, 13, 14]) // Lunch peak
        } else if (hourCategory < 0.90) {
          hour = rng.pick([19, 19, 20, 20, 21, 22]) // Dinner peak
        } else {
          hour = rng.pick([10, 11, 15, 16, 17]) // Off-peak
        }

        const orderDateTime = new Date(targetDate)
        orderDateTime.setHours(hour, minute, rng.range(0, 59))
        const isoTimestamp = orderDateTime.toISOString()

        // Cancellation rate ~2.5%
        const isCancelled = daysAgo > 0 && rng.next() < 0.025
        const status: OrderStatus = isCancelled
          ? 'cancelled'
          : daysAgo === 0 && hour >= 12
            ? rng.pick(['preparing', 'ready', 'delivered'] as OrderStatus[])
            : 'delivered'

        const paymentStatus: PaymentStatus = isCancelled
          ? 'failed'
          : status === 'preparing'
            ? 'pending'
            : 'paid'

        const paymentMethod: PaymentMethod = rng.pick(['mpesa', 'mpesa', 'card', 'emola', 'cash'] as PaymentMethod[])

        // Pick 1 to 4 items
        const numItems = rng.range(1, 3)
        const items: OrderItem[] = []
        let subtotal = 0

        for (let j = 0; j < numItems; j++) {
          // Weight towards top dishes unless low sales
          let dish = rng.pick(dishesCatalog)
          if (dish.isLow && rng.next() > 0.25) {
            dish = rng.pick(dishesCatalog.filter(d => !d.isLow))
          }

          const quantity = rng.range(1, 2)
          const unitPrice = dish.price
          const totalPrice = unitPrice * quantity
          subtotal += totalPrice

          items.push({
            id: `item-${orderSeq}-${j}`,
            productId: dish.id,
            productName: dish.name,
            quantity,
            unitPrice,
            totalPrice,
            station: dish.station
          })
        }

        const taxAmount = Math.round(subtotal * 0.16)
        const serviceFee = Math.round(subtotal * 0.10)
        const total = subtotal + taxAmount + serviceFee
        const customerName = rng.pick(customerNames)

        orders.push({
          id: `ord-hist-${orderSeq}`,
          tenantId,
          restaurantId,
          tableId: table.id,
          tableNumber: table.number,
          orderCode: `#ORD-${orderSeq}`,
          type: 'dine_in',
          status,
          paymentStatus,
          paymentMethod,
          items,
          subtotal,
          taxAmount,
          serviceFee,
          total,
          customerName,
          customerPhone: `+258 84 ${rng.range(100, 999)} ${rng.range(1000, 9999)}`,
          history: [
            {
              status: 'received',
              timestamp: isoTimestamp,
              updatedBy: 'Cliente (Menu Digital)'
            },
            {
              status,
              timestamp: new Date(orderDateTime.getTime() + 15 * 60000).toISOString(),
              updatedBy: 'Cozinha KDS'
            }
          ],
          createdAt: isoTimestamp,
          updatedAt: isoTimestamp
        })
      }
    }
  }

  return orders
}

export function generateHistoricalPayments(orders: Order[]): Payment[] {
  const rng = new SeededRandom(88)
  const payments: Payment[] = []

  orders.forEach((ord, idx) => {
    if (ord.paymentStatus === 'paid' && ord.paymentMethod) {
      payments.push({
        id: `pay-hist-${idx + 1000}`,
        tenantId: ord.tenantId,
        restaurantId: ord.restaurantId,
        orderId: ord.id,
        orderCode: ord.orderCode,
        tableNumber: ord.tableNumber,
        amount: ord.total,
        method: ord.paymentMethod,
        status: 'paid',
        transactionReference: `MP-${ord.restaurantId.substring(0, 3).toUpperCase()}-${Date.parse(ord.createdAt)}-${idx}`,
        customerPhone: ord.customerPhone,
        createdAt: ord.createdAt
      })
    }
  })

  return payments
}

export function generateHistoricalReviews(): CustomerReview[] {
  return [
    // Negative Alerts (<= 2 stars) for Manager Action Workflow
    {
      id: 'rev-neg-1',
      tenantId: 'tenant-1',
      restaurantId: 'rest-1',
      restaurantName: 'Sabores Maputo',
      tableId: 'tbl-4',
      tableNumber: '04',
      customerName: 'Paulo Tembe',
      customerPhone: '+258 84 333 1122',
      overallRating: 1,
      foodRating: 2,
      serviceRating: 1,
      ambienceRating: 3,
      waitTimeRating: 'very_slow',
      comment: 'Tempo de espera inaceitável. Esperámos mais de 50 minutos pelos camarões no almoço de sábado. O garçom não nos dava qualquer atualização.',
      status: 'pending',
      isNegativeAlert: true,
      createdAt: '2026-11-02T13:45:00Z'
    },
    {
      id: 'rev-neg-2',
      tenantId: 'tenant-1',
      restaurantId: 'rest-1',
      restaurantName: 'Sabores Maputo',
      tableId: 'tbl-2',
      tableNumber: '02',
      customerName: 'Dra. Marta Chissano',
      customerPhone: '+258 84 555 9900',
      overallRating: 2,
      foodRating: 2,
      serviceRating: 2,
      ambienceRating: 4,
      waitTimeRating: 'slow',
      comment: 'O hambúrguer veio morno e faltava a dose de molho de piripíri pedida no menu digital. Precisam de melhorar o controlo da cozinha.',
      status: 'analyzed',
      isNegativeAlert: true,
      managerNotes: 'Conversado com o Chefe Helena sobre o timing de saída da estação de grelhados.',
      createdAt: '2026-10-30T20:15:00Z'
    },
    {
      id: 'rev-neg-3',
      tenantId: 'tenant-1',
      restaurantId: 'rest-1',
      restaurantName: 'Sabores Maputo',
      tableId: 'tbl-7',
      tableNumber: '07',
      customerName: 'Zacarias Tivane',
      customerPhone: '+258 84 777 4433',
      overallRating: 2,
      foodRating: 3,
      serviceRating: 2,
      ambienceRating: 2,
      waitTimeRating: 'adequate',
      comment: 'Música muito alta junto ao balcão e houve uma cobrança duplicada no M-Pesa que tive de reclamar com o gerente.',
      status: 'resolved',
      isNegativeAlert: true,
      managerNotes: 'Estorno imediato verificado e conferência do log com a Vodacom.',
      correctiveAction: 'Valor estornado e oferecido voucher de 500 MT para a próxima visita.',
      resolvedAt: '2026-10-28T18:00:00Z',
      resolvedBy: 'Rui Mondlane (Admin)',
      createdAt: '2026-10-27T21:30:00Z'
    },
    {
      id: 'rev-neg-4',
      tenantId: 'tenant-1',
      restaurantId: 'rest-1',
      restaurantName: 'Sabores Maputo',
      tableId: 'tbl-3',
      tableNumber: '03',
      customerName: 'Armando Zandamela',
      customerPhone: '+258 84 222 8811',
      overallRating: 1,
      foodRating: 2,
      serviceRating: 1,
      ambienceRating: 3,
      waitTimeRating: 'very_slow',
      comment: 'Atraso enorme. Pedimos às 20h e só serviram às 21h15. Acabámos por cancelar a sobremesa.',
      status: 'pending',
      isNegativeAlert: true,
      createdAt: '2026-11-01T21:40:00Z'
    },

    // Positive and High Reviews (4 and 5 stars)
    {
      id: 'rev-pos-1',
      tenantId: 'tenant-1',
      restaurantId: 'rest-1',
      restaurantName: 'Sabores Maputo',
      tableId: 'tbl-1',
      tableNumber: '01',
      customerName: 'João Cossa',
      overallRating: 5,
      foodRating: 5,
      serviceRating: 5,
      ambienceRating: 5,
      waitTimeRating: 'very_fast',
      comment: 'O frango à zambeziana é simplesmente o melhor de Maputo! O atendimento do Tomás foi atencioso e o menu por QR Code funcionou perfeitamente.',
      status: 'analyzed',
      isNegativeAlert: false,
      createdAt: '2026-11-03T11:45:00Z'
    },
    {
      id: 'rev-pos-2',
      tenantId: 'tenant-1',
      restaurantId: 'rest-1',
      restaurantName: 'Sabores Maputo',
      tableId: 'tbl-1',
      tableNumber: '01',
      customerName: 'Fátima Guambe',
      overallRating: 5,
      foodRating: 5,
      serviceRating: 5,
      ambienceRating: 5,
      waitTimeRating: 'adequate',
      comment: 'Experiência 5 estrelas. Camarão tigre fresquíssimo e ambiente muito acolhedor na sala principal.',
      status: 'resolved',
      isNegativeAlert: false,
      createdAt: '2026-10-31T14:20:00Z'
    },
    {
      id: 'rev-pos-3',
      tenantId: 'tenant-1',
      restaurantId: 'rest-1',
      restaurantName: 'Sabores Maputo',
      tableId: 'tbl-5',
      tableNumber: '05',
      customerName: 'Nelson Matsinhe',
      overallRating: 4,
      foodRating: 5,
      serviceRating: 4,
      ambienceRating: 4,
      waitTimeRating: 'adequate',
      comment: 'A matapa com caranguejo é imperdível. Processo de pedir a conta no telemóvel poupa imenso tempo.',
      status: 'analyzed',
      isNegativeAlert: false,
      createdAt: '2026-10-29T13:10:00Z'
    },
    {
      id: 'rev-pos-4',
      tenantId: 'tenant-1',
      restaurantId: 'rest-1',
      restaurantName: 'Sabores Maputo',
      tableId: 'tbl-6',
      tableNumber: '06',
      customerName: 'Inês Macuácua',
      overallRating: 5,
      foodRating: 5,
      serviceRating: 5,
      ambienceRating: 4,
      waitTimeRating: 'very_fast',
      comment: 'Pizzas muito boas no forno e sumo de maracujá natural fresco. Adorámos a facilidade de pedir pelo telemóvel.',
      status: 'resolved',
      isNegativeAlert: false,
      createdAt: '2026-10-26T19:50:00Z'
    },
    {
      id: 'rev-pos-5',
      tenantId: 'tenant-1',
      restaurantId: 'rest-1',
      restaurantName: 'Sabores Maputo',
      tableId: 'tbl-2',
      tableNumber: '02',
      customerName: 'Jorge Chissano',
      overallRating: 4,
      foodRating: 4,
      serviceRating: 4,
      ambienceRating: 4,
      waitTimeRating: 'adequate',
      comment: 'Tudo muito bom e prático.',
      status: 'analyzed',
      isNegativeAlert: false,
      createdAt: '2026-10-24T12:30:00Z'
    },

    // Branch 2: Sabores Matola (rest-2) - High customer satisfaction
    {
      id: 'rev-mat-1',
      tenantId: 'tenant-1',
      restaurantId: 'rest-2',
      restaurantName: 'Sabores Matola',
      tableId: 'tbl-201',
      tableNumber: 'M1',
      customerName: 'Cláudia Mabote',
      overallRating: 5,
      foodRating: 5,
      serviceRating: 5,
      ambienceRating: 5,
      waitTimeRating: 'very_fast',
      comment: 'Ambiente de esplanada incrível na Matola. Excelente marisco e atendimento de topo!',
      status: 'analyzed',
      isNegativeAlert: false,
      createdAt: '2026-11-02T14:10:00Z'
    },
    {
      id: 'rev-mat-2',
      tenantId: 'tenant-1',
      restaurantId: 'rest-2',
      restaurantName: 'Sabores Matola',
      tableId: 'tbl-202',
      tableNumber: 'M2',
      customerName: 'Sérgio Manave',
      overallRating: 5,
      foodRating: 5,
      serviceRating: 5,
      ambienceRating: 4,
      waitTimeRating: 'adequate',
      comment: 'Almoço em família perfeito. As doses são generosas e o pagamento por M-Pesa é imediato.',
      status: 'resolved',
      isNegativeAlert: false,
      createdAt: '2026-10-31T15:20:00Z'
    },
    {
      id: 'rev-mat-3',
      tenantId: 'tenant-1',
      restaurantId: 'rest-2',
      restaurantName: 'Sabores Matola',
      tableId: 'tbl-201',
      tableNumber: 'M1',
      customerName: 'Telma Mucavele',
      overallRating: 4,
      foodRating: 4,
      serviceRating: 4,
      ambienceRating: 5,
      waitTimeRating: 'adequate',
      comment: 'Muito bom serviço, esplanada agradável.',
      status: 'analyzed',
      isNegativeAlert: false,
      createdAt: '2026-10-25T13:40:00Z'
    },

    // Branch 3: Sabores Beira (rest-3)
    {
      id: 'rev-bei-1',
      tenantId: 'tenant-1',
      restaurantId: 'rest-3',
      restaurantName: 'Sabores Beira',
      tableId: 'tbl-301',
      tableNumber: 'B1',
      customerName: 'Dário Nhantumbo',
      overallRating: 4,
      foodRating: 4,
      serviceRating: 4,
      ambienceRating: 4,
      waitTimeRating: 'adequate',
      comment: 'Boa comida e vista para a praia do Macuti.',
      status: 'analyzed',
      isNegativeAlert: false,
      createdAt: '2026-10-28T19:30:00Z'
    },

    // Branch 4: Ocean Restaurant (rest-4, tenant-2)
    {
      id: 'rev-ocn-1',
      tenantId: 'tenant-2',
      restaurantId: 'rest-4',
      restaurantName: 'Ocean Restaurant & Lounge',
      tableId: 'tbl-401',
      tableNumber: 'O-01',
      customerName: 'Edson Da Silva',
      overallRating: 5,
      foodRating: 5,
      serviceRating: 5,
      ambienceRating: 5,
      waitTimeRating: 'very_fast',
      comment: 'Vista espetacular para a baía, mariscos requintados e carta de vinhos seletiva.',
      status: 'resolved',
      isNegativeAlert: false,
      createdAt: '2026-11-01T20:15:00Z'
    },
    {
      id: 'rev-ocn-2',
      tenantId: 'tenant-2',
      restaurantId: 'rest-4',
      restaurantName: 'Ocean Restaurant & Lounge',
      tableId: 'tbl-402',
      tableNumber: 'O-02',
      customerName: 'Graça Machel',
      overallRating: 4,
      foodRating: 4,
      serviceRating: 4,
      ambienceRating: 5,
      waitTimeRating: 'adequate',
      comment: 'Ambiente acolhedor e requintado.',
      status: 'analyzed',
      isNegativeAlert: false,
      createdAt: '2026-10-29T21:00:00Z'
    }
  ]
}

