// ==========================================
// ETIQUETAS NFC — GESTÃO ADMINISTRATIVA
//
// O TapMenu NÃO grava etiquetas fisicamente. A equipa TapMenu grava a URL
// da mesa com uma aplicação externa de gravação NFC; aqui fica apenas o
// registo administrativo (que etiqueta, que mesa, que URL, em que estado).
// ==========================================

/**
 * - pending:              registada, ainda sem configuração física registada;
 * - configured:           a equipa registou que gravou a URL da mesa associada;
 * - active:               configurada e instalada/em uso na mesa;
 * - disabled:             retirada de uso (perdida, danificada, substituída…);
 * - reassignment_pending: a URL gravada já não corresponde à mesa associada —
 *                         a etiqueta tem de ser regravada pela equipa.
 */
export type NfcTagStatus = 'pending' | 'configured' | 'active' | 'disabled' | 'reassignment_pending'

export interface NfcTag {
  /** ID interno do sistema. */
  id: string
  /** Código/identificador físico impresso na etiqueta (ex.: TAG-00017). */
  code: string
  tenantId: string
  restaurantId: string
  /** Mesa associada (opcional — etiquetas em stock não têm mesa). */
  tableId?: string
  /**
   * Caminho público que a etiqueta DEVE conter (ex.: /m/sabores/mesa-08),
   * derivado da mesa associada. A URL absoluta é construída na apresentação.
   */
  targetPath?: string
  /**
   * Caminho que a equipa registou como efetivamente gravado na última
   * configuração. Quando difere de `targetPath`, a etiqueta precisa de ser
   * regravada (estado `reassignment_pending`).
   */
  configuredPath?: string
  status: NfcTagStatus
  /** Data em que a equipa registou a configuração física. */
  configuredAt?: string
  configuredBy?: string
  notes?: string
  createdAt: string
  /** Última alteração do registo. */
  updatedAt: string
}

export type NfcTagEventType =
  | 'registered'
  | 'associated'
  | 'association_changed'
  | 'unassigned'
  | 'configured'
  | 'activated'
  | 'disabled'
  | 'reactivated'
  | 'note'

export interface NfcTagEvent {
  id: string
  tagId: string
  type: NfcTagEventType
  description: string
  actor: string
  createdAt: string
  tableId?: string
  tableLabel?: string
  path?: string
  fromStatus?: NfcTagStatus
  toStatus?: NfcTagStatus
}
