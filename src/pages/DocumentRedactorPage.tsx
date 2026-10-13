import { useState, type JSX } from 'react'
import { Grid } from '@chakra-ui/react'
import { InputPanel } from '../components/InputPanel'
import { ModelStatusBar } from '../components/ModelStatusBar'
import { OutputPanel } from '../components/OutputPanel'
import { PresetSelector } from '../components/PresetSelector'
import { useNerWorker } from '../hooks/useNerWorker'
import type { FileMetadata } from '../types/ner'

export function DocumentRedactorPage(): JSX.Element {
  const [inputText, setInputText] = useState<string>(
    `Loan Application
Application Id: 120045671
Applicant Name: Seamus Rochford
Applicant Address: Knockane, Ovens, Cork, P31 NN53
Telephone Number: 087 2646379
Email Address: seamus@nuarca.com
Loan Type: Mortgage
Loan Amount: €450,000
Application Date: 19 April, 2020`,
  )
  const [currentFile, setCurrentFile] = useState<FileMetadata | null>({
    name: 'Seamus_Mortgage.txt',
    size: 265,
    type: 'text/plain',
    extension: 'txt',
  })
  const [tagFormat, setTagFormat] = useState<'standard' | 'typed'>('standard')

  const {
    status,
    downloadProgress,
    chunkProgress,
    isProcessing,
    redactedOutput,
    detectedEntities,
    executionTimeMs,
    error,
    redactText,
    reinitialize,
  } = useNerWorker()

  const handleRedact = (): void => {
    redactText(inputText, tagFormat)
  }

  const handleClear = (): void => {
    setInputText('')
    setCurrentFile(null)
  }

  const handleFileLoaded = (content: string, metadata: FileMetadata): void => {
    setInputText(content)
    setCurrentFile(metadata)
    if (status === 'ready') {
      redactText(content, tagFormat)
    }
  }

  const handleClearFile = (): void => {
    setCurrentFile(null)
  }

  const handlePresetSelect = (presetText: string, metadata?: FileMetadata): void => {
    setInputText(presetText)
    setCurrentFile(metadata || null)
    if (status === 'ready') {
      redactText(presetText, tagFormat)
    }
  }

  const handleTagFormatChange = (newFormat: 'standard' | 'typed'): void => {
    setTagFormat(newFormat)
    if (inputText.trim() && status === 'ready') {
      redactText(inputText, newFormat)
    }
  }

  return (
    <>
      {/* Model Lifecycle & Progress */}
      <ModelStatusBar
        status={status}
        downloadProgress={downloadProgress}
        chunkProgress={chunkProgress}
        isProcessing={isProcessing}
        executionTimeMs={executionTimeMs}
        entityCount={detectedEntities.length}
        error={error}
        onRetry={() => reinitialize('auto')}
      />

      {/* Preset Sample Picker */}
      <PresetSelector
        onSelect={handlePresetSelect}
        disabled={status !== 'ready' || isProcessing}
      />

      {/* Two-Column Responsive Layout */}
      <Grid
        templateColumns={{ base: '1fr', lg: '1fr 1fr' }}
        gap={6}
        alignItems="stretch"
        minH="540px"
      >
        <InputPanel
          text={inputText}
          onChange={setInputText}
          onRedact={handleRedact}
          onClear={handleClear}
          currentFile={currentFile}
          onFileLoaded={handleFileLoaded}
          onClearFile={handleClearFile}
          status={status}
          isProcessing={isProcessing}
          tagFormat={tagFormat}
          onTagFormatChange={handleTagFormatChange}
        />

        <OutputPanel
          sanitizedText={redactedOutput}
          entities={detectedEntities}
          isProcessing={isProcessing}
          currentFile={currentFile}
        />
      </Grid>
    </>
  )
}
