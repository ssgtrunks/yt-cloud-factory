import React from "react";
import { Composition, Still } from "remotion";
import { DocumentaryVideo, DocumentaryProps } from "./DocumentaryVideo";
import { Thumbnail } from "./Thumbnail";

const ThumbnailComponent = Thumbnail as unknown as React.FC<Record<string, unknown>>;

// Remotion types composition props as Record<string, unknown>; the cast keeps
// DocumentaryProps strongly typed inside the component.
const DocumentaryComponent = DocumentaryVideo as unknown as React.FC<Record<string, unknown>>;

export const RemotionRoot: React.FC = () => {
  return (
    <>
    <Still
      id="Thumbnail"
      component={ThumbnailComponent}
      width={1280}
      height={720}
      defaultProps={{
        thumbnailText: "STOP RENDERING LOCALLY",
        subText: "Cloud pipeline, zero hardware",
        channelHandle: "@WorkflowStack-AI",
        theme: "cyber_dark",
      }}
    />
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
    </>
  );
};
