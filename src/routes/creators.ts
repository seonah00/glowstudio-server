import { Router, Request, Response } from 'express'
import { fetchCreatorsByCategory, Creator } from '../services/creators'
import { cache } from '../services/cache'

const router = Router()

// GET /creators/debug — 환경변수 및 기본 동작 확인
router.get('/debug', (req: Request, res: Response) => {
  const hasApifyKey = !!process.env.APIFY_API_KEY
  const keyPrefix = process.env.APIFY_API_KEY?.slice(0, 12) || 'NOT_SET'
  res.json({
    ok: true,
    env: {
      hasApifyKey,
      keyPrefix,
      nodeEnv: process.env.NODE_ENV,
      port: process.env.PORT,
    },
  })
})

// GET /creators?category=beauty&limit=20
router.get('/', async (req: Request, res: Response) => {
  const category = (req.query.category as string) || 'beauty'
  const limit = parseInt(req.query.limit as string) || 20

  const validCategories = ['beauty', 'lifestyle', 'vlog']
  if (!validCategories.includes(category)) {
    return res.status(400).json({ error: '유효하지 않은 카테고리' })
  }

  const cacheKey = `creators:${category}`

  const cached = cache.get<Creator[]>(cacheKey)
  if (cached) {
    return res.json({ success: true, creators: cached, category, fromCache: true, fetchedAt: new Date() })
  }

  try {
    console.log(`[creators] fetching category=${category} limit=${limit}`)
    const creators = await fetchCreatorsByCategory(category, limit)
    console.log(`[creators] fetched ${creators.length} creators`)
    cache.set(cacheKey, creators, 60 * 60 * 1000)
    return res.json({ success: true, creators, category, fromCache: false, fetchedAt: new Date() })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '크리에이터 수집 실패'
    const stack = err instanceof Error ? err.stack : ''
    console.error('[creators] error:', msg, stack)
    return res.status(500).json({ error: msg, detail: stack?.split('\n')[0] })
  }
})

export default router
