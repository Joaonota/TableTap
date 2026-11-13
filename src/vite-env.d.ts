/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  /** Chave pública do projeto (Settings → API Keys → publishable / anon). */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string
  /** Nome alternativo da mesma chave pública (projetos com chaves "legacy"). */
  readonly VITE_SUPABASE_ANON_KEY?: string
  /** Domínio público usado nas URLs das mesas (etiquetas NFC e QR Code). */
  readonly VITE_PUBLIC_BASE_URL?: string
  readonly VITE_APP_TITLE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
