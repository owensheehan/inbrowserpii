import { useEffect, useState, type JSX } from 'react'
import {
  Badge,
  Box,
  Button,
  Flex,
  HStack,
  Text,
} from '@chakra-ui/react'
import { FiCheck, FiCopy, FiDownload, FiEye, FiFileText, FiShield } from 'react-icons/fi'
import type { DetectedEntity, EntityType, FileMetadata } from '../types/ner'
import { getMimeTypeForExtension } from './FileDropzone'

interface OutputPanelProps {
  sanitizedText: string
  entities: DetectedEntity[]
  isProcessing: boolean
  currentFile: FileMetadata | null
}

function getEntityStyle(type: EntityType): { text: string; bg: string; border: string } {
  switch (type) {
    case 'PER':
      return { text: '#c084fc', bg: 'rgba(168, 85, 247, 0.18)', border: 'rgba(168, 85, 247, 0.4)' }
    case 'LOC':
      return { text: '#34d399', bg: 'rgba(16, 185, 129, 0.18)', border: 'rgba(16, 185, 129, 0.4)' }
    case 'ORG':
      return { text: '#fbbf24', bg: 'rgba(245, 158, 11, 0.18)', border: 'rgba(245, 158, 11, 0.4)' }
    case 'EMAIL':
      return { text: '#38bdf8', bg: 'rgba(56, 189, 248, 0.18)', border: 'rgba(56, 189, 248, 0.4)' }
    case 'PHONE':
      return { text: '#fb7185', bg: 'rgba(244, 63, 94, 0.18)', border: 'rgba(244, 63, 94, 0.4)' }
    case 'EIRCODE':
      return { text: '#818cf8', bg: 'rgba(99, 102, 241, 0.18)', border: 'rgba(99, 102, 241, 0.4)' }
    case 'PPSN':
      return { text: '#e879f9', bg: 'rgba(217, 70, 239, 0.18)', border: 'rgba(217, 70, 239, 0.4)' }
    case 'IBAN':
      return { text: '#2dd4bf', bg: 'rgba(20, 184, 166, 0.18)', border: 'rgba(20, 184, 166, 0.4)' }
  }
}

function detectContentFormat(content: string): string {
  const trimmed = content.trim()
  if (
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']'))
  ) {
    try {
      JSON.parse(trimmed)
      return 'json'
    } catch {
      // not valid JSON
    }
  }

  const lines = trimmed.split(/\r?\n/)
  if (lines.length > 1 && lines[0].includes(',')) {
    const commaCount = (lines[0].match(/,/g) || []).length
    if (commaCount >= 1 && lines.slice(1, 4).every((l) => (l.match(/,/g) || []).length === commaCount)) {
      return 'csv'
    }
  }

  if (trimmed.startsWith('# ') || trimmed.includes('\n## ') || trimmed.includes('**')) {
    return 'md'
  }

  return 'txt'
}

export function OutputPanel({
  sanitizedText,
  entities,
  isProcessing,
  currentFile,
}: OutputPanelProps): JSX.Element {
  const [copied, setCopied] = useState<boolean>(false)
  const [downloaded, setDownloaded] = useState<boolean>(false)
  const [viewMode, setViewMode] = useState<'plain' | 'highlight'>('plain')
  const [selectedFormat, setSelectedFormat] = useState<string>('txt')

  // Automatically sync download format to match the uploaded file format exactly
  useEffect(() => {
    if (currentFile?.extension) {
      setSelectedFormat(currentFile.extension.toLowerCase())
    } else if (sanitizedText) {
      setSelectedFormat(detectContentFormat(sanitizedText))
    }
  }, [currentFile, sanitizedText])

  const handleCopy = async (): Promise<void> => {
    if (!sanitizedText) return
    try {
      await navigator.clipboard.writeText(sanitizedText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback
    }
  }

  const handleDownload = (): void => {
    if (!sanitizedText) return

    const targetExt = selectedFormat || (currentFile?.extension ? currentFile.extension : 'txt')
    let baseFilename = 'redacted_document'

    if (currentFile?.name) {
      baseFilename = currentFile.name.replace(/\.[^/.]+$/, '')
    }

    const downloadFilename = `${baseFilename}_redacted.${targetExt}`
    const mimeType = getMimeTypeForExtension(targetExt)

    const blob = new Blob([sanitizedText], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = downloadFilename
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    URL.revokeObjectURL(url)

    setDownloaded(true)
    setTimeout(() => setDownloaded(false), 2000)
  }

  const entityCounts = entities.reduce<Record<string, number>>((acc, curr) => {
    acc[curr.entityGroup] = (acc[curr.entityGroup] || 0) + 1
    return acc
  }, {})

  const renderHighlightedContent = (): JSX.Element => {
    if (!sanitizedText) {
      return <Text color="#64748b">No output</Text>
    }

    const parts = sanitizedText.split(
      /(\[REDACTED(?::\s*(?:PER|LOC|ORG|EMAIL|PHONE|EIRCODE|PPSN|IBAN))?\])/g,
    )

    return (
      <Box lineHeight="1.8" fontSize="sm" color="#e2e8f0" whiteSpace="pre-wrap">
        {parts.map((part, index) => {
          if (part.startsWith('[REDACTED')) {
            let style = {
              text: '#f87171',
              bg: 'rgba(239, 68, 68, 0.15)',
              border: 'rgba(239, 68, 68, 0.35)',
            }

            for (const key of ['PER', 'LOC', 'ORG', 'EMAIL', 'PHONE', 'EIRCODE', 'PPSN', 'IBAN'] as EntityType[]) {
              if (part.includes(key)) {
                style = getEntityStyle(key)
                break
              }
            }

            return (
              <Badge
                key={index}
                mx={1}
                px={2}
                py={0.5}
                borderRadius="md"
                bg={style.bg}
                color={style.text}
                border="1px solid"
                borderColor={style.border}
                fontSize="xs"
                fontFamily="JetBrains Mono, monospace"
                fontWeight="700"
                letterSpacing="0.02em"
              >
                {part}
              </Badge>
            )
          }
          return <span key={index}>{part}</span>
        })}
      </Box>
    )
  }

  const activeExtension = selectedFormat.toUpperCase()
  const isFormatMatchedToInput =
    currentFile !== null && selectedFormat.toLowerCase() === currentFile.extension.toLowerCase()

  return (
    <Box className="glass-panel" p={5} display="flex" flexDirection="column" h="100%">
      {/* Top Bar */}
      <Flex justify="space-between" align="center" mb={3} wrap="wrap" gap={2}>
        <HStack gap={2}>
          <Box w="8px" h="8px" borderRadius="full" bg="#10b981" />
          <Text fontWeight="700" fontSize="md" color="#f8fafc">
            Sanitized Output
          </Text>
          {entities.length > 0 && (
            <Badge
              size="sm"
              borderRadius="full"
              px={2}
              py={0.5}
              bg="rgba(16, 185, 129, 0.15)"
              color="#34d399"
              fontSize="xs"
            >
              {entities.length} Redacted
            </Badge>
          )}

          {/* Active Format Badge */}
          {sanitizedText && (
            <Badge
              size="sm"
              borderRadius="md"
              px={2}
              py={0.5}
              bg={isFormatMatchedToInput ? 'rgba(56, 189, 248, 0.15)' : 'rgba(148, 163, 184, 0.12)'}
              color={isFormatMatchedToInput ? '#38bdf8' : '#cbd5e1'}
              border="1px solid"
              borderColor={isFormatMatchedToInput ? 'rgba(56, 189, 248, 0.3)' : 'transparent'}
              fontSize="2xs"
              fontWeight="700"
            >
              <HStack gap={1}>
                <FiFileText size={10} />
                <Text as="span">Format: .{activeExtension}</Text>
              </HStack>
            </Badge>
          )}
        </HStack>

        <HStack gap={2} wrap="wrap">
          {sanitizedText && (
            <HStack gap={1} bg="rgba(15, 23, 42, 0.8)" p={1} borderRadius="lg" border="1px solid" borderColor="whiteAlpha.100">
              <Button
                size="xs"
                variant="ghost"
                onClick={() => setViewMode('plain')}
                bg={viewMode === 'plain' ? 'rgba(56, 189, 248, 0.2)' : 'transparent'}
                color={viewMode === 'plain' ? '#38bdf8' : '#94a3b8'}
                fontWeight={viewMode === 'plain' ? '600' : '400'}
                borderRadius="md"
                px={2}
              >
                Plain Text
              </Button>
              <Button
                size="xs"
                variant="ghost"
                onClick={() => setViewMode('highlight')}
                bg={viewMode === 'highlight' ? 'rgba(56, 189, 248, 0.2)' : 'transparent'}
                color={viewMode === 'highlight' ? '#38bdf8' : '#94a3b8'}
                fontWeight={viewMode === 'highlight' ? '600' : '400'}
                borderRadius="md"
                px={2}
              >
                <HStack gap={1}>
                  <FiEye size={11} />
                  <Text as="span">Highlights</Text>
                </HStack>
              </Button>
            </HStack>
          )}

          <Button
            size="xs"
            onClick={handleCopy}
            disabled={!sanitizedText || isProcessing}
            bg={copied ? 'rgba(16, 185, 129, 0.25)' : 'rgba(148, 163, 184, 0.12)'}
            color={copied ? '#34d399' : '#cbd5e1'}
            _hover={{ bg: 'rgba(148, 163, 184, 0.22)' }}
            borderRadius="md"
            px={2.5}
            py={1}
          >
            <HStack gap={1.5}>
              {copied ? <FiCheck size={12} /> : <FiCopy size={12} />}
              <Text as="span">{copied ? 'Copied!' : 'Copy'}</Text>
            </HStack>
          </Button>

          <Button
            size="xs"
            onClick={handleDownload}
            disabled={!sanitizedText || isProcessing}
            bg={downloaded ? 'rgba(16, 185, 129, 0.25)' : 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)'}
            color="white"
            _hover={{ bg: 'linear-gradient(135deg, #0369a1 0%, #1d4ed8 100%)' }}
            borderRadius="md"
            px={3}
            py={1}
            fontWeight="600"
            boxShadow="0 2px 8px rgba(37, 99, 235, 0.3)"
          >
            <HStack gap={1.5}>
              {downloaded ? <FiCheck size={12} /> : <FiDownload size={12} />}
              <Text as="span">
                {downloaded ? 'Saved!' : `Download .${activeExtension}`}
              </Text>
            </HStack>
          </Button>
        </HStack>
      </Flex>

      {/* Output Content Area */}
      <Box
        flex="1"
        minH="300px"
        bg="rgba(15, 23, 42, 0.5)"
        border="1px solid"
        borderColor="rgba(148, 163, 184, 0.15)"
        borderRadius="xl"
        p={4}
        overflowY="auto"
        userSelect="text"
      >
        {sanitizedText ? (
          viewMode === 'plain' ? (
            <Text
              fontSize="sm"
              lineHeight="1.7"
              color="#f8fafc"
              whiteSpace="pre-wrap"
              fontFamily="JetBrains Mono, monospace"
            >
              {sanitizedText}
            </Text>
          ) : (
            renderHighlightedContent()
          )
        ) : (
          <Flex direction="column" align="center" justify="center" h="100%" minH="260px" color="#64748b" textAlign="center">
            <Box p={3} borderRadius="full" bg="rgba(148, 163, 184, 0.05)" color="#64748b" mb={3}>
              <FiShield size={28} />
            </Box>
            <Text fontWeight="600" fontSize="sm" color="#94a3b8">
              Awaiting Input
            </Text>
            <Text fontSize="xs" maxW="280px" mt={1}>
              Your sanitized, PII-stripped text or file will appear here immediately after inference in the Web Worker.
            </Text>
          </Flex>
        )}
      </Box>

      {/* Format Selector & Entity Breakdown */}
      {sanitizedText && (
        <Flex
          justify="space-between"
          align="center"
          pt={2.5}
          mt={2.5}
          borderTop="1px solid"
          borderColor="whiteAlpha.100"
          wrap="wrap"
          gap={2}
        >
          <HStack gap={2} fontSize="xs">
            <Text color="#94a3b8">Output Format:</Text>
            <HStack gap={1}>
              {['txt', 'csv', 'json', 'md'].map((fmt) => (
                <Button
                  key={fmt}
                  size="2xs"
                  variant="ghost"
                  onClick={() => setSelectedFormat(fmt)}
                  bg={selectedFormat === fmt ? 'rgba(56, 189, 248, 0.2)' : 'rgba(15, 23, 42, 0.6)'}
                  color={selectedFormat === fmt ? '#38bdf8' : '#94a3b8'}
                  fontWeight={selectedFormat === fmt ? '700' : '400'}
                  borderRadius="sm"
                  px={1.5}
                  py={0.5}
                >
                  .{fmt.toUpperCase()}
                  {currentFile?.extension === fmt && ' (source)'}
                </Button>
              ))}
            </HStack>
          </HStack>

          {currentFile && (
            <Text fontSize="2xs" color="#64748b">
              Source: {currentFile.name}
            </Text>
          )}
        </Flex>
      )}

      {/* Entity Breakdown Stats */}
      {entities.length > 0 && (
        <Box pt={2.5} mt={2} borderTop="1px solid" borderColor="whiteAlpha.100">
          <Flex justify="space-between" align="center" mb={2} wrap="wrap" gap={2}>
            <Text fontSize="xs" fontWeight="600" color="#94a3b8" textTransform="uppercase" letterSpacing="0.05em">
              Detected Entities:
            </Text>
            <HStack gap={1.5} fontSize="xs" wrap="wrap">
              {Object.entries(entityCounts).map(([typeKey, count]) => {
                const style = getEntityStyle(typeKey as EntityType)
                return (
                  <Badge
                    key={typeKey}
                    bg={style.bg}
                    color={style.text}
                    border="1px solid"
                    borderColor={style.border}
                    px={2}
                    py={0.5}
                    borderRadius="md"
                    fontSize="2xs"
                    fontWeight="700"
                  >
                    {count} {typeKey}
                  </Badge>
                )
              })}
            </HStack>
          </Flex>

          <HStack gap={1.5} wrap="wrap" maxH="90px" overflowY="auto">
            {entities.map((item, idx) => {
              const style = getEntityStyle(item.entityGroup)
              return (
                <Badge
                  key={idx}
                  size="xs"
                  px={2}
                  py={0.5}
                  borderRadius="md"
                  bg="rgba(15, 23, 42, 0.8)"
                  color="#e2e8f0"
                  border="1px solid"
                  borderColor={style.border}
                  fontSize="2xs"
                >
                  <Text as="span" color={style.text} fontWeight="700">
                    {item.entityGroup}:
                  </Text>{' '}
                  {item.word} ({Math.round(item.score * 100)}%)
                </Badge>
              )
            })}
          </HStack>
        </Box>
      )}
    </Box>
  )
}
