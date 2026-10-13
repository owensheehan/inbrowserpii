import { env, pipeline } from '@huggingface/transformers'
import type {
  DetectedEntity,
  DeviceBackend,
  EntityType,
  WorkerIncomingMessage,
  WorkerOutgoingMessage,
} from '../types/ner'

// In browser / web worker environment, prevent unnecessary local file search
env.allowLocalModels = false

type NerPipelineFn = (
  text: string,
  options?: { aggregation_strategy?: 'simple' | 'none'; ignore_labels?: string[] },
) => Promise<unknown>

let activePipeline: NerPipelineFn | null = null
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

interface RawEntityRecord {
  word?: unknown
  entity?: unknown
  entity_group?: unknown
  score?: unknown
  start?: unknown
  end?: unknown
}

function isRawEntityRecord(val: unknown): val is RawEntityRecord {
  return typeof val === 'object' && val !== null
}

function normalizeEntityType(rawLabel: string): EntityType | null {
  const cleaned = rawLabel.toUpperCase().replace(/^(B-|I-)/, '')
  if (cleaned === 'PER' || cleaned === 'LOC' || cleaned === 'ORG') {
    return cleaned
  }
  return null
}

interface PatternRule {
  type: EntityType
  regex: RegExp
}

const STRUCTURED_PII_RULES: PatternRule[] = [
  // Email address
  {
    type: 'EMAIL',
    regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
  },
  // Irish Eircode (Routing key + Identifier, e.g. P31 NN53, D02 X285, D6W 1234)
  {
    type: 'EIRCODE',
    regex: /\b(?:[AC-FHKNPRTV-Yac-fhknprtv-y]\d{2}|D6W|d6w)\s?[0-9AC-FHKNPRTV-Yac-fhknprtv-y]{4}\b/g,
  },
  // Telephone Numbers (Irish, UK, International, US)
  {
    type: 'PHONE',
    regex: /(?:(?:\+|00)\d{1,3}[\s.-]?)?(?:\(\d{2,4}\)[\s.-]?|0\d{1,4}[\s.-]|\b0\d{8,10}\b)\d{3}[\s.-]?\d{3,4}\b|\b\d{3}[-.]\d{3}[-.]\d{4}\b/g,
  },
  // Irish PPSN
  {
    type: 'PPSN',
    regex: /\b\d{7}[A-Za-z]{1,2}\b/g,
  },
  // IBAN
  {
    type: 'IBAN',
    regex: /\b[A-Z]{2}\d{2}[A-Z0-9]{4}\d{7}([A-Z0-9]?){0,16}\b/g,
  },
]

function extractStructuredPii(text: string): DetectedEntity[] {
  const entities: DetectedEntity[] = []

  for (const rule of STRUCTURED_PII_RULES) {
    rule.regex.lastIndex = 0
    let match: RegExpExecArray | null = null

    while ((match = rule.regex.exec(text)) !== null) {
      entities.push({
        word: match[0],
        entityGroup: rule.type,
        score: 1.0,
        start: match.index,
        end: match.index + match[0].length,
      })
    }
  }

  return entities
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

async function initializeModel(
  modelId: string = 'Xenova/bert-base-NER',
  preferredDevice: 'webgpu' | 'wasm' | 'auto' = 'auto',
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
    const fileName = typeof data.file === 'string' ? data.file : 'model-artifacts'
    const loaded = typeof data.loaded === 'number' ? data.loaded : undefined
    const total = typeof data.total === 'number' ? data.total : undefined

    const progressMsg: WorkerOutgoingMessage = {
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

  try {
    const loadedPipeline = await pipeline('token-classification', modelId, {
      device: targetDevice,
      progress_callback: handleProgress,
    })

    activePipeline = loadedPipeline as unknown as NerPipelineFn
    currentDevice = targetDevice

    const successMsg: WorkerOutgoingMessage = {
      type: 'INIT_SUCCESS',
      device: currentDevice,
      model: modelId,
    }
    self.postMessage(successMsg)
  } catch (initialError) {
    if (targetDevice === 'webgpu') {
      try {
        const wasmPipeline = await pipeline('token-classification', modelId, {
          device: 'wasm',
          progress_callback: handleProgress,
        })
        activePipeline = wasmPipeline as unknown as NerPipelineFn
        currentDevice = 'wasm'

        const fallbackSuccessMsg: WorkerOutgoingMessage = {
          type: 'INIT_SUCCESS',
          device: 'wasm',
          model: modelId,
        }
        self.postMessage(fallbackSuccessMsg)
        return
      } catch (fallbackError) {
        const message =
          fallbackError instanceof Error
            ? fallbackError.message
            : 'Failed to initialize WASM fallback'
        const errorMsg: WorkerOutgoingMessage = {
          type: 'INIT_ERROR',
          error: message,
        }
        self.postMessage(errorMsg)
      }
    } else {
      const message =
        initialError instanceof Error
          ? initialError.message
          : 'Failed to initialize token-classification pipeline'
      const errorMsg: WorkerOutgoingMessage = {
        type: 'INIT_ERROR',
        error: message,
      }
      self.postMessage(errorMsg)
    }
  } finally {
    isInitializing = false
  }
}

interface SpanToRedact {
  start: number
  end: number
  entityGroup: EntityType
  word: string
  score: number
}

function redactOriginalText(
  originalText: string,
  rawEntities: DetectedEntity[],
  tagFormat: 'standard' | 'typed',
): { redactedText: string; verifiedEntities: DetectedEntity[] } {
  const spans: SpanToRedact[] = []
  let searchCursor = 0

  for (const item of rawEntities) {
    const startIdx = item.start
    const endIdx = item.end

    if (
      typeof startIdx === 'number' &&
      typeof endIdx === 'number' &&
      startIdx >= 0 &&
      endIdx > startIdx &&
      endIdx <= originalText.length
    ) {
      spans.push({
        start: startIdx,
        end: endIdx,
        entityGroup: item.entityGroup,
        word: originalText.slice(startIdx, endIdx),
        score: item.score,
      })
    } else {
      const cleanWord = item.word.replace(/^##/, '').trim()
      if (!cleanWord) continue

      const foundIndex = originalText.toLowerCase().indexOf(cleanWord.toLowerCase(), searchCursor)
      if (foundIndex !== -1) {
        const foundEnd = foundIndex + cleanWord.length
        spans.push({
          start: foundIndex,
          end: foundEnd,
          entityGroup: item.entityGroup,
          word: originalText.slice(foundIndex, foundEnd),
          score: item.score,
        })
        searchCursor = foundEnd
      }
    }
  }

  // Sort descending by start index to replace from end to beginning
  spans.sort((a, b) => b.start - a.start)

  // Merge overlapping spans
  const nonOverlappingSpans: SpanToRedact[] = []
  for (const span of spans) {
    const previous = nonOverlappingSpans[nonOverlappingSpans.length - 1]
    if (previous && span.end >= previous.start) {
      previous.start = Math.min(previous.start, span.start)
      previous.word = originalText.slice(previous.start, previous.end)
    } else {
      nonOverlappingSpans.push({ ...span })
    }
  }

  let redactedText = originalText
  const verifiedEntities: DetectedEntity[] = []

  for (const span of nonOverlappingSpans) {
    const replacement = tagFormat === 'typed' ? `[REDACTED: ${span.entityGroup}]` : `[REDACTED]`
    redactedText =
      redactedText.slice(0, span.start) + replacement + redactedText.slice(span.end)

    verifiedEntities.push({
      word: span.word,
      entityGroup: span.entityGroup,
      score: span.score,
      start: span.start,
      end: span.end,
    })
  }

  verifiedEntities.sort((a, b) => (a.start ?? 0) - (b.start ?? 0))
  return { redactedText, verifiedEntities }
}

interface TextChunk {
  text: string
  originalStartOffset: number
}

function splitIntoChunks(fullText: string, maxChunkLength: number = 700): TextChunk[] {
  if (fullText.length <= maxChunkLength) {
    return [{ text: fullText, originalStartOffset: 0 }]
  }

  const parts = fullText.split(/(\r?\n\r?\n|\r?\n)/)
  const chunks: TextChunk[] = []
  let currentChunkText = ''
  let currentChunkStart = 0
  let cursor = 0

  for (const part of parts) {
    if (currentChunkText.length + part.length > maxChunkLength && currentChunkText.length > 0) {
      chunks.push({ text: currentChunkText, originalStartOffset: currentChunkStart })
      currentChunkStart = cursor
      currentChunkText = part
    } else {
      if (currentChunkText.length === 0) {
        currentChunkStart = cursor
      }
      currentChunkText += part
    }
    cursor += part.length
  }

  if (currentChunkText.length > 0) {
    chunks.push({ text: currentChunkText, originalStartOffset: currentChunkStart })
  }

  return chunks.length > 0 ? chunks : [{ text: fullText, originalStartOffset: 0 }]
}

async function handleRedact(
  requestId: string,
  text: string,
  tagFormat: 'standard' | 'typed',
): Promise<void> {
  if (!activePipeline) {
    const errorMsg: WorkerOutgoingMessage = {
      type: 'REDACT_ERROR',
      requestId,
      error: 'NER Model is not initialized yet.',
    }
    self.postMessage(errorMsg)
    return
  }

  const startTime = performance.now()

  try {
    const chunks = splitIntoChunks(text, 700)
    let finalRedactedText = ''
    const allVerifiedEntities: DetectedEntity[] = []

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]

      const chunkProgressMsg: WorkerOutgoingMessage = {
        type: 'CHUNK_PROGRESS',
        requestId,
        currentChunk: i + 1,
        totalChunks: chunks.length,
      }
      self.postMessage(chunkProgressMsg)

      if (!chunk.text.trim()) {
        finalRedactedText += chunk.text
        continue
      }

      // 1. Structured PII Detection (Email, Phone, Eircode, PPSN, IBAN)
      const patternEntities = extractStructuredPii(chunk.text)

      // 2. Machine Learning NER Detection (PER, LOC, ORG)
      const rawResult = await activePipeline(chunk.text, {
        aggregation_strategy: 'simple',
      })

      const modelEntities: DetectedEntity[] = []

      if (Array.isArray(rawResult)) {
        for (const item of rawResult) {
          if (!isRawEntityRecord(item)) continue

          const labelString =
            typeof item.entity_group === 'string'
              ? item.entity_group
              : typeof item.entity === 'string'
                ? item.entity
                : ''

          const normalizedType = normalizeEntityType(labelString)
          if (!normalizedType) continue

          const wordText = typeof item.word === 'string' ? item.word : ''
          const scoreVal = typeof item.score === 'number' ? Math.round(item.score * 1000) / 1000 : 0
          const startVal = typeof item.start === 'number' ? item.start : undefined
          const endVal = typeof item.end === 'number' ? item.end : undefined

          modelEntities.push({
            word: wordText,
            entityGroup: normalizedType,
            score: scoreVal,
            start: startVal,
            end: endVal,
          })
        }
      }

      // Filter out model entities that overlap with high-confidence pattern entities
      const nonOverlappingModelEntities = modelEntities.filter((mEnt) => {
        if (mEnt.start === undefined || mEnt.end === undefined) return true
        return !patternEntities.some((pEnt) => {
          if (pEnt.start === undefined || pEnt.end === undefined) return false
          return mEnt.start! < pEnt.end && mEnt.end! > pEnt.start
        })
      })

      const combinedEntities = [...patternEntities, ...nonOverlappingModelEntities]

      const { redactedText, verifiedEntities } = redactOriginalText(
        chunk.text,
        combinedEntities,
        tagFormat,
      )

      finalRedactedText += redactedText

      for (const ent of verifiedEntities) {
        allVerifiedEntities.push({
          ...ent,
          start: ent.start !== undefined ? ent.start + chunk.originalStartOffset : undefined,
          end: ent.end !== undefined ? ent.end + chunk.originalStartOffset : undefined,
        })
      }
    }

    const executionTimeMs = Math.round(performance.now() - startTime)

    const successMsg: WorkerOutgoingMessage = {
      type: 'REDACT_SUCCESS',
      requestId,
      originalText: text,
      redactedText: finalRedactedText,
      entities: allVerifiedEntities,
      executionTimeMs,
    }
    self.postMessage(successMsg)
  } catch (inferenceError) {
    const message =
      inferenceError instanceof Error ? inferenceError.message : 'Inference execution failed'
    const errorMsg: WorkerOutgoingMessage = {
      type: 'REDACT_ERROR',
      requestId,
      error: message,
    }
    self.postMessage(errorMsg)
  }
}

self.addEventListener('message', (event: MessageEvent<WorkerIncomingMessage>): void => {
  const data = event.data
  if (!data || typeof data !== 'object') return

  if (data.type === 'INIT') {
    void initializeModel(data.modelId, data.preferredDevice)
  } else if (data.type === 'REDACT') {
    void handleRedact(data.requestId, data.text, data.tagFormat)
  }
})
