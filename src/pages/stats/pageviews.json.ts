import type { APIRoute } from 'astro'

import { umamiConfig } from '@/site-config'

type UmamiMetric = {
  path?: string
  views?: number
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

const getMetricPath = (metric: UmamiMetric) => metric.path

const getMetricViews = (metric: UmamiMetric) => Number(metric.views ?? Number.NaN)

export const getPageviews = async () => {
  const apiKey = process.env.UMAMI_API_KEY?.trim()

  if (!umamiConfig.websiteId || !apiKey) {
    console.warn(
      `[umami] Missing ${!umamiConfig.websiteId ? 'PUBLIC_UMAMI_WEBSITE_ID' : 'UMAMI_API_KEY'}, pageviews unavailable.`
    )
    return null
  }

  const url = new URL(`websites/${umamiConfig.websiteId}/breakdown`, `${umamiConfig.apiEndpoint}/`)
  url.searchParams.set('startAt', String(getStartAt()))
  url.searchParams.set('endAt', String(Date.now()))
  // /metrics counts distinct visitors in Umami 3.4.1; breakdown exposes actual pageviews.
  url.searchParams.set('fields', JSON.stringify(['path']))
  url.searchParams.set('eventType', '1')

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json'
      },
      signal: AbortSignal.timeout(15000)
    })

    if (!response.ok) {
      console.warn(
        `[umami] Failed to fetch pageviews stats: ${response.status} ${response.statusText}`
      )
      return null
    }

    const metrics = (await response.json()) as UmamiMetric[]
    if (!Array.isArray(metrics)) throw new Error('Invalid Umami metrics response')
    if (metrics.length >= 500) throw new Error('Umami breakdown reached its 500-path limit')
    const pageviews: Pageviews = Object.create(null)

    for (const metric of metrics) {
      if (!metric || typeof metric !== 'object') throw new Error('Invalid Umami metric')
      const path = getMetricPath(metric)
      if (!path) continue
      const views = getMetricViews(metric)
      if (typeof path !== 'string' || !Number.isFinite(views) || views < 0) {
        throw new Error('Invalid Umami metric')
      }
      addPageview(pageviews, path, views)
    }

    return pageviews
  } catch (error) {
    console.warn(
      '[umami] Failed to fetch pageviews stats:',
      error instanceof Error ? error.message : 'Unknown error'
    )
    return null
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
