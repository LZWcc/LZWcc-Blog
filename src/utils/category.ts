// 文章分类（frontmatter 的 category）：按文章写的是什么分，一篇一类。和 AI 参与了多少无关，那个看 authorship
export const CATEGORIES = [
  { key: 'project', label: '项目', note: '自己做的东西的开发记录' },
  { key: 'postmortem', label: '踩坑复盘', note: '线上问题和排障' },
  { key: 'tooling', label: '工具配置', note: '开发环境、AI 工具的配置和工作流' },
  { key: 'study', label: '学习笔记', note: '课程、刷题、面试、教程' }
] as const

export type Category = (typeof CATEGORIES)[number]['key']

export const categoryLabel = (key?: Category) => CATEGORIES.find((c) => c.key === key)?.label
