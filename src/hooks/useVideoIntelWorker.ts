import { useCallback, useEffect, useRef, useState } from 'react'
import type { DeviceBackend, DownloadProgress } from '../types/ner'
import type {
  AudioTranscriptChunk,
  MultimodalTimelineEvent,
  VideoKeyframe,
  VideoModelProfile,
  VideoWorkerIncomingMessage,
  VideoWorkerOutgoingMessage,
  VideoWorkerStatus,
} from '../types/video'
import {
  extractAudioFromVideo,
  extractKeyframesFromVideo,
  formatTimecode,
} from '../utils/mediaExtractor'

export interface UseVideoIntelWorkerReturn {
  status: VideoWorkerStatus
  device: DeviceBackend | null
  downloadProgress: DownloadProgress | null
  stepMessage: string
  stepProgress: { current: number; total: number } | null
  transcriptChunks: AudioTranscriptChunk[]
  keyframes: VideoKeyframe[]
  timelineEvents: MultimodalTimelineEvent[]
  executionTimeMs: number | null
  error: string | null
  isProcessing: boolean
  speechModel: string
  visionModel: string
  modelProfile: VideoModelProfile
  setModelProfile: (profile: VideoModelProfile) => void
  processVideoFile: (file: File | Blob) => Promise<void>
  reinitialize: (preferredDevice?: 'webgpu' | 'wasm' | 'auto', profile?: VideoModelProfile) => void
  applyTranscriptRedaction: (redactorFn: (text: string) => string) => void
}

export function useVideoIntelWorker(): UseVideoIntelWorkerReturn {
  const [status, setStatus] = useState<VideoWorkerStatus>('initializing')
  const [device, setDevice] = useState<DeviceBackend | null>(null)
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null)
  const [stepMessage, setStepMessage] = useState<string>('')
  const [stepProgress, setStepProgress] = useState<{ current: number; total: number } | null>(null)
  const [transcriptChunks, setTranscriptChunks] = useState<AudioTranscriptChunk[]>([])
  const [keyframes, setKeyframes] = useState<VideoKeyframe[]>([])
  const [timelineEvents, setTimelineEvents] = useState<MultimodalTimelineEvent[]>([])
  const [executionTimeMs, setExecutionTimeMs] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [speechModel, setSpeechModel] = useState<string>('Whisper-Base')
  const [visionModel, setVisionModel] = useState<string>('Florence-2')
  const [modelProfile, setModelProfileState] = useState<VideoModelProfile>('quality')

  const workerRef = useRef<Worker | null>(null)
  const currentKeyframesRef = useRef<VideoKeyframe[]>([])

  const postWorkerMessage = useCallback((msg: VideoWorkerIncomingMessage): void => {
    if (workerRef.current) {
      workerRef.current.postMessage(msg)
    }
  }, [])

  const reinitialize = useCallback(
    (
      preferredDevice: 'webgpu' | 'wasm' | 'auto' = 'auto',
      profile: VideoModelProfile = modelProfile,
    ): void => {
      setStatus('initializing')
      setError(null)
      postWorkerMessage({
        type: 'INIT',
        preferredDevice,
        modelProfile: profile,
      })
    },
    [postWorkerMessage, modelProfile],
  )

  const setModelProfile = useCallback(
    (profile: VideoModelProfile): void => {
      setModelProfileState(profile)
      reinitialize('auto', profile)
    },
    [reinitialize],
  )

  useEffect(() => {
    const workerInstance = new Worker(new URL('../workers/video.worker.ts', import.meta.url), {
      type: 'module',
    })
    workerRef.current = workerInstance

    workerInstance.postMessage({
      type: 'INIT',
      preferredDevice: 'auto',
      modelProfile: 'quality',
    } satisfies VideoWorkerIncomingMessage)

    workerInstance.onmessage = (event: MessageEvent<VideoWorkerOutgoingMessage>): void => {
      const data = event.data
      if (!data || typeof data !== 'object') return

      switch (data.type) {
        case 'PROGRESS': {
          setStatus('downloading')
          setDownloadProgress(data.progress)
          break
        }
        case 'INIT_SUCCESS': {
          setStatus('ready')
          setDevice(data.device)
          setSpeechModel(data.speechModel)
          setVisionModel(data.visionModel)
          setError(null)
          break
        }
        case 'INIT_ERROR': {
          setStatus('error')
          setError(data.error)
          break
        }
        case 'STEP_UPDATE': {
          if (data.step === 'transcribing') {
            setStatus('transcribing')
          } else {
            setStatus('captioning')
          }
          setStepMessage(data.message)
          setStepProgress({ current: data.current, total: data.total })
          break
        }
        case 'PROCESS_SUCCESS': {
          setStatus('complete')
          setTranscriptChunks(data.transcriptChunks)
          setExecutionTimeMs(data.executionTimeMs)
          setStepProgress(null)
          setStepMessage('')

          // Match captions to sampled keyframes
          const keyframesWithCaptions = currentKeyframesRef.current.map((kf) => {
            const foundCaption = data.sceneCaptions.find(
              (sc) => Math.abs(sc.timestamp - kf.timestampSeconds) < 4,
            )
            return {
              ...kf,
              caption: foundCaption?.caption || 'Visual keyframe captured',
            }
          })
          setKeyframes(keyframesWithCaptions)

          const events: MultimodalTimelineEvent[] = []

          // If speech was transcribed, build timeline events for all spoken dialogue
          if (data.transcriptChunks.length > 0) {
            data.transcriptChunks.forEach((chunk, idx) => {
              // Find the closest keyframe thumbnail and scene caption
              let closestKf = keyframesWithCaptions[0]
              let minDiff = Infinity

              for (const kf of keyframesWithCaptions) {
                const diff = Math.abs(kf.timestampSeconds - chunk.startSeconds)
                if (diff < minDiff) {
                  minDiff = diff
                  closestKf = kf
                }
              }

              events.push({
                id: `chunk_${idx}_${Math.round(chunk.startSeconds)}`,
                timestampSeconds: chunk.startSeconds,
                timecode: `${formatTimecode(chunk.startSeconds)} - ${formatTimecode(chunk.endSeconds)}`,
                sceneCaption: closestKf?.caption || 'Video scene captured',
                keyframeThumbnail: closestKf?.dataUrl,
                dialogueTranscript: chunk.text,
              })
            })
          } else {
            // If no speech detected, create events for keyframes across the video
            keyframesWithCaptions.forEach((kf, idx) => {
              const nextTime = keyframesWithCaptions[idx + 1]?.timestampSeconds ?? kf.timestampSeconds + 5
              events.push({
                id: `kf_${idx}_${Math.round(kf.timestampSeconds)}`,
                timestampSeconds: kf.timestampSeconds,
                timecode: `${kf.timecodeFormatted} - ${formatTimecode(nextTime)}`,
                sceneCaption: kf.caption || 'Scene visual documented',
                keyframeThumbnail: kf.dataUrl,
                dialogueTranscript: '(Ambient sound / background audio)',
              })
            })
          }

          // Sort strictly by timestamp from start to end of video
          events.sort((a, b) => a.timestampSeconds - b.timestampSeconds)
          setTimelineEvents(events)
          break
        }
        case 'PROCESS_ERROR': {
          setStatus('error')
          setError(data.error)
          setStepProgress(null)
          break
        }
      }
    }

    workerInstance.onerror = (evt: ErrorEvent): void => {
      setStatus('error')
      setError(evt.message || 'Video worker error')
    }

    workerInstance.postMessage({
      type: 'INIT',
      preferredDevice: 'auto',
    } satisfies VideoWorkerIncomingMessage)

    return () => {
      workerInstance.terminate()
      workerRef.current = null
    }
  }, [])

  const processVideoFile = useCallback(
    async (file: File | Blob): Promise<void> => {
      setStatus('extracting-media')
      setError(null)
      setStepMessage('Extracting full audio stream and sampling keyframes across video duration...')

      try {
        const objectUrl = URL.createObjectURL(file)
        const [audioData, extractedKeyframes] = await Promise.all([
          extractAudioFromVideo(file),
          extractKeyframesFromVideo(objectUrl, 16),
        ])

        currentKeyframesRef.current = extractedKeyframes
        setKeyframes(extractedKeyframes)

        const requestId = `vid_${Date.now()}`
        setStatus('transcribing')

        postWorkerMessage({
          type: 'PROCESS_VIDEO',
          requestId,
          audioData,
          keyframes: extractedKeyframes.map((k) => ({
            timestamp: k.timestampSeconds,
            dataUrl: k.dataUrl,
          })),
        })
      } catch (err) {
        setStatus('error')
        setError(err instanceof Error ? err.message : 'Failed to extract media from video')
      }
    },
    [postWorkerMessage],
  )

  const applyTranscriptRedaction = useCallback(
    (redactorFn: (text: string) => string): void => {
      setTimelineEvents((prev) =>
        prev.map((evt) => ({
          ...evt,
          sanitizedDialogue: redactorFn(evt.dialogueTranscript),
        })),
      )
    },
    [],
  )

  const isProcessing =
    status === 'extracting-media' || status === 'transcribing' || status === 'captioning'

  return {
    status,
    device,
    downloadProgress,
    stepMessage,
    stepProgress,
    transcriptChunks,
    keyframes,
    timelineEvents,
    executionTimeMs,
    error,
    isProcessing,
    speechModel,
    visionModel,
    modelProfile,
    setModelProfile,
    processVideoFile,
    reinitialize,
    applyTranscriptRedaction,
  }
}
