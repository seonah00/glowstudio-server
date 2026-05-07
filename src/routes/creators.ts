import { Router, Request, Response } from 'express'
import { fetchCreatorsByCategory, Creator } from '../services/creators'
import { cache } from '../services/cache'

const router = Router()

// GET /creators?category=beauty&limit=20
router.get('/', async (req: Request, res: Response) => {
  const category = (req.query.category as string) || 'beauty'
  const limit = parseInt(req.query.limit as string) || 20

  const validCategories = ['beauty', 'lifestyle', 'vlog']
  if (!validCategories.includes(category)) {
    return res.status(400).json({ error: '유효하지 않은 카테고리' })
  }

  const cacheKey = `creators:${category}`

  // 캐시 확인 (1시간)
  const cached = cache.get<Creator[]>(cacheKey)
  if (cached) {
    return res.json({ success: true, creators: cached, category, fromCache: true, fetchedAt: new Date() })
  }

  try {
    const creators = await fetchCreatorsByCategory(category, limit)
    cache.set(cacheKey, creators, 60 * 60 * 1000) // 1시간
    return res.json({ success: true, creators, category, fromCache: false, fetchedAt: new Date() })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '크리에이터 수집 실패'
    return res.status(500).json({ error: msg })
  }
})

export default router
