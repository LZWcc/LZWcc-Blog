// 文章的署名（frontmatter 的 authorship）显示成一行字：手写 / AI 协助：模型 / AI 生成：模型
// 文章页顶部（components/blog/PostHero.astro）和首页的文章卡片共用
export interface Authorship {
  mode: 'human' | 'assisted' | 'generated'
  models: string[]
}

export function authorshipLabel(authorship?: Authorship) {
  if (!authorship) return undefined
  if (authorship.mode === 'human') return '手写'
  const mode = authorship.mode === 'assisted' ? 'AI 协助' : 'AI 生成'
  return `${mode}：${authorship.models.join('、')}`
}
