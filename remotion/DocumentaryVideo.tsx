import React from "react";
import {
  AbsoluteFill,
  Audio,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

export interface WordTiming {
  word: string;
  startSec: number;
  endSec: number;
}

export interface TimelineStep {
  step: string;
  title: string;
  detail: string;
}

export interface BentoItem {
  badge: string;
  title: string;
  metric: string;
  highlight?: boolean;
}

export interface ChartData {
  type: "beam_chart" | "kpi" | "versus" | "timeline" | "terminal" | "mindmap" | "bento_grid";
  title: string;
  subtitle?: string;
  labels?: string[];
  values?: number[];
  unit?: string;
  units?: string[];
  prefix?: string;
  prefixes?: string[];
  color?: string;
  left_title?: string;
  left_points?: string[];
  right_title?: string;
  right_points?: string[];
  steps?: TimelineStep[];
  commands?: string[];
  center_node?: string;
  branch_nodes?: string[];
  bento_items?: BentoItem[];
}

export interface SceneProp {
  sceneNumber: number;
  startSec: number;
  durationSec: number;
  calloutText?: string;
  audioFile: string;
  chart: ChartData;
  words: WordTiming[];
}

export interface DocumentaryProps {
  channelHandle: string;
  episodeTitle: string;
  theme?: "glass_neon" | "cyber_dark" | "modern_bento";
  accentColor?: string;
  width: number;
  height: number;
  totalDurationSec: number;
  scenes: SceneProp[];
}

interface ThemeTokens {
  isLight: boolean;
  bgGradient: string;
  cardBg: string;
  cardBorder: string;
  textPrimary: string;
  textSecondary: string;
  accent: string;
  gridLine: string;
}

const getTheme = (themeName: string | undefined, customAccent?: string): ThemeTokens => {
  if (themeName === "modern_bento") {
    return {
      isLight: true,
      bgGradient: "radial-gradient(circle at 20% 15%, #ECFDF5 0%, #F1F5F9 55%, #E2E8F0 100%)",
      cardBg: "rgba(255, 255, 255, 0.94)",
      cardBorder: "rgba(15, 23, 42, 0.12)",
      textPrimary: "#0F172A",
      textSecondary: "#475569",
      accent: customAccent || "#059669",
      gridLine: "rgba(15, 23, 42, 0.05)",
    };
  }
  if (themeName === "cyber_dark") {
    return {
      isLight: false,
      bgGradient: "radial-gradient(circle at 50% 15%, #062825 0%, #050A0E 65%, #020406 100%)",
      cardBg: "rgba(10, 20, 28, 0.94)",
      cardBorder: "rgba(16, 185, 129, 0.35)",
      textPrimary: "#F8FAFC",
      textSecondary: "#94A3B8",
      accent: customAccent || "#10B981",
      gridLine: "rgba(16, 185, 129, 0.08)",
    };
  }
  return {
    isLight: false,
    bgGradient: "radial-gradient(circle at 25% 15%, #1E293B 0%, #090D16 60%, #04060B 100%)",
    cardBg: "rgba(15, 23, 42, 0.90)",
    cardBorder: "rgba(56, 189, 248, 0.32)",
    textPrimary: "#F8FAFC",
    textSecondary: "#94A3B8",
    accent: customAccent || "#38BDF8",
    gridLine: "rgba(255, 255, 255, 0.05)",
  };
};

const SceneCanvas: React.FC<{ scene: SceneProp; theme: ThemeTokens }> = ({ scene, theme }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const chart = scene.chart;
  const accent = chart.color || theme.accent;

  // Continuous slow push-in + subtle floating motion across the ENTIRE scene
  const cameraDrift = interpolate(frame, [0, durationInFrames], [0.98, 1.035], {
    extrapolateRight: "clamp",
  });
  const floatY = Math.sin(frame / 14) * 5;
  const sceneProgress = Math.min(1, frame / Math.max(1, durationInFrames * 0.78));

  // 1. GLOWING VERTICAL BEAM CHART
  if (chart.type === "beam_chart") {
    const values = chart.values || [97, 91, 89];
    const labels = chart.labels || ["A", "B", "C"];
    const maxVal = Math.max(...values, 1);

    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          backgroundColor: theme.cardBg,
          border: `1px solid ${theme.cardBorder}`,
          borderRadius: 30,
          padding: "44px 64px",
          boxShadow: "0 28px 75px rgba(0,0,0,0.32)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          transform: `scale(${cameraDrift}) translateY(${floatY}px)`,
        }}
      >
        <div>
          <div style={{ fontSize: 38, fontWeight: 900, color: theme.textPrimary }}>{chart.title}</div>
          {chart.subtitle && (
            <div style={{ fontSize: 22, color: theme.textSecondary, marginTop: 8 }}>{chart.subtitle}</div>
          )}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-around",
            height: "65%",
            borderBottom: `2px solid ${theme.cardBorder}`,
            gap: 56,
          }}
        >
          {values.map((val, idx) => {
            const staggerStart = (idx / values.length) * (durationInFrames * 0.45);
            const grow = spring({
              frame: Math.max(0, frame - staggerStart),
              fps,
              config: { damping: 16, stiffness: 55 },
            });
            const pct = (val / maxVal) * 84 * grow;
            const isHero = idx === 0;
            const animatedVal = (val * grow).toFixed(val % 1 === 0 ? 0 : 2);
            const pfx = chart.prefixes ? chart.prefixes[idx] || "" : chart.prefix || "";
            const sfx = chart.units ? chart.units[idx] || "" : chart.unit || "";

            return (
              <div
                key={idx}
                style={{
                  flex: 1,
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "flex-end",
                }}
              >
                <div
                  style={{
                    fontSize: 42,
                    fontWeight: 900,
                    color: isHero ? accent : theme.textPrimary,
                    marginBottom: 14,
                  }}
                >
                  {pfx}
                  {animatedVal}
                  {sfx}
                </div>
                <div
                  style={{
                    width: "46%",
                    height: `${Math.max(5, pct)}%`,
                    background: isHero
                      ? `linear-gradient(180deg, ${accent} 0%, ${accent}33 100%)`
                      : "linear-gradient(180deg, #475569 0%, #1E293B 100%)",
                    borderTop: `4px solid ${isHero ? "#FFFFFF" : accent}`,
                    borderRadius: "16px 16px 0 0",
                    boxShadow: isHero ? `0 -10px 45px ${accent}66` : "none",
                  }}
                />
              </div>
            );
          })}
        </div>

        <div style={{ display: "flex", justifyContent: "space-around", gap: 56, paddingTop: 14 }}>
          {labels.map((lbl, idx) => (
            <div
              key={idx}
              style={{ flex: 1, textAlign: "center", fontSize: 25, fontWeight: 800, color: theme.textSecondary }}
            >
              {lbl}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 2. VOICE-PACED LIVE TERMINAL
  if (chart.type === "terminal") {
    const cmds = chart.commands || ["$ initializing...", "✓ complete"];
    const framesPerLine = Math.max(12, Math.floor((durationInFrames * 0.78) / cmds.length));

    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          backgroundColor: "#090E17",
          border: `1px solid ${accent}66`,
          borderRadius: 26,
          overflow: "hidden",
          boxShadow: "0 30px 80px rgba(0,0,0,0.65)",
          display: "flex",
          flexDirection: "column",
          transform: `scale(${cameraDrift}) translateY(${floatY}px)`,
        }}
      >
        <div
          style={{
            backgroundColor: "#111827",
            padding: "18px 28px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid #1F2937",
          }}
        >
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ width: 15, height: 15, borderRadius: 99, backgroundColor: "#EF4444" }} />
            <div style={{ width: 15, height: 15, borderRadius: 99, backgroundColor: "#F59E0B" }} />
            <div style={{ width: 15, height: 15, borderRadius: 99, backgroundColor: "#10B981" }} />
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#9CA3AF" }}>{chart.title}</div>
          <div style={{ width: 60 }} />
        </div>

        <div style={{ padding: "44px 54px", display: "flex", flexDirection: "column", gap: 26 }}>
          {cmds.map((line, idx) => {
            const lineStart = idx * framesPerLine;
            if (frame < lineStart) return null;
            const localProgress = Math.min(1, (frame - lineStart) / Math.max(8, framesPerLine * 0.85));
            const shownText = line.slice(0, Math.ceil(line.length * localProgress));
            const isSuccess = line.trim().startsWith("✓") || line.includes("DONE");

            return (
              <div
                key={idx}
                style={{
                  fontFamily: "monospace",
                  fontSize: 31,
                  fontWeight: 700,
                  color: isSuccess ? "#10B981" : idx === 0 ? accent : "#F3F4F6",
                  backgroundColor: isSuccess ? "rgba(16, 185, 129, 0.12)" : "transparent",
                  padding: isSuccess ? "14px 22px" : "4px 0",
                  borderRadius: 12,
                }}
              >
                {shownText}
                {localProgress < 1 && <span style={{ color: accent }}>▌</span>}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // 3. VOICE-PACED SVG MIND MAP
  if (chart.type === "mindmap") {
    const branches = chart.branch_nodes || ["Node 1", "Node 2", "Node 3", "Node 4"];
    const stepWindow = (durationInFrames * 0.72) / branches.length;

    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          backgroundColor: theme.cardBg,
          border: `1px solid ${theme.cardBorder}`,
          borderRadius: 30,
          padding: "40px 56px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          transform: `scale(${cameraDrift})`,
        }}
      >
        <div style={{ fontSize: 36, fontWeight: 900, color: theme.textPrimary, textAlign: "center" }}>
          {chart.title}
        </div>

        <div style={{ position: "relative", flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="1480" height="440" style={{ position: "absolute" }}>
            {branches.map((_, idx) => {
              const startF = idx * stepWindow;
              const lineDraw = interpolate(frame, [startF, startF + stepWindow], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              });
              const isLeft = idx % 2 === 0;
              const row = Math.floor(idx / 2);
              const targetX = isLeft ? 280 : 1200;
              const targetY = row === 0 ? 105 : 335;
              return (
                <path
                  key={idx}
                  d={`M 740 220 C ${isLeft ? 520 : 960} 220, ${isLeft ? 480 : 1000} ${targetY}, ${targetX} ${targetY}`}
                  fill="none"
                  stroke={accent}
                  strokeWidth="4"
                  strokeDasharray="600"
                  strokeDashoffset={600 * (1 - lineDraw)}
                  opacity={0.85}
                />
              );
            })}
          </svg>

          <div
            style={{
              zIndex: 2,
              background: `linear-gradient(135deg, ${accent} 0%, #0284C7 100%)`,
              color: "#FFFFFF",
              padding: "28px 46px",
              borderRadius: 22,
              fontSize: 32,
              fontWeight: 900,
              boxShadow: `0 18px 45px ${accent}55`,
              transform: `translateY(${floatY}px)`,
            }}
          >
            {chart.center_node || "Core"}
          </div>

          {branches.map((node, idx) => {
            const startF = idx * stepWindow;
            const pop = spring({ frame: Math.max(0, frame - startF), fps, config: { damping: 14, stiffness: 80 } });
            const isLeft = idx % 2 === 0;
            const row = Math.floor(idx / 2);
            const isSpotlight = Math.floor(frame / stepWindow) === idx;

            return (
              <div
                key={idx}
                style={{
                  position: "absolute",
                  left: isLeft ? 40 : undefined,
                  right: !isLeft ? 40 : undefined,
                  top: row === 0 ? 55 : 285,
                  width: 390,
                  backgroundColor: theme.isLight ? "#FFFFFF" : "#0F172A",
                  border: isSpotlight ? `3px solid ${accent}` : `1px solid ${accent}55`,
                  borderRadius: 18,
                  padding: "22px 26px",
                  fontSize: 23,
                  fontWeight: 800,
                  color: theme.textPrimary,
                  textAlign: "center",
                  boxShadow: isSpotlight ? `0 14px 36px ${accent}44` : "0 10px 24px rgba(0,0,0,0.2)",
                  transform: `scale(${pop * (isSpotlight ? 1.05 : 1)})`,
                  opacity: pop,
                }}
              >
                {node}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // 4. BENTO GRID WITH SEQUENTIAL SPOTLIGHT
  if (chart.type === "bento_grid") {
    const items = chart.bento_items || [];
    const stepWindow = (durationInFrames * 0.72) / Math.max(1, items.length);

    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          transform: `scale(${cameraDrift})`,
        }}
      >
        <div style={{ fontSize: 38, fontWeight: 900, color: theme.textPrimary, marginBottom: 32, textAlign: "center" }}>
          {chart.title}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 28, width: "100%" }}>
          {items.map((item, idx) => {
            const startF = idx * stepWindow;
            const pop = spring({ frame: Math.max(0, frame - startF), fps, config: { damping: 14, stiffness: 80 } });
            const isSpotlight = Math.floor(frame / stepWindow) === idx;

            return (
              <div
                key={idx}
                style={{
                  backgroundColor: theme.cardBg,
                  border: isSpotlight ? `3px solid ${accent}` : `1px solid ${theme.cardBorder}`,
                  borderRadius: 24,
                  padding: "30px 36px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  boxShadow: isSpotlight ? `0 20px 50px ${accent}44` : "0 12px 30px rgba(0,0,0,0.18)",
                  transform: `scale(${pop * (isSpotlight ? 1.03 : 1)})`,
                  opacity: pop,
                }}
              >
                <div>
                  <div
                    style={{
                      display: "inline-block",
                      backgroundColor: isSpotlight ? `${accent}25` : "rgba(148,163,184,0.15)",
                      color: isSpotlight ? accent : theme.textSecondary,
                      fontSize: 18,
                      fontWeight: 800,
                      padding: "6px 14px",
                      borderRadius: 99,
                      marginBottom: 12,
                    }}
                  >
                    {item.badge}
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: theme.textPrimary }}>{item.title}</div>
                </div>
                <div style={{ fontSize: 42, fontWeight: 900, color: isSpotlight ? accent : theme.textPrimary }}>
                  {item.metric}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // 5. TIMELINE WITH ACTIVE STEP SPOTLIGHT (Only current step glows & enlarges)
  if (chart.type === "timeline") {
    const steps = chart.steps || [];
    const stepWindow = durationInFrames / Math.max(1, steps.length);
    const activeStep = Math.min(steps.length - 1, Math.floor(frame / stepWindow));

    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          transform: `scale(${cameraDrift})`,
        }}
      >
        <div style={{ fontSize: 38, fontWeight: 900, color: theme.textPrimary, marginBottom: 36, textAlign: "center" }}>
          {chart.title}
        </div>
        <div style={{ display: "flex", gap: 28, width: "100%" }}>
          {steps.map((st, idx) => {
            const isCurrent = idx === activeStep;
            const isPast = idx < activeStep;
            const pop = spring({
              frame: Math.max(0, frame - idx * (stepWindow * 0.65)),
              fps,
              config: { damping: 14, stiffness: 80 },
            });

            return (
              <div
                key={idx}
                style={{
                  flex: 1,
                  backgroundColor: theme.cardBg,
                  border: isCurrent ? `3px solid ${accent}` : `1px solid ${theme.cardBorder}`,
                  borderRadius: 24,
                  padding: "32px 28px",
                  transform: `scale(${pop * (isCurrent ? 1.05 : 0.98)}) translateY(${isCurrent ? -8 : 0}px)`,
                  opacity: isCurrent ? 1 : isPast ? 0.72 : 0.45,
                  boxShadow: isCurrent ? `0 22px 55px ${accent}44` : "0 10px 25px rgba(0,0,0,0.2)",
                }}
              >
                <div
                  style={{
                    display: "inline-block",
                    backgroundColor: isCurrent ? accent : "rgba(148,163,184,0.2)",
                    color: isCurrent ? "#FFFFFF" : theme.textSecondary,
                    fontWeight: 900,
                    fontSize: 20,
                    padding: "6px 16px",
                    borderRadius: 10,
                    marginBottom: 16,
                  }}
                >
                  {isPast ? `✓ ${st.step}` : st.step}
                </div>
                <div style={{ fontSize: 27, fontWeight: 900, color: theme.textPrimary, marginBottom: 12 }}>
                  {st.title}
                </div>
                <div style={{ fontSize: 21, color: theme.textSecondary, lineHeight: 1.45 }}>{st.detail}</div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // 6. VERSUS SPLIT COMPARISON (Left reveals first half, Right reveals second half)
  if (chart.type === "versus") {
    const halfFrames = durationInFrames * 0.45;
    const leftIn = spring({ frame, fps, config: { damping: 15, stiffness: 75 } });
    const rightIn = spring({ frame: Math.max(0, frame - halfFrames), fps, config: { damping: 15, stiffness: 75 } });
    const rightActive = frame >= halfFrames;

    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          transform: `scale(${cameraDrift})`,
        }}
      >
        <div style={{ fontSize: 38, fontWeight: 900, color: theme.textPrimary, marginBottom: 30, textAlign: "center" }}>
          {chart.title}
        </div>
        <div style={{ display: "flex", gap: 36, width: "100%", height: "78%" }}>
          <div
            style={{
              flex: 1,
              backgroundColor: theme.cardBg,
              border: !rightActive ? "2px solid #EF4444" : "1px solid rgba(239, 68, 68, 0.25)",
              borderRadius: 26,
              padding: "36px 40px",
              transform: `scale(${!rightActive ? 1.02 : 0.98})`,
              opacity: rightActive ? 0.65 : leftIn,
            }}
          >
            <div style={{ fontSize: 28, fontWeight: 900, color: "#EF4444", marginBottom: 24 }}>
              ✕ {chart.left_title || "Old Approach"}
            </div>
            {(chart.left_points || []).map((pt, i) => (
              <div
                key={i}
                style={{
                  fontSize: 23,
                  color: theme.textSecondary,
                  marginBottom: 18,
                  paddingLeft: 18,
                  borderLeft: "3px solid #EF4444",
                  lineHeight: 1.4,
                }}
              >
                {pt}
              </div>
            ))}
          </div>

          <div
            style={{
              flex: 1,
              backgroundColor: theme.cardBg,
              border: rightActive ? `3px solid ${accent}` : `1px solid ${theme.cardBorder}`,
              borderRadius: 26,
              padding: "36px 40px",
              boxShadow: rightActive ? `0 22px 55px ${accent}38` : "none",
              transform: `scale(${rightActive ? 1.03 : 0.96})`,
              opacity: Math.max(0.25, rightIn),
            }}
          >
            <div style={{ fontSize: 28, fontWeight: 900, color: accent, marginBottom: 24 }}>
              ✓ {chart.right_title || "Modern Playbook"}
            </div>
            {(chart.right_points || []).map((pt, i) => (
              <div
                key={i}
                style={{
                  fontSize: 23,
                  color: theme.textPrimary,
                  fontWeight: 600,
                  marginBottom: 18,
                  paddingLeft: 18,
                  borderLeft: `3px solid ${accent}`,
                  lineHeight: 1.4,
                }}
              >
                {pt}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // 7. KPI METRIC CARDS (Voice-paced sequential pop + active spotlight)
  const values = chart.values || [100, 200, 300];
  const labels = chart.labels || ["Metric 1", "Metric 2", "Metric 3"];
  const stepWindow = (durationInFrames * 0.72) / Math.max(1, values.length);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        transform: `scale(${cameraDrift})`,
      }}
    >
      <div style={{ textAlign: "center", marginBottom: 38 }}>
        <div style={{ fontSize: 40, fontWeight: 900, color: theme.textPrimary }}>{chart.title}</div>
        {chart.subtitle && <div style={{ fontSize: 23, color: theme.textSecondary, marginTop: 10 }}>{chart.subtitle}</div>}
      </div>
      <div style={{ display: "flex", gap: 36, width: "100%" }}>
        {values.map((val, idx) => {
          const startF = idx * stepWindow;
          const pop = spring({ frame: Math.max(0, frame - startF), fps, config: { damping: 13, stiffness: 80 } });
          const animatedVal = (val * pop).toFixed(val % 1 === 0 ? 0 : 2);
          const isSpotlight = Math.floor(frame / stepWindow) === idx;
          const pfx = chart.prefixes ? chart.prefixes[idx] || "" : chart.prefix || "";
          const sfx = chart.units ? chart.units[idx] || "" : chart.unit || "";

          return (
            <div
              key={idx}
              style={{
                flex: 1,
                backgroundColor: theme.cardBg,
                border: isSpotlight ? `3px solid ${accent}` : `1px solid ${theme.cardBorder}`,
                borderRadius: 26,
                padding: "44px 28px",
                textAlign: "center",
                transform: `scale(${pop * (isSpotlight ? 1.05 : 0.98)}) translateY(${floatY}px)`,
                opacity: pop,
                boxShadow: isSpotlight ? `0 20px 50px ${accent}44` : "0 15px 40px rgba(0,0,0,0.2)",
              }}
            >
              <div style={{ fontSize: 64, fontWeight: 900, color: isSpotlight ? accent : theme.textPrimary, marginBottom: 14 }}>
                {pfx}
                {animatedVal}
                {sfx}
              </div>
              <div style={{ fontSize: 25, fontWeight: 800, color: theme.textSecondary }}>{labels[idx] || ""}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const SceneView: React.FC<{ scene: SceneProp; channelHandle: string; theme: ThemeTokens }> = ({
  scene,
  channelHandle,
  theme,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentSec = frame / fps;
  const badgeSlide = spring({ frame, fps, config: { damping: 15, stiffness: 110 } });

  const chunkSize = 7;
  let activeChunkIndex = 0;
  for (let i = 0; i < scene.words.length; i++) {
    if (currentSec >= scene.words[i].startSec) {
      activeChunkIndex = Math.floor(i / chunkSize);
    }
  }
  const visibleWords = scene.words.slice(activeChunkIndex * chunkSize, activeChunkIndex * chunkSize + chunkSize);

  return (
    <AbsoluteFill
      style={{
        background: theme.bgGradient,
        backgroundImage: `linear-gradient(${theme.gridLine} 1px, transparent 1px), linear-gradient(90deg, ${theme.gridLine} 1px, transparent 1px), ${theme.bgGradient}`,
        backgroundSize: "64px 64px, 64px 64px, 100% 100%",
        fontFamily: "DejaVu Sans, sans-serif",
      }}
    >
      <Audio src={staticFile(scene.audioFile)}/>

      <div style={{ position: "absolute", top: 135, bottom: 185, left: 100, right: 100 }}>
        <SceneCanvas scene={scene} theme={theme}/>
      </div>

      {scene.calloutText && (
        <div
          style={{
            position: "absolute",
            top: 46,
            left: 100,
            display: "flex",
            alignItems: "center",
            gap: 14,
            backgroundColor: theme.cardBg,
            border: `1px solid ${theme.cardBorder}`,
            borderLeft: `6px solid ${theme.accent}`,
            padding: "14px 26px",
            borderRadius: "0 14px 14px 0",
            boxShadow: "0 10px 28px rgba(0,0,0,0.18)",
            transform: `translateX(${interpolate(badgeSlide, [0, 1], [-60, 0])}px)`,
            opacity: badgeSlide,
          }}
        >
          <span style={{ color: theme.accent, fontWeight: 900, fontSize: 21 }}>{channelHandle}</span>
          <span style={{ color: theme.textSecondary, fontSize: 21 }}>|</span>
          <span style={{ color: theme.textPrimary, fontWeight: 800, fontSize: 23, letterSpacing: 0.5 }}>
            {scene.calloutText.toUpperCase()}
          </span>
        </div>
      )}

      {visibleWords.length > 0 && (
        <div style={{ position: "absolute", bottom: 48, left: 100, right: 100, display: "flex", justifyContent: "center" }}>
          <div
            style={{
              backgroundColor: "rgba(6, 9, 19, 0.92)",
              border: "1px solid rgba(255,255,255,0.16)",
              padding: "16px 34px",
              borderRadius: 18,
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
              gap: "8px 14px",
              boxShadow: "0 16px 40px rgba(0,0,0,0.55)",
            }}
          >
            {visibleWords.map((w, idx) => {
              const isSpoken = currentSec >= w.startSec && currentSec <= w.endSec + 0.18;
              return (
                <span
                  key={idx}
                  style={{
                    fontSize: 36,
                    fontWeight: 800,
                    color: isSpoken ? "#FACC15" : "#F8FAFC",
                  }}
                >
                  {w.word}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};

export const DocumentaryVideo: React.FC<DocumentaryProps> = ({
  channelHandle,
  theme,
  accentColor,
  scenes,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const progressPct = Math.min(100, (frame / Math.max(1, durationInFrames)) * 100);
  const resolvedTheme = getTheme(theme, accentColor);

  return (
    <AbsoluteFill>
      {scenes.map((scene, index) => {
        const fromFrame = Math.round(scene.startSec * fps);
        const durFrames = Math.max(15, Math.round(scene.durationSec * fps));
        return (
          <Sequence durationInFrames={durFrames} from={fromFrame} key={index}>
            <SceneView channelHandle={channelHandle} scene={scene} theme={resolvedTheme}/>
          </Sequence>
        );
      })}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          height: 8,
          width: `${progressPct}%`,
          background: `linear-gradient(90deg, ${resolvedTheme.accent} 0%, #FACC15 100%)`,
        }}
      />
    </AbsoluteFill>
  );
};
