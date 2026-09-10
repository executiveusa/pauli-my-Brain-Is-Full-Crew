import { NextRequest, NextResponse } from 'next/server'
import { authConfiguration, authError, checkReadAuth } from '@/lib/private-auth'
import { getVaultHealth } from '@/lib/vault'
import { supabaseConfigured } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const auth = checkReadAuth(req)
  if (!auth.authenticated) return authError(auth)

  const vault = await getVaultHealth()
  const authConfig = authConfiguration()
  const ok = vault.ok

  return NextResponse.json({
    ok,
    degraded: !ok,
    generatedAt: new Date().toISOString(),
    service: 'pauli-second-brain',
    components: {
      vault,
      supabase: { configured: supabaseConfigured() },
      auth: {
        ownerLoginConfigured: authConfig.ownerLoginConfigured,
        readServiceConfigured: authConfig.readServiceConfigured,
        writeServiceConfigured: authConfig.writeServiceConfigured,
      },
    },
  }, { headers: { 'Cache-Control': 'no-store' } })
}
