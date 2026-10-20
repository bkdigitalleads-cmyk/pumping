import { useColorScheme } from 'react-native';

export interface Theme {
  bg: string;
  card: string;
  cardAlt: string;
  text: string;
  textSecondary: string;
  textFaint: string;
  accent: string;
  accentSoft: string;
  /** Text and icons drawn on top of an accent fill. */
  onAccent: string;
  danger: string;
  dangerSoft: string;
  border: string;
  success: string;
  /** Ring track behind today's total. */
  ringTrack: string;
  /** Left and right side, in the steppers, the split bar and the PDF. */
  left: string;
  right: string;
  /** Freezer icons and frozen totals. */
  frost: string;
  isDark: boolean;
}

// Day: warm cream paper, deep warm ink, a soft clay accent.
// Night: true black, warm cream text kept a little dim, a low amber accent,
// so a 3am session in a dark room is not a flashlight in the face.
// Deliberately unlike the asphalt and amber of Odo or our other apps.
export const lightTheme: Theme = {
  bg: '#FAF3E8',
  card: '#FFFBF5',
  cardAlt: '#F3E7D7',
  text: '#33241D',
  textSecondary: '#6F5B4F',
  textFaint: '#9A8678',
  accent: '#A8503A',
  accentSoft: '#F8E7DD',
  onAccent: '#FFF8EE',
  danger: '#A23B2C',
  dangerSoft: '#F6DDD6',
  border: '#EADCC9',
  success: '#5F7E62',
  ringTrack: '#EFE1CF',
  left: '#A8503A',
  right: '#7A6A96',
  frost: '#5E7C8A',
  isDark: false,
};

export const darkTheme: Theme = {
  bg: '#000000',
  card: '#120E0A',
  cardAlt: '#1C1611',
  text: '#D9CCB4',
  textSecondary: '#A39580',
  textFaint: '#7A6D5E',
  accent: '#C08440',
  accentSoft: '#2A1D0E',
  onAccent: '#120C06',
  danger: '#D07F6E',
  dangerSoft: '#2A1410',
  border: '#2A221A',
  success: '#93AD86',
  ringTrack: '#1E1813',
  left: '#C08440',
  right: '#9285AD',
  frost: '#7E98A3',
  isDark: true,
};

/** Follows the system setting, so night mode comes on with iOS Dark Mode. */
export function useTheme(): Theme {
  const scheme = useColorScheme();
  return scheme === 'dark' ? darkTheme : lightTheme;
}

export const fonts = {
  weight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
  /**
   * Fraunces (SIL OFL, assets/fonts/OFL.txt), a soft old-style serif. Numbers
   * and headings only; body text stays the system font. Loaded in App.tsx,
   * keyed by these names. Never combine with fontWeight: the weight is in the file.
   */
  display: 'Fraunces-SemiBold',
  heading: 'Fraunces-Medium',
  /** Small warm asides ("of 25 oz today"). */
  soft: 'Fraunces-Italic',
};

/** Font files for useFonts in App.tsx. */
export const FONT_FILES = {
  [fonts.display]: require('../assets/fonts/Fraunces_600SemiBold.ttf'),
  [fonts.heading]: require('../assets/fonts/Fraunces_500Medium.ttf'),
  [fonts.soft]: require('../assets/fonts/Fraunces_400Regular_Italic.ttf'),
};
