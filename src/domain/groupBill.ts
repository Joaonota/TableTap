/**
 * Modo Grupo — conta individual e colectiva de uma sessão de mesa.
 *
 * Os valores vêm SEMPRE do servidor (get_session_bill, migração 1800): o
 * frontend só mostra e pré-visualiza. O servidor recalcula tudo ao pagar
 * e recusa cobranças duplicadas.
 */
import type { PaymentMethod, PaymentStatus } from '@/types'

export type SplitMode = 'own' | 'equal' | 'items' | 'all'

export interface BillParticipant {
  id: string
  name: string
  avatar?: string
  isPrimary: boolean
  active: boolean
  isMe: boolean
  /** Valor do que esta pessoa pediu. */
  consumption: number
  /** Parte do consumo já paga (por quem quer que seja). */
  paid: number
  /** Parte do consumo com pagamento a aguardar confirmação. */
  reserved: number
  /** Consumo - pago (inclui o que aguarda confirmação). */
  pending: number
  /** Ainda sem ninguém a pagar. */
  outstanding: number
}

export interface BillLine {
  itemId: string
  orderId: string
  orderCode: string
  orderStatus: string
  participantId?: string
  productName: string
  quantity: number
  unitPrice: number
  itemTotal: number
  due: number
  paid: number
  reserved: number
  outstanding: number
}

export interface BillPayment {
  id: string
  participantId?: string
  payerName?: string
  amount: number
  method: PaymentMethod
  status: PaymentStatus
  splitMode?: SplitMode
  createdAt: string
  isMine: boolean
}

export interface SessionBill {
  sessionId: string
  status: string
  meParticipantId?: string
  totals: { total: number; paid: number; reserved: number; outstanding: number; pending: number }
  /** O que cabe a esta pessoa na divisão igual do que está em aberto. */
  equalShare: number
  equalPayers: number
  participants: BillParticipant[]
  lines: BillLine[]
  payments: BillPayment[]
}

export interface ItemSelection {
  itemId: string
  quantity: number
}

export const SPLIT_MODE_LABELS: Record<SplitMode, { title: string; hint: string }> = {
  own: { title: 'Pagar o meu consumo', hint: 'Só o que eu pedi.' },
  equal: { title: 'Dividir igualmente', hint: 'O que falta, a dividir por quem ainda não pagou.' },
  items: { title: 'Escolher produtos', hint: 'Escolho os produtos que quero pagar.' },
  all: { title: 'Pagar a conta toda', hint: 'Pago tudo o que falta da mesa.' }
}

export const PAYMENT_STATUS_SHORT: Partial<Record<PaymentStatus, string>> = {
  pending: 'A aguardar',
  awaiting_confirmation: 'A aguardar confirmação',
  confirmed: 'Confirmado',
  paid: 'Pago',
  failed: 'Cancelado',
  refunded: 'Reembolsado'
}

// ---------------------------------------------------------------------
// Avatares (cores — sem emojis na interface)
// ---------------------------------------------------------------------
export const AVATAR_COLORS: Record<string, string> = {
  blue: '#2563eb',
  teal: '#0d9488',
  green: '#16a34a',
  amber: '#d97706',
  orange: '#ea580c',
  rose: '#e11d48',
  violet: '#7c3aed',
  slate: '#475569'
}
export const AVATAR_KEYS = Object.keys(AVATAR_COLORS)

/** Cor do avatar: a escolhida, ou uma estável derivada do id. */
export function avatarColor(participant: { id: string; avatar?: string }): string {
  if (participant.avatar && AVATAR_COLORS[participant.avatar]) return AVATAR_COLORS[participant.avatar]
  let hash = 0
  for (const ch of participant.id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  return AVATAR_COLORS[AVATAR_KEYS[hash % AVATAR_KEYS.length]]
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}

// ---------------------------------------------------------------------
// Pré-visualização (o servidor confirma o valor real)
// ---------------------------------------------------------------------
const round2 = (v: number) => Math.round(v * 100) / 100

/** Valor de uma selecção de itens (igual à regra do servidor). */
export function selectionAmount(bill: SessionBill, selection: ItemSelection[]): number {
  let sum = 0
  for (const s of selection) {
    const line = bill.lines.find(l => l.itemId === s.itemId)
    if (!line || s.quantity < 1 || line.outstanding <= 0) continue
    const value = s.quantity >= line.quantity ? line.outstanding : Math.min(line.outstanding, round2((line.due * s.quantity) / line.quantity))
    sum += value
  }
  return round2(sum)
}

/** Valor previsto para cada forma de pagar. */
export function previewAmount(bill: SessionBill, mode: SplitMode, selection: ItemSelection[] = []): number {
  switch (mode) {
    case 'own':
      return round2(bill.participants.find(p => p.isMe)?.outstanding ?? 0)
    case 'equal':
      return round2(bill.equalShare)
    case 'items':
      return selectionAmount(bill, selection)
    case 'all':
      return round2(bill.totals.outstanding)
  }
}

export const formatMt = (v: number) => `${v.toLocaleString('pt-MZ', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} MT`
