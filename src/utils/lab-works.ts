// 作品站（lab.lzwcc.xyz）的作品列表，给首页右栏用。构建时请求作品站静态导出的 /works.json（从新到旧），
// 5 秒内拿不到（断网、作品站还没部署）就用仓库里的快照 lab-works.snapshot.json。
// 快照可以用 curl -s https://lab.lzwcc.xyz/works.json > src/utils/lab-works.snapshot.json 更新
import snapshot from './lab-works.snapshot.json'

export const LAB = 'https://lab.lzwcc.xyz'

export interface LabWork {
  path: string
  title: string
  short?: string
  cover?: string
  date: string
  type: 'ui' | 'animation' | 'project'
  no: string
}

let works: Promise<LabWork[]> | undefined

export function getLabWorks() {
  works ??= fetch(`${LAB}/works.json`, { signal: AbortSignal.timeout(5000) })
    .then((r) =>
      r.ok ? (r.json() as Promise<LabWork[]>) : Promise.reject(new Error(`${r.status}`))
    )
    .catch(() => snapshot as LabWork[])
  return works
}
