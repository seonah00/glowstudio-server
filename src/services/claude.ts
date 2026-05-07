import axios from 'axios'

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY!

interface VideoMetadata {
  text: string
  playCount: number
  diggCount: number
  commentCount: number
  duration: number
  authorName: string
}

interface SceneDescription {
  timeRange: string
  visual: string
  purpose: string
}

export interface FrameAnalysisResult {
  viral_score: number
  hook_analysis: {
    type: string
    description: string
    visual_hook: string
    text_overlay: string
    script_example: string
  }
  visual_analysis: {
    camera_angle: string
    distance: string
    lighting: string
    background: string
    product_appearance: string
    editing_pace: string
  }
  content_structure: {
    scene_breakdown: SceneDescription[]
    key_moments: string[]
  }
  viral_factors: string[]
  copyable_elements: string[]
  shooting_tips: string[]
  weak_points: string[]
  target_audience: string
  recommended_improvements: string[]
}

export async function analyzeFrames(
  frames: string[],
  metadata: VideoMetadata,
): Promise<FrameAnalysisResult> {
  const imageContent = frames.map((base64) => ({
    type: 'image' as const,
    source: {
      type: 'base64' as const,
      media_type: 'image/jpeg' as const,
      data: base64,
    },
  }))

  const engagementRate = metadata.playCount > 0
    ? (((metadata.diggCount + metadata.commentCount) / metadata.playCount) * 100).toFixed(2)
    : '0.00'

  const prompt = `당신은 TikTok 바이럴 콘텐츠 전문 분석가입니다.
위 이미지들은 하나의 TikTok 영상에서 추출한 프레임입니다.
순서대로: 0.5초, 2초, 25%, 50%, 75%, 마지막 부분입니다.

영상 메타데이터:
- 캡션: ${metadata.text}
- 조회수: ${metadata.playCount.toLocaleString()}
- 좋아요: ${metadata.diggCount.toLocaleString()}
- 댓글: ${metadata.commentCount.toLocaleString()}
- 참여율: ${engagementRate}%
- 길이: ${metadata.duration}초
- 크리에이터: @${metadata.authorName}

실제 영상 프레임을 직접 보고 분석하세요. 추측이 아닌 실제로 보이는 것을 기반으로 작성하세요.

아래 JSON 형식으로만 응답 (순수 JSON, 마크다운 없이):
{
  "viral_score": 85,
  "hook_analysis": {
    "type": "궁금증형/충격형/공감형/정보형/도전형 중 하나",
    "description": "첫 2초 프레임에서 실제로 보이는 장면을 구체적으로 설명",
    "visual_hook": "시청자가 멈추게 만드는 시각적 요소 (실제 프레임 기반)",
    "text_overlay": "화면에 보이는 텍스트/자막/스티커 내용 (없으면 '없음')",
    "script_example": "이 후킹 방식을 내 영상에 적용하는 스크립트 예시 (한국어)"
  },
  "visual_analysis": {
    "camera_angle": "정면/측면/위에서/아래서 + 구체적 설명",
    "distance": "클로즈업/미디엄샷/풀샷 + 피사체와의 거리감",
    "lighting": "자연광/링라이트/스튜디오조명/역광 등 + 빛의 방향",
    "background": "배경에 보이는 것들, 정리 상태, 색감",
    "product_appearance": "제품이 몇 초에 어떻게 등장하는지, 어떻게 보여주는지",
    "editing_pace": "프레임 변화 빈도 기반 편집 속도 분석"
  },
  "content_structure": {
    "scene_breakdown": [
      { "timeRange": "0~3초", "visual": "실제 보이는 것", "purpose": "이 씬의 역할" },
      { "timeRange": "3~15초", "visual": "...", "purpose": "..." },
      { "timeRange": "15~끝", "visual": "...", "purpose": "..." }
    ],
    "key_moments": ["핵심 포인트1", "핵심 포인트2", "핵심 포인트3"]
  },
  "viral_factors": ["바이럴 요인1", "바이럴 요인2", "바이럴 요인3", "바이럴 요인4"],
  "copyable_elements": ["따라할 수 있는 요소1", "따라할 수 있는 요소2", "따라할 수 있는 요소3"],
  "shooting_tips": ["촬영 팁1", "촬영 팁2", "촬영 팁3", "촬영 팁4"],
  "weak_points": ["아쉬운 점1", "아쉬운 점2"],
  "target_audience": "실제 영상 내용 기반 타겟 시청자 분석",
  "recommended_improvements": ["개선 제안1", "개선 제안2", "개선 제안3"]
}`

  const res = await axios.post(
    'https://api.anthropic.com/v1/messages',
    {
      model: 'claude-opus-4-5-20251001',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: [
          ...imageContent,
          { type: 'text', text: prompt },
        ],
      }],
    },
    {
      headers: {
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      timeout: 60000,
    },
  )

  const text: string = res.data.content?.[0]?.text || '{}'
  return JSON.parse(text.replace(/```json|```/g, '').trim()) as FrameAnalysisResult
}
