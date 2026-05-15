import type { ExtractedClaim, TranscriptLine, Verdict } from '@/lib/types'

export const DEMO_TRANSCRIPT: TranscriptLine[] = [
  {
    id: '1',
    speaker: 'A',
    text:
      'The United States unemployment rate is currently at a historic low of 2.1 percent.',
    timestamp: '0:14',
    startMs: 14000,
    endMs: 18000,
  },
  {
    id: '2',
    speaker: 'B',
    text:
      'Inflation has dropped to well under one percent this year, according to Federal Reserve data.',
    timestamp: '0:31',
    startMs: 31000,
    endMs: 36000,
  },
  {
    id: '3',
    speaker: 'A',
    text: 'Regardless, Apple remains the most valuable company in the world right now.',
    timestamp: '0:48',
    startMs: 48000,
    endMs: 52000,
  },
  {
    id: '4',
    speaker: 'B',
    text:
      'Climate scientists confirm temperatures have risen by 3 degrees Celsius since pre-industrial times.',
    timestamp: '1:05',
    startMs: 65000,
    endMs: 71000,
  },
  {
    id: '5',
    speaker: 'A',
    text:
      'Coffee consumption has been linked to a lower risk of Parkinson’s disease in multiple studies.',
    timestamp: '1:22',
    startMs: 82000,
    endMs: 88000,
  },
]

export const DEMO_CLAIMS: ExtractedClaim[] = [
  {
    id: 'c1',
    speaker: 'A',
    timestamp: '0:14',
    originalText: DEMO_TRANSCRIPT[0].text,
    claimText: 'US unemployment rate is 2.1%',
    searchQuery: 'US unemployment rate 2024',
    isCheckworthy: true,
  },
  {
    id: 'c2',
    speaker: 'B',
    timestamp: '0:31',
    originalText: DEMO_TRANSCRIPT[1].text,
    claimText: 'Inflation dropped to under 1% this year',
    searchQuery: 'US CPI inflation rate 2024',
    isCheckworthy: true,
  },
  {
    id: 'c3',
    speaker: 'A',
    timestamp: '0:48',
    originalText: DEMO_TRANSCRIPT[2].text,
    claimText: 'Apple is the most valuable company in the world',
    searchQuery: 'largest company market cap 2024',
    isCheckworthy: true,
  },
  {
    id: 'c4',
    speaker: 'B',
    timestamp: '1:05',
    originalText: DEMO_TRANSCRIPT[3].text,
    claimText: 'Global temps risen 3°C since pre-industrial era',
    searchQuery: 'global temperature rise since pre-industrial IPCC',
    isCheckworthy: true,
  },
  {
    id: 'c5',
    speaker: 'A',
    timestamp: '1:22',
    originalText: DEMO_TRANSCRIPT[4].text,
    claimText: 'Coffee consumption reduces Parkinson’s disease risk',
    searchQuery: 'coffee Parkinson disease risk meta-analysis',
    isCheckworthy: true,
  },
]

export const DEMO_VERDICTS: Verdict[] = [
  {
    id: 'v1',
    claimId: 'c1',
    speaker: 'A',
    timestamp: '0:14',
    claimText: 'US unemployment rate is 2.1%',
    label: 'FALSE',
    confidencePct: 91,
    explanation:
      'Bureau of Labor Statistics data shows the unemployment rate at approximately 3.9%, not 2.1% as claimed. The claim significantly understates the actual figure.',
    evidence: [
      {
        source: 'Bureau of Labor Statistics',
        url: 'https://bls.gov',
        excerpt: 'Current unemployment rate 3.9%',
        stance: 'CONTRADICTS',
        credibilityScore: 98,
      },
    ],
    searchQueries: ['US unemployment rate 2024'],
    iterationsUsed: 1,
    approvalRequired: false,
    approved: null,
  },
  {
    id: 'v2',
    claimId: 'c2',
    speaker: 'B',
    timestamp: '0:31',
    claimText: 'Inflation dropped to under 1% this year',
    label: 'FALSE',
    confidencePct: 87,
    explanation:
      'Federal Reserve and CPI data show inflation at approximately 3.2%, significantly above the 1% threshold claimed.',
    evidence: [
      {
        source: 'Federal Reserve',
        url: 'https://federalreserve.gov',
        excerpt: 'CPI inflation 3.2% year-over-year',
        stance: 'CONTRADICTS',
        credibilityScore: 99,
      },
    ],
    searchQueries: ['US CPI inflation rate 2024'],
    iterationsUsed: 1,
    approvalRequired: false,
    approved: null,
  },
  {
    id: 'v3',
    claimId: 'c3',
    speaker: 'A',
    timestamp: '0:48',
    claimText: 'Apple is the most valuable company in the world',
    label: 'VERIFIED',
    confidencePct: 94,
    explanation:
      'Apple consistently holds the highest market capitalisation globally, a status confirmed by multiple financial data sources.',
    evidence: [
      {
        source: 'Bloomberg Markets',
        url: 'https://bloomberg.com',
        excerpt: 'Apple market cap $3.5T, highest globally',
        stance: 'SUPPORTS',
        credibilityScore: 95,
      },
    ],
    searchQueries: ['largest company market cap 2024'],
    iterationsUsed: 1,
    approvalRequired: false,
    approved: null,
  },
  {
    id: 'v4',
    claimId: 'c4',
    speaker: 'B',
    timestamp: '1:05',
    claimText: 'Global temps risen 3°C since pre-industrial era',
    label: 'MISLEADING',
    confidencePct: 82,
    explanation:
      'IPCC data shows global temperatures have risen approximately 1.2°C since pre-industrial times. The 3°C figure represents a projected future scenario under high-emission pathways, not current measurements.',
    evidence: [
      {
        source: 'IPCC Report 2023',
        url: 'https://ipcc.ch',
        excerpt: '1.1-1.2°C warming observed since pre-industrial era',
        stance: 'CONTRADICTS',
        credibilityScore: 99,
      },
    ],
    searchQueries: ['global temperature rise since pre-industrial IPCC'],
    iterationsUsed: 2,
    approvalRequired: false,
    approved: null,
  },
  {
    id: 'v5',
    claimId: 'c5',
    speaker: 'A',
    timestamp: '1:22',
    claimText: 'Coffee consumption reduces Parkinson’s disease risk',
    label: 'MISLEADING',
    confidencePct: 58,
    explanation:
      'Observational studies do report an inverse association between coffee consumption and Parkinson’s disease risk, but a 2022 randomised review in JAMA Neurology cautions the effect is small, sex-dependent, and confounded by smoking and reverse causation. Evidence is genuinely mixed; human review is warranted before issuing a confident verdict.',
    evidence: [
      {
        source: 'NIH / NIA',
        url: 'https://nih.gov',
        excerpt:
          'Pooled cohort analysis shows a modest inverse association between habitual coffee consumption and incident Parkinson’s disease.',
        stance: 'SUPPORTS',
        credibilityScore: 92,
      },
      {
        source: 'JAMA Neurology',
        url: 'https://nytimes.com',
        excerpt:
          'A 2022 review notes the protective effect is sex-dependent and substantially attenuated after controlling for smoking and reverse causation, calling the causal claim into question.',
        stance: 'CONTRADICTS',
        credibilityScore: 85,
      },
    ],
    searchQueries: ['coffee Parkinson disease risk meta-analysis'],
    iterationsUsed: 2,
    approvalRequired: true,
    approved: null,
  },
]
