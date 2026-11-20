import React from "react";
import { Composition } from "remotion";
import { DocumentaryVideo, DocumentaryProps } from "./DocumentaryVideo";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="DocumentaryVideo"
      component={DocumentaryVideo}
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
      calculateMetadata={({ props }: { props: DocumentaryProps }) => {
        const fps = 30;
        const durationInFrames = Math.max(90, Math.ceil((props.totalDurationSec || 10) * fps));
        return {
          durationInFrames,
          fps,
          width: props.width || 1920,
          height: props.height || 1080,
        };
      }}
    />
  );
};
