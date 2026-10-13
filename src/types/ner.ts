export type EntityType =
  | 'PER'
  | 'LOC'
  | 'ORG'
  | 'EMAIL'
  | 'PHONE'
  | 'EIRCODE'
  | 'PPSN'
  | 'IBAN';

export interface DetectedEntity {
  word: string;
  entityGroup: EntityType;
  score: number;
  start?: number;
  end?: number;
}

export type DeviceBackend = 'webgpu' | 'wasm';

export type WorkerStatus =
  | 'idle'
  | 'initializing'
  | 'downloading'
  | 'ready'
  | 'processing'
  | 'error';

export interface DownloadProgress {
  file: string;
  progress: number;
  loaded?: number;
  total?: number;
}

export interface ChunkProgress {
  current: number;
  total: number;
}

export interface FileMetadata {
  name: string;
  size: number;
  type: string;
  extension: string;
}

export interface WorkerInitMessage {
  type: 'INIT';
  preferredDevice?: 'webgpu' | 'wasm' | 'auto';
  modelId?: string;
}

export interface WorkerRedactMessage {
  type: 'REDACT';
  requestId: string;
  text: string;
  tagFormat: 'standard' | 'typed';
}

export type WorkerIncomingMessage = WorkerInitMessage | WorkerRedactMessage;

export interface WorkerProgressResponse {
  type: 'PROGRESS';
  progress: DownloadProgress;
}

export interface WorkerInitSuccessResponse {
  type: 'INIT_SUCCESS';
  device: DeviceBackend;
  model: string;
}

export interface WorkerInitErrorResponse {
  type: 'INIT_ERROR';
  error: string;
}

export interface WorkerChunkProgressResponse {
  type: 'CHUNK_PROGRESS';
  requestId: string;
  currentChunk: number;
  totalChunks: number;
}

export interface WorkerRedactSuccessResponse {
  type: 'REDACT_SUCCESS';
  requestId: string;
  originalText: string;
  redactedText: string;
  entities: DetectedEntity[];
  executionTimeMs: number;
}

export interface WorkerRedactErrorResponse {
  type: 'REDACT_ERROR';
  requestId: string;
  error: string;
}

export type WorkerOutgoingMessage =
  | WorkerProgressResponse
  | WorkerInitSuccessResponse
  | WorkerInitErrorResponse
  | WorkerChunkProgressResponse
  | WorkerRedactSuccessResponse
  | WorkerRedactErrorResponse;
