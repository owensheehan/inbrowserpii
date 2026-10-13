import { useState, type JSX } from 'react'
import { Box, Container, Text } from '@chakra-ui/react'
import { Header } from './components/Header'
import { Navigation, type ActivePage } from './components/Navigation'
import { DocumentRedactorPage } from './pages/DocumentRedactorPage'
import { VideoIntelPage } from './pages/VideoIntelPage'

export function App(): JSX.Element {
  const [activePage, setActivePage] = useState<ActivePage>('document')

  return (
    <Box
      minH="100vh"
      position="relative"
      bg="#080c14"
      color="#f8fafc"
      py={{ base: 6, md: 8 }}
      px={{ base: 4, md: 8 }}
      overflowX="hidden"
    >
      {/* Background radial gradient mesh */}
      <Box
        position="absolute"
        top="-150px"
        left="50%"
        transform="translateX(-50%)"
        w="1000px"
        h="450px"
        bg="radial-gradient(circle, rgba(56, 189, 248, 0.08) 0%, rgba(192, 132, 252, 0.05) 40%, transparent 70%)"
        pointerEvents="none"
        zIndex={0}
      />

      <Container maxW="7xl" position="relative" zIndex={1}>
        {/* Top App Header */}
        <Header
          device="webgpu"
          status="ready"
          modelName={
            activePage === 'document'
              ? 'Xenova/bert-base-NER'
              : 'Whisper-Tiny + ViT-GPT2'
          }
        />

        {/* Page Switcher Navigation */}
        <Navigation activePage={activePage} onNavigate={setActivePage} />

        {/* Active Page View */}
        {activePage === 'document' ? <DocumentRedactorPage /> : <VideoIntelPage />}

        {/* Footer Privacy Guarantee */}
        <Box mt={10} pt={6} borderTop="1px solid" borderColor="whiteAlpha.100" textAlign="center">
          <Text fontSize="xs" color="#64748b">
            Enterprise Client-Side Intelligence • Built with React, TypeScript, Chakra UI & Transformers.js • Text, files, and video streams never leave your device.
          </Text>
        </Box>
      </Container>
    </Box>
  )
}

export default App
