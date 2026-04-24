import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join } from 'path'

// Parse key=value lines from a .env file
function parseEnvFile(filePath: string): Record<string, string> {
  const vars: Record<string, string> = {}
  try {
    const lines = readFileSync(filePath, 'utf-8').split('\n')
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const idx = trimmed.indexOf('=')
      if (idx < 0) continue
      const key = trimmed.slice(0, idx).trim()
      const val = trimmed.slice(idx + 1).trim()
      if (key) vars[key] = val
    }
  } catch { /* file not found */ }
  return vars
}

// Cache parsed .env so we only read it once per process lifetime
let _envCache: Record<string, string> | null = null

function getEnv(key: string): string | undefined {
  // Check process.env first (populated by Next.js on normal startup)
  if (process.env[key]) return process.env[key]

  // Fallback: read .env directly (Turbopack worker isolation workaround)
  if (!_envCache) {
    _envCache = parseEnvFile(join(process.cwd(), '.env'))
  }
  return _envCache[key]
}

export function createServerClient() {
  const url = getEnv('NEXT_PUBLIC_SUPABASE_URL')
  const key = getEnv('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. ' +
      'Ensure .env exists in the project root.'
    )
  }
  return createClient(url, key)
}
