import { useState, type JSX } from 'react'
import {
  Badge,
  Box,
  Button,
  Flex,
  HStack,
  Image,
  Text,
} from '@chakra-ui/react'
import { FiCheck, FiDownload, FiFileText, FiFilm, FiLock, FiMic, FiShield } from 'react-icons/fi'
import type { MultimodalTimelineEvent } from '../../types/video'

interface MultimodalTimelineProps {
  events: MultimodalTimelineEvent[]
  isProcessing: boolean
  onRedactToggle: () => void
  isRedacted: boolean
  videoFilename?: string
}

export function MultimodalTimeline({
  events,
  isProcessing,
  onRedactToggle,
  isRedacted,
  videoFilename,
}: MultimodalTimelineProps): JSX.Element {
  const [downloaded, setDownloaded] = useState<boolean>(false)

  const handleExportJson = (): void => {
    if (events.length === 0) return
    const payload = {
      sourceVideo: videoFilename || 'video',
      analyzedAt: new Date().toISOString(),
      timeline: events.map((e) => ({
        timecode: e.timecode,
        seconds: e.timestampSeconds,
        sceneDescription: e.sceneCaption,
        spokenDialogue: isRedacted && e.sanitizedDialogue ? e.sanitizedDialogue : e.dialogueTranscript,
      })),
    }

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json;charset=utf-8',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${videoFilename?.replace(/\.[^/.]+$/, '') || 'video'}_intelligence.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    setDownloaded(true)
    setTimeout(() => setDownloaded(false), 2000)
  }

  const handleExportVtt = (): void => {
    if (events.length === 0) return
    let vtt = 'WEBVTT\n\n'

    events.forEach((e, idx) => {
      const dialogue = isRedacted && e.sanitizedDialogue ? e.sanitizedDialogue : e.dialogueTranscript
      const startMins = Math.floor(e.timestampSeconds / 60)
      const startSecs = Math.floor(e.timestampSeconds % 60)
      const endMins = Math.floor((e.timestampSeconds + 3) / 60)
      const endSecs = Math.floor((e.timestampSeconds + 3) % 60)

      const pad = (n: number): string => (n < 10 ? `0${n}` : `${n}`)
      vtt += `${idx + 1}\n00:${pad(startMins)}:${pad(startSecs)}.000 --> 00:${pad(endMins)}:${pad(endSecs)}.000\n[Scene: ${e.sceneCaption}]\n${dialogue}\n\n`
    })

    const blob = new Blob([vtt], { type: 'text/vtt;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${videoFilename?.replace(/\.[^/.]+$/, '') || 'video'}_subtitles.vtt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    setDownloaded(true)
    setTimeout(() => setDownloaded(false), 2000)
  }

  return (
    <Box className="glass-panel" p={5} display="flex" flexDirection="column" h="100%">
      {/* Top Header */}
      <Flex justify="space-between" align="center" mb={4} wrap="wrap" gap={2}>
        <HStack gap={2}>
          <Box w="8px" h="8px" borderRadius="full" bg="#38bdf8" />
          <Text fontWeight="700" fontSize="md" color="#f8fafc">
            Multimodal Intelligence Timeline
          </Text>
          {events.length > 0 && (
            <Badge size="sm" borderRadius="full" px={2} py={0.5} bg="rgba(56, 189, 248, 0.15)" color="#38bdf8" fontSize="xs">
              {events.length} Events
            </Badge>
          )}
        </HStack>

        {events.length > 0 && (
          <HStack gap={2} wrap="wrap">
            {/* PII Redact Toggle */}
            <Button
              size="xs"
              variant="ghost"
              onClick={onRedactToggle}
              bg={isRedacted ? 'rgba(16, 185, 129, 0.2)' : 'rgba(148, 163, 184, 0.1)'}
              color={isRedacted ? '#34d399' : '#cbd5e1'}
              borderRadius="md"
              px={2.5}
              py={1}
            >
              <HStack gap={1.5}>
                <FiLock size={12} />
                <Text as="span">{isRedacted ? 'Transcript Redacted' : 'Redact Spoken PII'}</Text>
              </HStack>
            </Button>

            <Button
              size="xs"
              variant="ghost"
              onClick={handleExportVtt}
              color="#cbd5e1"
              bg="rgba(148, 163, 184, 0.1)"
              _hover={{ bg: 'rgba(148, 163, 184, 0.2)' }}
              borderRadius="md"
              px={2.5}
              py={1}
            >
              <HStack gap={1.5}>
                <FiFileText size={12} />
                <Text as="span">Export .VTT</Text>
              </HStack>
            </Button>

            <Button
              size="xs"
              onClick={handleExportJson}
              bg="linear-gradient(135deg, #0284c7 0%, #2563eb 100%)"
              color="white"
              borderRadius="md"
              px={3}
              py={1}
              fontWeight="600"
            >
              <HStack gap={1.5}>
                {downloaded ? <FiCheck size={12} /> : <FiDownload size={12} />}
                <Text as="span">{downloaded ? 'Saved!' : 'Export JSON'}</Text>
              </HStack>
            </Button>
          </HStack>
        )}
      </Flex>

      {/* Events List */}
      <Box flex="1" overflowY="auto" maxH="580px" pr={1}>
        {events.length > 0 ? (
          <Flex direction="column" gap={3}>
            {events.map((evt) => {
              const activeDialogue =
                isRedacted && evt.sanitizedDialogue ? evt.sanitizedDialogue : evt.dialogueTranscript

              return (
                <Box
                  key={evt.id}
                  p={3.5}
                  borderRadius="xl"
                  bg="rgba(15, 23, 42, 0.55)"
                  border="1px solid"
                  borderColor="rgba(148, 163, 184, 0.15)"
                  transition="border-color 0.2s ease"
                  _hover={{ borderColor: 'rgba(56, 189, 248, 0.3)' }}
                >
                  <Flex gap={3} align="flex-start">
                    {/* Keyframe Snapshot */}
                    {evt.keyframeThumbnail && (
                      <Box
                        w="100px"
                        h="65px"
                        borderRadius="lg"
                        overflow="hidden"
                        flexShrink={0}
                        bg="black"
                        border="1px solid"
                        borderColor="whiteAlpha.100"
                      >
                        <Image
                          src={evt.keyframeThumbnail}
                          alt="Keyframe"
                          w="100%"
                          h="100%"
                          objectFit="cover"
                        />
                      </Box>
                    )}

                    {/* Details */}
                    <Box flex="1">
                      <Flex justify="space-between" align="center" mb={1.5}>
                        <Badge
                          size="xs"
                          borderRadius="md"
                          px={2}
                          py={0.5}
                          bg="rgba(56, 189, 248, 0.12)"
                          color="#38bdf8"
                          fontSize="2xs"
                          fontFamily="monospace"
                          fontWeight="700"
                        >
                          ⏱️ {evt.timecode}
                        </Badge>
                      </Flex>

                      {/* Visual Scene Description */}
                      <HStack gap={1.5} align="flex-start" mb={1.5}>
                        <Box color="#c084fc" mt={0.5}>
                          <FiFilm size={13} />
                        </Box>
                        <Text fontSize="xs" color="#e2e8f0" fontWeight="600">
                          <Text as="span" color="#c084fc">
                            Scene:
                          </Text>{' '}
                          {evt.sceneCaption}
                        </Text>
                      </HStack>

                      {/* Audio Transcript */}
                      <HStack gap={1.5} align="flex-start">
                        <Box color="#34d399" mt={0.5}>
                          <FiMic size={13} />
                        </Box>
                        <Text fontSize="xs" color="#cbd5e1" fontStyle="italic">
                          <Text as="span" color="#34d399" fontStyle="normal" fontWeight="600">
                            Dialogue:
                          </Text>{' '}
                          "{activeDialogue}"
                        </Text>
                      </HStack>
                    </Box>
                  </Flex>
                </Box>
              )
            })}
          </Flex>
        ) : (
          <Flex
            direction="column"
            align="center"
            justify="center"
            h="100%"
            minH="300px"
            color="#64748b"
            textAlign="center"
          >
            <Box p={3} borderRadius="full" bg="rgba(148, 163, 184, 0.05)" color="#64748b" mb={3}>
              <FiShield size={28} />
            </Box>
            <Text fontWeight="600" fontSize="sm" color="#94a3b8">
              {isProcessing ? 'Analyzing Video Streams...' : 'Awaiting Video Execution'}
            </Text>
            <Text fontSize="xs" maxW="320px" mt={1}>
              {isProcessing
                ? 'Extracting speech audio with Whisper and captioning sampled keyframes with ViT-GPT2.'
                : 'Upload or generate a video clip on the left to extract speech transcription and visual scene captions.'}
            </Text>
          </Flex>
        )}
      </Box>
    </Box>
  )
}
