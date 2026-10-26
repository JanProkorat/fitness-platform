export type ColorScheme = 'light' | 'dark';

/** SVG gradient stops take colour and opacity separately, so glows are not plain `Colors` entries. */
export type GlowColor = { color: string; opacity: number };
export type LaunchGlows = { top: GlowColor; bottom: GlowColor; corner: GlowColor };

export type Colors = {
  ground: string;
  surface: string;
  field: string;
  fieldBorder: string;
  ink: string;
  ink2: string;
  muted: string;
  line: string;
  lineStrong: string;

  primary: string;
  onPrimary: string;

  accent: string;
  accentSoft: string;
  onAccent: string;

  trainingInk: string;
  training: string;
  trainingSoft: string;
  onTraining: string;

  nutritionInk: string;
  nutrition: string;
  nutritionSoft: string;
  onNutrition: string;

  infoInk: string;
  infoSoft: string;

  warning: string;
  warningSoft: string;
  success: string;
  successSoft: string;
  error: string;
  errorSoft: string;

  segmentSelected: string;
  tabSelected: string;
  avatar: string;
  qrTile: string;
  qrInk: string;
  onAvatar: string;

  glassFill: string;
  glassBorder: string;

  wordmarkInk: string;
  wordmarkAccent: string;
  wordmarkMarkTop: string;
  wordmarkMarkBottom: string;

  launchMarkDeep: string;
  launchRing: string;
  launchUp: string;

  macroProtein: string;
  macroCarbs: string;
  macroFat: string;
  macroFiber: string;
};

const macros = {
  macroProtein: '#3563C9',
  macroCarbs: '#7A4FD0',
  macroFat: '#B53C7E',
  macroFiber: '#2E9CB0',
};

const shared = {
  accent: '#D2342A',
  onAccent: '#FFFFFF',
  training: '#F28C38',
  nutrition: '#8CC152',
  onTraining: '#141414',
  onNutrition: '#141414',
  avatar: '#141414',
  onAvatar: '#F6F4F0',
  // A QR code must be dark on white to scan, so its tile is the same in both schemes.
  qrTile: '#FFFFFF',
  qrInk: '#141414',
  wordmarkAccent: '#C8382F',
  launchRing: '#F4A08A',
};

export const lightColors: Colors = {
  ...shared,
  ...macros,
  ground: '#FFFFFF',
  surface: '#FFFFFF',
  field: '#F6F5F2',
  fieldBorder: 'rgba(20,20,20,0.08)',
  ink: '#141414',
  ink2: '#3A3835',
  muted: '#6B6863',
  line: 'rgba(20,20,20,0.06)',
  lineStrong: 'rgba(20,20,20,0.08)',
  primary: '#141414',
  onPrimary: '#FFFFFF',
  accentSoft: '#FBE7E5',
  trainingInk: '#B4500C',
  trainingSoft: '#FFF0E2',
  nutritionInk: '#3F7D2A',
  nutritionSoft: '#EEF6E3',
  infoInk: '#3563C9',
  infoSoft: '#E8EEFB',
  warning: '#B4500C',
  warningSoft: '#FFE8D2',
  success: '#3F7D2A',
  successSoft: '#EEF6E3',
  error: '#9F1F17',
  errorSoft: '#FBE3DF',
  segmentSelected: '#FFFFFF',
  tabSelected: 'rgba(20,20,20,0.05)',
  glassFill: 'rgba(255,255,255,0.58)',
  glassBorder: 'rgba(255,255,255,0.85)',
  wordmarkInk: '#141414',
  wordmarkMarkTop: '#8E1F18',
  wordmarkMarkBottom: '#D2342A',
  launchMarkDeep: '#8E1F18',
  launchUp: '#C8382F',
};

export const darkColors: Colors = {
  ...shared,
  ...macros,
  ground: '#0B0B0C',
  surface: '#1C1C1E',
  field: '#1C1C1E',
  fieldBorder: 'rgba(255,255,255,0.08)',
  ink: '#F5F5F7',
  ink2: '#D1D1D6',
  muted: '#98989F',
  line: 'rgba(255,255,255,0.05)',
  lineStrong: 'rgba(255,255,255,0.08)',
  primary: '#F5F5F7',
  onPrimary: '#0B0B0C',
  accentSoft: '#3A1A17',
  trainingInk: '#F7A863',
  trainingSoft: '#3A2414',
  nutritionInk: '#A9D673',
  nutritionSoft: '#243319',
  infoInk: '#8EAAEB',
  infoSoft: '#1B2640',
  warning: '#F7A863',
  warningSoft: '#3A2414',
  success: '#A9D673',
  successSoft: '#243319',
  error: '#F2705F',
  errorSoft: '#3A1A17',
  segmentSelected: '#3A3A3E',
  tabSelected: 'rgba(255,255,255,0.06)',
  glassFill: 'rgba(44,44,48,0.52)',
  glassBorder: 'rgba(255,255,255,0.14)',
  wordmarkInk: '#F4F2EE',
  wordmarkMarkTop: '#E5483D',
  wordmarkMarkBottom: '#B8322A',
  launchMarkDeep: '#7A1A14',
  launchUp: '#E5483D',
};

export const launchGlowColors: Record<ColorScheme, LaunchGlows> = {
  light: {
    top: { color: '#FFE7D3', opacity: 1 },
    bottom: { color: '#E4F2D3', opacity: 1 },
    corner: { color: '#FDE4E1', opacity: 1 },
  },
  dark: {
    top: { color: '#F28C38', opacity: 0.16 },
    bottom: { color: '#8CC152', opacity: 0.12 },
    corner: { color: '#E5483D', opacity: 0.1 },
  },
};
