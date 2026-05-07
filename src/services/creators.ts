import axios from 'axios'

const APIFY_TOKEN = process.env.APIFY_API_KEY!

const CATEGORY_HASHTAGS: Record<string, string[]> = {
  beauty: ['kbeauty', 'koreanskincare', 'glassskin', 'skincareroutine', 'koreanmakeup'],
  lifestyle: ['koreanlifestyle', 'koreandailylife', 'seoullife', 'koreatravel', 'livinginkorea'],
  vlog: ['koreadvlog', 'seoulvlog', 'koreanvlog', 'koreadailylife', 'seoulkoreadvlog'],
}

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  beauty: ['beauty', 'skin', 'makeup', 'skincare', 'korean', 'kbeauty', 'glow', 'routine', 'cosmetic', 'serum'],
  lifestyle: ['lifestyle', 'life', 'daily', 'routine', 'wellness', 'korea', 'living', 'vlog'],
  vlog: ['vlog', 'daily', 'korea', 'seoul', 'life', 'travel', 'living', 'day'],
}

const GENERIC_TAGS = new Set(['#fyp', '#fy', '#foryou', '#foryoupage', '#viral', '#trending'])

function isRelevant(creator: Creator, category: string): boolean {
  const keywords = CATEGORY_KEYWORDS[category] || []
  const creatorText = [
    ...creator.keywords,
    creator.bio,
    creator.displayName,
  ].join(' ').toLowerCase()
  return keywords.some(k => creatorText.includes(k))
}

function hasOnlyGenericTags(creator: Creator): boolean {
  if (creator.keywords.length === 0) return false
  return creator.keywords.every(k => GENERIC_TAGS.has(k))
}

interface RawTikTokItem {
  authorMeta?: {
    name?: string
    nickName?: string
    fans?: number
    heart?: number
    video?: number
    verified?: boolean
    signature?: string
  }
  playCount?: number
  diggCount?: number
  commentCount?: number
  text?: string
}

export interface Creator {
  username: string
  displayName: string
  followers: number
  followersDisplay: string
  totalLikes: number
  videoCount: number
  avgViews: number
  avgViewsDisplay: string
  engagementRate: string
  isVerified: boolean
  bio: string
  category: string
  keywords: string[]
  tiktokUrl: string
  growthIndicator: 'hot' | 'rising' | 'stable'
}

export async function fetchCreatorsByCategory(
  category: string,
  limit: number,
): Promise<Creator[]> {
  const hashtags = CATEGORY_HASHTAGS[category] || CATEGORY_HASHTAGS.beauty

  const runUrl = `https://api.apify.com/v2/acts/clockworks~free-tiktok-scraper/run-sync-get-dataset-items?token=${APIFY_TOKEN}&timeout=90`

  const res = await axios.post(
    runUrl,
    {
      hashtags,
      resultsPerPage: Math.ceil((limit * 3) / hashtags.length),
      shouldDownloadVideos: false,
      shouldDownloadCovers: false,
    },
    { timeout: 100000 },
  )

  const items: RawTikTokItem[] = res.data || []

  // 크리에이터별로 그룹핑
  const creatorMap = new Map<string, {
    meta: RawTikTokItem['authorMeta']
    videos: { playCount: number; diggCount: number; commentCount: number }[]
    keywords: Set<string>
  }>()

  for (const item of items) {
    const username = item.authorMeta?.name
    if (!username || !item.authorMeta) continue

    if (!creatorMap.has(username)) {
      creatorMap.set(username, {
        meta: item.authorMeta,
        videos: [],
        keywords: new Set(),
      })
    }

    const entry = creatorMap.get(username)!
    entry.videos.push({
      playCount: item.playCount || 0,
      diggCount: item.diggCount || 0,
      commentCount: item.commentCount || 0,
    })

    // 캡션에서 해시태그 추출
    const tags = (item.text || '').match(/#\w+/g) || []
    tags.slice(0, 5).forEach(t => entry.keywords.add(t.toLowerCase()))
  }

  // Creator 객체로 변환
  const creators: Creator[] = []

  for (const [username, data] of creatorMap.entries()) {
    if (data.videos.length === 0) continue

    const followers = data.meta?.fans || 0
    const totalViews = data.videos.reduce((sum, v) => sum + v.playCount, 0)
    const avgViews = Math.round(totalViews / data.videos.length)
    const totalEngagement = data.videos.reduce(
      (sum, v) => sum + v.diggCount + v.commentCount,
      0,
    )
    const avgEngagement = totalViews > 0
      ? ((totalEngagement / totalViews) * 100).toFixed(1)
      : '0'

    // 조회수/팔로워 비율로 성장 지표 추정
    const viewsPerFollower = followers > 0 ? avgViews / followers : 0
    const growthIndicator: Creator['growthIndicator'] =
      viewsPerFollower > 2 ? 'hot' :
      viewsPerFollower > 0.5 ? 'rising' : 'stable'

    creators.push({
      username,
      displayName: data.meta?.nickName || username,
      followers,
      followersDisplay: formatCount(followers),
      totalLikes: data.meta?.heart || 0,
      videoCount: data.meta?.video || 0,
      avgViews,
      avgViewsDisplay: formatCount(avgViews),
      engagementRate: avgEngagement + '%',
      isVerified: data.meta?.verified || false,
      bio: data.meta?.signature || '',
      category,
      keywords: Array.from(data.keywords).slice(0, 5),
      tiktokUrl: `https://www.tiktok.com/@${username}`,
      growthIndicator,
    })
  }

  // hot → rising → stable, 같은 등급은 avgViews 높은 순
  creators.sort((a, b) => {
    const order: Record<Creator['growthIndicator'], number> = { hot: 0, rising: 1, stable: 2 }
    if (order[a.growthIndicator] !== order[b.growthIndicator]) {
      return order[a.growthIndicator] - order[b.growthIndicator]
    }
    return b.avgViews - a.avgViews
  })

  // 카테고리 관련 키워드 필터링
  const filtered = creators.filter(c => isRelevant(c, category))
  console.log(`[creators] 전체: ${creators.length}개, 필터 후: ${filtered.length}개`)

  // 필터 결과가 5개 미만이면 fallback: 범용 태그만 있는 계정 제외 후 팔로워순
  if (filtered.length < 5) {
    const fallback = creators.filter(c => !hasOnlyGenericTags(c))
    console.log(`[creators] fallback 사용: ${fallback.length}개`)
    return fallback.slice(0, limit)
  }

  return filtered.slice(0, limit)
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return n.toString()
}
