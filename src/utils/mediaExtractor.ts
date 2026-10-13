import type { VideoKeyframe } from '../types/video'

export function formatTimecode(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  const pad = (n: number): string => (n < 10 ? `0${n}` : `${n}`)
  return `${pad(mins)}:${pad(secs)}`
}

/**
 * Extracts 16kHz mono PCM Float32Array from a video file in-browser using the Web Audio API
 */
export async function extractAudioFromVideo(videoFile: File | Blob): Promise<Float32Array> {
  const arrayBuffer = await videoFile.arrayBuffer()
  const audioContext = new (window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)({
    sampleRate: 16000,
  })

  try {
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
    const channelData = audioBuffer.getChannelData(0)
    const copy = new Float32Array(channelData.length)
    copy.set(channelData)
    return copy
  } finally {
    void audioContext.close()
  }
}

/**
 * Samples keyframes adaptively across the ENTIRE duration of the video
 */
export async function extractKeyframesFromVideo(
  videoUrl: string,
  targetKeyframeCount: number = 12,
): Promise<VideoKeyframe[]> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.src = videoUrl
    video.crossOrigin = 'anonymous'
    video.muted = true
    video.playsInline = true

    video.onloadedmetadata = async () => {
      const duration = video.duration
      if (!duration || isNaN(duration) || duration <= 0) {
        resolve([])
        return
      }

      const keyframes: VideoKeyframe[] = []
      const canvas = document.createElement('canvas')
      canvas.width = 384
      canvas.height = 288
      const ctx = canvas.getContext('2d')

      if (!ctx) {
        reject(new Error('Canvas context not available'))
        return
      }

      // Calculate timestamps spanning the ENTIRE video
      const count = Math.min(Math.max(4, targetKeyframeCount), 24)
      const interval = duration / (count + 1)
      const timestamps: number[] = []

      for (let i = 0; i < count; i++) {
        const t = Math.min(i * interval, duration - 0.5)
        if (t >= 0 && !timestamps.includes(t)) {
          timestamps.push(t)
        }
      }

      for (const time of timestamps) {
        await new Promise<void>((seekResolve) => {
          const onSeeked = (): void => {
            video.removeEventListener('seeked', onSeeked)
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
            const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
            keyframes.push({
              timestampSeconds: time,
              timecodeFormatted: formatTimecode(time),
              dataUrl,
            })
            seekResolve()
          }
          video.addEventListener('seeked', onSeeked)
          video.currentTime = time
        })
      }

      // Sort chronologically
      keyframes.sort((a, b) => a.timestampSeconds - b.timestampSeconds)
      resolve(keyframes)
    }

    video.onerror = () => {
      reject(new Error('Failed to load video file for keyframe extraction'))
    }
  })
}

/**
 * Generates an in-browser animated demo video with synthesized audio tones & visual scenes
 */
export async function generateSyntheticDemoVideo(): Promise<{ blob: Blob; url: string }> {
  const canvas = document.createElement('canvas')
  canvas.width = 640
  canvas.height = 360
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas not supported')

  const audioCtx = new AudioContext({ sampleRate: 16000 })
  const dest = audioCtx.createMediaStreamDestination()

  const osc = audioCtx.createOscillator()
  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(220, audioCtx.currentTime)

  const gain = audioCtx.createGain()
  gain.gain.setValueAtTime(0.08, audioCtx.currentTime)
  osc.connect(gain)
  gain.connect(dest)
  osc.start()

  const canvasStream = canvas.captureStream(24)
  const combinedStream = new MediaStream([
    ...canvasStream.getVideoTracks(),
    ...dest.stream.getAudioTracks(),
  ])

  const mediaRecorder = new MediaRecorder(combinedStream, {
    mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
      ? 'video/webm;codecs=vp8,opus'
      : 'video/webm',
  })

  const chunks: BlobPart[] = []
  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data)
  }

  return new Promise((resolve) => {
    mediaRecorder.onstop = () => {
      osc.stop()
      void audioCtx.close()
      const blob = new Blob(chunks, { type: 'video/webm' })
      const url = URL.createObjectURL(blob)
      resolve({ blob, url })
    }

    mediaRecorder.start()

    let frame = 0
    const totalFrames = 24 * 10 // 10 seconds demo clip

    const drawFrame = (): void => {
      if (frame >= totalFrames) {
        mediaRecorder.stop()
        return
      }

      const t = frame / 24
      if (t < 5) {
        ctx.fillStyle = '#0f172a'
        ctx.fillRect(0, 0, 640, 360)
        ctx.fillStyle = '#38bdf8'
        ctx.font = 'bold 22px Inter, sans-serif'
        ctx.fillText('Scene 1: Corporate Headquarters Briefing', 40, 60)
        ctx.fillStyle = '#94a3b8'
        ctx.font = '16px Inter, sans-serif'
        ctx.fillText('Speaker: David Miller (Chicago Office)', 40, 100)
        ctx.fillText('Discussing enterprise privacy protocols', 40, 130)

        ctx.beginPath()
        ctx.arc(320, 220, 40 + Math.sin(frame * 0.1) * 10, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(56, 189, 248, 0.4)'
        ctx.fill()
      } else {
        ctx.fillStyle = '#1e1b4b'
        ctx.fillRect(0, 0, 640, 360)
        ctx.fillStyle = '#c084fc'
        ctx.font = 'bold 22px Inter, sans-serif'
        ctx.fillText('Scene 2: Client Verification & Mortgage Review', 40, 60)
        ctx.fillStyle = '#cbd5e1'
        ctx.font = '16px Inter, sans-serif'
        ctx.fillText('Applicant: Seamus Rochford (Cork, P31 NN53)', 40, 100)
        ctx.fillText('Verification Tel: 087 2646379', 40, 130)

        ctx.beginPath()
        ctx.arc(320, 220, 45 + Math.cos(frame * 0.1) * 10, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(168, 85, 247, 0.4)'
        ctx.fill()
      }

      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'
      ctx.fillRect(480, 310, 140, 35)
      ctx.fillStyle = '#34d399'
      ctx.font = 'bold 16px monospace'
      ctx.fillText(formatTimecode(t) + ' / 00:10', 495, 335)

      frame++
      requestAnimationFrame(drawFrame)
    }

    drawFrame()
  })
}
