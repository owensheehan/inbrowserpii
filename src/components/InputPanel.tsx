import type { JSX } from 'react'
import {
  Box,
  Button,
  Flex,
  HStack,
  Text,
  Textarea,
} from '@chakra-ui/react'
import { FiPlay, FiTrash2 } from 'react-icons/fi'
import type { FileMetadata, WorkerStatus } from '../types/ner'
import { FileDropzone } from './FileDropzone'

interface InputPanelProps {
  text: string
  onChange: (value: string) => void
  onRedact: () => void
  onClear: () => void
  currentFile: FileMetadata | null
  onFileLoaded: (content: string, metadata: FileMetadata) => void
  onClearFile: () => void
  status: WorkerStatus
  isProcessing: boolean
  tagFormat: 'standard' | 'typed'
  onTagFormatChange: (format: 'standard' | 'typed') => void
}

export function InputPanel({
  text,
  onChange,
  onRedact,
  onClear,
  currentFile,
  onFileLoaded,
  onClearFile,
  status,
  isProcessing,
  tagFormat,
  onTagFormatChange,
}: InputPanelProps): JSX.Element {
  const isModelReady = status === 'ready'
  const charCount = text.length
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0

  return (
    <Box className="glass-panel" p={5} display="flex" flexDirection="column" h="100%">
      {/* Panel Top Bar */}
      <Flex justify="space-between" align="center" mb={2}>
        <HStack gap={2}>
          <Box w="8px" h="8px" borderRadius="full" bg="#38bdf8" />
          <Text fontWeight="700" fontSize="md" color="#f8fafc">
            Raw User Input / File
          </Text>
        </HStack>

        <HStack gap={3} fontSize="xs" color="#94a3b8">
          <Text>{wordCount} words</Text>
          <Text>•</Text>
          <Text>{charCount} chars</Text>
        </HStack>
      </Flex>

      {/* File Dropzone */}
      <FileDropzone
        currentFile={currentFile}
        onFileLoaded={onFileLoaded}
        onClearFile={onClearFile}
        disabled={isProcessing}
      />

      {/* Large Textarea */}
      <Box flex="1" position="relative" mb={4}>
        <Textarea
          value={text}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Paste or type text containing sensitive PII, or upload a document (.txt, .md, .csv, .json)... e.g. 'John Smith traveled from San Francisco to Apple headquarters in Cupertino.'"
          minH="300px"
          h="100%"
          bg="rgba(15, 23, 42, 0.5)"
          border="1px solid"
          borderColor="rgba(148, 163, 184, 0.2)"
          borderRadius="xl"
          color="#f8fafc"
          p={4}
          fontSize="sm"
          lineHeight="1.7"
          resize="none"
          _placeholder={{ color: '#64748b' }}
          _focus={{
            borderColor: '#38bdf8',
            boxShadow: '0 0 0 1px #38bdf8',
            outline: 'none',
          }}
        />
      </Box>

      {/* Options and Actions */}
      <Flex
        direction={{ base: 'column', sm: 'row' }}
        justify="space-between"
        align={{ base: 'stretch', sm: 'center' }}
        gap={3}
        pt={3}
        borderTop="1px solid"
        borderColor="whiteAlpha.100"
      >
        {/* Redaction Tag Style toggle */}
        <HStack gap={2}>
          <Text fontSize="xs" color="#94a3b8">
            Tag Format:
          </Text>
          <HStack gap={1} bg="rgba(15, 23, 42, 0.8)" p={1} borderRadius="lg" border="1px solid" borderColor="whiteAlpha.100">
            <Button
              size="xs"
              variant="ghost"
              onClick={() => onTagFormatChange('standard')}
              bg={tagFormat === 'standard' ? 'rgba(56, 189, 248, 0.2)' : 'transparent'}
              color={tagFormat === 'standard' ? '#38bdf8' : '#94a3b8'}
              fontWeight={tagFormat === 'standard' ? '600' : '400'}
              borderRadius="md"
              px={2}
            >
              [REDACTED]
            </Button>
            <Button
              size="xs"
              variant="ghost"
              onClick={() => onTagFormatChange('typed')}
              bg={tagFormat === 'typed' ? 'rgba(56, 189, 248, 0.2)' : 'transparent'}
              color={tagFormat === 'typed' ? '#38bdf8' : '#94a3b8'}
              fontWeight={tagFormat === 'typed' ? '600' : '400'}
              borderRadius="md"
              px={2}
            >
              [REDACTED: TYPE]
            </Button>
          </HStack>
        </HStack>

        {/* Buttons */}
        <HStack gap={2}>
          <Button
            size="sm"
            variant="ghost"
            onClick={onClear}
            disabled={!text || isProcessing}
            color="#94a3b8"
            _hover={{ color: '#f87171', bg: 'rgba(239, 68, 68, 0.1)' }}
            borderRadius="lg"
          >
            <HStack gap={1.5}>
              <FiTrash2 size={14} />
              <Text as="span">Clear</Text>
            </HStack>
          </Button>

          <Button
            size="sm"
            onClick={onRedact}
            disabled={!isModelReady || isProcessing || !text.trim()}
            bg="linear-gradient(135deg, #0284c7 0%, #2563eb 100%)"
            color="white"
            fontWeight="600"
            borderRadius="lg"
            px={4}
            boxShadow="0 4px 14px rgba(37, 99, 235, 0.35)"
            _hover={{
              bg: 'linear-gradient(135deg, #0369a1 0%, #1d4ed8 100%)',
              boxShadow: '0 6px 20px rgba(37, 99, 235, 0.45)',
            }}
            _active={{ transform: 'scale(0.98)' }}
          >
            <HStack gap={2}>
              <FiPlay size={14} />
              <Text as="span">
                {isProcessing ? 'Processing in Worker...' : 'Redact PII'}
              </Text>
            </HStack>
          </Button>
        </HStack>
      </Flex>
    </Box>
  )
}
