import ffmpeg from 'fluent-ffmpeg'
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg'
import axios from 'axios'
import fs from 'fs'
import path from 'path'
import os from 'os'

ffmpeg.setFfmpegPath(ffmpegInstaller.path)

// 영상 URL에서 특정 시간대 프레임을 base64 이미지로 추출
export async function extractFrames(videoUrl: string, duration: number): Promise<string[]> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'glowstudio-'))

  try {
    // 1. 영상 다운로드
    const videoPath = path.join(tmpDir, 'video.mp4')
    const response = await axios.get(videoUrl, {
      responseType: 'arraybuffer',
      timeout: 30000,
      headers: { 'User-Agent': 'Mozilla/5.0' },
    })
    fs.writeFileSync(videoPath, Buffer.from(response.data as ArrayBuffer))

    // 2. 프레임 추출 시점 계산
    // 후킹(0.5초), 후킹끝(2초), 전반(25%), 중반(50%), 후반(75%), 마무리
    const dur = duration > 0 ? duration : 30
    const timestamps = [
      0.5,
      2.0,
      Math.min(dur * 0.25, dur - 1),
      Math.min(dur * 0.5, dur - 1),
      Math.min(dur * 0.75, dur - 1),
      Math.max(dur - 1.5, 3),
    ].filter((t, i, arr) => arr.indexOf(t) === i)

    // 3. 각 시점에서 프레임 추출
    const frames: string[] = []
    for (let i = 0; i < timestamps.length; i++) {
      const framePath = path.join(tmpDir, `frame_${i}.jpg`)
      await extractSingleFrame(videoPath, timestamps[i], framePath)
      if (fs.existsSync(framePath)) {
        const base64 = fs.readFileSync(framePath).toString('base64')
        frames.push(base64)
      }
    }

    return frames
  } finally {
    // 임시 파일 정리
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
}

function extractSingleFrame(videoPath: string, timestamp: number, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .seekInput(timestamp)
      .frames(1)
      .size('720x?')
      .output(outputPath)
      .on('end', () => resolve())
      .on('error', (err) => reject(err))
      .run()
  })
}
