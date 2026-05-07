// 메모리 캐시 (서버 재시작 시 초기화)
// 카테고리별 결과를 1시간 캐시 → 같은 카테고리 반복 요청 시 Apify 재호출 없음

interface CacheEntry<T> {
  data: T
  expiresAt: number
}

class MemoryCache {
  private store = new Map<string, CacheEntry<unknown>>()

  set<T>(key: string, data: T, ttlMs: number): void {
    this.store.set(key, { data, expiresAt: Date.now() + ttlMs })
  }

  get<T>(key: string): T | null {
    const entry = this.store.get(key)
    if (!entry) return null
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key)
      return null
    }
    return entry.data as T
  }
}

export const cache = new MemoryCache()
