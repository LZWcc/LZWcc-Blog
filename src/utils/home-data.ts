// 首页（src/pages/index.astro）用的作品站数据：作品、AI 用量、GitHub 贡献、技术栈。
// 构建时请求 lab.lzwcc.xyz/home.json（作品站静态导出时生成，见 ui-motion-lab 的 server/routes/home.json.ts），
// 5 秒内拿不到就用仓库里的快照：curl -s https://lab.lzwcc.xyz/home.json > src/utils/home-data.snapshot.json
import snapshot from './home-data.snapshot.json'

export const LAB = 'https://lab.lzwcc.xyz'
export type HomeData = typeof snapshot

let data: Promise<HomeData> | undefined

export function getHomeData() {
  data ??= fetch(`${LAB}/home.json`, { signal: AbortSignal.timeout(5000) })
    .then((r) =>
      r.ok ? (r.json() as Promise<HomeData>) : Promise.reject(new Error(`${r.status}`))
    )
    .catch(() => snapshot)
  return data
}
