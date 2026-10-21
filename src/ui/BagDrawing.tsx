import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { ClipPath, Defs, G, Line, Path, Rect } from 'react-native-svg';
import { Theme } from '../theme';
import Tape, { Marker } from './Tape';

/**
 * A milk storage bag as it really looks: a flat pouch, widest at the top and
 * tapering a little toward the bottom. At the top a heat-sealed strip with
 * two tear notches, the zip line just under it, then the printed white
 * write-on stripe with the bag number, date and amount in marker. Below it
 * clear plastic with the milk level showing, and a small gusset at the
 * bottom so it stands. No lid, no rim, no shoulders. It leans a little on
 * the shelf and has a soft fold. Frozen bags get a faint frost.
 * "Use next" is a piece of tape stuck across the corner.
 */
const VB_W = 100;
const VB_H = 142;
/**
 * The whole pouch outline, seal strip included: widest at the top, the
 * sides bowing out a touch like soft plastic (ruler-straight tapered sides
 * read as a cup), small corners and a flat base.
 */
const BODY = 'M5 3 H95 Q97 70 91 131 Q90.6 137 86 137 H14 Q9.4 137 9 131 Q3 70 5 3 Z';
/** Roughly where each side of the pouch is at height y (the straight line under the bow). */
const leftAt = (y: number) => 5 + ((y - 3) * 4) / 123;
const rightAt = (y: number) => 95 - ((y - 3) * 4) / 123;
const SEAL_Y = 13;
const ZIP_Y = 17.5;
const STRIPE = { x: 15, y: 23, w: 70, h: 44 };
/** The milk can rise from the bottom of the bag to just under the zip. */
const MILK_BOTTOM = 137;
const MILK_TOP = 24;
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
  // Bags never stand perfectly straight: a small lean, one way or the other.
  const lean = ghost ? -2 : seed % 2 ? -3 : 2.5;
  const notch = (side: 'l' | 'r') => {
    const y = 8;
    const x = side === 'l' ? leftAt(y) : rightAt(y);
    const d = side === 'l' ? 3.6 : -3.6;
    return `M${x} ${y - 2.6} L${x + d} ${y} L${x} ${y + 2.6} Z`;
  };

  return (
    <View style={{ width, height, transform: [{ rotate: `${lean}deg` }] }}>
      <Svg width={width} height={height} viewBox={`0 0 ${VB_W} ${VB_H}`}>
        <Defs>
          <ClipPath id={clipId}>
            <Path d={BODY} />
          </ClipPath>
        </Defs>
        {/* the flat pouch */}
        <Path d={BODY} fill={ghost ? 'none' : theme.plastic} stroke={edge} strokeWidth={1.3} strokeLinejoin="round" strokeDasharray={dash} />
        {!ghost && fill > 0 && (
          <G clipPath={`url(#${clipId})`}>
            <Rect x={0} y={milkTop} width={VB_W} height={VB_H} fill={theme.milk} />
            <Rect x={0} y={milkTop} width={VB_W} height={1.6} fill={theme.milkLine} />
          </G>
        )}
        {frozen && !ghost && <Frost theme={theme} seed={seed} clipId={clipId} />}
        {/* heat seal at the top, with its crimp lines and the two tear notches */}
        <Line x1={leftAt(SEAL_Y)} y1={SEAL_Y} x2={rightAt(SEAL_Y)} y2={SEAL_Y} stroke={edge} strokeWidth={1} strokeDasharray={dash} />
        {!ghost && (
          <>
            <Line x1={9} y1={5.6} x2={91} y2={5.6} stroke={edge} strokeWidth={0.5} opacity={0.6} />
            <Line x1={9} y1={10.4} x2={91} y2={10.4} stroke={edge} strokeWidth={0.5} opacity={0.6} />
          </>
        )}
        <Path d={notch('l')} fill={theme.bg} stroke={edge} strokeWidth={0.8} />
        <Path d={notch('r')} fill={theme.bg} stroke={edge} strokeWidth={0.8} />
        {/* the zip, just under the seal */}
        <Line x1={leftAt(ZIP_Y)} y1={ZIP_Y - 1} x2={rightAt(ZIP_Y)} y2={ZIP_Y - 1} stroke={edge} strokeWidth={0.9} strokeDasharray={dash} />
        <Line x1={leftAt(ZIP_Y)} y1={ZIP_Y + 1} x2={rightAt(ZIP_Y)} y2={ZIP_Y + 1} stroke={edge} strokeWidth={0.9} strokeDasharray={dash} />
        {/* the printed write-on stripe */}
        <Rect
          x={STRIPE.x}
          y={STRIPE.y}
          width={STRIPE.w}
          height={STRIPE.h}
          rx={1.5}
          fill={ghost ? 'none' : theme.stripe}
          stroke={edge}
          strokeWidth={0.7}
          strokeDasharray={ghost ? '3 3' : undefined}
        />
        <Line x1={STRIPE.x + 4} y1={STRIPE.y + 16} x2={STRIPE.x + STRIPE.w - 4} y2={STRIPE.y + 16} stroke={theme.rule} strokeWidth={0.6} />
        <Line x1={STRIPE.x + 4} y1={STRIPE.y + 31} x2={STRIPE.x + STRIPE.w - 4} y2={STRIPE.y + 31} stroke={theme.rule} strokeWidth={0.6} />
        {/* a soft fold in the plastic */}
        <Path d="M66 70 C 71 88, 61 106, 67 127" stroke={edge} strokeWidth={0.8} fill="none" opacity={ghost ? 0.5 : 0.35} strokeDasharray={dash} />
        {/* the gusset at the bottom, so it stands */}
        <Path d="M10 129 Q50 121 90 129" stroke={edge} strokeWidth={0.9} fill="none" opacity={0.7} strokeDasharray={dash} />
        {/* printed ounce marks down the side, below the stripe */}
        {!ghost &&
          [78, 92, 106, 120].map((y) => (
            <Line key={y} x1={rightAt(y) - 6} y1={y} x2={rightAt(y) - 2} y2={y} stroke={edge} strokeWidth={0.7} />
          ))}
      </Svg>
      {/* what the parent wrote on the stripe */}
      <View
        style={[styles.stripe, { left: (STRIPE.x + 2) * k, top: STRIPE.y * k, width: (STRIPE.w - 4) * k, height: STRIPE.h * k }]}
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
    const y = 22 + rand() * 110;
    const x = leftAt(y) + 5 + rand() * (rightAt(y) - leftAt(y) - 10);
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
