import { mkdir, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

import { getPageviews } from '../../src/pages/stats/pageviews.json'

// Bundle for the server: bun build preset/scripts/syncPageviews.ts --target=node --outfile=dist-tools/sync-pageviews.mjs
const output = process.argv[2]
if (!output) throw new Error('Usage: sync-pageviews.mjs /absolute/path/pageviews.json')

const pageviews = await getPageviews()
if (pageviews === null) {
  console.error('[umami] Sync failed; keeping the previous snapshot.')
  process.exitCode = 1
} else {
  const target = resolve(output)
  const temporary = `${target}.${process.pid}.tmp`
  try {
    await mkdir(dirname(target), { recursive: true })
    await writeFile(temporary, JSON.stringify(pageviews), { mode: 0o644 })
    await rename(temporary, target)
    console.log(`[umami] Updated ${Object.keys(pageviews).length} paths.`)
  } finally {
    await rm(temporary, { force: true })
  }
}
