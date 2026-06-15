/**
 * ビート同期用のブラウザセーフなユーティリティ
 * ※ サーバー専用コード(BPM解析)は server/beatAnalyzer.ts に配置
 */
import type { AudioFrameData } from "./types";

/**
 * 現在フレームから最も近いビートフレームを見つけ、
 * ビートからの経過フレーム数を返す（Remotionコンポーネント内で使用）
 */
export function getBeatDistance(
  currentFrame: number,
  beatFrames: number[]
): { nearestBeatFrame: number; framesSinceBeat: number; progress: number } {
  if (!beatFrames || beatFrames.length === 0) {
    return { nearestBeatFrame: 0, framesSinceBeat: 0, progress: 0 };
  }

  let nearestBeatFrame = beatFrames[0];
  let nearestIdx = 0;
  for (let i = 0; i < beatFrames.length; i++) {
    if (beatFrames[i] <= currentFrame) {
      nearestBeatFrame = beatFrames[i];
      nearestIdx = i;
    } else {
      break;
    }
  }

  const framesSinceBeat = currentFrame - nearestBeatFrame;

  // 次のビートまでのフレーム数を計算（インデックスベースで安全に）
  const nextBeatFrame =
    nearestIdx + 1 < beatFrames.length
      ? beatFrames[nearestIdx + 1]
      : nearestBeatFrame + 30;
  const beatInterval = nextBeatFrame - nearestBeatFrame;
  const progress = beatInterval > 0 ? framesSinceBeat / beatInterval : 0;

  return { nearestBeatFrame, framesSinceBeat, progress };
}

/**
 * フレーム番号から補間したオーディオデータを取得
 * frameData配列のインデックス = フレーム番号（fpsサンプリング）
 */
export function getFrameAudioData(
  frame: number,
  frameData: AudioFrameData[],
): AudioFrameData {
  if (!frameData || frameData.length === 0) {
    return { energy: 0, bass: 0, mid: 0, high: 0, onset: 0 };
  }
  const idx = Math.max(0, Math.min(frame, frameData.length - 1));
  const d = frameData[idx];
  return {
    energy: d.energy ?? 0,
    bass: d.bass ?? 0,
    mid: d.mid ?? 0,
    high: d.high ?? 0,
    onset: d.onset ?? 0,
  };
}

/**
 * 過去フレームのみで平均を取ってオーディオデータを平滑化
 * 未来のフレームを参照しない（因果律を保つ = 音が鳴った瞬間に反応する）
 */
export function getSmoothedAudio(
  frame: number,
  frameData: AudioFrameData[],
  windowSize: number = 2
): AudioFrameData {
  if (!frameData || frameData.length === 0) {
    return { energy: 0, bass: 0, mid: 0, high: 0, onset: 0 };
  }
  // 過去のみ参照: 現在フレームを含めて windowSize+1 フレームで平均
  let energy = 0, bass = 0, mid = 0, high = 0, totalWeight = 0;
  for (let i = 0; i <= windowSize; i++) {
    const idx = Math.max(0, Math.min(frame - i, frameData.length - 1));
    const d = frameData[idx];
    // 現在フレームに近いほど重みが大きい
    const weight = 1 - i / (windowSize + 1);
    energy += d.energy * weight;
    bass += d.bass * weight;
    mid += d.mid * weight;
    high += d.high * weight;
    totalWeight += weight;
  }
  return {
    energy: energy / totalWeight,
    bass: bass / totalWeight,
    mid: mid / totalWeight,
    high: high / totalWeight,
    onset: 0, // onset is sharp transient data, not smoothed
  };
}
