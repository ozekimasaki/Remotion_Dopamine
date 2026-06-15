import React from "react";
import {
  AbsoluteFill,
  Img,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { getSmoothedAudio, getFrameAudioData } from "../lib/beatDetector";
import type { AudioFrameData, AnimMode } from "../lib/types";

interface CharacterProps {
  imageSrc: string;
  beatFrames: number[];
  bounceIntensity: number;
  characterColor: string;
  frameData: AudioFrameData[];
  animMode: AnimMode;
}

export const Character: React.FC<CharacterProps> = ({
  imageSrc,
  beatFrames,
  bounceIntensity,
  characterColor,
  frameData,
  animMode,
}) => {
  const frame = useCurrentFrame();
  const { height, width } = useVideoConfig();

  // オーディオデータ取得
  const raw = getFrameAudioData(frame, frameData);
  // 平滑化（ベースのゆるやかな動き用）
  const smooth = getSmoothedAudio(frame, frameData, 5);

  // === ヒット強度（モード別） ===
  let hit: number;
  if (animMode === "bpm") {
    // BPMモード: beatFramesに基づいた規則的なパルス
    // 現在のフレーム以前の最後のビートフレームを探す
    let lastBeatFrame = -999;
    for (let i = beatFrames.length - 1; i >= 0; i--) {
      if (beatFrames[i] <= frame) {
        lastBeatFrame = beatFrames[i];
        break;
      }
    }
    const framesSinceBeat = frame - lastBeatFrame;
    // 遅い攻撃 + 短い保持 + 一瞬の減衰（「大きくなる」過程を見せる）
    if (framesSinceBeat === 0) {
      hit = 0.3;   // 攻撃開始
    } else if (framesSinceBeat === 1) {
      hit = 0.7;   // 攻撃中
    } else if (framesSinceBeat === 2) {
      hit = 1.0;   // ピーク到達
    } else if (framesSinceBeat === 3) {
      hit = 1.0;   // ホールド
    } else if (framesSinceBeat === 4) {
      hit = 0.15;  // 一瞬で縮小
    } else {
      hit = 0;     // 即ゼロ
    }
  } else {
    // Onsetモード: サーバー側で適応閾値+包絡済み
    hit = raw.onset; // 0 or 減衰中の値（0〜1）
  }

  // === ベースの動き（bassの継続音にゆるく反応） ===
  const baseBass = smooth.bass * bounceIntensity;

  // === ヒット時の動き（onsetが立った瞬間に大きく反応） ===
  // hitは既に閾値処理済みなので、0以外の時は「本物のヒット」
  const hitScale = hit * 0.3;                           // 一律1.3倍（1 + 0.3）

  // 合成: ベース + ヒットアクセント（上下・左右揺れ・回転なし）
  const scale = 1 + baseBass * 0.3 + hitScale;
  const offsetY = 0;
  const swayX = 0;
  const rotation = 0;

  // キャラクターを画面下半分に配置
  const characterSize = Math.min(width, height * 0.4);

  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-end",
        alignItems: "center",
        paddingBottom: height * 0.05,
      }}
    >
      <div
        style={{
          transform: `translate(${swayX}px, ${offsetY}px) scale(${scale}) rotate(${rotation}deg)`,
          transformOrigin: "center bottom",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",

        }}
      >
        {imageSrc ? (
          <Img
            src={staticFile(imageSrc)}
            style={{
              width: characterSize,
              height: characterSize,
              objectFit: "contain",
            }}
          />
        ) : (
          // フォールバック: シンプルな図形キャラクター
          <div
            style={{
              width: characterSize,
              height: characterSize,
              borderRadius: "50%",
              backgroundColor: characterColor,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",

            }}
          >
            {/* 目 */}
            <div
              style={{
                display: "flex",
                gap: characterSize * 0.2,
                marginTop: -characterSize * 0.1,
              }}
            >
              <div
                style={{
                  width: characterSize * 0.12,
                  height: characterSize * 0.12,
                  borderRadius: "50%",
                  backgroundColor: "#000",
                }}
              />
              <div
                style={{
                  width: characterSize * 0.12,
                  height: characterSize * 0.12,
                  borderRadius: "50%",
                  backgroundColor: "#000",
                }}
              />
            </div>
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
