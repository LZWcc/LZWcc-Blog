import type { APIRoute } from 'astro'

import { umamiConfig } from '@/site-config'

type UmamiMetric = {
  name?: string
  x?: string
  pageviews?: number
  views?: number
  y?: number
}

type Pageviews = Record<string, number>

const getStartAt = () => {
  const start = Date.parse(umamiConfig.statsStartAt)
  return Number.isNaN(start) ? 0 : start
}

const normalizePath = (url: string) => {
  const pathname = url.startsWith('http') ? new URL(url).pathname : url.split(/[?#]/)[0]
  const normalized = pathname.startsWith('/') ? pathname : `/${pathname}`
  return normalized === '/' ? normalized : normalized.replace(/\/+$/, '')
}

const addPageview = (pageviews: Pageviews, path: string, views: number) => {
  const normalized = normalizePath(path)
  pageviews[normalized] = (pageviews[normalized] ?? 0) + views

  if (normalized !== '/') {
    pageviews[`${normalized}/`] = pageviews[normalized]
  }
}

const getMetricPath = (metric: UmamiMetric) => metric.name ?? metric.x

const getMetricViews = (metric: UmamiMetric) =>
  Number(metric.pageviews ?? metric.views ?? metric.y ?? 0)

const getPageviews = async () => {
  const token = process.env.UMAMI_API_TOKEN

  if (!umamiConfig.websiteId || !token) {
    console.warn('[umami] Missing website id or API token, writing empty pageviews stats.')
    return {}
  }

  const url = new URL(`/api/websites/${umamiConfig.websiteId}/metrics/expanded`, umamiConfig.hostUrl)
  url.searchParams.set('startAt', String(getStartAt()))
  url.searchParams.set('endAt', String(Date.now()))
  url.searchParams.set('type', 'path')
  url.searchParams.set('limit', '10000')

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json'
      }
    })

    if (!response.ok) {
      console.warn(`[umami] Failed to fetch pageviews stats: ${response.status} ${response.statusText}`)
      return {}
    }

    const metrics = (await response.json()) as UmamiMetric[]
    const pageviews: Pageviews = {}

    for (const metric of metrics) {
      const path = getMetricPath(metric)
      if (!path) continue
      addPageview(pageviews, path, getMetricViews(metric))
    }

    return pageviews
  } catch (error) {
    console.warn('[umami] Failed to fetch pageviews stats:', error)
    return {}
  }
}

export const GET: APIRoute = async () => {
  const pageviews = await getPageviews()

  return new Response(JSON.stringify(pageviews), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8'
    }
  })
}
