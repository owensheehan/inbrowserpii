import type { JSX } from 'react'
import { Badge, Box, Button, Flex, HStack, Spinner, Text } from '@chakra-ui/react'
import { FiAlertCircle, FiCheckCircle, FiClock, FiDownloadCloud, FiLayers, FiRefreshCw, FiShield } from 'react-icons/fi'
import type { ChunkProgress, DownloadProgress, WorkerStatus } from '../types/ner'

interface ModelStatusBarProps {
  status: WorkerStatus
  downloadProgress: DownloadProgress | null
  chunkProgress: ChunkProgress | null
  isProcessing: boolean
  executionTimeMs: number | null
  entityCount: number
  error: string | null
  onRetry: () => void
}

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return '0 MB'
  const mb = bytes / (1024 * 1024)
  return `${mb.toFixed(1)} MB`
}

export function ModelStatusBar({
  status,
  downloadProgress,
  chunkProgress,
  isProcessing,
  executionTimeMs,
  entityCount,
  error,
  onRetry,
}: ModelStatusBarProps): JSX.Element {
  const isDownloading = status === 'downloading'
  const isInitializing = status === 'initializing'
  const isReady = status === 'ready'
  const isError = status === 'error'

  return (
    <Box
      className="glass-panel"
      p={4}
      mb={6}
      bg="rgba(15, 23, 42, 0.6)"
      border="1px solid"
      borderColor={isError ? 'rgba(239, 68, 68, 0.3)' : 'rgba(148, 163, 184, 0.12)'}
    >
      <Flex
        direction={{ base: 'column', md: 'row' }}
        align={{ base: 'flex-start', md: 'center' }}
        justify="space-between"
        gap={4}
      >
        {/* Left side: Status description */}
        <HStack gap={3}>
          {isDownloading && <Spinner size="sm" color="#38bdf8" />}
          {isInitializing && <Spinner size="sm" color="#818cf8" />}
          {isReady && !isProcessing && (
            <Box color="#10b981">
              <FiCheckCircle size={18} />
            </Box>
          )}
          {isProcessing && (
            <Box className="pulse-indicator" color="#38bdf8">
              <Spinner size="sm" color="#38bdf8" />
            </Box>
          )}
          {isError && (
            <Box color="#ef4444">
              <FiAlertCircle size={18} />
            </Box>
          )}

          <Box>
            <HStack gap={2}>
              <Text fontWeight="600" fontSize="sm" color="#f8fafc">
                {isDownloading && 'Downloading NER Model Weights into Browser Cache...'}
                {isInitializing && 'Initializing Web Worker & ONNX Runtime...'}
                {isReady &&
                  !isProcessing &&
                  'Model Ready in Web Worker (Zero-Server Isolation)'}
                {isProcessing &&
                  (chunkProgress
                    ? `Processing Chunk ${chunkProgress.current} of ${chunkProgress.total}...`
                    : 'Scanning & Redacting Tokens in Web Worker...')}
                {isError && 'Initialization Failed'}
              </Text>
            </HStack>

            <Text fontSize="xs" color="#94a3b8" mt={0.5}>
              {isDownloading &&
                downloadProgress &&
                `Caching ${downloadProgress.file} (${formatBytes(downloadProgress.loaded)} / ${formatBytes(downloadProgress.total)})`}
              {isInitializing && 'Negotiating WebGPU hardware buffer with WASM fallback'}
              {isReady && !isProcessing && 'Accepts manual text and uploaded document files (.txt, .md, .csv, .json)'}
              {isProcessing &&
                (chunkProgress
                  ? `Batched background execution in Web Worker • ${Math.round((chunkProgress.current / chunkProgress.total) * 100)}% complete`
                  : 'Execution isolated in background thread (UI non-blocking)')}
              {isError && (error || 'An error occurred during model setup')}
            </Text>
          </Box>
        </HStack>

        {/* Right side: Performance Metrics & Controls */}
        <HStack gap={3} wrap="wrap">
          {chunkProgress && (
            <Badge
              px={2.5}
              py={1}
              borderRadius="md"
              bg="rgba(56, 189, 248, 0.15)"
              color="#38bdf8"
              fontSize="xs"
              fontWeight="600"
            >
              <HStack gap={1}>
                <FiLayers size={12} />
                <Text as="span">
                  Chunk {chunkProgress.current}/{chunkProgress.total}
                </Text>
              </HStack>
            </Badge>
          )}

          {isReady && executionTimeMs !== null && !isProcessing && (
            <Badge
              px={2.5}
              py={1}
              borderRadius="md"
              bg="rgba(148, 163, 184, 0.1)"
              color="#cbd5e1"
              fontSize="xs"
            >
              <HStack gap={1}>
                <FiClock size={12} />
                <Text as="span">{executionTimeMs} ms latency</Text>
              </HStack>
            </Badge>
          )}

          {isReady && entityCount > 0 && !isProcessing && (
            <Badge
              px={2.5}
              py={1}
              borderRadius="md"
              bg="rgba(168, 85, 247, 0.15)"
              color="#c084fc"
              fontSize="xs"
              fontWeight="600"
            >
              <HStack gap={1}>
                <FiShield size={12} />
                <Text as="span">{entityCount} PII entities redacted</Text>
              </HStack>
            </Badge>
          )}

          {isError && (
            <Button
              size="xs"
              onClick={onRetry}
              bg="rgba(239, 68, 68, 0.2)"
              color="#f87171"
              _hover={{ bg: 'rgba(239, 68, 68, 0.3)' }}
            >
              <HStack gap={1.5}>
                <FiRefreshCw size={12} />
                <Text as="span">Retry</Text>
              </HStack>
            </Button>
          )}
        </HStack>
      </Flex>

      {/* Model Download Progress Bar */}
      {isDownloading && downloadProgress && (
        <Box mt={3}>
          <Flex justify="space-between" fontSize="xs" color="#94a3b8" mb={1}>
            <HStack gap={1}>
              <FiDownloadCloud size={13} />
              <Text as="span">{downloadProgress.file}</Text>
            </HStack>
            <Text fontWeight="600" color="#38bdf8">
              {downloadProgress.progress}%
            </Text>
          </Flex>
          <Box w="100%" h="6px" bg="rgba(148, 163, 184, 0.15)" borderRadius="full" overflow="hidden">
            <Box
              className="shimmer-progress"
              h="100%"
              w={`${Math.max(downloadProgress.progress, 5)}%`}
              borderRadius="full"
              transition="width 0.3s ease"
            />
          </Box>
        </Box>
      )}

      {/* Chunk Processing Progress Bar */}
      {isProcessing && chunkProgress && (
        <Box mt={3}>
          <Flex justify="space-between" fontSize="xs" color="#94a3b8" mb={1}>
            <HStack gap={1}>
              <FiLayers size={13} color="#38bdf8" />
              <Text as="span">Chunk Progress</Text>
            </HStack>
            <Text fontWeight="600" color="#38bdf8">
              {Math.round((chunkProgress.current / chunkProgress.total) * 100)}%
            </Text>
          </Flex>
          <Box w="100%" h="5px" bg="rgba(148, 163, 184, 0.15)" borderRadius="full" overflow="hidden">
            <Box
              h="100%"
              w={`${Math.max(Math.round((chunkProgress.current / chunkProgress.total) * 100), 5)}%`}
              bg="linear-gradient(90deg, #38bdf8, #818cf8)"
              borderRadius="full"
              transition="width 0.2s ease"
            />
          </Box>
        </Box>
      )}
    </Box>
  )
}
