import { getPublicShareByPublicId } from '@/lib/public-share'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ImageResponse } from 'next/og'

export const alt = 'Branderize read-only shared snapshot'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const titleLimit = 96
const workspaceNameLimit = 56
const graphemeSegmenter = new Intl.Segmenter('en', { granularity: 'grapheme' })
const bundledGeistCodePointRanges = [
  [0x20, 0x7e],
  [0xa0, 0xac],
  [0xae, 0xff],
  [0x102, 0x102],
  [0x131, 0x131],
  [0x152, 0x153],
  [0x2bc, 0x2bc],
  [0x2c6, 0x2c6],
  [0x2da, 0x2da],
  [0x2dc, 0x2dc],
  [0x300, 0x301],
  [0x303, 0x304],
  [0x308, 0x309],
  [0x323, 0x323],
  [0x2013, 0x2014],
  [0x2018, 0x201a],
  [0x201c, 0x201e],
  [0x2022, 0x2022],
  [0x2026, 0x2026],
  [0x2032, 0x2033],
  [0x2039, 0x203a],
  [0x2044, 0x2044],
  [0x20ac, 0x20ac],
  [0x2122, 0x2122],
  [0x2191, 0x2191],
  [0x2193, 0x2193],
  [0x2212, 0x2212],
] as const

function getGraphemes(value: string) {
  return Array.from(graphemeSegmenter.segment(value), ({ segment }) => segment)
}

function isBundledGeistGrapheme(grapheme: string) {
  return Array.from(grapheme).every((character) => {
    const codePoint = character.codePointAt(0) ?? 0
    return bundledGeistCodePointRanges.some(([start, end]) => codePoint >= start && codePoint <= end)
  })
}

function normalizeShareText(value: string, limit: number, fallback: string) {
  const normalized = value.normalize('NFC').replace(/\s+/g, ' ').trim()
  const sanitized = getGraphemes(normalized)
    .map((grapheme) => isBundledGeistGrapheme(grapheme) ? grapheme : '?')
    .join('')
    .replace(/\?{2,}/g, '?')

  if (!sanitized.replaceAll('?', '').trim()) return fallback

  const graphemes = getGraphemes(sanitized)
  if (graphemes.length <= limit) return sanitized

  const clipped = graphemes.slice(0, limit - 1).join('')
  const lastWordBoundary = clipped.lastIndexOf(' ')
  const readableClip = lastWordBoundary >= Math.floor(limit * 0.72)
    ? clipped.slice(0, lastWordBoundary)
    : clipped

  return `${readableClip.trimEnd()}…`
}

function getTitleFontSize(title: string) {
  const length = getGraphemes(title).length
  if (length <= 34) return 68
  if (length <= 58) return 57
  if (length <= 78) return 49
  return 43
}

interface PublicShareOpenGraphImageProps {
  params: Promise<{ publicId: string }>
}

export default async function PublicShareOpenGraphImage({ params }: PublicShareOpenGraphImageProps) {
  const { publicId } = await params
  const share = await getPublicShareByPublicId(publicId)
  if (!share) return new Response(null, { status: 404 })

  const [logo, geistRegular, geistBold] = await Promise.all([
    readFile(join(process.cwd(), 'app/apple-icon.png'), 'base64'),
    readFile(join(process.cwd(), 'assets/Geist-Regular.ttf')),
    readFile(join(process.cwd(), 'assets/Geist-Bold.ttf')),
  ])
  const title = normalizeShareText(share.snapshot.title, titleLimit, 'Shared marketing work')
  const workspaceName = normalizeShareText(
    share.snapshot.workspaceName,
    workspaceNameLimit,
    'Branderize workspace',
  )
  const resourceLabel = share.snapshot.type === 'artifact' ? 'Artifact' : 'Conversation'
  const capturedLabel = new Intl.DateTimeFormat('en', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
    year: 'numeric',
  }).format(share.createdAt)
  const detail = share.snapshot.type === 'conversation'
    ? `${share.snapshot.messages.length} ${share.snapshot.messages.length === 1 ? 'message' : 'messages'} · Captured ${capturedLabel}`
    : `Captured ${capturedLabel}`
  const previewRows = share.snapshot.type === 'conversation'
    ? [
        { align: 'flex-start', color: '#f3562e', width: 176 },
        { align: 'flex-end', color: '#d7dbe0', width: 216 },
        { align: 'flex-start', color: '#d7dbe0', width: 196 },
        { align: 'flex-end', color: '#f3562e', width: 152 },
      ] as const
    : [
        { align: 'flex-start', color: '#f3562e', width: 210 },
        { align: 'flex-start', color: '#d7dbe0', width: 246 },
        { align: 'flex-start', color: '#d7dbe0', width: 226 },
        { align: 'flex-start', color: '#d7dbe0', width: 168 },
      ] as const

  return new ImageResponse(
    (
      <div
        style={{
          background: '#f1f4f7',
          color: '#080e15',
          display: 'flex',
          flexDirection: 'column',
          fontFamily: 'Geist',
          height: '100%',
          overflow: 'hidden',
          padding: 54,
          position: 'relative',
          width: '100%',
        }}
      >
        <div
          style={{
            background: '#f3562e',
            borderRadius: 999,
            display: 'flex',
            height: 360,
            opacity: 0.08,
            position: 'absolute',
            right: -138,
            top: -210,
            width: 360,
          }}
        />

        <div
          style={{
            alignItems: 'center',
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ alignItems: 'center', display: 'flex', gap: 14 }}>
            <img alt="" height={50} src={`data:image/png;base64,${logo}`} width={50} />
            <div style={{ display: 'flex', fontSize: 31, fontWeight: 700, letterSpacing: '-0.045em' }}>
              branderize
            </div>
          </div>
          <div
            style={{
              alignItems: 'center',
              border: '1.5px solid #d7dbe0',
              borderRadius: 999,
              color: '#595e64',
              display: 'flex',
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: '0.1em',
              padding: '10px 16px',
              textTransform: 'uppercase',
            }}
          >
            Read-only snapshot
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            flex: 1,
            gap: 48,
            minHeight: 0,
            paddingTop: 46,
          }}
        >
          <div
            style={{
              display: 'flex',
              flex: 1,
              flexDirection: 'column',
              justifyContent: 'space-between',
              minWidth: 0,
              paddingBottom: 4,
              paddingTop: 12,
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div
                style={{
                  color: '#c64221',
                  display: 'flex',
                  fontSize: 15,
                  fontWeight: 700,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                }}
              >
                {resourceLabel} · Shared by {workspaceName}
              </div>
              <div
                style={{
                  display: 'flex',
                  fontSize: getTitleFontSize(title),
                  fontWeight: 700,
                  letterSpacing: '-0.055em',
                  lineHeight: 0.98,
                  maxWidth: 700,
                  overflow: 'hidden',
                  wordBreak: 'break-word',
                }}
              >
                {title}
              </div>
            </div>

            <div style={{ color: '#595e64', display: 'flex', fontSize: 17 }}>
              {detail}
            </div>
          </div>

          <div
            style={{
              background: '#fbfdfe',
              border: '2px solid #d7dbe0',
              borderRadius: 30,
              boxShadow: '0 28px 70px rgba(8, 14, 21, 0.12)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              padding: 26,
              width: 320,
            }}
          >
            <div
              style={{
                color: '#595e64',
                display: 'flex',
                fontSize: 12,
                fontWeight: 700,
                justifyContent: 'space-between',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
              }}
            >
              <span>Shared work</span>
              <span>{resourceLabel}</span>
            </div>

            <div
              style={{
                background: '#eef1f4',
                border: '1.5px solid #d7dbe0',
                borderRadius: 22,
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
                minHeight: 238,
                padding: '28px 24px',
              }}
            >
              {previewRows.map((row, index) => (
                <div
                  key={`${row.width}-${index}`}
                  style={{
                    alignSelf: row.align,
                    background: row.color,
                    borderRadius: 999,
                    display: 'flex',
                    height: index === 0 ? 16 : 12,
                    opacity: row.color === '#f3562e' ? 0.86 : 1,
                    width: row.width,
                  }}
                />
              ))}
            </div>

            <div
              style={{
                alignItems: 'center',
                color: '#595e64',
                display: 'flex',
                fontSize: 13,
                justifyContent: 'space-between',
              }}
            >
              <span>branderize</span>
              <span>View only</span>
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: 'Geist', data: geistRegular, style: 'normal', weight: 400 },
        { name: 'Geist', data: geistBold, style: 'normal', weight: 700 },
      ],
      headers: {
        'Cache-Control': 'public, max-age=0, must-revalidate',
      },
    },
  )
}
