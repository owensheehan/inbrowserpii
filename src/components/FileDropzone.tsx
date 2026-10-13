import { useRef, useState, type DragEvent, type ChangeEvent, type JSX } from 'react'
import { Badge, Box, Button, Flex, HStack, Text } from '@chakra-ui/react'
import { FiFile, FiUploadCloud, FiX } from 'react-icons/fi'
import type { FileMetadata } from '../types/ner'

interface FileDropzoneProps {
  currentFile: FileMetadata | null
  onFileLoaded: (content: string, metadata: FileMetadata) => void
  onClearFile: () => void
  disabled?: boolean
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export function extractFileExtension(filename: string): string {
  if (!filename.includes('.')) return 'txt'
  const parts = filename.split('.')
  return parts[parts.length - 1].toLowerCase() || 'txt'
}

export function getMimeTypeForExtension(ext: string): string {
  switch (ext.toLowerCase()) {
    case 'json':
      return 'application/json;charset=utf-8'
    case 'csv':
      return 'text/csv;charset=utf-8'
    case 'md':
    case 'markdown':
      return 'text/markdown;charset=utf-8'
    case 'xml':
      return 'application/xml;charset=utf-8'
    case 'html':
    case 'htm':
      return 'text/html;charset=utf-8'
    case 'log':
    case 'txt':
    default:
      return 'text/plain;charset=utf-8'
  }
}

export function FileDropzone({
  currentFile,
  onFileLoaded,
  onClearFile,
  disabled = false,
}: FileDropzoneProps): JSX.Element {
  const [isDragging, setIsDragging] = useState<boolean>(false)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const processFile = async (file: File): Promise<void> => {
    try {
      const text = await file.text()
      const ext = extractFileExtension(file.name)
      onFileLoaded(text, {
        name: file.name,
        size: file.size,
        type: file.type || getMimeTypeForExtension(ext),
        extension: ext,
      })
    } catch {
      // Handled gracefully
    }
  }

  const handleDragOver = (e: DragEvent<HTMLDivElement>): void => {
    e.preventDefault()
    if (!disabled) setIsDragging(true)
  }

  const handleDragLeave = (): void => {
    setIsDragging(false)
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>): void => {
    e.preventDefault()
    setIsDragging(false)
    if (disabled) return

    const droppedFiles = e.dataTransfer.files
    if (droppedFiles && droppedFiles.length > 0) {
      void processFile(droppedFiles[0])
    }
  }

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>): void => {
    const files = e.target.files
    if (files && files.length > 0) {
      void processFile(files[0])
    }
    if (inputRef.current) {
      inputRef.current.value = ''
    }
  }

  const triggerFileInput = (): void => {
    if (!disabled && inputRef.current) {
      inputRef.current.click()
    }
  }

  return (
    <Box mb={3}>
      <input
        ref={inputRef}
        type="file"
        accept=".txt,.md,.json,.csv,.log,.xml,.html,text/*"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {currentFile ? (
        <Flex
          align="center"
          justify="space-between"
          p={2.5}
          bg="rgba(56, 189, 248, 0.08)"
          border="1px solid"
          borderColor="rgba(56, 189, 248, 0.25)"
          borderRadius="lg"
        >
          <HStack gap={2}>
            <Box color="#38bdf8">
              <FiFile size={16} />
            </Box>
            <Box>
              <HStack gap={2}>
                <Text fontSize="xs" fontWeight="600" color="#f8fafc">
                  {currentFile.name}
                </Text>
                <Badge size="xs" bg="rgba(148, 163, 184, 0.15)" color="#cbd5e1" fontSize="2xs">
                  {formatFileSize(currentFile.size)}
                </Badge>
                <Badge size="xs" bg="rgba(56, 189, 248, 0.15)" color="#38bdf8" fontSize="2xs" fontWeight="700">
                  .{currentFile.extension.toUpperCase()}
                </Badge>
              </HStack>
              <Text fontSize="2xs" color="#94a3b8">
                Preserves original .{currentFile.extension} format on download
              </Text>
            </Box>
          </HStack>

          <Button
            size="xs"
            variant="ghost"
            onClick={onClearFile}
            color="#94a3b8"
            _hover={{ color: '#f87171', bg: 'rgba(239, 68, 68, 0.1)' }}
            borderRadius="md"
            p={1}
          >
            <FiX size={14} />
          </Button>
        </Flex>
      ) : (
        <Box
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={triggerFileInput}
          cursor={disabled ? 'not-allowed' : 'pointer'}
          p={3}
          border="1px dashed"
          borderColor={isDragging ? '#38bdf8' : 'rgba(148, 163, 184, 0.2)'}
          borderRadius="lg"
          bg={isDragging ? 'rgba(56, 189, 248, 0.06)' : 'rgba(15, 23, 42, 0.4)'}
          transition="all 0.2s ease"
          _hover={{
            borderColor: disabled ? 'rgba(148, 163, 184, 0.2)' : '#38bdf8',
            bg: disabled ? 'rgba(15, 23, 42, 0.4)' : 'rgba(56, 189, 248, 0.04)',
          }}
          textAlign="center"
        >
          <Flex align="center" justify="center" gap={2}>
            <Box color={isDragging ? '#38bdf8' : '#94a3b8'}>
              <FiUploadCloud size={16} />
            </Box>
            <Text fontSize="xs" color="#cbd5e1">
              <Text as="span" fontWeight="600" color="#38bdf8">
                Click to browse
              </Text>{' '}
              or drop files here (.txt, .csv, .json, .md, .log)
            </Text>
          </Flex>
        </Box>
      )}
    </Box>
  )
}
