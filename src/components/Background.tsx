import React from "react";
import { AbsoluteFill } from "remotion";
import type { AudioFrameData } from "../lib/types";

interface BackgroundProps {
  stripeColors: [string, string];
  stripeAngle: number;
  stripeWidth: number;
  beatFrames: number[];
  frameData: AudioFrameData[];
}

export const Background: React.FC<BackgroundProps> = ({
  stripeColors,
  stripeAngle,
  stripeWidth,
}) => {
  const period = stripeWidth * 2;

  const gradient = `repeating-linear-gradient(
    ${stripeAngle}deg,
    ${stripeColors[0]} 0px,
    ${stripeColors[0]} ${stripeWidth}px,
    ${stripeColors[1]} ${stripeWidth}px,
    ${stripeColors[1]} ${period}px
  )`;

  return (
    <AbsoluteFill
      style={{
        background: gradient,
      }}
    />
  );
};
