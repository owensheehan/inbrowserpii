import type { DeviceBackend, DownloadProgress } from './ner'

export interface VideoKeyframe {
  timestampSeconds: number
  timecodeFormatted: string
  dataUrl: string
  caption?: string
}

export interface AudioTranscriptChunk {
  startSeconds: number
  endSeconds: number
  text: string
  redactedText?: string
}

export interface MultimodalTimelineEvent {
  id: string
  timestampSeconds: number
  timecode: string
  sceneCaption: string
  keyframeThumbnail?: string
  dialogueTranscript: string
  sanitizedDialogue?: string
}

export type VideoWorkerStatus =
  | 'idle'
  | 'initializing'
  | 'downloading'
  | 'ready'
  | 'extracting-media'
  | 'transcribing'
  | 'captioning'
  | 'complete'
  | 'error'

export type VideoModelProfile = 'quality' | 'fast'

export interface VideoWorkerInitMessage {
  type: 'INIT'
  preferredDevice?: 'webgpu' | 'wasm' | 'auto'
  modelProfile?: VideoModelProfile
}

export interface VideoWorkerProcessMessage {
  type: 'PROCESS_VIDEO'
  requestId: string
  audioData: Float32Array
  keyframes: Array<{
    timestamp: number
    dataUrl: string
  }>
}

export type VideoWorkerIncomingMessage =
  | VideoWorkerInitMessage
  | VideoWorkerProcessMessage

export interface VideoWorkerProgressResponse {
  type: 'PROGRESS'
  progress: DownloadProgress
}

export interface VideoWorkerInitSuccessResponse {
  type: 'INIT_SUCCESS'
  device: DeviceBackend
  speechModel: string
  visionModel: string
}

export interface VideoWorkerInitErrorResponse {
  type: 'INIT_ERROR'
  error: string
}

export interface VideoWorkerStepResponse {
  type: 'STEP_UPDATE'
  step: 'transcribing' | 'captioning'
  current: number
  total: number
  message: string
}

export interface VideoWorkerProcessSuccessResponse {
  type: 'PROCESS_SUCCESS'
  requestId: string
  transcriptChunks: AudioTranscriptChunk[]
  sceneCaptions: Array<{
    timestamp: number
    caption: string
  }>
  executionTimeMs: number
}

export interface VideoWorkerProcessErrorResponse {
  type: 'PROCESS_ERROR'
  requestId: string
  error: string
}

export type VideoWorkerOutgoingMessage =
  | VideoWorkerProgressResponse
  | VideoWorkerInitSuccessResponse
  | VideoWorkerInitErrorResponse
  | VideoWorkerStepResponse
  | VideoWorkerProcessSuccessResponse
  | VideoWorkerProcessErrorResponse
