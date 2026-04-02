const light = {
  // Backgrounds
  bg: '#f2f2f7',
  bg2: '#ffffff',
  bg3: '#f2f2f7',

  // Separators
  sep: 'rgba(60,60,67,0.18)',
  sep2: 'rgba(60,60,67,0.09)',

  // Labels
  label: '#000000',
  label2: 'rgba(60,60,67,0.6)',
  label3: 'rgba(60,60,67,0.3)',

  // Fills (interactive elements)
  fill: 'rgba(120,120,128,0.12)',
  fill2: 'rgba(120,120,128,0.08)',

  // System
  blue: '#007aff',
  green: '#34c759',
  red: '#ff3b30',
  orange: '#ff9500',
  purple: '#af52de',

  // Brand
  gold: '#c9a84c',
  goldBg: 'rgba(201,168,76,0.10)',
} as const

const dark = {
  bg: '#1c1c1e',
  bg2: '#2c2c2e',
  bg3: '#1c1c1e',

  sep: 'rgba(84,84,88,0.65)',
  sep2: 'rgba(84,84,88,0.40)',

  label: '#ffffff',
  label2: 'rgba(235,235,245,0.6)',
  label3: 'rgba(235,235,245,0.3)',

  fill: 'rgba(120,120,128,0.24)',
  fill2: 'rgba(120,120,128,0.16)',

  blue: '#0a84ff',
  green: '#30d158',
  red: '#ff453a',
  orange: '#ff9f0a',
  purple: '#bf5af2',

  gold: '#c9a84c',
  goldBg: 'rgba(201,168,76,0.15)',
} as const

export interface ColorScheme {
  readonly bg: string
  readonly bg2: string
  readonly bg3: string
  readonly sep: string
  readonly sep2: string
  readonly label: string
  readonly label2: string
  readonly label3: string
  readonly fill: string
  readonly fill2: string
  readonly blue: string
  readonly green: string
  readonly red: string
  readonly orange: string
  readonly purple: string
  readonly gold: string
  readonly goldBg: string
}

export const Colors = { light, dark } as const
