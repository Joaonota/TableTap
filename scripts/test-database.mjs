/**
 * Testes da base de dados (RLS, isolamento entre empresas, regras de negócio).
 *
 * Cria uma base temporária num PostgreSQL local, aplica uma simulação mínima
 * do Supabase (supabase/tests/supabase_stub.sql), todas as migrations e os
 * testes (supabase/tests/database.test.sql), e apaga a base no fim.
 *
 * Variáveis (opcionais):
 *   PSQL          caminho do psql        (por omissão: psql no PATH)
 *   TEST_PG_HOST  / TEST_PG_PORT / TEST_PG_USER   (localhost / 5432 / postgres)
 */
import { spawnSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import path from 'node:path'

const psql = process.env.PSQL || 'psql'
const conn = ['-h', process.env.TEST_PG_HOST || 'localhost', '-p', process.env.TEST_PG_PORT || '5432', '-U', process.env.TEST_PG_USER || 'postgres']
const db = `tapmenu_test_${Date.now()}`

const run = (args, { quiet = false } = {}) => {
  const r = spawnSync(psql, [...conn, '-v', 'ON_ERROR_STOP=1', '-q', ...args], { encoding: 'utf8' })
  const out = `${r.stdout ?? ''}${r.stderr ?? ''}`
  if (r.status !== 0) {
    console.error(out)
    throw new Error(`psql falhou: ${args.join(' ')}`)
  }
  if (!quiet) return out
  return ''
}

let failed = false
run(['-d', 'postgres', '-c', `create database ${db}`])
try {
  run(['-d', db, '-f', 'supabase/tests/supabase_stub.sql'], { quiet: true })
  const dir = 'supabase/migrations'
  for (const file of readdirSync(dir).filter(f => f.endsWith('.sql')).sort()) {
    run(['-d', db, '-f', path.join(dir, file)], { quiet: true })
  }
  const out = run(['-d', db, '-f', 'supabase/tests/database.test.sql'])
  console.log(out.split('\n').filter(l => /^(PASS|FAIL)|testes passaram/.test(l)).join('\n'))
} catch (e) {
  failed = true
  console.error(e.message)
} finally {
  run(['-d', 'postgres', '-c', `drop database if exists ${db}`])
}
process.exit(failed ? 1 : 0)
