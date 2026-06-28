// Schematic facility floor-plan (a layout placeholder, per the handoff).
// In production this becomes a real map/floor-plan layer driven by the
// lat/long coordinates that nodes, cameras and assets carry.

const A = "var(--accent)";
const I = "var(--info)";
const W = "var(--warn)";
const B = "var(--border2)";
const F = "var(--faint)";

function Node({ x, y }: { x: number; y: number }) {
  return (
    <>
      <circle cx={x} cy={y} r={3.4} fill={A} />
      <circle cx={x} cy={y} r={6.5} fill="none" stroke={A} strokeOpacity={0.3} />
    </>
  );
}
const Cam = ({ x, y }: { x: number; y: number }) => (
  <rect x={x - 3} y={y - 3} width={6} height={6} fill={I} />
);
const AssetDot = ({ x, y }: { x: number; y: number }) => (
  <circle cx={x} cy={y} r={3.6} fill={W} />
);

export default function FacilityMap() {
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: "1 / 0.72",
        background: "var(--bg)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        overflow: "hidden",
      }}
    >
      <svg
        viewBox="0 0 400 288"
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid meet"
        style={{ display: "block" }}
      >
        <rect x={14} y={14} width={372} height={260} rx={8} fill="none" stroke={B} strokeDasharray="3 5" />
        <rect x={52} y={58} width={120} height={92} rx={4} fill="var(--panel2)" stroke={B} />
        <text x={60} y={74} fill={F} fontFamily="var(--font-mono)" fontSize={9}>BLDG A</text>
        <rect x={232} y={58} width={108} height={76} rx={4} fill="var(--panel2)" stroke={B} />
        <text x={240} y={74} fill={F} fontFamily="var(--font-mono)" fontSize={9}>BLDG B</text>
        <rect x={232} y={172} width={108} height={72} rx={4} fill="var(--panel2)" stroke={B} />
        <text x={240} y={188} fill={F} fontFamily="var(--font-mono)" fontSize={9}>VEHICLE BAY</text>
        <line x1={200} y1={274} x2={200} y2={248} stroke={B} />
        <text x={150} y={266} fill={F} fontFamily="var(--font-mono)" fontSize={8}>MAIN GATE</text>

        <Node x={200} y={254} />
        <Node x={96} y={150} />
        <Node x={286} y={134} />
        <Node x={286} y={210} />
        <Node x={96} y={100} />

        <Cam x={60} y={66} />
        <Cam x={240} y={66} />
        <Cam x={240} y={180} />
        <Cam x={168} y={150} />
        <Cam x={330} y={250} />

        <AssetDot x={286} y={210} />
        <AssetDot x={150} y={235} />

        <line x1={200} y1={254} x2={96} y2={150} stroke={A} strokeOpacity={0.18} />
        <line x1={200} y1={254} x2={286} y2={134} stroke={A} strokeOpacity={0.18} />
        <line x1={200} y1={254} x2={286} y2={210} stroke={A} strokeOpacity={0.18} />
        {/* asset flagged out-of-bounds */}
        <circle cx={150} cy={235} r={11} fill="none" stroke={W} strokeOpacity={0.5} strokeDasharray="2 3" />
      </svg>
    </div>
  );
}
