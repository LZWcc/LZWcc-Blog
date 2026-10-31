import { execFileSync } from 'node:child_process'
import { copyFile, mkdir, mkdtemp, readdir, rename, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { backup, DatabaseSync } from 'node:sqlite'

// Bundle for the server: bun build preset/scripts/backupComments.ts --target=node --outfile=dist-tools/backup-comments.mjs
// Run daily by blog-comments-backup.timer; node:sqlite backup() needs Node.js 22.16+.
const root = process.env.BLOG_COMMENTS_ROOT || '/opt/blog-comments'
const folder = join(root, 'daily-backups')
const retain = 14

process.umask(0o077)
await mkdir(folder, { recursive: true })
const work = await mkdtemp(join(folder, '.snapshot-'))
const stamp = new Date().toISOString().replace(/[-:]|\.\d+/g, '')
const output = join(folder, `comments-${stamp}.tar.gz`)
const pending = `${output}.partial`
try {
  // An online backup stays consistent while Artalk keeps writing.
  const source = new DatabaseSync(join(root, 'data/artalk.db'), { readOnly: true })
  try {
    await backup(source, join(work, 'artalk.db'))
  } finally {
    source.close()
  }
  const snapshot = new DatabaseSync(join(work, 'artalk.db'), { readOnly: true })
  let comments: number
  try {
    const { integrity_check } = snapshot.prepare('PRAGMA integrity_check').get()!
    if (integrity_check !== 'ok') throw new Error(`Snapshot is corrupt: ${integrity_check}`)
    const { total } = snapshot
      .prepare('SELECT count(*) AS total FROM comments WHERE deleted_at IS NULL')
      .get()!
    comments = Number(total)
  } finally {
    snapshot.close()
  }
  // artalk.yml holds the app key that signs login tokens, so a restore needs it too.
  await copyFile(join(root, 'data/artalk.yml'), join(work, 'artalk.yml'))
  execFileSync('tar', ['-czf', pending, '-C', work, 'artalk.db', 'artalk.yml'])
  await rename(pending, output)
  const archives = (await readdir(folder))
    .filter((name) => /^comments-\d{8}T\d{6}Z\.tar\.gz$/.test(name))
    .sort()
  for (const expired of archives.slice(0, -retain)) await rm(join(folder, expired))
  console.log(`[backup] ${output}: ${comments} comments`)
} finally {
  await rm(work, { recursive: true, force: true })
  await rm(pending, { force: true })
}
