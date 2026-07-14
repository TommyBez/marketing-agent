import { pixelBasedPreset, type TailwindConfig } from 'react-email'

export const emailTailwindConfig = {
  presets: [pixelBasedPreset],
  theme: {
    extend: {
      colors: {
        brand: {
          accent: '#ee6635',
          border: '#d9dce2',
          ink: '#23262d',
          muted: '#69707c',
          paper: '#f3f4f7',
          surface: '#ffffff',
        },
      },
    },
  },
} satisfies TailwindConfig
