import { Router, Request, Response } from 'express'
import { getTikTokVideoUrl } from '../services/apify'
import { extractFrames } from '../services/ffmpeg'
import { analyzeFrames } from '../services/claude'

const router = Router()

router.post('/video', async (req: Request, res: Response) => {
  const { tiktokUrl } = req.body as { tiktokUrl?: string }

  if (!tiktokUrl || !tiktokUrl.includes('tiktok.com')) {
    return res.status(400).json({ error: '유효한 TikTok URL을 입력하세요' })
  }

  try {
    // Step 1: Apify로 영상 정보 + 다운로드 URL 가져오기
    console.log('[1/3] Apify로 영상 정보 수집 중...')
    const videoInfo = await getTikTokVideoUrl(tiktokUrl)

    if (!videoInfo.videoUrl) {
      throw new Error('영상 다운로드 URL을 가져올 수 없습니다')
    }

    // Step 2: ffmpeg으로 프레임 추출
    console.log('[2/3] 프레임 추출 중...')
    const frames = await extractFrames(videoInfo.videoUrl, videoInfo.duration)

    if (frames.length === 0) {
      throw new Error('프레임 추출에 실패했습니다')
    }

    // Step 3: Claude Vision으로 분석
    console.log('[3/3] Claude Vision 분석 중...')
    const analysis = await analyzeFrames(frames, {
      text: videoInfo.text,
      playCount: videoInfo.playCount,
      diggCount: videoInfo.diggCount,
      commentCount: videoInfo.commentCount,
      duration: videoInfo.duration,
      authorName: videoInfo.authorName,
    })

    return res.json({
      success: true,
      videoInfo: {
        coverUrl: videoInfo.coverUrl,
        text: videoInfo.text,
        playCount: videoInfo.playCount,
        diggCount: videoInfo.diggCount,
        commentCount: videoInfo.commentCount,
        duration: videoInfo.duration,
        authorName: videoInfo.authorName,
      },
      analysis,
      framesAnalyzed: frames.length,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '분석 중 오류 발생'
    console.error('분석 오류:', msg)
    return res.status(500).json({ error: msg })
  }
})

export default router
