import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { promisify } from 'node:util'
import vm from 'node:vm'
import ts from 'typescript'

const routeSource = readFileSync(
  new URL('../src/pages/stats/pageviews.json.ts', import.meta.url),
  'utf8'
)
const componentSource = readFileSync(
  new URL('../src/components/remark42/PageInfo.astro', import.meta.url),
  'utf8'
)

async function runRoute(fetchImpl: typeof fetch, apiKey = 'test-api-key') {
  const source = routeSource
    .replace(/import type .*?from 'astro'\n/, '')
    .replace(/import \{ umamiConfig \} from '@\/site-config'/, '')
    .replace('export const getPageviews', 'const getPageviews')
    .replace('export const GET: APIRoute', 'const GET')
  const { outputText: code } = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext }
  })
  const context = vm.createContext({
    umamiConfig: {
      websiteId: 'test-website',
      apiEndpoint: 'https://api.umami.is/v1',
      statsStartAt: '2026-01-01'
    },
    process: { env: { UMAMI_API_KEY: apiKey } },
    fetch: fetchImpl,
    URL,
    Response,
    AbortSignal,
    console: { warn() {} }
  })
  vm.runInContext(code + '\n globalThis.route = GET;', context)
  return context.route()
}

test('uses documented Bearer authentication and merges URL variants', async () => {
  const response = await runRoute((async (input, init) => {
    const url = new URL(String(input))
    assert.ok(url.pathname.endsWith('/breakdown'))
    assert.equal(url.searchParams.get('fields'), '["path"]')
    assert.equal(url.searchParams.get('eventType'), '1')
    assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer test-api-key')
    return Response.json([
      { path: '/blog/example/', views: 3, visitors: 1 },
      { path: '/blog/example', views: 2, visitors: 1 }
    ])
  }) as typeof fetch)
  const data = await response.json()
  assert.equal(data['/blog/example'], 5)
  assert.equal(data['/blog/example/'], 5)
})

test('API rejection is unavailable, not an empty successful snapshot', async () => {
  const response = await runRoute((async () => new Response(null, { status: 403 })) as typeof fetch)
  assert.equal(await response.json(), null)
})

test('missing credentials and malformed responses are unavailable', async () => {
  const unusedFetch = (async () => {
    throw new Error('must not fetch')
  }) as typeof fetch
  assert.equal(await (await runRoute(unusedFetch, '')).json(), null)
  for (const payload of [{ error: 'invalid' }, [{ path: '/blog/example', views: 'oops' }]]) {
    const response = await runRoute((async () => Response.json(payload)) as typeof fetch)
    assert.equal(await response.json(), null)
  }
})

test('counter distinguishes unavailable data from a successful zero', async () => {
  const script = componentSource.match(
    /<script is:inline define:vars=\{\{ statsJsonPath \}\}>([\s\S]*?)<\/script>/
  )![1]
  for (const [payload, ok, expected] of [
    [{}, true, '—'],
    [null, true, '—'],
    [{ '/blog/example': 0 }, true, '0'],
    [{ '/blog/example/': 8 }, true, '8'],
    [{}, false, '—']
  ] as const) {
    const element = { dataset: { path: '/blog/example/' }, textContent: '', title: '' }
    const context = vm.createContext({
      statsJsonPath: '/stats/pageviews.json',
      window: { location: { pathname: '/blog/example/' } },
      document: {
        readyState: 'loading',
        addEventListener() {},
        querySelectorAll() {
          return [element]
        }
      },
      fetch: async () => ({ ok, json: async () => payload }),
      AbortSignal,
      console
    })
    vm.runInContext(script, context)
    await context.renderUmamiPageviews()
    assert.equal(element.textContent, expected)
  }
})

test('server sync writes successful data atomically and preserves it after a 403', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'blog-umami-test-'))
  const run = promisify(execFile)
  let forbidden = false
  const server = createServer((request, response) => {
    assert.equal(request.headers.authorization, 'Bearer test-api-key')
    response.writeHead(forbidden ? 403 : 200, { 'Content-Type': 'application/json' })
    response.end(
      forbidden ? '{}' : JSON.stringify([{ path: '/blog/example/', views: 8, visitors: 2 }])
    )
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  try {
    const bundle = join(directory, 'sync.mjs')
    const output = join(directory, 'pageviews.json')
    await run('bun', [
      'build',
      'preset/scripts/syncPageviews.ts',
      '--target=node',
      `--outfile=${bundle}`
    ])
    const address = server.address() as { port: number }
    const env = {
      ...process.env,
      UMAMI_API_KEY: 'test-api-key',
      PUBLIC_UMAMI_WEBSITE_ID: 'test-website',
      UMAMI_API_CLIENT_ENDPOINT: `http://127.0.0.1:${address.port}`
    }
    await run('node', [bundle, output], { env })
    const snapshot = await readFile(output, 'utf8')
    assert.equal(JSON.parse(snapshot)['/blog/example/'], 8)
    forbidden = true
    await assert.rejects(run('node', [bundle, output], { env }))
    assert.equal(await readFile(output, 'utf8'), snapshot)
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    )
    await rm(directory, { recursive: true, force: true })
  }
})
