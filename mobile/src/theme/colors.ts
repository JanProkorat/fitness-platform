export type ColorScheme = 'light' | 'dark';

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

  success: string;
  successSoft: string;
  error: string;
  errorSoft: string;
  onError: string;

  segmentSelected: string;
  avatar: string;
  onAvatar: string;

  glassFill: string;
  glassBorder: string;

  macroProtein: string;
  macroCarbs: string;
  macroFat: string;
  macroFiber: string;
};

export type Shadows = {
  training: string;
  nutrition: string;
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
};

export const lightColors: Colors = {
  ...shared,
  ...macros,
  ground: '#FFFFFF',
  surface: '#FFFFFF',
  field: '#F6F5F2',
  fieldBorder: 'transparent',
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
  success: '#3F7D2A',
  successSoft: '#EEF6E3',
  error: '#9F1F17',
  errorSoft: '#FBE3DF',
  onError: '#FFFFFF',
  segmentSelected: '#FFFFFF',
  glassFill: 'rgba(255,255,255,0.58)',
  glassBorder: 'rgba(255,255,255,0.85)',
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
  success: '#A9D673',
  successSoft: '#243319',
  error: '#F2705F',
  errorSoft: '#3A1A17',
  onError: '#141414',
  segmentSelected: '#3A3A3E',
  glassFill: 'rgba(44,44,48,0.52)',
  glassBorder: 'rgba(255,255,255,0.14)',
};

export const shadowColors: Shadows = {
  training: 'rgba(242,140,56,0.3)',
  nutrition: 'rgba(140,193,82,0.3)',
};
