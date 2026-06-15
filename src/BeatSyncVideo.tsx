import React from "react";
import { AbsoluteFill, Audio, staticFile } from "remotion";
import { Background } from "./components/Background";
import { Character } from "./components/Character";
import type { BeatSyncInput, AudioFrameData } from "./lib/types";

interface BeatSyncVideoProps extends BeatSyncInput {
  beatFrames: number[];
  frameData: AudioFrameData[];
}

export const BeatSyncVideo: React.FC<BeatSyncVideoProps> = ({
  musicSrc,
  characterSrc,
  animMode,
  stripeColors,
  stripeAngle,
  stripeWidth,
  characterColor,
  bounceIntensity,
  beatFrames,
  frameData,
}) => {
  return (
    <AbsoluteFill>
      {/* 斜めストライプ背景 */}
      <Background
        stripeColors={stripeColors}
        stripeAngle={stripeAngle}
        stripeWidth={stripeWidth}
        beatFrames={beatFrames}
        frameData={frameData}
      />

      {/* キャラクター */}
      <Character
        imageSrc={characterSrc}
        beatFrames={beatFrames}
        bounceIntensity={bounceIntensity}
        characterColor={characterColor}
        frameData={frameData}
        animMode={animMode}
      />

      {/* 音楽 */}
      <Audio src={staticFile(musicSrc)} />
    </AbsoluteFill>
  );
};
