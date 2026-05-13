import React from 'react';

/**
 * QuadrantChart
 *
 * Renders a 2x2 quadrant grid with axis labels, quadrant names, and a candidate marker.
 * Pure SVG — no external dependencies. Sized via viewBox so it scales cleanly.
 */
export default function QuadrantChart({
  instrument,
  xScore,
  yScore,
  resultQuadrantId,
}) {
  const [axisX, axisY] = instrument.axes;
  const W = 600;
  const H = 600;
  const PAD = 80;

  // Map score [-1, 1] -> pixel coords
  const xPx = PAD + ((xScore + 1) / 2) * (W - 2 * PAD);
  const yPx = H - PAD - ((yScore + 1) / 2) * (H - 2 * PAD); // invert Y

  // Quadrant rectangles, addressed by (x, y) high/low
  const halfW = (W - 2 * PAD) / 2;
  const halfH = (H - 2 * PAD) / 2;
  const quads = [
    { x: 'low', y: 'high', rect: [PAD, PAD, halfW, halfH] },
    { x: 'high', y: 'high', rect: [PAD + halfW, PAD, halfW, halfH] },
    { x: 'low', y: 'low', rect: [PAD, PAD + halfH, halfW, halfH] },
    { x: 'high', y: 'low', rect: [PAD + halfW, PAD + halfH, halfW, halfH] },
  ];

  const quadFill = (q) => {
    if (q.fit === 'ideal') return 'var(--via-ideal-bg, #f6e6d8)';
    if (q.fit === 'secondary') return 'var(--via-secondary-bg, #efe9df)';
    if (q.fit === 'weak') return 'var(--via-weak-bg, #ece4d7)';
    return 'var(--via-exclude-bg, #e8e0d2)';
  };

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label="Candidate quadrant result"
      className="via-quadrant-svg"
    >
      {/* Quadrant fills */}
      {quads.map((rectDef) => {
        const q = instrument.quadrants.find(
          (qq) => qq.x === rectDef.x && qq.y === rectDef.y
        );
        if (!q) return null;
        const [x, y, w, h] = rectDef.rect;
        const isResult = q.id === resultQuadrantId;
        return (
          <g key={q.id}>
            <rect
              x={x}
              y={y}
              width={w}
              height={h}
              fill={quadFill(q)}
              stroke={isResult ? 'var(--via-accent, #B71C1C)' : 'var(--via-line, #cdbfa8)'}
              strokeWidth={isResult ? 4 : 1}
            />
            <text
              x={x + w / 2}
              y={y + 28}
              textAnchor="middle"
              className="via-quadrant-label"
              fontFamily="'Playfair Display', Georgia, serif"
              fontSize="20"
              fontWeight="600"
              fill="var(--via-text, #1F1B16)"
            >
              {q.label}
            </text>
            <text
              x={x + w / 2}
              y={y + 50}
              textAnchor="middle"
              fontFamily="Inter, system-ui, sans-serif"
              fontSize="11"
              fill="var(--via-muted, #6e6457)"
              style={{ textTransform: 'uppercase', letterSpacing: '0.08em' }}
            >
              {q.fit === 'ideal' ? 'Ideal fit' : q.fit === 'exclude' ? 'Not a fit' : q.fit}
            </text>
          </g>
        );
      })}

      {/* Center cross */}
      <line
        x1={PAD + halfW}
        y1={PAD}
        x2={PAD + halfW}
        y2={H - PAD}
        stroke="var(--via-line, #cdbfa8)"
        strokeWidth="1"
      />
      <line
        x1={PAD}
        y1={PAD + halfH}
        x2={W - PAD}
        y2={PAD + halfH}
        stroke="var(--via-line, #cdbfa8)"
        strokeWidth="1"
      />

      {/* Axis labels */}
      <text
        x={W / 2}
        y={H - 30}
        textAnchor="middle"
        fontFamily="Inter, system-ui, sans-serif"
        fontSize="13"
        fontWeight="600"
        fill="var(--via-text, #1F1B16)"
      >
        {axisX.label} →
      </text>
      <text
        x={PAD - 10}
        y={H - PAD + 18}
        textAnchor="end"
        fontFamily="Inter, system-ui, sans-serif"
        fontSize="11"
        fill="var(--via-muted, #6e6457)"
      >
        {axisX.lowLabel}
      </text>
      <text
        x={W - PAD + 10}
        y={H - PAD + 18}
        textAnchor="start"
        fontFamily="Inter, system-ui, sans-serif"
        fontSize="11"
        fill="var(--via-muted, #6e6457)"
      >
        {axisX.highLabel}
      </text>

      <text
        x={30}
        y={H / 2}
        textAnchor="middle"
        fontFamily="Inter, system-ui, sans-serif"
        fontSize="13"
        fontWeight="600"
        fill="var(--via-text, #1F1B16)"
        transform={`rotate(-90 30 ${H / 2})`}
      >
        {axisY.label} →
      </text>
      <text
        x={PAD - 10}
        y={H - PAD + 4}
        textAnchor="end"
        fontFamily="Inter, system-ui, sans-serif"
        fontSize="11"
        fill="var(--via-muted, #6e6457)"
        transform={`rotate(-90 ${PAD - 10} ${H - PAD + 4})`}
      >
        {axisY.lowLabel}
      </text>
      <text
        x={PAD - 10}
        y={PAD - 8}
        textAnchor="start"
        fontFamily="Inter, system-ui, sans-serif"
        fontSize="11"
        fill="var(--via-muted, #6e6457)"
        transform={`rotate(-90 ${PAD - 10} ${PAD - 8})`}
      >
        {axisY.highLabel}
      </text>

      {/* Candidate marker */}
      <g>
        <circle
          cx={xPx}
          cy={yPx}
          r="14"
          fill="var(--via-accent, #B71C1C)"
          stroke="#fff"
          strokeWidth="3"
        />
        <circle cx={xPx} cy={yPx} r="4" fill="#fff" />
      </g>
    </svg>
  );
}
