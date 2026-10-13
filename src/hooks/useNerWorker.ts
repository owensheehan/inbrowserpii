import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  ChunkProgress,
  DetectedEntity,
  DeviceBackend,
  DownloadProgress,
  WorkerIncomingMessage,
  WorkerOutgoingMessage,
  WorkerStatus,
} from '../types/ner'

export interface UseNerWorkerReturn {
  status: WorkerStatus
  device: DeviceBackend | null
  downloadProgress: DownloadProgress | null
  chunkProgress: ChunkProgress | null
  isProcessing: boolean
  redactedOutput: string
  detectedEntities: DetectedEntity[]
  executionTimeMs: number | null
  error: string | null
  modelName: string
  redactText: (text: string, tagFormat?: 'standard' | 'typed') => void
  reinitialize: (preferredDevice?: 'webgpu' | 'wasm' | 'auto') => void
}

export function useNerWorker(): UseNerWorkerReturn {
  const [status, setStatus] = useState<WorkerStatus>('initializing')
  const [device, setDevice] = useState<DeviceBackend | null>(null)
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null)
  const [chunkProgress, setChunkProgress] = useState<ChunkProgress | null>(null)
  const [isProcessing, setIsProcessing] = useState<boolean>(false)
  const [redactedOutput, setRedactedOutput] = useState<string>('')
  const [detectedEntities, setDetectedEntities] = useState<DetectedEntity[]>([])
  const [executionTimeMs, setExecutionTimeMs] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [modelName, setModelName] = useState<string>('Xenova/bert-base-NER')

  const workerRef = useRef<Worker | null>(null)

  const postWorkerMessage = useCallback((msg: WorkerIncomingMessage): void => {
    if (workerRef.current) {
      workerRef.current.postMessage(msg)
    }
  }, [])

  const reinitialize = useCallback(
    (preferredDevice: 'webgpu' | 'wasm' | 'auto' = 'auto'): void => {
      setStatus('initializing')
      setError(null)
      postWorkerMessage({
        type: 'INIT',
        preferredDevice,
        modelId: 'Xenova/bert-base-NER',
      })
    },
    [postWorkerMessage],
  )

  useEffect(() => {
    const workerInstance = new Worker(new URL('../workers/ner.worker.ts', import.meta.url), {
      type: 'module',
    })
    workerRef.current = workerInstance

    workerInstance.onmessage = (event: MessageEvent<WorkerOutgoingMessage>): void => {
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
          setModelName(data.model)
          setError(null)
          break
        }
        case 'INIT_ERROR': {
          setStatus('error')
          setError(data.error)
          break
        }
        case 'CHUNK_PROGRESS': {
          setChunkProgress({
            current: data.currentChunk,
            total: data.totalChunks,
          })
          break
        }
        case 'REDACT_SUCCESS': {
          setIsProcessing(false)
          setChunkProgress(null)
          setStatus('ready')
          setRedactedOutput(data.redactedText)
          setDetectedEntities(data.entities)
          setExecutionTimeMs(data.executionTimeMs)
          break
        }
        case 'REDACT_ERROR': {
          setIsProcessing(false)
          setChunkProgress(null)
          setStatus('ready')
          setError(data.error)
          break
        }
      }
    }

    workerInstance.onerror = (evt: ErrorEvent): void => {
      setIsProcessing(false)
      setChunkProgress(null)
      setStatus('error')
      setError(evt.message || 'Unknown Web Worker error')
    }

    workerInstance.postMessage({
      type: 'INIT',
      preferredDevice: 'auto',
      modelId: 'Xenova/bert-base-NER',
    } satisfies WorkerIncomingMessage)

    return () => {
      workerInstance.terminate()
      workerRef.current = null
    }
  }, [])

  const redactText = useCallback(
    (text: string, tagFormat: 'standard' | 'typed' = 'standard'): void => {
      if (!text.trim()) {
        setRedactedOutput('')
        setDetectedEntities([])
        setExecutionTimeMs(0)
        setChunkProgress(null)
        return
      }

      const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
      setIsProcessing(true)
      setChunkProgress(null)
      setError(null)

      postWorkerMessage({
        type: 'REDACT',
        requestId,
        text,
        tagFormat,
      })
    },
    [postWorkerMessage],
  )

  return {
    status,
    device,
    downloadProgress,
    chunkProgress,
    isProcessing,
    redactedOutput,
    detectedEntities,
    executionTimeMs,
    error,
    modelName,
    redactText,
    reinitialize,
  }
}
