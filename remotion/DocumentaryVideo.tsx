import React from "react";
import {
  AbsoluteFill,
  Audio,
  Img,
  OffthreadVideo,
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

export interface ChartData {
  type?: "bar" | "line" | "kpi";
  title: string;
  labels: string[];
  values: number[];
  unit?: string;
  prefix?: string;
  subtitle?: string;
  color?: string;
}

export interface SceneProp {
  sceneNumber: number;
  startSec: number;
  durationSec: number;
  calloutText?: string;
  highlightStat?: string;
  mediaType: "video" | "image" | "chart" | "grid";
  mediaFile?: string;
  audioFile: string;
  chart?: ChartData;
  words: WordTiming[];
}

export interface DocumentaryProps {
  channelHandle: string;
  episodeTitle: string;
  width: number;
  height: number;
  totalDurationSec: number;
  scenes: SceneProp[];
}

const AnimatedChartCard: React.FC<{ chart: ChartData }> = ({ chart }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const accent = chart.color || "#38BDF8";
  const maxVal = Math.max(...chart.values, 1);
  const cardScale = spring({ frame, fps, config: { damping: 14, stiffness: 90 } });

  if (chart.type === "kpi") {
    return (
      <AbsoluteFill
        style={{
          background: "radial-gradient(circle at 25% 20%, #1E293B 0%, #060913 100%)",
          justifyContent: "center",
          alignItems: "center",
          padding: "130px 120px 210px 120px",
          fontFamily: "DejaVu Sans, sans-serif",
        }}
      >
        <div style={{ width: "100%", textAlign: "center", marginBottom: 42 }}>
          <div style={{ fontSize: 42, fontWeight: 800, color: "#F8FAFC" }}>{chart.title}</div>
          {chart.subtitle && (
            <div style={{ fontSize: 24, color: "#94A3B8", marginTop: 10 }}>{chart.subtitle}</div>
          )}
        </div>
        <div style={{ display: "flex", gap: 40, width: "100%", justifyContent: "center" }}>
          {chart.values.map((val, idx) => {
            const pop = spring({
              frame: Math.max(0, frame - idx * 7),
              fps,
              config: { damping: 12, stiffness: 95 },
            });
            const animatedVal = (val * pop).toFixed(val % 1 === 0 ? 0 : 2);
            const isLast = idx === chart.values.length - 1;
            return (
              <div
                key={idx}
                style={{
                  flex: 1,
                  backgroundColor: "rgba(15, 23, 42, 0.92)",
                  border: isLast ? `2px solid ${accent}` : "1px solid rgba(148, 163, 184, 0.25)",
                  borderRadius: 24,
                  padding: "44px 32px",
                  textAlign: "center",
                  transform: `translateY(${interpolate(pop, [0, 1], [40, 0])}px) scale(${pop})`,
                  boxShadow: isLast ? `0 20px 50px ${accent}33` : "0 15px 40px rgba(0,0,0,0.5)",
                }}
              >
                <div
                  style={{
                    fontSize: 64,
                    fontWeight: 900,
                    color: isLast ? accent : "#F8FAFC",
                    marginBottom: 16,
                  }}
                >
                  {chart.prefix || ""}
                  {animatedVal}
                  {chart.unit || ""}
                </div>
                <div style={{ fontSize: 26, fontWeight: 700, color: "#CBD5E1" }}>
                  {chart.labels[idx] || ""}
                </div>
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill
      style={{
        background: "radial-gradient(circle at 30% 20%, #1E293B 0%, #060913 100%)",
        justifyContent: "center",
        alignItems: "center",
        padding: "125px 140px 210px 140px",
        fontFamily: "DejaVu Sans, sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          backgroundColor: "rgba(15, 23, 42, 0.9)",
          border: "1px solid rgba(56, 189, 248, 0.3)",
          borderRadius: 28,
          padding: "44px 64px",
          boxShadow: "0 25px 70px rgba(0,0,0,0.7)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          transform: `scale(${interpolate(cardScale, [0, 1], [0.95, 1])})`,
          opacity: cardScale,
        }}
      >
        <div style={{ fontSize: 36, fontWeight: 800, color: "#F8FAFC" }}>{chart.title}</div>

        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-around",
            height: "66%",
            paddingTop: 28,
            borderBottom: "2px solid #334155",
            gap: 48,
          }}
        >
          {chart.values.map((val, idx) => {
            const grow = spring({
              frame: Math.max(0, frame - idx * 8),
              fps,
              config: { damping: 13, stiffness: 80 },
            });
            const barHeightPct = (val / maxVal) * 84 * grow;
            const isHighlight = idx === chart.values.length - 1;
            const animatedVal = (val * grow).toFixed(val % 1 === 0 ? 0 : 2);

            return (
              <div
                key={idx}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  height: "100%",
                  flex: 1,
                }}
              >
                <div
                  style={{
                    fontSize: 34,
                    fontWeight: 800,
                    color: isHighlight ? accent : "#E2E8F0",
                    marginBottom: 14,
                  }}
                >
                  {chart.prefix || (chart.unit === "$" ? "$" : "")}
                  {animatedVal}
                  {chart.unit && chart.unit !== "$" ? chart.unit : ""}
                </div>
                <div
                  style={{
                    width: "52%",
                    height: `${Math.max(4, barHeightPct)}%`,
                    background: isHighlight
                      ? `linear-gradient(180deg, ${accent} 0%, #0284C7 100%)`
                      : "linear-gradient(180deg, #64748B 0%, #334155 100%)",
                    borderRadius: "14px 14px 0 0",
                    boxShadow: isHighlight ? `0 0 30px ${accent}55` : "none",
                  }}
                />
              </div>
            );
          })}
        </div>

        <div style={{ display: "flex", justifyContent: "space-around", paddingTop: 18, gap: 48 }}>
          {chart.labels.map((lbl, idx) => (
            <div
              key={idx}
              style={{
                flex: 1,
                textAlign: "center",
                fontSize: 26,
                fontWeight: 700,
                color: "#CBD5E1",
              }}
            >
              {lbl}
            </div>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const SceneView: React.FC<{ scene: SceneProp; channelHandle: string }> = ({ scene, channelHandle }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const currentSec = frame / fps;

  const badgeSlide = spring({ frame, fps, config: { damping: 15, stiffness: 110 } });
  const statPop = spring({ frame: Math.max(0, frame - 10), fps, config: { damping: 13, stiffness: 90 } });
  const kenBurnsScale = interpolate(frame, [0, durationInFrames], [1.02, 1.18], {
    extrapolateRight: "clamp",
  });
  const kenBurnsPanX = interpolate(frame, [0, durationInFrames], [-18, 18], {
    extrapolateRight: "clamp",
  });

  const chunkSize = 7;
  let activeChunkIndex = 0;
  for (let i = 0; i < scene.words.length; i++) {
    if (currentSec >= scene.words[i].startSec) {
      activeChunkIndex = Math.floor(i / chunkSize);
    }
  }
  const visibleWords = scene.words.slice(
    activeChunkIndex * chunkSize,
    activeChunkIndex * chunkSize + chunkSize
  );

  return (
    <AbsoluteFill style={{ backgroundColor: "#060913", fontFamily: "DejaVu Sans, sans-serif" }}>
      <Audio src={staticFile(scene.audioFile)} />

      {/* Background Visual Layer */}
      {scene.mediaType === "chart" && scene.chart ? (
        <AnimatedChartCard chart={scene.chart} />
      ) : scene.mediaType === "video" && scene.mediaFile ? (
        <AbsoluteFill>
          <OffthreadVideo
            src={staticFile(scene.mediaFile)}
            muted
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
          <AbsoluteFill
            style={{
              background:
                "linear-gradient(180deg, rgba(6,9,19,0.62) 0%, rgba(6,9,19,0.22) 48%, rgba(6,9,19,0.88) 100%)",
            }}
          />
        </AbsoluteFill>
      ) : scene.mediaType === "image" && scene.mediaFile ? (
        <AbsoluteFill style={{ overflow: "hidden" }}>
          <Img
            src={staticFile(scene.mediaFile)}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              transform: `scale(${kenBurnsScale}) translateX(${kenBurnsPanX}px)`,
            }}
          />
          <AbsoluteFill
            style={{
              background:
                "linear-gradient(180deg, rgba(6,9,19,0.62) 0%, rgba(6,9,19,0.25) 48%, rgba(6,9,19,0.88) 100%)",
            }}
          />
        </AbsoluteFill>
      ) : (
        <AbsoluteFill
          style={{
            background: "radial-gradient(circle at 50% 35%, #1E3A8A 0%, #060913 85%)",
          }}
        />
      )}

      {/* Top-Left Animated Chapter Badge */}
      {scene.calloutText && (
        <div
          style={{
            position: "absolute",
            top: 52,
            left: 64,
            display: "flex",
            alignItems: "center",
            gap: 14,
            backgroundColor: "rgba(15, 23, 42, 0.9)",
            borderLeft: "6px solid #38BDF8",
            padding: "16px 28px",
            borderRadius: "0 14px 14px 0",
            boxShadow: "0 12px 32px rgba(0,0,0,0.55)",
            transform: `translateX(${interpolate(badgeSlide, [0, 1], [-80, 0])}px)`,
            opacity: badgeSlide,
          }}
        >
          <span style={{ color: "#38BDF8", fontWeight: 800, fontSize: 22 }}>{channelHandle}</span>
          <span style={{ color: "#475569", fontSize: 22 }}>|</span>
          <span style={{ color: "#F8FAFC", fontWeight: 800, fontSize: 24, letterSpacing: 0.6 }}>
            {scene.calloutText.toUpperCase()}
          </span>
        </div>
      )}

      {/* Center Kinetic Stat Overlay (for B-Roll Scenes with Key Numbers) */}
      {scene.highlightStat && scene.mediaType !== "chart" && (
        <div
          style={{
            position: "absolute",
            top: "36%",
            left: 120,
            right: 120,
            display: "flex",
            justifyContent: "center",
            transform: `scale(${interpolate(statPop, [0, 1], [0.85, 1])})`,
            opacity: statPop,
          }}
        >
          <div
            style={{
              backgroundColor: "rgba(6, 9, 19, 0.82)",
              border: "2px solid #38BDF8",
              borderRadius: 22,
              padding: "26px 54px",
              fontSize: 54,
              fontWeight: 900,
              color: "#F8FAFC",
              textAlign: "center",
              boxShadow: "0 20px 60px rgba(0,0,0,0.75)",
            }}
          >
            {scene.highlightStat}
          </div>
        </div>
      )}

      {/* Word-by-Word Highlighted Kinetic Subtitles */}
      {visibleWords.length > 0 && (
        <div
          style={{
            position: "absolute",
            bottom: 60,
            left: 100,
            right: 100,
            display: "flex",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              backgroundColor: "rgba(6, 9, 19, 0.92)",
              border: "1px solid rgba(255,255,255,0.18)",
              padding: "18px 36px",
              borderRadius: 18,
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
              gap: "8px 14px",
              boxShadow: "0 16px 40px rgba(0,0,0,0.75)",
            }}
          >
            {visibleWords.map((w, idx) => {
              const isSpoken = currentSec >= w.startSec && currentSec <= w.endSec + 0.18;
              return (
                <span
                  key={idx}
                  style={{
                    fontSize: 38,
                    fontWeight: 800,
                    color: isSpoken ? "#FACC15" : "#F8FAFC",
                    transform: isSpoken ? "scale(1.06)" : "scale(1)",
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

export const DocumentaryVideo: React.FC<DocumentaryProps> = ({ channelHandle, scenes }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const progressPct = Math.min(100, (frame / Math.max(1, durationInFrames)) * 100);

  return (
    <AbsoluteFill style={{ backgroundColor: "#060913" }}>
      {scenes.map((scene, index) => {
        const fromFrame = Math.round(scene.startSec * fps);
        const durFrames = Math.max(15, Math.round(scene.durationSec * fps));
        return (
          <Sequence key={index} from={fromFrame} durationInFrames={durFrames}>
            <SceneView scene={scene} channelHandle={channelHandle} />
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
          background: "linear-gradient(90deg, #38BDF8 0%, #FACC15 100%)",
        }}
      />
    </AbsoluteFill>
  );
};
