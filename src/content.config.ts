import { defineCollection, z } from 'astro:content'
import { glob } from 'astro/loaders'

function removeDupsAndLowerCase(array: string[]) {
  if (!array.length) return array
  const lowercaseItems = array.map((str) => str.toLowerCase())
  const distinctItems = new Set(lowercaseItems)
  return Array.from(distinctItems)
}

// Define blog collection
const blog = defineCollection({
  // Load Markdown and MDX files in the `src/content/blog/` directory.
  loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
  // Required
  schema: ({ image }) =>
    z.object({
      // Required
      title: z.string().max(60),
      description: z.string().max(160),
      publishDate: z.coerce.date(),
      // Optional
      updatedDate: z.coerce.date().optional(),
      heroImage: z
        .object({
          src: image(),
          alt: z.string().optional(),
          inferSize: z.boolean().optional(),
          width: z.number().optional(),
          height: z.number().optional(),

          color: z.string().optional()
        })
        .optional(),
      tags: z.array(z.string()).default([]).transform(removeDupsAndLowerCase),
      language: z.string().optional(),
      draft: z.boolean().default(false),
      // 文章写的是什么，首页按它分栏：project 项目 / postmortem 踩坑复盘 / tooling 工具配置 / study 学习笔记
      // （和 AI 参与了多少无关，那个看 authorship）。名称在 src/utils/category.ts
      category: z.enum(['project', 'postmortem', 'tooling', 'study']).optional(),
      // 谁写的，显示在文章顶部：手写 / AI 协助 / AI 生成；后两种在 models 里写模型名，多个按参与多少排
      authorship: z
        .object({
          mode: z.enum(['human', 'assisted', 'generated']),
          models: z.array(z.string()).default([])
        })
        .refine((a) => a.mode === 'human' || a.models.length > 0, {
          message: 'AI 协助或 AI 生成时要写 models'
        })
        .optional(),
      // Special fields
      comment: z.boolean().default(true)
    })
})

export const collections = { blog }
