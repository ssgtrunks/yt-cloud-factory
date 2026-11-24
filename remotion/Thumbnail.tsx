import React from "react";
import { AbsoluteFill } from "remotion";

export interface ThumbnailProps {
  thumbnailText: string;
  subText?: string;
  channelHandle: string;
  theme?: "glass_neon" | "cyber_dark" | "modern_bento";
  accentColor?: string;
  highlightWord?: string;
  ringText?: string;
}

const PALETTES: Record<string, { bg: string; glow: string; text: string; accent: string }> = {
  cyber_dark: { bg: "#03110E", glow: "#10B981", text: "#FFFFFF", accent: "#10B981" },
  glass_neon: { bg: "#050B18", glow: "#38BDF8", text: "#FFFFFF", accent: "#38BDF8" },
  modern_bento: { bg: "#0B1F17", glow: "#34D399", text: "#FFFFFF", accent: "#059669" },
};

// 1280x720 thumbnail: max 3-4 huge words, one highlighted word, strong contrast,
// readable at the size of a phone search result.
export const Thumbnail: React.FC<ThumbnailProps> = ({
  thumbnailText,
  subText,
  channelHandle,
  theme,
  accentColor,
  highlightWord,
  ringText,
}) => {
  const p = PALETTES[theme || "cyber_dark"] || PALETTES.cyber_dark;
  const accent = accentColor || p.accent;
  const words = (thumbnailText || "").toUpperCase().split(/\s+/).filter(Boolean).slice(0, 4);
  const hl = (highlightWord || words[words.length - 1] || "").toUpperCase();
  const longest = Math.max(...words.map((w) => w.length), 1);
  const fontSize = Math.min(190, Math.floor(1100 / Math.max(longest, 5)));

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at 78% 40%, ${p.glow}55 0%, ${p.bg} 55%, #000000 100%)`,
        fontFamily: "DejaVu Sans, sans-serif",
        overflow: "hidden",
      }}
    >
      {/* diagonal energy stripes */}
      <div
        style={{
          position: "absolute",
          inset: -200,
          backgroundImage: `repeating-linear-gradient(115deg, ${accent}14 0px, ${accent}14 2px, transparent 2px, transparent 46px)`,
        }}
      />
      {/* big glowing ring on the right */}
      <div
        style={{
          position: "absolute",
          right: -120,
          top: 70,
          width: 620,
          height: 620,
          borderRadius: "50%",
          border: `28px solid ${accent}`,
          boxShadow: `0 0 120px ${accent}, inset 0 0 90px ${accent}88`,
          opacity: 0.85,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {ringText && (
          <div style={{ fontSize: ringText.length > 4 ? 120 : 190, fontWeight: 900, color: "#FFFFFF", textShadow: `0 0 40px ${accent}`, marginRight: 120 }}>
            {ringText}
          </div>
        )}
      </div>
      <div style={{ position: "absolute", left: 64, top: 70, right: 360, display: "flex", flexDirection: "column", gap: 4 }}>
        {words.map((w, i) => {
          const isHl = w.replace(/[^A-Z0-9$%]/g, "") === hl.replace(/[^A-Z0-9$%]/g, "");
          return (
            <div
              key={i}
              style={{
                display: "inline-block",
                alignSelf: "flex-start",
                fontSize,
                lineHeight: 1.0,
                fontWeight: 900,
                letterSpacing: -4,
                color: isHl ? "#000000" : p.text,
                background: isHl ? accent : "transparent",
                padding: isHl ? "4px 22px 10px" : "0",
                borderRadius: isHl ? 14 : 0,
                transform: isHl ? "rotate(-2deg)" : "none",
                textShadow: isHl ? "none" : "0 8px 0 #000, 0 0 30px rgba(0,0,0,0.9)",
              }}
            >
              {w}
            </div>
          );
        })}
      </div>
      {subText && (
        <div
          style={{
            position: "absolute",
            left: 64,
            bottom: 56,
            fontSize: 38,
            fontWeight: 800,
            color: "#E5E7EB",
            background: "rgba(0,0,0,0.65)",
            padding: "10px 22px",
            borderRadius: 10,
            borderLeft: `8px solid ${accent}`,
          }}
        >
          {subText}
        </div>
      )}
      <div
        style={{
          position: "absolute",
          right: 40,
          top: 30,
          fontSize: 26,
          fontWeight: 800,
          color: accent,
          opacity: 0.9,
        }}
      >
        {channelHandle}
      </div>
    </AbsoluteFill>
  );
};
