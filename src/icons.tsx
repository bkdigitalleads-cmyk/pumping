/**
 * Pumping's own line icons, drawn with react-native-svg on a 24x24 grid so
 * they match each other and the Fraunces numbers. No emoji anywhere.
 */
import React from 'react';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

export type IconName =
  | 'drop'
  | 'bottle'
  | 'bag'
  | 'snowflake'
  | 'fridge'
  | 'chest'
  | 'moon'
  | 'sun'
  | 'clock'
  | 'pastClock'
  | 'chart'
  | 'sliders'
  | 'bell'
  | 'key'
  | 'check'
  | 'close'
  | 'plus'
  | 'minus'
  | 'share'
  | 'doc'
  | 'tag'
  | 'trash'
  | 'pencil'
  | 'chevronLeft'
  | 'chevronRight'
  | 'chevronDown'
  | 'heart'
  | 'question';

interface Props {
  name: IconName;
  size?: number;
  color: string;
  strokeWidth?: number;
}

export default function Icon({ name, size = 22, color, strokeWidth = 1.9 }: Props) {
  const p = {
    stroke: color,
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
  };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {draw(name, p, color)}
    </Svg>
  );
}

function draw(name: IconName, p: object, color: string) {
  switch (name) {
    case 'drop':
      return (
        <>
          <Path d="M12 3.2C12 3.2 5.5 10.1 5.5 14.6A6.5 6.5 0 0 0 18.5 14.6C18.5 10.1 12 3.2 12 3.2Z" {...p} />
          <Path d="M8.9 15.2A3.2 3.2 0 0 0 11.4 18" {...p} />
        </>
      );
    case 'bottle':
      return (
        <>
          <Path d="M10.3 5.4C10.3 3.9 11.1 2.8 12 2.8C12.9 2.8 13.7 3.9 13.7 5.4" {...p} />
          <Rect x="8" y="5.4" width="8" height="2.6" rx="0.9" {...p} />
          <Path d="M8.6 8V19.2C8.6 20.2 9.4 21 10.4 21H13.6C14.6 21 15.4 20.2 15.4 19.2V8" {...p} />
          <Path d="M12.8 11.5H15.4M12.8 14.5H15.4M12.8 17.5H15.4" {...p} />
        </>
      );
    case 'bag':
      return (
        <>
          <Path d="M6.5 7H17.5L16.9 18.6C16.8 19.9 15.8 21 14.4 21H9.6C8.2 21 7.2 19.9 7.1 18.6L6.5 7Z" {...p} />
          <Path d="M6.5 7V4.3C6.5 3.9 6.8 3.5 7.2 3.5H16.8C17.2 3.5 17.5 3.9 17.5 4.3V7" {...p} />
          <Path d="M9.6 11H14.4M9.6 14H13" {...p} />
        </>
      );
    case 'snowflake':
      return (
        <Path
          d="M12 3L12 21M4.21 7.5L19.79 16.5M4.21 16.5L19.79 7.5M14.4 7.8L12 5.6L9.6 7.8M9.56 7.82L6.46 8.8L7.16 11.98M7.16 12.02L6.46 15.2L9.56 16.18M9.6 16.2L12 18.4L14.4 16.2M14.44 16.18L17.54 15.2L16.84 12.02M16.84 11.98L17.54 8.8L14.44 7.82"
          {...p}
        />
      );
    case 'fridge':
      return (
        <>
          <Rect x="6" y="2.8" width="12" height="18.4" rx="2.2" {...p} />
          <Line x1="6" y1="9.5" x2="18" y2="9.5" {...p} />
          <Line x1="9" y1="5.6" x2="9" y2="7" {...p} />
          <Line x1="9" y1="12.4" x2="9" y2="15" {...p} />
        </>
      );
    case 'chest':
      return (
        <>
          <Rect x="3.2" y="8.5" width="17.6" height="11.5" rx="2" {...p} />
          <Line x1="3.2" y1="12" x2="20.8" y2="12" {...p} />
          <Line x1="10" y1="15.4" x2="14" y2="15.4" {...p} />
          <Path d="M8 5.5L9 4.5M12 5V3.6M16 5.5L15 4.5" {...p} />
        </>
      );
    case 'moon':
      return <Path d="M19.5 14.5A7.8 7.8 0 1 1 9.5 4.5A6.3 6.3 0 0 0 19.5 14.5Z" {...p} />;
    case 'sun':
      return (
        <>
          <Circle cx="12" cy="12" r="4" {...p} />
          <Path d="M12 2.5V4.5M12 19.5V21.5M2.5 12H4.5M19.5 12H21.5M5.3 5.3L6.7 6.7M17.3 17.3L18.7 18.7M5.3 18.7L6.7 17.3M17.3 6.7L18.7 5.3" {...p} />
        </>
      );
    case 'clock':
      return (
        <>
          <Circle cx="12" cy="12" r="8.6" {...p} />
          <Path d="M12 7.4V12L15 13.9" {...p} />
        </>
      );
    case 'pastClock':
      return (
        <>
          <Path d="M4.6 13A7.6 7.6 0 1 0 6.6 6.8" {...p} />
          <Path d="M4.4 4.2V7.5H7.7" {...p} />
          <Path d="M12 8.4V12.3L14.6 13.8" {...p} />
        </>
      );
    case 'chart':
      return (
        <>
          <Rect x="4.2" y="12.5" width="3.6" height="7.5" rx="1.2" {...p} />
          <Rect x="10.2" y="8" width="3.6" height="12" rx="1.2" {...p} />
          <Rect x="16.2" y="4" width="3.6" height="16" rx="1.2" {...p} />
        </>
      );
    case 'sliders':
      return (
        <>
          <Path d="M4 7H8M12 7H20M4 12H14M18 12H20M4 17H6.5M10.5 17H20" {...p} />
          <Circle cx="10" cy="7" r="2" {...p} />
          <Circle cx="16" cy="12" r="2" {...p} />
          <Circle cx="8.5" cy="17" r="2" {...p} />
        </>
      );
    case 'bell':
      return (
        <>
          <Path d="M6 16.5V11A6 6 0 0 1 18 11V16.5L19.5 18H4.5L6 16.5Z" {...p} />
          <Path d="M10 20.5A2.2 2.2 0 0 0 14 20.5" {...p} />
        </>
      );
    case 'key':
      return (
        <>
          <Circle cx="8" cy="12" r="4" {...p} />
          <Path d="M12 12H21M18 12V15M15.5 12V14" {...p} />
        </>
      );
    case 'check':
      return <Path d="M5 12.5L10 17.5L19 7" {...p} />;
    case 'close':
      return <Path d="M6 6L18 18M18 6L6 18" {...p} />;
    case 'plus':
      return <Path d="M12 5V19M5 12H19" {...p} />;
    case 'minus':
      return <Path d="M5 12H19" {...p} />;
    case 'share':
      return (
        <>
          <Path d="M12 3.5V14.5M8 7.5L12 3.5L16 7.5" {...p} />
          <Path d="M8 10.5H6.5C5.9 10.5 5.5 10.9 5.5 11.5V19.5C5.5 20.1 5.9 20.5 6.5 20.5H17.5C18.1 20.5 18.5 20.1 18.5 19.5V11.5C18.5 10.9 18.1 10.5 17.5 10.5H16" {...p} />
        </>
      );
    case 'doc':
      return (
        <>
          <Path d="M7 3.5H14L18.5 8V19.5C18.5 20.1 18.1 20.5 17.5 20.5H7C6.4 20.5 6 20.1 6 19.5V4.5C6 3.9 6.4 3.5 7 3.5Z" {...p} />
          <Path d="M14 3.5V8H18.5" {...p} />
          <Line x1="9" y1="12" x2="15.5" y2="12" {...p} />
          <Line x1="9" y1="15.5" x2="15.5" y2="15.5" {...p} />
        </>
      );
    case 'tag':
      return (
        <>
          <Path d="M3.5 12.2V5C3.5 4.2 4.2 3.5 5 3.5H12.2L20.5 11.8L11.8 20.5L3.5 12.2Z" {...p} />
          <Circle cx="8" cy="8" r="1.4" {...p} />
        </>
      );
    case 'trash':
      return (
        <>
          <Path d="M4.5 6.5H19.5M9.5 6.5V4.5H14.5V6.5" {...p} />
          <Path d="M6.5 6.5L7.3 19.2C7.4 20 8 20.5 8.8 20.5H15.2C16 20.5 16.6 20 16.7 19.2L17.5 6.5" {...p} />
        </>
      );
    case 'pencil':
      return (
        <>
          <Path d="M4 20L4.8 16.2L15.6 5.4C16.4 4.6 17.6 4.6 18.4 5.4L18.6 5.6C19.4 6.4 19.4 7.6 18.6 8.4L7.8 19.2L4 20Z" {...p} />
          <Path d="M14 7L17 10" {...p} />
        </>
      );
    case 'chevronLeft':
      return <Path d="M14.5 5.5L8 12L14.5 18.5" {...p} />;
    case 'chevronRight':
      return <Path d="M9.5 5.5L16 12L9.5 18.5" {...p} />;
    case 'chevronDown':
      return <Path d="M5.5 9L12 15.5L18.5 9" {...p} />;
    case 'heart':
      return (
        <Path d="M12 19.5C12 19.5 4 14.6 4 9.2A4.2 4.2 0 0 1 12 7.4A4.2 4.2 0 0 1 20 9.2C20 14.6 12 19.5 12 19.5Z" {...p} />
      );
    case 'question':
      return (
        <>
          <Path d="M4.5 5.5H19.5C20.1 5.5 20.5 5.9 20.5 6.5V15.5C20.5 16.1 20.1 16.5 19.5 16.5H10L6 20V16.5H4.5C3.9 16.5 3.5 16.1 3.5 15.5V6.5C3.5 5.9 3.9 5.5 4.5 5.5Z" {...p} />
          <Path d="M10.2 9.3A1.9 1.9 0 1 1 12.6 11.1C12.2 11.3 12 11.6 12 12" {...p} />
          <Circle cx="12" cy="14.2" r="0.4" fill={color} stroke={color} />
        </>
      );
  }
}
