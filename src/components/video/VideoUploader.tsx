import { useRef, useState, type DragEvent, type ChangeEvent, type JSX } from 'react'
import { Box, Button, Flex, HStack, Text } from '@chakra-ui/react'
import { FiPlay, FiUploadCloud, FiVideo, FiZap } from 'react-icons/fi'
import { generateSyntheticDemoVideo } from '../../utils/mediaExtractor'

interface VideoUploaderProps {
  onVideoSelected: (file: File | Blob, videoUrl: string, filename: string) => void
  onProcess: () => void
  isProcessing: boolean
  isReady: boolean
  hasVideo: boolean
  currentFilename?: string
  videoUrl?: string
}

export function VideoUploader({
  onVideoSelected,
  onProcess,
  isProcessing,
  isReady,
  hasVideo,
  currentFilename,
  videoUrl,
}: VideoUploaderProps): JSX.Element {
  const [isDragging, setIsDragging] = useState<boolean>(false)
  const [isGeneratingDemo, setIsGeneratingDemo] = useState<boolean>(false)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const handleDragOver = (e: DragEvent<HTMLDivElement>): void => {
    e.preventDefault()
    if (!isProcessing) setIsDragging(true)
  }

  const handleDragLeave = (): void => {
    setIsDragging(false)
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>): void => {
    e.preventDefault()
    setIsDragging(false)
    if (isProcessing) return

    const files = e.dataTransfer.files
    if (files && files.length > 0) {
      const file = files[0]
      const url = URL.createObjectURL(file)
      onVideoSelected(file, url, file.name)
    }
  }

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>): void => {
    const files = e.target.files
    if (files && files.length > 0) {
      const file = files[0]
      const url = URL.createObjectURL(file)
      onVideoSelected(file, url, file.name)
    }
    if (inputRef.current) inputRef.current.value = ''
  }

  const triggerBrowse = (): void => {
    if (!isProcessing && inputRef.current) {
      inputRef.current.click()
    }
  }

  const handleGenerateSample = async (): Promise<void> => {
    setIsGeneratingDemo(true)
    try {
      const { blob, url } = await generateSyntheticDemoVideo()
      onVideoSelected(blob, url, 'Synthetic_Corporate_Briefing.webm')
    } finally {
      setIsGeneratingDemo(false)
    }
  }

  return (
    <Box className="glass-panel" p={5} display="flex" flexDirection="column">
      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/webm,video/quicktime,video/*"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      <Flex justify="space-between" align="center" mb={3}>
        <HStack gap={2}>
          <Box w="8px" h="8px" borderRadius="full" bg="#c084fc" />
          <Text fontWeight="700" fontSize="md" color="#f8fafc">
            Video Input & Player
          </Text>
        </HStack>

        <Button
          size="xs"
          variant="ghost"
          onClick={handleGenerateSample}
          disabled={isProcessing || isGeneratingDemo}
          bg="rgba(192, 132, 252, 0.12)"
          color="#c084fc"
          _hover={{ bg: 'rgba(192, 132, 252, 0.22)' }}
          borderRadius="md"
          px={2.5}
          py={1}
        >
          <HStack gap={1}>
            <FiZap size={12} />
            <Text as="span">{isGeneratingDemo ? 'Generating...' : 'Load Sample Video Clip'}</Text>
          </HStack>
        </Button>
      </Flex>

      {/* Video Preview Player or Dropzone */}
      {videoUrl ? (
        <Box mb={4} borderRadius="xl" overflow="hidden" bg="black" border="1px solid" borderColor="whiteAlpha.100">
          <video
            src={videoUrl}
            controls
            playsInline
            style={{ width: '100%', maxHeight: '280px', objectFit: 'contain' }}
          />
          <Flex justify="space-between" align="center" p={2.5} bg="rgba(15, 23, 42, 0.8)">
            <HStack gap={2}>
              <FiVideo size={14} color="#38bdf8" />
              <Text fontSize="xs" color="#e2e8f0" fontWeight="600">
                {currentFilename || 'Uploaded Video'}
              </Text>
            </HStack>
            <Button
              size="xs"
              variant="ghost"
              onClick={triggerBrowse}
              disabled={isProcessing}
              color="#94a3b8"
              _hover={{ color: '#38bdf8' }}
            >
              Change Video
            </Button>
          </Flex>
        </Box>
      ) : (
        <Box
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={triggerBrowse}
          cursor="pointer"
          p={8}
          mb={4}
          border="1px dashed"
          borderColor={isDragging ? '#c084fc' : 'rgba(148, 163, 184, 0.25)'}
          borderRadius="xl"
          bg={isDragging ? 'rgba(192, 132, 252, 0.08)' : 'rgba(15, 23, 42, 0.4)'}
          textAlign="center"
          transition="all 0.2s ease"
        >
          <Flex direction="column" align="center" justify="center" gap={2}>
            <Box p={3} borderRadius="full" bg="rgba(192, 132, 252, 0.1)" color="#c084fc">
              <FiUploadCloud size={24} />
            </Box>
            <Text fontWeight="600" fontSize="sm" color="#f8fafc">
              Drag & drop a video file here, or click to browse
            </Text>
            <Text fontSize="xs" color="#94a3b8">
              Supports MP4, WebM, MOV (Processed entirely in-browser without server upload)
            </Text>
          </Flex>
        </Box>
      )}

      {/* Action Footer */}
      <Flex justify="flex-end" pt={2} borderTop="1px solid" borderColor="whiteAlpha.100">
        <Button
          size="sm"
          onClick={onProcess}
          disabled={!hasVideo || isProcessing || !isReady}
          bg="linear-gradient(135deg, #9333ea 0%, #4f46e5 100%)"
          color="white"
          fontWeight="600"
          borderRadius="lg"
          px={5}
          boxShadow="0 4px 14px rgba(147, 51, 234, 0.35)"
          _hover={{
            bg: 'linear-gradient(135deg, #7e22ce 0%, #4338ca 100%)',
            boxShadow: '0 6px 20px rgba(147, 51, 234, 0.45)',
          }}
        >
          <HStack gap={2}>
            <FiPlay size={14} />
            <Text as="span">
              {isProcessing ? 'Processing in Worker...' : 'Transcribe & Describe Scenes'}
            </Text>
          </HStack>
        </Button>
      </Flex>
    </Box>
  )
}
