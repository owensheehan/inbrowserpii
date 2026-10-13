import type { JSX } from 'react'
import { Box, Button, HStack, Text } from '@chakra-ui/react'
import { FiFileText, FiFilm } from 'react-icons/fi'

export type ActivePage = 'document' | 'video'

interface NavigationProps {
  activePage: ActivePage
  onNavigate: (page: ActivePage) => void
}

export function Navigation({ activePage, onNavigate }: NavigationProps): JSX.Element {
  return (
    <Box mb={6}>
      <HStack
        gap={2}
        p={1.5}
        bg="rgba(15, 23, 42, 0.7)"
        border="1px solid"
        borderColor="whiteAlpha.100"
        borderRadius="xl"
        w="fit-content"
      >
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onNavigate('document')}
          bg={activePage === 'document' ? 'rgba(56, 189, 248, 0.2)' : 'transparent'}
          color={activePage === 'document' ? '#38bdf8' : '#94a3b8'}
          fontWeight={activePage === 'document' ? '700' : '500'}
          borderRadius="lg"
          px={4}
          py={2}
          _hover={{ color: '#f8fafc', bg: activePage === 'document' ? 'rgba(56, 189, 248, 0.25)' : 'whiteAlpha.50' }}
        >
          <HStack gap={2}>
            <FiFileText size={15} />
            <Text as="span">Document & File PII Redactor</Text>
          </HStack>
        </Button>

        <Button
          size="sm"
          variant="ghost"
          onClick={() => onNavigate('video')}
          bg={activePage === 'video' ? 'rgba(192, 132, 252, 0.2)' : 'transparent'}
          color={activePage === 'video' ? '#c084fc' : '#94a3b8'}
          fontWeight={activePage === 'video' ? '700' : '500'}
          borderRadius="lg"
          px={4}
          py={2}
          _hover={{ color: '#f8fafc', bg: activePage === 'video' ? 'rgba(192, 132, 252, 0.25)' : 'whiteAlpha.50' }}
        >
          <HStack gap={2}>
            <FiFilm size={15} />
            <Text as="span">Video Intelligence & Transcription</Text>
          </HStack>
        </Button>
      </HStack>
    </Box>
  )
}
