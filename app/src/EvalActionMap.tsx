import { useState } from "react";
export type EvalMap = {
  points: {
    id: string;
    position: number[];
    summary: string;
    person: string;
    variant: string;
    repeat: number;
    model_choice: string;
    governed_choice: string;
  }[];
  groups: { person: string; paths: { level: number; path: string }[] }[];
  diffs: Record<
    string,
    { peak: number; paths: { level: number; path: string }[] }
  >;
  bandwidth: number;
  projection: string;
  dimensions: number;
};
const colors: Record<string, string> = {
  daniel: "#7552a5",
  sam: "#aa8352",
  maya: "#47837f",
  baseline: "#8a8294",
  gamer: "#5514b4",
  paraphrase: "#47837f",
  upsell: "#ad7850",
};
export function EvalActionMap({
  map,
  selected,
  select,
  variant,
}: {
  map: EvalMap;
  selected?: string;
  select: (id: string) => void;
  variant: string;
}) {
  const [density, setDensity] = useState("groups"),
    [colour, setColour] = useState("person");
  const diffKey = variant === "baseline" ? "gamer" : variant,
    diff = map.diffs[diffKey];
  const stacks = new Map<string, typeof map.points>();
  for (const p of map.points) {
    const key = p.position.map((v) => v.toFixed(5)).join("/");
    stacks.set(key, [...(stacks.get(key) || []), p]);
  }
  return (
    <div className="eh-observe">
      <div className="eh-vertical">
        <span>01 · OBSERVE</span>
        <strong>Action map</strong>
        <small>Hodoscope · 384D</small>
      </div>
      <div className="eh-map-body">
        <div className="eh-controls">
          <label>
            Colour
            <select value={colour} onChange={(e) => setColour(e.target.value)}>
              <option value="person">By household</option>
              <option value="variant">By intervention</option>
            </select>
          </label>
          <label>
            Density
            <select
              value={density}
              onChange={(e) => setDensity(e.target.value)}
            >
              <option value="groups">Household contours</option>
              <option value="diff">Variant − control</option>
              <option value="off">Off</option>
            </select>
          </label>
          <details>
            <summary>How to read this</summary>
            <p>
              Each point is a real eval action. Position comes from Hodoscope
              PCA over local action-summary embeddings. Identical actions
              overlap; select a stack to cycle through runs.
            </p>
            <p>
              Contours are Gaussian KDE at 10–88% of each household's peak.
              Difference layers compare the selected variant with its control
              using the same bandwidth. These small-sample densities are
              descriptive, not a significance test.
            </p>
          </details>
        </div>
        <div className="eh-chart">
          <svg
            viewBox="0 0 630 335"
            role="group"
            aria-label="Jio-style Hodoscope action map with density overlays"
          >
            <defs>
              <pattern
                id="eh-dots"
                width="12"
                height="12"
                patternUnits="userSpaceOnUse"
              >
                <circle cx="1" cy="1" r=".6" fill="#d8d0e3" />
              </pattern>
              <clipPath id="eh-clip">
                <rect x="52" y="18" width="530" height="270" />
              </clipPath>
            </defs>
            <rect
              x="52"
              y="18"
              width="530"
              height="270"
              fill="#faf9fc"
              stroke="#e9e4ef"
            />
            <rect x="52" y="18" width="530" height="270" fill="url(#eh-dots)" />
            {[0, 0.25, 0.5, 0.75, 1].map((v) => (
              <g key={v}>
                <line
                  x1={52 + v * 530}
                  x2={52 + v * 530}
                  y1="18"
                  y2="288"
                  stroke="#e8e2ed"
                  strokeDasharray="2 4"
                />
                <line
                  x1="52"
                  x2="582"
                  y1={18 + v * 270}
                  y2={18 + v * 270}
                  stroke="#e8e2ed"
                  strokeDasharray="2 4"
                />
                <text
                  x={52 + v * 530}
                  y="305"
                  textAnchor="middle"
                  className="ce-axis"
                >
                  {v.toFixed(2)}
                </text>
                <text
                  x="42"
                  y={292 - v * 270}
                  textAnchor="end"
                  className="ce-axis"
                >
                  {v.toFixed(2)}
                </text>
              </g>
            ))}
            <g clipPath="url(#eh-clip)">
              <g transform="translate(52,18) scale(530,270)">
                {density === "groups" &&
                  map.groups.map((g) => (
                    <g key={g.person}>
                      {g.paths.map((p) => (
                        <path
                          key={p.level}
                          d={p.path}
                          fill={colors[g.person]}
                          fillRule="evenodd"
                          opacity={0.06 + p.level * 0.15}
                        />
                      ))}
                    </g>
                  ))}
                {density === "diff" &&
                  diff?.paths.map((p) => (
                    <path
                      key={p.level}
                      d={p.path}
                      fill={p.level > 0 ? "#af7152" : "#576da5"}
                      opacity={0.15 + Math.abs(p.level) * 0.3}
                      fillRule="evenodd"
                    />
                  ))}
              </g>
            </g>
            {[...stacks.values()].map((stack) => {
              const p =
                  stack.find((p) => p.id === selected) ||
                  stack.find((p) => p.variant === variant) ||
                  stack[0],
                x = 52 + p.position[0] * 530,
                y = 18 + (1 - p.position[1]) * 270,
                chosen = stack.some((p) => p.id === selected);
              const pick = () =>
                select(
                  stack[
                    (stack.findIndex((p) => p.id === selected) + 1) %
                      stack.length
                  ].id,
                );
              const keys = [
                ...new Set(
                  stack.map((p) =>
                    colour === "person" ? p.person : p.variant,
                  ),
                ),
              ];
              return (
                <g
                  key={stack[0].id}
                  role="button"
                  tabIndex={0}
                  aria-pressed={chosen}
                  aria-label={`${p.person}, ${stack.length} overlapping action runs, ${p.governed_choice}; select to cycle`}
                  className="eh-point"
                  onClick={pick}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      pick();
                    }
                  }}
                >
                  <title>
                    {stack.length} recorded actions here · {p.summary}
                  </title>
                  <rect x={x - 21} y={y - 21} width="160" height="44" fill="transparent" />
                  {keys.map((key, i) => (
                    <circle
                      key={key}
                      cx={x}
                      cy={y}
                      r={8 + i * 2.5}
                      stroke={colors[key]}
                      strokeWidth="1.8"
                      fill="none"
                    />
                  ))}
                  <circle
                    cx={x}
                    cy={y}
                    r="4"
                    fill={colors[colour === "person" ? p.person : p.variant]}
                  />
                  {chosen && (
                    <circle
                      cx={x}
                      cy={y}
                      r="21"
                      stroke="#5514b4"
                      strokeDasharray="2 3"
                      fill="none"
                    />
                  )}
                  <text x={x + 22} y={y - 4} className="eh-point-label">
                    {p.person} · ×{stack.length}
                  </text>
                  <text x={x + 22} y={y + 11} className="ce-axis">
                    {p.governed_choice}
                  </text>
                </g>
              );
            })}
            <text x="317" y="326" textAnchor="middle" className="ce-axis">
              NORMALISED PCA COORDINATES · DISTANCE ≠ CUSTOMER VALUE
            </text>
          </svg>
        </div>
        <div className="eh-legend">
          {(colour === "person"
            ? ["daniel", "sam", "maya"]
            : ["baseline", "gamer", "paraphrase", "upsell"]
          ).map((k) => (
            <span key={k}>
              <i style={{ background: colors[k] }} />
              {k}
            </span>
          ))}
          <code>
            {map.points.length} real runs · {stacks.size} distinct positions
          </code>
        </div>
        <p className="om-chart-note">
          {density === "diff"
            ? diff?.peak < 0.000001
              ? "No action-density difference detected. Variant and control actions occupy the same regions."
              : `Density difference: ${diffKey} minus control. Probability shifts are checked separately.`
            : "All interventions can occupy the same action cluster. That overlap is the expected result when a self-description does not divert the plan."}
        </p>
      </div>
    </div>
  );
}
