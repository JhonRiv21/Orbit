import type { Category } from "@/lib/types/satellite";

// Line drawings of each kind of satellite, standing in for a picture of the
// actual object: they show what that class of spacecraft looks like.

const PANEL = (x: number, y: number, w: number, h: number, cells: number) => (
  <g>
    <rect x={x} y={y} width={w} height={h} rx="1" />
    {Array.from({ length: cells - 1 }, (_, i) => {
      const cx = x + ((i + 1) * w) / cells;
      return <line key={i} x1={cx} y1={y} x2={cx} y2={y + h} />;
    })}
  </g>
);

const DRAWINGS: Record<Category, React.ReactNode> = {
  starlink: (
    <>
      <rect x="44" y="40" width="40" height="8" rx="1.5" />
      <line x1="84" y1="44" x2="92" y2="44" />
      {PANEL(92, 30, 92, 28, 6)}
    </>
  ),
  comms: (
    <>
      <rect x="98" y="30" width="28" height="30" rx="2" />
      <line x1="98" y1="45" x2="86" y2="45" />
      <line x1="126" y1="45" x2="138" y2="45" />
      {PANEL(26, 36, 60, 18, 5)}
      {PANEL(138, 36, 60, 18, 5)}
      <path d="M104 30 q8 -16 16 0" />
      <line x1="112" y1="22" x2="112" y2="14" />
    </>
  ),
  navigation: (
    <>
      <rect x="96" y="28" width="32" height="34" rx="2" />
      <rect x="102" y="62" width="20" height="6" />
      <line x1="96" y1="45" x2="84" y2="45" />
      <line x1="128" y1="45" x2="140" y2="45" />
      {PANEL(46, 30, 38, 30, 3)}
      {PANEL(140, 30, 38, 30, 3)}
    </>
  ),
  earth: (
    <>
      <rect x="70" y="32" width="44" height="26" rx="2" />
      <circle cx="92" cy="66" r="6" />
      <line x1="92" y1="58" x2="92" y2="60" />
      <line x1="114" y1="45" x2="126" y2="45" />
      {PANEL(126, 32, 74, 26, 5)}
    </>
  ),
  stations: (
    <>
      <line x1="30" y1="45" x2="194" y2="45" />
      <rect x="96" y="38" width="32" height="14" rx="3" />
      <rect x="104" y="52" width="16" height="14" rx="3" />
      {PANEL(36, 22, 20, 18, 2)}
      {PANEL(36, 50, 20, 18, 2)}
      {PANEL(64, 22, 20, 18, 2)}
      {PANEL(64, 50, 20, 18, 2)}
      {PANEL(140, 22, 20, 18, 2)}
      {PANEL(140, 50, 20, 18, 2)}
      {PANEL(168, 22, 20, 18, 2)}
      {PANEL(168, 50, 20, 18, 2)}
    </>
  ),
  science: (
    <>
      <rect x="72" y="32" width="72" height="26" rx="12" />
      <ellipse cx="72" cy="45" rx="4" ry="13" />
      <path d="M72 32 l-14 -8" />
      {PANEL(96, 12, 28, 18, 3)}
      {PANEL(96, 60, 28, 18, 3)}
    </>
  ),
  other: (
    <>
      <rect x="98" y="32" width="28" height="26" rx="2" />
      <line x1="98" y1="45" x2="88" y2="45" />
      <line x1="126" y1="45" x2="136" y2="45" />
      {PANEL(50, 36, 38, 18, 3)}
      {PANEL(136, 36, 38, 18, 3)}
    </>
  ),
};

export function SatelliteIllustration({
  category,
  color,
}: {
  category: Category;
  color: string;
}) {
  return (
    <svg
      viewBox="0 0 224 90"
      className="h-full w-full"
      fill="none"
      stroke={color}
      strokeWidth="1.4"
      strokeLinejoin="round"
      strokeLinecap="round"
      aria-hidden="true"
    >
      {DRAWINGS[category]}
    </svg>
  );
}
