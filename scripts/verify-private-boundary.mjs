import fs from 'node:fs'

const read = (path) => fs.readFileSync(path, 'utf8')
const failures = []
const check = (name, condition) => {
  console.log(`${condition ? 'PASS' : 'FAIL'} ${name}`)
  if (!condition) failures.push(name)
}

const readRoutes = [
  'app/api/search/route.ts',
  'app/api/vault/route.ts',
  'app/api/note/route.ts',
  'app/api/agent-log/route.ts',
  'app/api/status/route.ts',
]

for (const route of readRoutes) {
  check(`${route} requires read authentication`, read(route).includes('checkReadAuth'))
}

const agentLog = read('app/api/agent-log/route.ts')
check('agent log write uses separate write authentication', agentLog.includes('checkWriteAuth'))
check('agent log write requires a durable receipt', agentLog.includes('writeAgentAction') && agentLog.includes('receipt'))

const auth = read('lib/private-auth.ts')
check('service secrets stay environment-backed', auth.includes('process.env.BRAIN_SERVICE_TOKEN') && auth.includes('process.env.BRAIN_WRITE_TOKEN'))
check('owner session cookie is HttpOnly at issuance', read('app/api/auth/session/route.ts').includes('httpOnly: true'))
check('session signatures use HMAC', auth.includes("createHmac('sha256'"))
check('secret comparisons are timing safe', auth.includes('timingSafeEqual'))

const vault = read('lib/vault.ts')
check('vault rejects parent traversal', vault.includes("segment === '..'"))
check('vault rejects absolute paths', vault.includes("raw.startsWith('/')"))
check('vault note reads are markdown confined', vault.includes('markdownOnly: true'))

const search = read('app/api/search/route.ts')
check('private search returns per-result provenance', search.includes('provenance') && search.includes('canonicalPath'))

const page = read('app/page.tsx')
check('dashboard data components sit behind AuthGate', page.includes('<AuthGate>'))

const status = read('app/api/status/route.ts')
check('status does not emit secret values directly', !/process\.env\.[A-Z0-9_]+/.test(status))

if (failures.length) {
  console.error(`\n${failures.length} private-boundary check(s) failed.`)
  process.exit(1)
}

console.log('\nPrivate Second Brain boundary checks passed.')
