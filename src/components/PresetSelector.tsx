import type { JSX } from 'react'
import { Box, Button, HStack, Text } from '@chakra-ui/react'
import { FiFileText } from 'react-icons/fi'
import type { FileMetadata } from '../types/ner'

interface PresetSelectorProps {
  onSelect: (sampleText: string, metadata?: FileMetadata) => void
  disabled?: boolean
}

interface SamplePreset {
  id: string
  label: string
  filename: string
  extension: string
  text: string
}

const SAMPLE_PRESETS: SamplePreset[] = [
  {
    id: 'mortgage',
    label: 'Mortgage Application (.txt)',
    filename: 'Seamus_Mortgage.txt',
    extension: 'txt',
    text: `Loan Application
Application Id: 120045671
Applicant Name: Seamus Rochford
Applicant Address: Knockane, Ovens, Cork, P31 NN53
Telephone Number: 087 2646379
Email Address: seamus@nuarca.com
Loan Type: Mortgage
Loan Amount: €450,000
Application Date: 19 April, 2020`,
  },
  {
    id: 'csv',
    label: 'Customer Records (.csv)',
    filename: 'clients_export.csv',
    extension: 'csv',
    text: `Id,Full_Name,Primary_Address,Contact_Phone,Email_Address
101,David Miller,"14 Main St, Chicago, IL",087 2646379,david.m@microsoft.com
102,Sarah Connor,"Acme Corp HQ, Dublin, D02 X285",086 9876543,sarah.connor@acme.com`,
  },
  {
    id: 'json',
    label: 'Employee Profile (.json)',
    filename: 'profile_payload.json',
    extension: 'json',
    text: `{
  "employeeId": "EMP-9421",
  "fullName": "Elena Rostova",
  "officeLocation": "Tokyo Innovation Center",
  "corporateEmail": "elena.rostova@sony.com",
  "directPhone": "+353 87 264 6379"
}`,
  },
  {
    id: 'medical',
    label: 'Medical Intake (.txt)',
    filename: 'patient_intake.txt',
    extension: 'txt',
    text: 'Patient Marcus Vance was evaluated at St. Jude Children Research Hospital in Memphis by Dr. Linda Gomez (tel: 085 1234567, email: dr.gomez@stjude.org) for insurance verification under Blue Cross Blue Shield.',
  },
]

export function PresetSelector({ onSelect, disabled = false }: PresetSelectorProps): JSX.Element {
  return (
    <Box mb={4}>
      <HStack gap={2} wrap="wrap" align="center">
        <Text fontSize="xs" fontWeight="600" color="#94a3b8" textTransform="uppercase" letterSpacing="0.05em">
          Sample Formats:
        </Text>
        {SAMPLE_PRESETS.map((preset) => (
          <Button
            key={preset.id}
            size="xs"
            variant="ghost"
            bg="rgba(148, 163, 184, 0.08)"
            color="#cbd5e1"
            _hover={{ bg: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}
            disabled={disabled}
            onClick={() =>
              onSelect(preset.text, {
                name: preset.filename,
                size: preset.text.length,
                type: preset.extension === 'json' ? 'application/json' : preset.extension === 'csv' ? 'text/csv' : 'text/plain',
                extension: preset.extension,
              })
            }
            borderRadius="md"
            px={2.5}
            py={1}
          >
            <HStack gap={1}>
              <FiFileText size={12} />
              <Text as="span">{preset.label}</Text>
            </HStack>
          </Button>
        ))}
      </HStack>
    </Box>
  )
}
