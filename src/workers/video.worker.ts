import {
  env,
  pipeline,
  RawImage,
  Florence2ForConditionalGeneration,
  Florence2Processor,
} from '@huggingface/transformers'
import type { Florence2ProcessorInstance } from '@huggingface/transformers'
import type { DeviceBackend } from '../types/ner'
import type {
  AudioTranscriptChunk,
  VideoModelProfile,
  VideoWorkerIncomingMessage,
  VideoWorkerOutgoingMessage,
} from '../types/video'

// Prevent unnecessary local file checks in browser/worker
env.allowLocalModels = false

type AsrPipelineFn = (
  audio: Float32Array,
  options?: { return_timestamps?: boolean; chunk_length_s?: number; stride_length_s?: number },
) => Promise<unknown>

type VisionPipelineFn = (
  image: string,
  options?: { max_new_tokens?: number },
) => Promise<unknown>

let activeAsrPipeline: AsrPipelineFn | null = null
let activeVisionPipeline: VisionPipelineFn | null = null
let activeFlorenceModel: Florence2ForConditionalGeneration | null = null
let activeFlorenceProcessor: Florence2ProcessorInstance | null = null
let loadedSpeechModelName = 'Whisper-Base'
let loadedVisionModelName = 'Florence-2'
let currentDevice: DeviceBackend = 'wasm'
let isInitializing = false

interface ProgressPayload {
  status?: string
  file?: string
  progress?: number
  loaded?: number
  total?: number
}

function isProgressPayload(val: unknown): val is ProgressPayload {
  return typeof val === 'object' && val !== null
}

async function checkWebGpuSupport(): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && 'gpu' in navigator && navigator.gpu) {
      const adapter = await navigator.gpu.requestAdapter()
      return adapter !== null
    }
  } catch {
    return false
  }
  return false
}

async function initializeVideoModels(
  preferredDevice: 'webgpu' | 'wasm' | 'auto' = 'auto',
  modelProfile: VideoModelProfile = 'quality',
): Promise<void> {
  if (isInitializing) return
  isInitializing = true

  const hasWebGpu = await checkWebGpuSupport()
  let targetDevice: DeviceBackend = 'wasm'

  if (preferredDevice === 'webgpu' && hasWebGpu) {
    targetDevice = 'webgpu'
  } else if (preferredDevice === 'wasm') {
    targetDevice = 'wasm'
  } else {
    targetDevice = hasWebGpu ? 'webgpu' : 'wasm'
  }

  const handleProgress = (data: unknown): void => {
    if (!isProgressPayload(data)) return

    const progressValue = typeof data.progress === 'number' ? Math.round(data.progress) : 0
    const fileName = typeof data.file === 'string' ? data.file : 'multimodal-weights'
    const loaded = typeof data.loaded === 'number' ? data.loaded : undefined
    const total = typeof data.total === 'number' ? data.total : undefined

    const progressMsg: VideoWorkerOutgoingMessage = {
      type: 'PROGRESS',
      progress: {
        file: fileName,
        progress: progressValue,
        loaded,
        total,
      },
    }
    self.postMessage(progressMsg)
  }

  const loadPipelineStack = async (deviceToUse: DeviceBackend): Promise<void> => {
    // 1. Load Speech Model (Whisper Base for Quality or Tiny for Fast)
    const asrModelId =
      modelProfile === 'quality'
        ? 'onnx-community/whisper-base.en'
        : 'onnx-community/whisper-tiny.en'

    try {
      const asr = await pipeline('automatic-speech-recognition', asrModelId, {
        device: deviceToUse,
        dtype: deviceToUse === 'webgpu' ? 'fp32' : 'q4',
        progress_callback: handleProgress,
      })
      activeAsrPipeline = asr as unknown as AsrPipelineFn
      loadedSpeechModelName =
        modelProfile === 'quality'
          ? 'Whisper-Base (High Accuracy)'
          : 'Whisper-Tiny (Lightweight)'
    } catch {
      // If whisper-base encounters an issue on low memory, fallback to tiny
      const fallbackAsr = await pipeline(
        'automatic-speech-recognition',
        'onnx-community/whisper-tiny.en',
        {
          device: deviceToUse,
          progress_callback: handleProgress,
        },
      )
      activeAsrPipeline = fallbackAsr as unknown as AsrPipelineFn
      loadedSpeechModelName = 'Whisper-Tiny (Fallback)'
    }

    // 2. Load Vision Model (Florence-2 for Quality or ViT-GPT2 for Fast)
    if (modelProfile === 'quality') {
      try {
        activeFlorenceModel = await Florence2ForConditionalGeneration.from_pretrained(
          'onnx-community/Florence-2-base',
          {
            device: deviceToUse,
            dtype: {
              embed_tokens: 'q4',
              vision_encoder: 'q4',
              encoder_model: 'q4',
              decoder_model_merged: 'q4',
            },
            progress_callback: handleProgress,
          },
        )
        activeFlorenceProcessor = await Florence2Processor.from_pretrained(
          'onnx-community/Florence-2-base',
        )
        loadedVisionModelName = 'Florence-2 (Microsoft Foundation Vision)'
        activeVisionPipeline = null
      } catch {
        // Fallback to ViT-GPT2 if Florence-2 exceeds memory on device
        const fallbackVision = await pipeline('image-to-text', 'Xenova/vit-gpt2-image-captioning', {
          device: deviceToUse,
          progress_callback: handleProgress,
        })
        activeVisionPipeline = fallbackVision as unknown as VisionPipelineFn
        activeFlorenceModel = null
        activeFlorenceProcessor = null
        loadedVisionModelName = 'ViT-GPT2 (Fallback)'
      }
    } else {
      const fastVision = await pipeline('image-to-text', 'Xenova/vit-gpt2-image-captioning', {
        device: deviceToUse,
        progress_callback: handleProgress,
      })
      activeVisionPipeline = fastVision as unknown as VisionPipelineFn
      activeFlorenceModel = null
      activeFlorenceProcessor = null
      loadedVisionModelName = 'ViT-GPT2 (Lightweight)'
    }
  }

  try {
    await loadPipelineStack(targetDevice)
    currentDevice = targetDevice
    const successMsg: VideoWorkerOutgoingMessage = {
      type: 'INIT_SUCCESS',
      device: currentDevice,
      speechModel: loadedSpeechModelName,
      visionModel: loadedVisionModelName,
    }
    self.postMessage(successMsg)
  } catch (initialError) {
    if (targetDevice === 'webgpu') {
      try {
        await loadPipelineStack('wasm')
        currentDevice = 'wasm'
        const fallbackMsg: VideoWorkerOutgoingMessage = {
          type: 'INIT_SUCCESS',
          device: 'wasm',
          speechModel: loadedSpeechModelName,
          visionModel: loadedVisionModelName,
        }
        self.postMessage(fallbackMsg)
      } catch (wasmError) {
        const message = wasmError instanceof Error ? wasmError.message : 'WASM fallback failed'
        self.postMessage({ type: 'INIT_ERROR', error: message } satisfies VideoWorkerOutgoingMessage)
      }
    } else {
      const message =
        initialError instanceof Error ? initialError.message : 'Failed to initialize video models'
      self.postMessage({ type: 'INIT_ERROR', error: message } satisfies VideoWorkerOutgoingMessage)
    }
  } finally {
    isInitializing = false
  }
}

interface AsrRawChunk {
  timestamp?: [number | null, number | null]
  text?: string
}

interface AsrRawResult {
  text?: string
  chunks?: AsrRawChunk[]
}

function isAsrRawResult(val: unknown): val is AsrRawResult {
  return typeof val === 'object' && val !== null
}

interface VisionRawItem {
  generated_text?: string
}

function isVisionRawArray(val: unknown): val is VisionRawItem[] {
  return Array.isArray(val)
}

async function describeKeyframe(dataUrl: string): Promise<string> {
  if (activeFlorenceModel && activeFlorenceProcessor) {
    try {
      const image = await RawImage.read(dataUrl)
      const task = '<CAPTION>'
      const prompts = activeFlorenceProcessor.construct_prompts(task)
      const inputs = await activeFlorenceProcessor(image, prompts)
      const generatedIds = await activeFlorenceModel.generate({
        ...inputs,
        max_new_tokens: 50,
      })
      const decodedArr = activeFlorenceProcessor.batch_decode(generatedIds, {
        skip_special_tokens: false,
      })
      const decodedFirst = decodedArr[0]
      if (typeof decodedFirst === 'string') {
        const post = activeFlorenceProcessor.post_process_generation(decodedFirst, task, [
          image.height,
          image.width,
        ])
        if (typeof post === 'object' && post !== null && task in post) {
          const val = (post as Record<string, unknown>)[task]
          if (typeof val === 'string' && val.trim()) {
            return val.trim()
          }
        }
        const cleaned = decodedFirst.replace(/<s>/g, '').replace(/<\/s>/g, '').trim()
        if (cleaned) return cleaned
      }
    } catch {
      // Fall through to activeVisionPipeline if Florence fails on a single frame
    }
  }

  if (activeVisionPipeline) {
    const captionRaw = await activeVisionPipeline(dataUrl, { max_new_tokens: 30 })
    if (isVisionRawArray(captionRaw) && captionRaw.length > 0) {
      const gen = captionRaw[0]?.generated_text
      if (typeof gen === 'string' && gen.trim()) {
        return gen.trim()
      }
    }
  }

  return 'Visual scene recorded'
}

async function handleProcessVideo(
  requestId: string,
  audioData: Float32Array,
  keyframes: Array<{ timestamp: number; dataUrl: string }>,
): Promise<void> {
  if (!activeAsrPipeline && !activeFlorenceModel && !activeVisionPipeline) {
    const errorMsg: VideoWorkerOutgoingMessage = {
      type: 'PROCESS_ERROR',
      requestId,
      error: 'Video ML models are not fully initialized yet.',
    }
    self.postMessage(errorMsg)
    return
  }

  const startTime = performance.now()

  try {
    // ----------------------------------------------------
    // Phase 1: Transcribe Audio Track with Whisper (Full Duration)
    // ----------------------------------------------------
    const transcriptChunks: AudioTranscriptChunk[] = []

    if (activeAsrPipeline && audioData.length > 0) {
      const sampleRate = 16000
      const chunkDurationSeconds = 25
      const chunkSamples = chunkDurationSeconds * sampleRate
      const totalAudioSeconds = audioData.length / sampleRate

      if (totalAudioSeconds <= 30) {
        self.postMessage({
          type: 'STEP_UPDATE',
          step: 'transcribing',
          current: 1,
          total: 1,
          message: `Transcribing audio dialogue with ${loadedSpeechModelName.split(' ')[0]}...`,
        } satisfies VideoWorkerOutgoingMessage)

        const asrResult = await activeAsrPipeline(audioData, { return_timestamps: true })
        if (isAsrRawResult(asrResult)) {
          if (Array.isArray(asrResult.chunks) && asrResult.chunks.length > 0) {
            for (const c of asrResult.chunks) {
              const start = c.timestamp && typeof c.timestamp[0] === 'number' ? c.timestamp[0] : 0
              const end =
                c.timestamp && typeof c.timestamp[1] === 'number' ? c.timestamp[1] : start + 3
              const text = typeof c.text === 'string' ? c.text.trim() : ''
              if (text) {
                transcriptChunks.push({
                  startSeconds: Math.round(start * 10) / 10,
                  endSeconds: Math.round(end * 10) / 10,
                  text,
                })
              }
            }
          } else if (typeof asrResult.text === 'string' && asrResult.text.trim()) {
            transcriptChunks.push({
              startSeconds: 0,
              endSeconds: Math.round(totalAudioSeconds * 10) / 10,
              text: asrResult.text.trim(),
            })
          }
        }
      } else {
        const totalSegments = Math.ceil(audioData.length / chunkSamples)

        for (let segIdx = 0; segIdx < totalSegments; segIdx++) {
          const startSample = segIdx * chunkSamples
          const endSample = Math.min(startSample + chunkSamples, audioData.length)
          const slice = audioData.subarray(startSample, endSample)
          const offsetSeconds = segIdx * chunkDurationSeconds

          self.postMessage({
            type: 'STEP_UPDATE',
            step: 'transcribing',
            current: segIdx + 1,
            total: totalSegments,
            message: `Transcribing audio segment ${segIdx + 1} of ${totalSegments} (${offsetSeconds}s - ${Math.round(endSample / sampleRate)}s)...`,
          } satisfies VideoWorkerOutgoingMessage)

          try {
            const asrResult = await activeAsrPipeline(slice, { return_timestamps: true })
            if (isAsrRawResult(asrResult)) {
              if (Array.isArray(asrResult.chunks) && asrResult.chunks.length > 0) {
                for (const c of asrResult.chunks) {
                  const segStart =
                    c.timestamp && typeof c.timestamp[0] === 'number' ? c.timestamp[0] : 0
                  const segEnd =
                    c.timestamp && typeof c.timestamp[1] === 'number' ? c.timestamp[1] : segStart + 3
                  const text = typeof c.text === 'string' ? c.text.trim() : ''
                  if (text) {
                    transcriptChunks.push({
                      startSeconds: Math.round((segStart + offsetSeconds) * 10) / 10,
                      endSeconds: Math.round((segEnd + offsetSeconds) * 10) / 10,
                      text,
                    })
                  }
                }
              } else if (typeof asrResult.text === 'string' && asrResult.text.trim()) {
                transcriptChunks.push({
                  startSeconds: Math.round(offsetSeconds * 10) / 10,
                  endSeconds: Math.round((offsetSeconds + slice.length / sampleRate) * 10) / 10,
                  text: asrResult.text.trim(),
                })
              }
            }
          } catch {
            // Continue transcribing remaining chunks if an individual slice fails
          }
        }
      }
    }

    // ----------------------------------------------------
    // Phase 2: Describe Visual Scenes (Across Entire Video)
    // ----------------------------------------------------
    const sceneCaptions: Array<{ timestamp: number; caption: string }> = []

    for (let i = 0; i < keyframes.length; i++) {
      const kf = keyframes[i]
      self.postMessage({
        type: 'STEP_UPDATE',
        step: 'captioning',
        current: i + 1,
        total: keyframes.length,
        message: `Analyzing keyframe ${i + 1} of ${keyframes.length} (${Math.round(kf.timestamp)}s) with ${loadedVisionModelName.split(' ')[0]}...`,
      } satisfies VideoWorkerOutgoingMessage)

      try {
        const caption = await describeKeyframe(kf.dataUrl)
        sceneCaptions.push({
          timestamp: Math.round(kf.timestamp * 10) / 10,
          caption,
        })
      } catch {
        sceneCaptions.push({
          timestamp: Math.round(kf.timestamp * 10) / 10,
          caption: 'Visual keyframe analyzed',
        })
      }
    }

    const executionTimeMs = Math.round(performance.now() - startTime)

    const successMsg: VideoWorkerOutgoingMessage = {
      type: 'PROCESS_SUCCESS',
      requestId,
      transcriptChunks,
      sceneCaptions,
      executionTimeMs,
    }
    self.postMessage(successMsg)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Video processing failed'
    const errorMsg: VideoWorkerOutgoingMessage = {
      type: 'PROCESS_ERROR',
      requestId,
      error: message,
    }
    self.postMessage(errorMsg)
  }
}

self.addEventListener('message', (event: MessageEvent<VideoWorkerIncomingMessage>): void => {
  const data = event.data
  if (!data || typeof data !== 'object') return

  if (data.type === 'INIT') {
    void initializeVideoModels(data.preferredDevice, data.modelProfile ?? 'quality')
  } else if (data.type === 'PROCESS_VIDEO') {
    void handleProcessVideo(data.requestId, data.audioData, data.keyframes)
  }
})
