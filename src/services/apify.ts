import axios from 'axios'

const APIFY_TOKEN = process.env.APIFY_API_KEY!

export interface TikTokVideoInfo {
  videoUrl: string
  coverUrl: string
  text: string
  playCount: number
  diggCount: number
  commentCount: number
  duration: number
  authorName: string
}

// TikTok URL로 영상 mp4 다운로드 URL 가져오기
export async function getTikTokVideoUrl(tiktokUrl: string): Promise<TikTokVideoInfo> {
  const runUrl = `https://api.apify.com/v2/acts/clockworks~free-tiktok-scraper/run-sync-get-dataset-items?token=${APIFY_TOKEN}&timeout=60`

  const res = await axios.post(
    runUrl,
    {
      postURLs: [tiktokUrl],
      shouldDownloadVideos: true,
      shouldDownloadCovers: true,
      maxItems: 1,
    },
    { timeout: 70000 },
  )

  const item = res.data[0]
  if (!item) throw new Error('영상 정보를 가져올 수 없습니다')

  return {
    videoUrl: item.videoUrl || item.video?.downloadAddr || '',
    coverUrl: item.videoMeta?.coverUrl || item.video?.cover || '',
    text: item.text || item.desc || '',
    playCount: item.playCount || item.stats?.playCount || 0,
    diggCount: item.diggCount || item.stats?.diggCount || 0,
    commentCount: item.commentCount || item.stats?.commentCount || 0,
    duration: item.videoMeta?.duration || item.video?.duration || 0,
    authorName: item.authorMeta?.name || item.author?.uniqueId || '',
  }
}
