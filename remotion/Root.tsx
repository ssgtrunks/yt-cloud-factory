import React from "react";
import { Composition } from "remotion";
import { DocumentaryVideo, DocumentaryProps } from "./DocumentaryVideo";

// Remotion types composition props as Record<string, unknown>; the cast keeps
// DocumentaryProps strongly typed inside the component.
const DocumentaryComponent = DocumentaryVideo as unknown as React.FC<Record<string, unknown>>;

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="DocumentaryVideo"
      component={DocumentaryComponent}
      durationInFrames={300}
      fps={30}
      width={1920}
      height={1080}
      defaultProps={{
        channelHandle: "@CapLedger",
        episodeTitle: "Episode Preview",
        width: 1920,
        height: 1080,
        totalDurationSec: 10,
        scenes: [],
      }}
      calculateMetadata={({ props }) => {
        const p = props as unknown as DocumentaryProps;
        const fps = 30;
        const durationInFrames = Math.max(90, Math.ceil((p.totalDurationSec || 10) * fps));
        return {
          durationInFrames,
          fps,
          width: p.width || 1920,
          height: p.height || 1080,
        };
      }}
    />
  );
};
