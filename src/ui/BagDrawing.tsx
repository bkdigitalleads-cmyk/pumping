import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { ClipPath, Defs, G, Line, Path, Rect } from 'react-native-svg';
import { Theme } from '../theme';
import Tape, { Marker } from './Tape';

/**
 * A milk storage bag as it really looks: a zip top with tear notches, clear
 * plastic, milk settled at the bottom, and the printed write-on stripe with
 * the bag number, date and amount in marker. Frozen bags get a faint frost.
 * "Use next" is a piece of tape stuck across the corner.
 */
const VB_W = 100;
const VB_H = 142;
const BODY = 'M8 15 H92 L90 128 Q89.4 138 80 138 H20 Q10.6 138 10 128 Z';
/** The milk can rise from the bottom of the bag to just under the zip. */
const MILK_BOTTOM = 138;
const MILK_TOP = 30;
/** A storage bag holds about 6 oz; the fill is drawn against that. */
export const BAG_CAPACITY_ML = 180;

export default function BagDrawing({
  theme,
  width,
  number,
  date,
  amount,
  extra,
  fill = 0,
  frozen = false,
  ghost = false,
  tape,
  tapeDanger = false,
  seed = 1,
}: {
  theme: Theme;
  width: number;
  number?: string;
  date?: string;
  amount?: string;
  /** A third line on the stripe, like "thawing". */
  extra?: string;
  /** 0 to 1 of the bag. */
  fill?: number;
  frozen?: boolean;
  /** Dashed outline only: the empty-state example. */
  ghost?: boolean;
  /** Words on a piece of tape across the top corner ("use next"). */
  tape?: string;
  tapeDanger?: boolean;
  seed?: number;
}) {
  const height = (width * VB_H) / VB_W;
  const k = width / VB_W;
  const dash = ghost ? '4 3' : undefined;
  const edge = ghost ? theme.inkFaint : theme.plasticEdge;
  const milkTop = MILK_BOTTOM - Math.max(0, Math.min(1, fill)) * (MILK_BOTTOM - MILK_TOP);
  const clipId = `bag${seed}`;

  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height} viewBox={`0 0 ${VB_W} ${VB_H}`}>
        <Defs>
          <ClipPath id={clipId}>
            <Path d={BODY} />
          </ClipPath>
        </Defs>
        {/* zip top */}
        <Path
          d="M8 15 V8 Q8 3.5 12.5 3.5 H87.5 Q92 3.5 92 8 V15 Z"
          fill={ghost ? 'none' : theme.plastic}
          stroke={edge}
          strokeWidth={1.2}
          strokeDasharray={dash}
        />
        <Line x1={8} y1={9.5} x2={92} y2={9.5} stroke={edge} strokeWidth={1} strokeDasharray={dash} />
        {/* body */}
        <Path d={BODY} fill={ghost ? 'none' : theme.plastic} stroke={edge} strokeWidth={1.3} strokeDasharray={dash} />
        {!ghost && fill > 0 && (
          <G clipPath={`url(#${clipId})`}>
            <Rect x={0} y={milkTop} width={VB_W} height={VB_H} fill={theme.milk} />
            <Rect x={0} y={milkTop} width={VB_W} height={1.6} fill={theme.milkLine} />
          </G>
        )}
        {frozen && !ghost && <Frost theme={theme} seed={seed} clipId={clipId} />}
        {/* tear notches */}
        <Path d="M8 18 L11.5 20 L8 22" fill={theme.bg} stroke={edge} strokeWidth={0.8} />
        <Path d="M92 18 L88.5 20 L92 22" fill={theme.bg} stroke={edge} strokeWidth={0.8} />
        {/* the printed write-on stripe */}
        <Rect
          x={16}
          y={26}
          width={68}
          height={48}
          rx={2}
          fill={ghost ? 'none' : theme.stripe}
          stroke={edge}
          strokeWidth={0.7}
          strokeDasharray={ghost ? '3 3' : undefined}
        />
        <Line x1={20} y1={42} x2={80} y2={42} stroke={theme.rule} strokeWidth={0.6} />
        <Line x1={20} y1={58} x2={80} y2={58} stroke={theme.rule} strokeWidth={0.6} />
        {/* printed ounce marks down the side */}
        {!ghost &&
          [0, 1, 2, 3, 4, 5].map((i) => (
            <Line key={i} x1={84} y1={130 - i * 16} x2={88} y2={130 - i * 16} stroke={edge} strokeWidth={0.7} />
          ))}
      </Svg>
      {/* what the parent wrote on the stripe */}
      <View
        style={[styles.stripe, { left: 18 * k, top: 26 * k, width: 64 * k, height: 48 * k }]}
        pointerEvents="none"
        importantForAccessibility="no-hide-descendants"
      >
        <View style={styles.stripeRow}>
          {number ? <Marker theme={theme} drawn size={17 * k}>{number}</Marker> : null}
          {date ? <Marker theme={theme} drawn size={14 * k}>{date}</Marker> : null}
        </View>
        {amount ? <Marker theme={theme} drawn size={15 * k}>{amount}</Marker> : null}
        {extra ? (
          <Marker theme={theme} drawn size={12 * k} color={theme.accent}>
            {extra}
          </Marker>
        ) : null}
      </View>
      {tape ? (
        <View style={[styles.tape, { top: -6 * k, left: -10 * k }]} pointerEvents="none">
          <Tape theme={theme} rotate={-9} seed={seed + 3}>
            <Marker theme={theme} drawn size={Math.max(13, 15 * k)} color={tapeDanger ? theme.danger : theme.marker}>
              {tape}
            </Marker>
          </Tape>
        </View>
      ) : null}
    </View>
  );
}

/** Frost: a faint haze and a scatter of tiny crystals, the same for a given bag every time. */
function Frost({ theme, seed, clipId }: { theme: Theme; seed: number; clipId: string }) {
  let r = seed * 7919 + 17;
  const rand = () => {
    r = (r * 16807) % 2147483647;
    return (r % 1000) / 1000;
  };
  const marks = Array.from({ length: 26 }, () => {
    const x = 12 + rand() * 76;
    const y = 18 + rand() * 116;
    const s = 1.2 + rand() * 1.8;
    return `M${(x - s).toFixed(1)} ${y.toFixed(1)} H${(x + s).toFixed(1)} M${x.toFixed(1)} ${(y - s).toFixed(1)} V${(y + s).toFixed(1)}`;
  }).join(' ');
  return (
    <G clipPath={`url(#${clipId})`}>
      <Rect x={0} y={0} width={VB_W} height={VB_H} fill={theme.frost} opacity={0.08} />
      <Path d={marks} stroke={theme.frost} strokeWidth={0.6} opacity={0.55} />
    </G>
  );
}

const styles = StyleSheet.create({
  stripe: { position: 'absolute', justifyContent: 'center', paddingHorizontal: 2 },
  stripeRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  tape: { position: 'absolute' },
});
