import "./index.css";
import { Composition, getInputProps } from "remotion";
import type { BeatSyncInput, AudioFrameData } from "./lib/types";
import {
  COMPOSITION_WIDTH,
  COMPOSITION_HEIGHT,
  COMPOSITION_FPS,
  DEFAULT_INPUT,
} from "./lib/types";
import { BeatSyncVideo } from "./BeatSyncVideo";

interface BeatSyncVideoProps extends BeatSyncInput {
  beatFrames: number[];
  frameData: AudioFrameData[];
}

// Remotion Studio / CLI で外部から渡される props
const inputProps = getInputProps() as Partial<BeatSyncVideoProps>;

// デフォルトのビートフレーム（120BPM, 30fps, 10秒間の場合）
// 実際のレンダリング時はサーバー側で解析した beatFrames を渡す
function generateDefaultBeatFrames(
  bpm: number,
  fps: number,
  durationInFrames: number
): number[] {
  const framesPerBeat = (60 / bpm) * fps;
  const frames: number[] = [];
  for (let f = 0; f < durationInFrames; f += framesPerBeat) {
    frames.push(Math.round(f));
  }
  return frames;
}

const defaultBeatFrames = generateDefaultBeatFrames(120, COMPOSITION_FPS, 300);

export const RemotionRoot: React.FC = () => {
  const props: BeatSyncVideoProps = {
    ...DEFAULT_INPUT,
    beatFrames: defaultBeatFrames,
    frameData: [],
    ...inputProps,
  };

  return (
    <Composition
      id="BeatSyncVideo"
      component={BeatSyncVideo as React.FC<any>}
      durationInFrames={
        (props.beatFrames[props.beatFrames.length - 1] ?? 300) + 30
      }
      fps={COMPOSITION_FPS}
      width={COMPOSITION_WIDTH}
      height={COMPOSITION_HEIGHT}
      defaultProps={props}
    />
  );
};
