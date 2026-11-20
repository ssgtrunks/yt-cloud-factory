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
      cardBg: "rgba(255, 255, 255, 0.92)",
      cardBorder: "rgba(15, 23, 42, 0.10)",
      textPrimary: "#0F172A",
      textSecondary: "#475569",
      accent: customAccent || "#059669",
      gridLine: "rgba(15, 23, 42, 0.04)",
    };
  }
  if (themeName === "cyber_dark") {
    return {
      isLight: false,
      bgGradient: "radial-gradient(circle at 50% 15%, #062825 0%, #050A0E 65%, #020406 100%)",
      cardBg: "rgba(10, 20, 28, 0.92)",
      cardBorder: "rgba(16, 185, 129, 0.30)",
      textPrimary: "#F8FAFC",
      textSecondary: "#94A3B8",
      accent: customAccent || "#10B981",
      gridLine: "rgba(16, 185, 129, 0.07)",
    };
  }
  return {
    isLight: false,
    bgGradient: "radial-gradient(circle at 25% 15%, #1E293B 0%, #090D16 60%, #04060B 100%)",
    cardBg: "rgba(15, 23, 42, 0.86)",
    cardBorder: "rgba(56, 189, 248, 0.28)",
    textPrimary: "#F8FAFC",
    textSecondary: "#94A3B8",
    accent: customAccent || "#38BDF8",
    gridLine: "rgba(255, 255, 255, 0.04)",
  };
};

const SceneCanvas: React.FC<{ scene: SceneProp; theme: ThemeTokens }> = ({ scene, theme }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const chart = scene.chart;
  const accent = chart.color || theme.accent;
  const entrance = spring({ frame, fps, config: { damping: 14, stiffness: 95 } });

  if (chart.type === "beam_chart") {
    const values = chart.values || [97, 91, 89];
    const labels = chart.labels || ["Model A", "Model B", "Model C"];
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
          boxShadow: "0 28px 75px rgba(0,0,0,0.28)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          transform: `scale(${interpolate(entrance, [0, 1], [0.95, 1])})`,
          opacity: entrance,
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
            const grow = spring({
              frame: Math.max(0, frame - idx * 7),
              fps,
              config: { damping: 13, stiffness: 85 },
            });
            const pct = (val / maxVal) * 84 * grow;
            const isHero = idx === 0 || idx === values.length - 1;
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
                    fontSize: 40,
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
                      : theme.isLight
                      ? "linear-gradient(180deg, #94A3B8 0%, #CBD5E1 100%)"
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

  if (chart.type === "terminal") {
    const cmds = chart.commands || ["$ initializing workflow...", "✓ 100% automated execution"];
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          backgroundColor: "#090E17",
          border: `1px solid ${accent}55`,
          borderRadius: 26,
          overflow: "hidden",
          boxShadow: "0 30px 80px rgba(0,0,0,0.65)",
          display: "flex",
          flexDirection: "column",
          transform: `scale(${interpolate(entrance, [0, 1], [0.95, 1])})`,
          opacity: entrance,
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
            const lineStart = idx * 18;
            const visibleChars = Math.max(0, Math.floor((frame - lineStart) * 2.2));
            const shownText = line.slice(0, visibleChars);
            const isSuccess = line.trim().startsWith("✓") || line.includes("SUCCESS");
            if (frame < lineStart) return null;

            return (
              <div
                key={idx}
                style={{
                  fontFamily: "monospace",
                  fontSize: 30,
                  fontWeight: 700,
                  color: isSuccess ? "#10B981" : idx === 0 ? accent : "#F3F4F6",
                  backgroundColor: isSuccess ? "rgba(16, 185, 129, 0.1)" : "transparent",
                  padding: isSuccess ? "12px 20px" : "4px 0",
                  borderRadius: 12,
                }}
              >
                {shownText}
                {visibleChars < line.length && <span style={{ color: accent }}>▌</span>}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (chart.type === "mindmap") {
    const branches = chart.branch_nodes || ["Factor 1", "Factor 2", "Factor 3", "Factor 4"];
    const lineDraw = interpolate(frame, [5, 35], [0, 1], { extrapolateRight: "clamp" });

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
          boxShadow: "0 25px 70px rgba(0,0,0,0.22)",
        }}
      >
        <div style={{ fontSize: 36, fontWeight: 900, color: theme.textPrimary, textAlign: "center" }}>
          {chart.title}
        </div>

        <div style={{ position: "relative", flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="1480" height="440" style={{ position: "absolute" }}>
            {branches.map((_, idx) => {
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
                  opacity={0.75}
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
              transform: `scale(${entrance})`,
            }}
          >
            {chart.center_node || "Core Mechanism"}
          </div>

          {branches.map((node, idx) => {
            const pop = spring({
              frame: Math.max(0, frame - (12 + idx * 6)),
              fps,
              config: { damping: 13, stiffness: 95 },
            });
            const isLeft = idx % 2 === 0;
            const row = Math.floor(idx / 2);
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
                  border: `2px solid ${accent}66`,
                  borderRadius: 18,
                  padding: "22px 26px",
                  fontSize: 23,
                  fontWeight: 800,
                  color: theme.textPrimary,
                  textAlign: "center",
                  boxShadow: "0 12px 30px rgba(0,0,0,0.18)",
                  transform: `scale(${pop})`,
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

  if (chart.type === "bento_grid") {
    const items = chart.bento_items || [];
    return (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <div style={{ fontSize: 38, fontWeight: 900, color: theme.textPrimary, marginBottom: 32, textAlign: "center" }}>
          {chart.title}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 28, width: "100%" }}>
          {items.map((item, idx) => {
            const pop = spring({
              frame: Math.max(0, frame - idx * 6),
              fps,
              config: { damping: 13, stiffness: 95 },
            });
            return (
              <div
                key={idx}
                style={{
                  backgroundColor: theme.cardBg,
                  border: item.highlight ? `2px solid ${accent}` : `1px solid ${theme.cardBorder}`,
                  borderRadius: 24,
                  padding: "30px 36px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  boxShadow: item.highlight ? `0 18px 45px ${accent}33` : "0 12px 30px rgba(0,0,0,0.18)",
                  transform: `translateY(${interpolate(pop, [0, 1], [30, 0])}px) scale(${pop})`,
                  opacity: pop,
                }}
              >
                <div>
                  <div
                    style={{
                      display: "inline-block",
                      backgroundColor: item.highlight ? `${accent}22` : "rgba(148,163,184,0.15)",
                      color: item.highlight ? accent : theme.textSecondary,
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
                <div style={{ fontSize: 42, fontWeight: 900, color: item.highlight ? accent : theme.textPrimary }}>
                  {item.metric}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (chart.type === "timeline") {
    const steps = chart.steps || [];
    const activeStep = Math.min(steps.length - 1, Math.floor(frame / 22));

    return (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <div style={{ fontSize: 38, fontWeight: 900, color: theme.textPrimary, marginBottom: 36, textAlign: "center" }}>
          {chart.title}
        </div>
        <div style={{ display: "flex", gap: 28, width: "100%" }}>
          {steps.map((st, idx) => {
            const pop = spring({ frame: Math.max(0, frame - idx * 8), fps, config: { damping: 13, stiffness: 90 } });
            const isActive = idx <= activeStep;
            return (
              <div
                key={idx}
                style={{
                  flex: 1,
                  backgroundColor: theme.cardBg,
                  border: isActive ? `2px solid ${accent}` : `1px solid ${theme.cardBorder}`,
                  borderRadius: 24,
                  padding: "32px 28px",
                  transform: `translateY(${interpolate(pop, [0, 1], [35, 0])}px)`,
                  opacity: pop,
                  boxShadow: isActive ? `0 18px 45px ${accent}28` : "0 12px 30px rgba(0,0,0,0.2)",
                }}
              >
                <div
                  style={{
                    display: "inline-block",
                    backgroundColor: isActive ? accent : "rgba(148,163,184,0.2)",
                    color: isActive ? "#FFFFFF" : theme.textSecondary,
                    fontWeight: 900,
                    fontSize: 20,
                    padding: "6px 16px",
                    borderRadius: 10,
                    marginBottom: 16,
                  }}
                >
                  {st.step}
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

  if (chart.type === "versus") {
    return (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <div style={{ fontSize: 38, fontWeight: 900, color: theme.textPrimary, marginBottom: 30, textAlign: "center" }}>
          {chart.title}
        </div>
        <div style={{ display: "flex", gap: 36, width: "100%", height: "78%" }}>
          <div
            style={{
              flex: 1,
              backgroundColor: theme.cardBg,
              border: "1px solid rgba(239, 68, 68, 0.35)",
              borderRadius: 26,
              padding: "36px 40px",
              transform: `translateX(${interpolate(entrance, [0, 1], [-45, 0])}px)`,
              opacity: entrance,
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
              border: `2px solid ${accent}`,
              borderRadius: 26,
              padding: "36px 40px",
              boxShadow: `0 20px 55px ${accent}28`,
              transform: `translateX(${interpolate(entrance, [0, 1], [45, 0])}px)`,
              opacity: entrance,
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

  const values = chart.values || [100, 200, 300];
  const labels = chart.labels || ["Metric 1", "Metric 2", "Metric 3"];

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <div style={{ textAlign: "center", marginBottom: 38 }}>
        <div style={{ fontSize: 40, fontWeight: 900, color: theme.textPrimary }}>{chart.title}</div>
        {chart.subtitle && <div style={{ fontSize: 23, color: theme.textSecondary, marginTop: 10 }}>{chart.subtitle}</div>}
      </div>
      <div style={{ display: "flex", gap: 36, width: "100%" }}>
        {values.map((val, idx) => {
          const pop = spring({ frame: Math.max(0, frame - idx * 7), fps, config: { damping: 12, stiffness: 95 } });
          const animatedVal = (val * pop).toFixed(val % 1 === 0 ? 0 : 2);
          const isLast = idx === values.length - 1;
          const pfx = chart.prefixes ? chart.prefixes[idx] || "" : chart.prefix || "";
          const sfx = chart.units ? chart.units[idx] || "" : chart.unit || "";

          return (
            <div
              key={idx}
              style={{
                flex: 1,
                backgroundColor: theme.cardBg,
                border: isLast ? `2px solid ${accent}` : `1px solid ${theme.cardBorder}`,
                borderRadius: 26,
                padding: "44px 28px",
                textAlign: "center",
                transform: `translateY(${interpolate(pop, [0, 1], [35, 0])}px) scale(${pop})`,
                boxShadow: isLast ? `0 20px 50px ${accent}33` : "0 15px 40px rgba(0,0,0,0.2)",
              }}
            >
              <div style={{ fontSize: 64, fontWeight: 900, color: isLast ? accent : theme.textPrimary, marginBottom: 14 }}>
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
