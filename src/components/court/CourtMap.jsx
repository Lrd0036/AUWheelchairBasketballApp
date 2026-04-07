import React, { useRef, useState } from "react";
import { cn } from "@/lib/utils";

// Court dimensions: 500 x 470 viewBox, half-court facing up
// Zones mapped to areas of the court

export function getShotZone(x, y) {
  // x: 0-100, y: 0-100 (0,0 = top-left, basket ~50,88)
  const distFromBasket = Math.sqrt((x - 50) ** 2 + (y - 88) ** 2);
  
  if (distFromBasket < 15) return "paint";
  if (y > 80 && x < 25) return "corner_left";
  if (y > 80 && x > 75) return "corner_right";
  if (distFromBasket > 38) {
    if (x < 30) return "three_left";
    if (x > 70) return "three_right";
    return "three_center";
  }
  if (x < 30) return "wing_left";
  if (x > 70) return "wing_right";
  if (x < 40) return "mid_left";
  if (x > 60) return "mid_right";
  return "mid_center";
}

export function getZoneLabel(zone) {
  const labels = {
    paint: "Paint", mid_left: "Mid Left", mid_right: "Mid Right",
    mid_center: "Mid Center", corner_left: "Corner Left", corner_right: "Corner Right",
    wing_left: "Left Wing", wing_right: "Right Wing", top_key: "Top of Key",
    three_left: "3PT Left", three_right: "3PT Right", three_center: "3PT Center"
  };
  return labels[zone] || zone;
}

const BASKET_X = 50;
const BASKET_Y = 88;

export default function CourtMap({ onShotClick = null, shots = [], opponentShots = [], showHeatMap = false, readOnly = false }) {
  const svgRef = useRef(null);
  const [hovering, setHovering] = useState(false);

  const handleClick = (e) => {
    if (readOnly) return;
    const svg = svgRef.current;
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    const zone = getShotZone(x, y);
    onShotClick && onShotClick({ x, y, zone });
  };

  // Zone heat map aggregation
  const zoneData = {};
  if (showHeatMap) {
    shots.forEach(s => {
      if (!s.shot_zone) return;
      if (!zoneData[s.shot_zone]) zoneData[s.shot_zone] = { made: 0, total: 0 };
      zoneData[s.shot_zone].total++;
      if (["made_2pt", "made_3pt"].includes(s.action_type)) zoneData[s.shot_zone].made++;
    });
  }

  return (
    <div className="relative w-full select-none">
      <svg
        ref={svgRef}
        viewBox="0 0 100 100"
        className={cn(
          "w-full rounded-2xl border border-border/40",
          !readOnly && "cursor-crosshair"
        )}
        style={{ background: "linear-gradient(180deg, #1a2744 0%, #0f1a30 100%)" }}
        onClick={handleClick}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
      >
        {/* Court lines */}
        {/* Outer boundary */}
        <rect x="2" y="2" width="96" height="96" rx="1" fill="none" stroke="#2a3f6f" strokeWidth="0.5" />
        {/* Half-court line */}
        <line x1="2" y1="50" x2="98" y2="50" stroke="#2a3f6f" strokeWidth="0.4" />
        {/* Paint / key */}
        <rect x="33" y="65" width="34" height="28" fill="rgba(255,165,0,0.04)" stroke="#c8a84b" strokeWidth="0.5" />
        {/* Free throw line */}
        <line x1="33" y1="65" x2="67" y2="65" stroke="#c8a84b" strokeWidth="0.5" />
        {/* Free throw circle */}
        <circle cx="50" cy="65" r="10" fill="none" stroke="#c8a84b" strokeWidth="0.4" strokeDasharray="1 1" />
        {/* Basket */}
        <circle cx="50" cy="88" r="2.5" fill="none" stroke="#F97316" strokeWidth="0.8" />
        <circle cx="50" cy="88" r="0.8" fill="#F97316" />
        {/* Backboard */}
        <line x1="43" y1="91" x2="57" y2="91" stroke="#F97316" strokeWidth="0.8" />
        {/* 3PT arc */}
        <path
          d="M 14,95 L 14,78 A 37,37 0 0,1 86,78 L 86,95"
          fill="none"
          stroke="#c8a84b"
          strokeWidth="0.5"
        />
        {/* Restricted area */}
        <path
          d="M 44,91 A 6,6 0 0,1 56,91"
          fill="none"
          stroke="#2a3f6f"
          strokeWidth="0.4"
        />

        {/* Zone heat map overlays */}
        {showHeatMap && Object.entries(zoneData).map(([zone, data]) => {
          const pct = data.total > 0 ? data.made / data.total : 0;
          const color = pct >= 0.5 ? `rgba(34,197,94,${0.15 + pct * 0.3})` : `rgba(239,68,68,${0.15 + (1-pct) * 0.25})`;
          return <ZoneOverlay key={zone} zone={zone} color={color} data={data} />;
        })}

        {/* Our shot dots */}
        {shots.map((shot, i) => {
          if (!shot.shot_x || !shot.shot_y) return null;
          const made = ["made_2pt", "made_3pt", "ft_made"].includes(shot.action_type);
          return (
            <g key={i}>
              {made ? (
                <circle cx={shot.shot_x} cy={shot.shot_y} r="1.5" fill="#22c55e" opacity="0.85" />
              ) : (
                <g>
                  <line x1={shot.shot_x - 1.2} y1={shot.shot_y - 1.2} x2={shot.shot_x + 1.2} y2={shot.shot_y + 1.2} stroke="#ef4444" strokeWidth="0.6" />
                  <line x1={shot.shot_x + 1.2} y1={shot.shot_y - 1.2} x2={shot.shot_x - 1.2} y2={shot.shot_y + 1.2} stroke="#ef4444" strokeWidth="0.6" />
                </g>
              )}
            </g>
          );
        })}

        {/* Opponent shot dots */}
        {opponentShots.map((shot, i) => {
          if (!shot.shot_x || !shot.shot_y) return null;
          const made = shot.is_opponent && ["opp_made_2pt", "opp_made_3pt"].includes(shot.action_type);
          return (
            <circle key={`opp-${i}`} cx={shot.shot_x} cy={shot.shot_y} r="1.5"
              fill={made ? "#a855f7" : "#fb923c"} opacity="0.7" />
          );
        })}

        {/* Tap hint */}
        {!readOnly && hovering && shots.length === 0 && (
          <text x="50" y="40" textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="3.5" fontFamily="sans-serif">
            Tap court to record shot
          </text>
        )}

        {/* Labels */}
        <text x="50" y="8" textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize="2.5" fontFamily="sans-serif">HALF COURT</text>
      </svg>
    </div>
  );
}

function ZoneOverlay({ zone, color, data }) {
  // Zone shapes approximate positions
  const zoneShapes = {
    paint:         { type: "rect", x: 33, y: 65, w: 34, h: 28 },
    corner_left:   { type: "rect", x: 2, y: 80, w: 12, h: 16 },
    corner_right:  { type: "rect", x: 86, y: 80, w: 12, h: 16 },
    wing_left:     { type: "rect", x: 2, y: 55, w: 18, h: 25 },
    wing_right:    { type: "rect", x: 80, y: 55, w: 18, h: 25 },
    mid_left:      { type: "rect", x: 20, y: 55, w: 15, h: 22 },
    mid_right:     { type: "rect", x: 65, y: 55, w: 15, h: 22 },
    mid_center:    { type: "rect", x: 35, y: 52, w: 30, h: 14 },
    three_left:    { type: "rect", x: 2, y: 30, w: 25, h: 25 },
    three_right:   { type: "rect", x: 73, y: 30, w: 25, h: 25 },
    three_center:  { type: "rect", x: 27, y: 15, w: 46, h: 25 },
  };

  const s = zoneShapes[zone];
  if (!s) return null;
  const pct = data.total > 0 ? Math.round((data.made / data.total) * 100) : 0;
  const cx = s.x + s.w / 2;
  const cy = s.y + s.h / 2;

  return (
    <g>
      <rect x={s.x} y={s.y} width={s.w} height={s.h} fill={color} rx="1" />
      <text x={cx} y={cy - 1.5} textAnchor="middle" fill="white" fontSize="3" fontWeight="bold" fontFamily="sans-serif">
        {pct}%
      </text>
      <text x={cx} y={cy + 3} textAnchor="middle" fill="rgba(255,255,255,0.7)" fontSize="2.2" fontFamily="sans-serif">
        {data.made}/{data.total}
      </text>
    </g>
  );
}