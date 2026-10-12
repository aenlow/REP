/**
 * REP brand mark: a 3×3 grid — three blocks of three exercises — with the final
 * two cells open, reading as "work in progress". Same geometry as the app icon.
 */
export function Mark({ size = 28, title = 'REP' }: { size?: number; title?: string }) {
  const cells = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const i = r * 3 + c;
      const open = i >= 7;
      cells.push(
        <rect
          key={i}
          x={2 + c * 10}
          y={2 + r * 10}
          width={8}
          height={8}
          fill={open ? 'none' : 'currentColor'}
          stroke="currentColor"
          strokeWidth={open ? 1.6 : 0}
        />,
      );
    }
  }
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" role="img" aria-label={title}>
      {cells}
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="wordmark">
      <Mark size={22} title="" />
      <span>REP</span>
    </span>
  );
}
