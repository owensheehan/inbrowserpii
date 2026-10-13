import type { JSX } from 'react'
import { Badge, Box, Button, Flex, HStack, Spinner, Text } from '@chakra-ui/react'
import {
  FiAlertCircle,
  FiCheckCircle,
  FiClock,
  FiDownloadCloud,
  FiEye,
  FiLayers,
  FiMic,
  FiRefreshCw,
  FiZap,
} from 'react-icons/fi'
import type { DeviceBackend, DownloadProgress } from '../../types/ner'
import type { VideoModelProfile, VideoWorkerStatus } from '../../types/video'

interface VideoStatusBannerProps {
  status: VideoWorkerStatus
  device: DeviceBackend | null
  downloadProgress: DownloadProgress | null
  stepMessage: string
  stepProgress: { current: number; total: number } | null
  executionTimeMs: number | null
  error: string | null
  speechModel?: string
  visionModel?: string
  modelProfile?: VideoModelProfile
  onModelProfileChange?: (profile: VideoModelProfile) => void
  onRetry: () => void
}

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return '0 MB'
  const mb = bytes / (1024 * 1024)
  return `${mb.toFixed(1)} MB`
}

export function VideoStatusBanner({
  status,
  device,
  downloadProgress,
  stepMessage,
  stepProgress,
  executionTimeMs,
  error,
  speechModel = 'Whisper-Base',
  visionModel = 'Florence-2',
  modelProfile = 'quality',
  onModelProfileChange,
  onRetry,
}: VideoStatusBannerProps): JSX.Element {
  const isDownloading = status === 'downloading'
  const isInitializing = status === 'initializing'
  const isProcessing =
    status === 'extracting-media' || status === 'transcribing' || status === 'captioning'
  const isReady = status === 'ready' || status === 'complete'
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
        <HStack gap={3}>
          {isDownloading && <Spinner size="sm" color="#38bdf8" />}
          {isInitializing && <Spinner size="sm" color="#818cf8" />}
          {isProcessing && (
            <Box className="pulse-indicator" color="#c084fc">
              <Spinner size="sm" color="#c084fc" />
            </Box>
          )}
          {isReady && !isProcessing && (
            <Box color="#10b981">
              <FiCheckCircle size={18} />
            </Box>
          )}
          {isError && (
            <Box color="#ef4444">
              <FiAlertCircle size={18} />
            </Box>
          )}

          <Box>
            <HStack gap={2} wrap="wrap">
              <Text fontWeight="600" fontSize="sm" color="#f8fafc">
                {isDownloading && 'Downloading Multimodal AI Models...'}
                {isInitializing && 'Initializing Video Processing Worker...'}
                {status === 'extracting-media' && 'Decoding Audio Stream & Sampling Keyframes...'}
                {status === 'transcribing' && `Transcribing Dialogue with ${speechModel.split(' ')[0]}...`}
                {status === 'captioning' && `Describing Visual Scenes with ${visionModel.split(' ')[0]}...`}
                {status === 'complete' && 'Multimodal Video Analysis Complete'}
                {status === 'ready' && 'Video Intelligence Models Ready'}
                {isError && 'Video Initialization Error'}
              </Text>
            </HStack>

            <Text fontSize="xs" color="#94a3b8" mt={0.5}>
              {isDownloading &&
                downloadProgress &&
                `Caching ${downloadProgress.file} (${formatBytes(downloadProgress.loaded)} / ${formatBytes(downloadProgress.total)})`}
              {isProcessing && (stepMessage || 'Executing local ML inference on WebGPU/WASM')}
              {isReady &&
                !isProcessing &&
                `Active: ${speechModel} + ${visionModel} (100% private in-browser inference)`}
              {isError && (error || 'Failed to initialize video pipelines')}
            </Text>
          </Box>
        </HStack>

        <HStack gap={2.5} wrap="wrap">
          {/* Model Profile Toggle */}
          {onModelProfileChange && (
            <HStack
              bg="rgba(15, 23, 42, 0.8)"
              p={0.5}
              borderRadius="md"
              border="1px solid rgba(148, 163, 184, 0.15)"
            >
              <Button
                size="xs"
                variant="ghost"
                onClick={() => onModelProfileChange('quality')}
                bg={modelProfile === 'quality' ? 'rgba(56, 189, 248, 0.2)' : 'transparent'}
                color={modelProfile === 'quality' ? '#38bdf8' : '#94a3b8'}
                fontWeight={modelProfile === 'quality' ? '600' : '400'}
                _hover={{ bg: 'rgba(56, 189, 248, 0.1)' }}
                px={2}
                h="22px"
              >
                <HStack gap={1}>
                  <FiZap size={11} />
                  <Text as="span">High Quality</Text>
                </HStack>
              </Button>
              <Button
                size="xs"
                variant="ghost"
                onClick={() => onModelProfileChange('fast')}
                bg={modelProfile === 'fast' ? 'rgba(192, 132, 252, 0.2)' : 'transparent'}
                color={modelProfile === 'fast' ? '#c084fc' : '#94a3b8'}
                fontWeight={modelProfile === 'fast' ? '600' : '400'}
                _hover={{ bg: 'rgba(192, 132, 252, 0.1)' }}
                px={2}
                h="22px"
              >
                Fast Mode
              </Button>
            </HStack>
          )}

          {/* Active Model Badges */}
          <Badge
            px={2}
            py={0.5}
            borderRadius="md"
            bg="rgba(56, 189, 248, 0.1)"
            color="#38bdf8"
            fontSize="xs"
          >
            <HStack gap={1}>
              <FiMic size={11} />
              <Text as="span">{speechModel.split(' ')[0]}</Text>
            </HStack>
          </Badge>

          <Badge
            px={2}
            py={0.5}
            borderRadius="md"
            bg="rgba(192, 132, 252, 0.1)"
            color="#c084fc"
            fontSize="xs"
          >
            <HStack gap={1}>
              <FiEye size={11} />
              <Text as="span">{visionModel.split(' ')[0]}</Text>
            </HStack>
          </Badge>

          {device && (
            <Badge
              px={2.5}
              py={0.5}
              borderRadius="full"
              bg={device === 'webgpu' ? 'rgba(234, 179, 8, 0.1)' : 'rgba(99, 102, 241, 0.1)'}
              color={device === 'webgpu' ? '#fbbf24' : '#818cf8'}
              fontSize="xs"
              fontWeight="600"
            >
              {device === 'webgpu' ? 'WebGPU' : 'WASM'}
            </Badge>
          )}

          {stepProgress && (
            <Badge px={2.5} py={0.5} borderRadius="md" bg="rgba(192, 132, 252, 0.15)" color="#c084fc" fontSize="xs">
              <HStack gap={1}>
                <FiLayers size={11} />
                <Text as="span">
                  {stepProgress.current}/{stepProgress.total}
                </Text>
              </HStack>
            </Badge>
          )}

          {executionTimeMs !== null && !isProcessing && (
            <Badge px={2.5} py={0.5} borderRadius="md" bg="rgba(148, 163, 184, 0.1)" color="#cbd5e1" fontSize="xs">
              <HStack gap={1}>
                <FiClock size={11} />
                <Text as="span">{executionTimeMs} ms</Text>
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
                <FiRefreshCw size={11} />
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

      {/* Processing Step Progress Bar */}
      {isProcessing && stepProgress && (
        <Box mt={3}>
          <Flex justify="space-between" fontSize="xs" color="#94a3b8" mb={1}>
            <Text as="span">{stepMessage}</Text>
            <Text fontWeight="600" color="#c084fc">
              {Math.round((stepProgress.current / stepProgress.total) * 100)}%
            </Text>
          </Flex>
          <Box w="100%" h="5px" bg="rgba(148, 163, 184, 0.15)" borderRadius="full" overflow="hidden">
            <Box
              h="100%"
              w={`${Math.max(Math.round((stepProgress.current / stepProgress.total) * 100), 5)}%`}
              bg="linear-gradient(90deg, #c084fc, #38bdf8)"
              borderRadius="full"
              transition="width 0.2s ease"
            />
          </Box>
        </Box>
      )}
    </Box>
  )
}
