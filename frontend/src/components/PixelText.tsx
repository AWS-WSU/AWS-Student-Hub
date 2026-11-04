import { useMemo } from 'react';
import type { CSSProperties } from 'react';

/**
 * Renders text in a 5x7 bitmap face as one SVG path per layer. A whole word is
 * a single DOM node, so it is cheap to animate and re-render (the countdown
 * repaints every second without creating elements).
 */

const GLYPH_W = 5;
const GLYPH_H = 7;
const LETTER_GAP = 1;

const GLYPHS: Record<string, string[]> = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.####', '#....', '#....', '#....', '#....', '#....', '.####'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.####', '#....', '#....', '#.###', '#...#', '#...#', '.####'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '#####'],
  J: ['..###', '...#.', '...#.', '...#.', '...#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#...#', '#...#', '#...#', '#...#'],
  N: ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '##.##', '#...#'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  '0': ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  '3': ['#####', '...#.', '..#..', '...#.', '....#', '#...#', '.###.'],
  '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  '6': ['..##.', '.#...', '#....', '####.', '#...#', '#...#', '.###.'],
  '7': ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  '9': ['.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..'],
  ':': ['.....', '..#..', '..#..', '.....', '..#..', '..#..', '.....'],
  '+': ['.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....'],
  $: ['..#..', '.####', '#.#..', '.###.', '..#.#', '####.', '..#..'],
  '-': ['.....', '.....', '.....', '#####', '.....', '.....', '.....'],
  '!': ['..#..', '..#..', '..#..', '..#..', '..#..', '.....', '..#..'],
  '.': ['.....', '.....', '.....', '.....', '.....', '.##..', '.##..'],
  ',': ['.....', '.....', '.....', '.....', '.##..', '..#..', '.#...'],
  '/': ['....#', '....#', '...#.', '..#..', '.#...', '#....', '#....'],
  "'": ['..#..', '..#..', '.....', '.....', '.....', '.....', '.....'],
  '&': ['.##..', '#..#.', '#..#.', '.##..', '#.#.#', '#..#.', '.##.#'],
  ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
};

const UNKNOWN = ['#####', '#...#', '#...#', '#...#', '#...#', '#...#', '#####'];

const glyphFor = (ch: string): string[] => GLYPHS[ch.toUpperCase()] ?? UNKNOWN;

const measure = (text: string): { width: number; height: number } => ({
  width: text.length * GLYPH_W + Math.max(0, text.length - 1) * LETTER_GAP,
  height: GLYPH_H,
});

/** Builds one path covering every lit pixel, merging horizontal runs. */
const buildPath = (text: string): string => {
  const parts: string[] = [];
  const chars = Array.from(text);

  for (let row = 0; row < GLYPH_H; row++) {
    let runStart = -1;
    let x = 0;

    const flush = (end: number) => {
      if (runStart >= 0) {
        parts.push(`M${runStart} ${row}h${end - runStart}v1h-${end - runStart}z`);
        runStart = -1;
      }
    };

    chars.forEach((ch, index) => {
      const glyph = glyphFor(ch);
      const line = glyph[row];
      for (let col = 0; col < GLYPH_W; col++) {
        const lit = line[col] === '#';
        if (lit && runStart < 0) runStart = x + col;
        if (!lit) flush(x + col);
      }
      flush(x + GLYPH_W);
      x += GLYPH_W + (index < chars.length - 1 ? LETTER_GAP : 0);
    });
  }

  return parts.join('');
};

export interface PixelTextProps {
  text: string;
  /** Rendered height of one glyph row, in CSS px. Width follows automatically. */
  size?: number;
  color?: string;
  /** Adds an offset copy underneath, like the poster's extruded lettering. */
  depth?: number;
  depthColor?: string;
  className?: string;
  style?: CSSProperties;
  /** Accessible label; defaults to the text. */
  label?: string;
}

function PixelText({
  text,
  size = 12,
  color = 'currentColor',
  depth = 0,
  depthColor = 'rgba(0,0,0,0.45)',
  className,
  style,
  label,
}: PixelTextProps) {
  const path = useMemo(() => buildPath(text), [text]);
  const { width, height } = measure(text);
  const totalW = width + depth;
  const totalH = height + depth;

  return (
    <svg
      className={className}
      style={style}
      viewBox={`0 0 ${totalW} ${totalH}`}
      width={totalW * size}
      height={totalH * size}
      role="img"
      aria-label={label ?? text}
      shapeRendering="crispEdges"
      focusable="false"
    >
      {depth > 0 && <path d={path} fill={depthColor} transform={`translate(${depth} ${depth})`} />}
      <path d={path} fill={color} />
    </svg>
  );
}

export default PixelText;

/** A small pixel-art bitmap from rows of characters mapped to colors. */
export interface PixelBitmapProps {
  rows: string[];
  palette: Record<string, string>;
  size?: number;
  className?: string;
  style?: CSSProperties;
  label?: string;
}

export function PixelBitmap({
  rows,
  palette,
  size = 4,
  className,
  style,
  label = '',
}: PixelBitmapProps) {
  const layers = useMemo(() => {
    const byColor = new Map<string, string[]>();
    rows.forEach((row, y) => {
      Array.from(row).forEach((ch, x) => {
        const color = palette[ch];
        if (!color) return;
        const list = byColor.get(color) ?? [];
        list.push(`M${x} ${y}h1v1h-1z`);
        byColor.set(color, list);
      });
    });
    return Array.from(byColor.entries()).map(([fill, segments]) => ({
      fill,
      d: segments.join(''),
    }));
  }, [rows, palette]);

  const w = Math.max(...rows.map((row) => row.length));
  const h = rows.length;

  return (
    <svg
      className={className}
      style={style}
      viewBox={`0 0 ${w} ${h}`}
      width={w * size}
      height={h * size}
      role={label ? 'img' : 'presentation'}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
      shapeRendering="crispEdges"
      focusable="false"
    >
      {layers.map((layer) => (
        <path key={layer.fill} d={layer.d} fill={layer.fill} />
      ))}
    </svg>
  );
}
