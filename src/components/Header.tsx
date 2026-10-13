import type { JSX } from 'react'
import { Badge, Box, Flex, Heading, HStack, Text } from '@chakra-ui/react'
import { FiCpu, FiLock, FiZap } from 'react-icons/fi'
import type { DeviceBackend, WorkerStatus } from '../types/ner'

interface HeaderProps {
  device: DeviceBackend | null
  status: WorkerStatus
  modelName: string
}

export function Header({ device, status, modelName }: HeaderProps): JSX.Element {
  const isWebGpu = device === 'webgpu'

  return (
    <Box as="header" mb={6} pb={4} borderBottom="1px solid" borderColor="whiteAlpha.100">
      <Flex
        direction={{ base: 'column', md: 'row' }}
        align={{ base: 'flex-start', md: 'center' }}
        justify="space-between"
        gap={4}
      >
        <Box>
          <HStack gap={3} align="center">
            <Box
              p={2}
              borderRadius="xl"
              bg="rgba(56, 189, 248, 0.1)"
              color="#38bdf8"
              border="1px solid"
              borderColor="rgba(56, 189, 248, 0.2)"
            >
              <FiLock size={22} />
            </Box>
            <Box>
              <Heading as="h1" size="xl" fontWeight="800" letterSpacing="-0.02em" color="#f8fafc">
                InBrowser PII Redactor
              </Heading>
              <Text fontSize="xs" color="#94a3b8" mt={0.5}>
                Zero-Server Network Isolation • Pure Client-Side NER via{' '}
                <Text as="span" color="#38bdf8" fontWeight="600">
                  {modelName}
                </Text>
              </Text>
            </Box>
          </HStack>
        </Box>

        <HStack gap={3} wrap="wrap">
          {/* Privacy badge */}
          <Badge
            px={3}
            py={1.5}
            borderRadius="full"
            bg="rgba(16, 185, 129, 0.1)"
            color="#34d399"
            border="1px solid"
            borderColor="rgba(16, 185, 129, 0.25)"
            fontSize="xs"
            fontWeight="600"
          >
            <HStack gap={1.5}>
              <Box w="6px" h="6px" borderRadius="full" bg="#10b981" />
              <Text as="span">Zero Data Egress</Text>
            </HStack>
          </Badge>

          {/* Hardware acceleration badge */}
          {status === 'ready' && (
            <Badge
              px={3}
              py={1.5}
              borderRadius="full"
              bg={isWebGpu ? 'rgba(234, 179, 8, 0.1)' : 'rgba(99, 102, 241, 0.1)'}
              color={isWebGpu ? '#fbbf24' : '#818cf8'}
              border="1px solid"
              borderColor={isWebGpu ? 'rgba(234, 179, 8, 0.3)' : 'rgba(99, 102, 241, 0.3)'}
              fontSize="xs"
              fontWeight="600"
            >
              <HStack gap={1.5}>
                {isWebGpu ? <FiZap size={13} /> : <FiCpu size={13} />}
                <Text as="span">Backend: {isWebGpu ? 'WebGPU Accelerated' : 'WASM Fallback'}</Text>
              </HStack>
            </Badge>
          )}
        </HStack>
      </Flex>
    </Box>
  )
}
