import { useState, type JSX } from 'react'
import { Grid } from '@chakra-ui/react'
import { MultimodalTimeline } from '../components/video/MultimodalTimeline'
import { VideoStatusBanner } from '../components/video/VideoStatusBanner'
import { VideoUploader } from '../components/video/VideoUploader'
import { useVideoIntelWorker } from '../hooks/useVideoIntelWorker'

export function VideoIntelPage(): JSX.Element {
  const [videoFile, setVideoFile] = useState<File | Blob | null>(null)
  const [videoUrl, setVideoUrl] = useState<string>('')
  const [videoFilename, setVideoFilename] = useState<string>('')
  const [isRedacted, setIsRedacted] = useState<boolean>(false)

  const {
    status,
    device,
    downloadProgress,
    stepMessage,
    stepProgress,
    speechModel,
    visionModel,
    modelProfile,
    setModelProfile,
    timelineEvents,
    executionTimeMs,
    error,
    isProcessing,
    processVideoFile,
    reinitialize,
    applyTranscriptRedaction,
  } = useVideoIntelWorker()

  const handleVideoSelected = (file: File | Blob, url: string, filename: string): void => {
    setVideoFile(file)
    setVideoUrl(url)
    setVideoFilename(filename)
  }

  const handleProcess = async (): Promise<void> => {
    if (videoFile) {
      await processVideoFile(videoFile)
    }
  }

  const handleRedactToggle = (): void => {
    if (!isRedacted) {
      // Simple client-side dialogue sanitizer regex for names, phones, locations
      applyTranscriptRedaction((text: string) => {
        let res = text
        // Names
        res = res.replace(/\b(David Miller|Seamus Rochford|Sarah Connor|Elena Rostova)\b/gi, '[REDACTED: PER]')
        // Irish/Intl Phones
        res = res.replace(/(?:(?:\+|00)\d{1,3}[\s.-]?)?(?:\(\d{2,4}\)[\s.-]?|0\d{1,4}[\s.-]|\b0\d{8,10}\b)\d{3}[\s.-]?\d{3,4}\b/gi, '[REDACTED: PHONE]')
        // Emails
        res = res.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/gi, '[REDACTED: EMAIL]')
        // Eircodes
        res = res.replace(/\b(?:[AC-FHKNPRTV-Yac-fhknprtv-y]\d{2}|D6W|d6w)\s?[0-9AC-FHKNPRTV-Yac-fhknprtv-y]{4}\b/gi, '[REDACTED: EIRCODE]')
        // Locations
        res = res.replace(/\b(Chicago|Cork|Knockane|Ovens|Dublin|Tokyo|Paris)\b/gi, '[REDACTED: LOC]')
        return res
      })
      setIsRedacted(true)
    } else {
      setIsRedacted(false)
    }
  }

  return (
    <>
      {/* Video Model Status Banner */}
      <VideoStatusBanner
        status={status}
        device={device}
        downloadProgress={downloadProgress}
        stepMessage={stepMessage}
        stepProgress={stepProgress}
        executionTimeMs={executionTimeMs}
        error={error}
        speechModel={speechModel}
        visionModel={visionModel}
        modelProfile={modelProfile}
        onModelProfileChange={setModelProfile}
        onRetry={() => reinitialize('auto')}
      />

      {/* Two-Column Responsive Layout */}
      <Grid
        templateColumns={{ base: '1fr', lg: '1fr 1fr' }}
        gap={6}
        alignItems="stretch"
        minH="540px"
      >
        {/* Left Column: Video Uploader & Player */}
        <VideoUploader
          onVideoSelected={handleVideoSelected}
          onProcess={handleProcess}
          isProcessing={isProcessing}
          isReady={status === 'ready' || status === 'complete'}
          hasVideo={videoFile !== null}
          currentFilename={videoFilename}
          videoUrl={videoUrl}
        />

        {/* Right Column: Multimodal Intelligence Timeline */}
        <MultimodalTimeline
          events={timelineEvents}
          isProcessing={isProcessing}
          onRedactToggle={handleRedactToggle}
          isRedacted={isRedacted}
          videoFilename={videoFilename}
        />
      </Grid>
    </>
  )
}
