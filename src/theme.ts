import { useColorScheme } from 'react-native';

/**
 * "The freezer door at 3am." The look is built from real pumping gear:
 * milk storage bags with a write-on stripe, bottles with printed ounce
 * marks, masking tape and a Sharpie, a fridge shelf.
 *
 * Day: warm cream paper, deep warm ink, soft clay.
 * Night: true black, cream text kept dim, a low amber. Nothing at night is
 * brighter than the cream text, and there is no pure white anywhere.
 */
export interface Theme {
  /** The page. */
  bg: string;
  /** Paper laid on the page: sheets, inputs, the PDF preview. */
  paper: string;
  /** A shade below the page: pressed rows, the empty part of a bottle. */
  sunk: string;
  ink: string;
  inkSoft: string;
  inkFaint: string;
  /** Hairlines between rows, and printed marks. */
  rule: string;
  accent: string;
  accentSoft: string;
  /** Text and icons drawn on top of an accent fill. */
  onAccent: string;
  danger: string;
  dangerSoft: string;
  success: string;
  /** Left and right side, everywhere they appear. */
  left: string;
  right: string;
  /** Milk inside a bottle or a bag. */
  milk: string;
  /** The darker line at the top of the milk. */
  milkLine: string;
  /** Clear plastic of a bottle or bag, and its outline. */
  plastic: string;
  plasticEdge: string;
  /** The white write-on stripe printed on a storage bag. */
  stripe: string;
  /** Masking tape and the marker ink written on it. */
  tape: string;
  tapeEdge: string;
  marker: string;
  /** Frost on frozen bags; freezer accents. */
  frost: string;
  /** Wire shelf in the fridge and freezer. */
  shelf: string;
  /** Switch thumb: pure white by default on iOS, which is too bright at night. */
  thumb: string;
  isDark: boolean;
}

export const lightTheme: Theme = {
  bg: '#FAF3E8',
  paper: '#FFFBF5',
  sunk: '#F1E6D6',
  ink: '#33241D',
  inkSoft: '#6F5B4F',
  inkFaint: '#9A8678',
  rule: '#E5D6C2',
  accent: '#A8503A',
  accentSoft: '#F6E2D7',
  onAccent: '#FFF8EE',
  danger: '#A23B2C',
  dangerSoft: '#F6DDD6',
  success: '#5F7E62',
  left: '#A8503A',
  right: '#7A6A96',
  milk: '#FFFCF2',
  milkLine: '#DDC397',
  plastic: '#E8DCCB',
  plasticEdge: '#BFA992',
  stripe: '#FFFEFA',
  tape: '#E8D9B8',
  tapeEdge: '#D6C39C',
  marker: '#2A1E19',
  frost: '#6F8C99',
  shelf: '#CDBBA4',
  thumb: '#FFFDF8',
  isDark: false,
};

export const darkTheme: Theme = {
  bg: '#000000',
  paper: '#120E0A',
  sunk: '#1A1510',
  ink: '#D9CCB4',
  inkSoft: '#A39580',
  inkFaint: '#776A5B',
  rule: '#2A221A',
  accent: '#B9803F',
  accentSoft: '#271B0E',
  onAccent: '#140D06',
  danger: '#CC7D6C',
  dangerSoft: '#2A1410',
  success: '#8FA982',
  left: '#B9803F',
  right: '#8D80A8',
  milk: '#BFB194',
  milkLine: '#97876B',
  plastic: '#16110C',
  plasticEdge: '#5E5142',
  stripe: '#2B241C',
  tape: '#3A3024',
  tapeEdge: '#4A3E2F',
  marker: '#D9CCB4',
  frost: '#7D96A0',
  shelf: '#3A3026',
  thumb: '#D9CCB4',
  isDark: true,
};

/** Follows the system setting, so night mode comes on with iOS Dark Mode. */
export function useTheme(): Theme {
  const scheme = useColorScheme();
  return scheme === 'dark' ? darkTheme : lightTheme;
}

/**
 * One radius system, used on purpose:
 *  - pill: every button you press with a thumb
 *  - bag:  drawn bags and bottles (soft plastic)
 *  - tape: masking tape and paper, almost square
 *  - lists, sections and the tab bar are square-edged (no radius at all)
 */
export const radius = { pill: 999, bag: 16, tape: 2 };

export const fonts = {
  weight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
  /**
   * Fraunces (SIL OFL, assets/fonts/OFL.txt), a soft old-style serif, for
   * headings and numbers. Its static files have no tabular figures, so
   * changing numbers go through ui/Figures, which sets each digit in a
   * fixed-width cell. Never combine with fontWeight: the weight is in the file.
   */
  display: 'Fraunces-SemiBold',
  heading: 'Fraunces-Medium',
  /** Small warm asides. */
  soft: 'Fraunces-Italic',
  /**
   * Caveat Brush (SIL OFL, assets/fonts/OFL-CaveatBrush.txt). Only for what a
   * parent would write with a marker: bag stripes, masking tape.
   */
  marker: 'CaveatBrush',
};

/** Font files for useFonts in App.tsx. */
export const FONT_FILES = {
  [fonts.display]: require('../assets/fonts/Fraunces_600SemiBold.ttf'),
  [fonts.heading]: require('../assets/fonts/Fraunces_500Medium.ttf'),
  [fonts.soft]: require('../assets/fonts/Fraunces_400Regular_Italic.ttf'),
  [fonts.marker]: require('../assets/fonts/CaveatBrush_400Regular.ttf'),
};
