// Deterministic pseudo-QR matrix (schematic placeholder, per the handoff).
// No randomness at runtime — a seeded LCG — so it is stable across SSR/CSR.

const N = 21;
const SIZE = 128;
const CELL = SIZE / N;
const DARK = "#0a0e14";

function buildCells(): { x: number; y: number }[] {
  const cells: { x: number; y: number }[] = [];
  let seed = 987654321;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const inFinder = (x < 7 && y < 7) || (x >= N - 7 && y < 7) || (x < 7 && y >= N - 7);
      if (inFinder) continue;
      if (rnd() > 0.55) cells.push({ x, y });
    }
  }
  return cells;
}

const CELLS = buildCells();

function Finder({ x, y }: { x: number; y: number }) {
  return (
    <>
      <rect x={x} y={y} width={CELL * 7} height={CELL * 7} fill={DARK} />
      <rect x={x + CELL} y={y + CELL} width={CELL * 5} height={CELL * 5} fill="#fff" />
      <rect x={x + CELL * 2} y={y + CELL * 2} width={CELL * 3} height={CELL * 3} fill={DARK} />
    </>
  );
}

export default function QrMatrix() {
  return (
    <svg viewBox="0 0 128 128" width="128" height="128" style={{ display: "block" }}>
      <rect width="128" height="128" fill="#fff" />
      {CELLS.map((c, i) => (
        <rect key={i} x={c.x * CELL} y={c.y * CELL} width={CELL} height={CELL} fill={DARK} />
      ))}
      <Finder x={0} y={0} />
      <Finder x={CELL * (N - 7)} y={0} />
      <Finder x={0} y={CELL * (N - 7)} />
    </svg>
  );
}
