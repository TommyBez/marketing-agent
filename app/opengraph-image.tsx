import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ImageResponse } from 'next/og'

export const alt = 'branderize. Brief once. Move as one.'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const specialists = ['Strategy', 'SEO + Content', 'Copywriting', 'Conversion', 'Growth', 'Paid + Social']

export default async function OpenGraphImage() {
  const [logo, geistRegular, geistBold] = await Promise.all([
    readFile(join(process.cwd(), 'app/apple-icon.png'), 'base64'),
    readFile(join(process.cwd(), 'assets/Geist-Regular.ttf')),
    readFile(join(process.cwd(), 'assets/Geist-Bold.ttf')),
  ])

  return new ImageResponse(
    (
      <div
        style={{
          alignItems: 'stretch',
          background: '#f1f4f7',
          color: '#080e15',
          display: 'flex',
          gap: 48,
          height: '100%',
          overflow: 'hidden',
          padding: 56,
          position: 'relative',
          width: '100%',
        }}
      >
        <div
          style={{
            background: '#f3562e',
            borderRadius: 999,
            display: 'flex',
            height: 320,
            opacity: 0.08,
            position: 'absolute',
            right: -120,
            top: -170,
            width: 320,
          }}
        />

        <div
          style={{
            display: 'flex',
            flex: 1,
            flexDirection: 'column',
            justifyContent: 'space-between',
            minWidth: 0,
          }}
        >
          <div style={{ alignItems: 'center', display: 'flex', gap: 16 }}>
            <img
              alt=""
              height={56}
              src={`data:image/png;base64,${logo}`}
              width={56}
            />
            <div style={{ display: 'flex', fontSize: 34, fontWeight: 700, letterSpacing: '-0.045em' }}>
              branderize
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
            <div
              style={{
                color: '#f3562e',
                display: 'flex',
                fontSize: 16,
                fontWeight: 700,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
              }}
            >
              AI marketing workspace
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                fontSize: 74,
                fontWeight: 700,
                letterSpacing: '-0.065em',
                lineHeight: 0.91,
              }}
            >
              <div style={{ display: 'flex' }}>Brief once.</div>
              <div style={{ color: '#595e64', display: 'flex' }}>Move as one.</div>
            </div>
            <div style={{ color: '#595e64', display: 'flex', fontSize: 25, lineHeight: 1.35, maxWidth: 620 }}>
              One company brief. The right specialists. One coordinated answer.
            </div>
          </div>
        </div>

        <div
          style={{
            background: '#fbfdfe',
            border: '2px solid #d7dbe0',
            borderRadius: 32,
            boxShadow: '0 28px 70px rgba(8, 14, 21, 0.12)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: 28,
            width: 352,
          }}
        >
          <div
            style={{
              color: '#595e64',
              display: 'flex',
              fontSize: 13,
              fontWeight: 700,
              justifyContent: 'space-between',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}
          >
            <span>Shared system</span>
            <span>Six disciplines</span>
          </div>

          <div
            style={{
              background: '#f3562e',
              borderRadius: 24,
              color: '#120806',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              padding: '24px 22px',
            }}
          >
            <div style={{ display: 'flex', fontSize: 13, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase' }}>
              Source of truth
            </div>
            <div style={{ display: 'flex', fontSize: 31, fontWeight: 700, letterSpacing: '-0.045em' }}>
              Brand context
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {specialists.map((specialist, index) => (
              <div
                key={specialist}
                style={{
                  alignItems: 'center',
                  border: '1.5px solid #d7dbe0',
                  borderRadius: 14,
                  display: 'flex',
                  flex: '1 0 42%',
                  fontSize: 14,
                  fontWeight: 700,
                  gap: 9,
                  padding: '13px 12px',
                }}
              >
                <span style={{ color: '#a2a6ab', fontSize: 12 }}>{String(index + 1).padStart(2, '0')}</span>
                <span>{specialist}</span>
              </div>
            ))}
          </div>

          <div style={{ color: '#595e64', display: 'flex', fontSize: 14, lineHeight: 1.35 }}>
            One coordinated answer.
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
    },
  )
}
