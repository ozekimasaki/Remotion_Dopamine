/**
 * 短いテスト動画（2秒）を生成するスクリプト
 * モックの frameData を使って周波数帯別反応を確認
 */
import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const FPS = 30;
const DURATION_SEC = 3;
const TOTAL_FRAMES = FPS * DURATION_SEC; // 90 frames

// モックの frameData を生成（bass/mid/high が交互に強くなるパターン）
const rawFrameData: { energy: number; bass: number; mid: number; high: number }[] = [];
for (let i = 0; i < TOTAL_FRAMES; i++) {
  const t = i / FPS;
  // bass: 0.5秒ごとにパルス（120BPM相当）
  const bassPhase = (t * 2) % 1; // 2Hz = 120BPM
  const bass = bassPhase < 0.15 ? 1.0 : Math.max(0, 1 - bassPhase * 5);
  // mid: ゆっくり変動
  const mid = 0.3 + 0.7 * Math.abs(Math.sin(t * Math.PI));
  // high: 速い変動
  const high = 0.2 + 0.8 * Math.abs(Math.sin(t * Math.PI * 4));
  // energy: 全体
  const energy = (bass + mid + high) / 3;

  rawFrameData.push({
    energy: Math.round(energy * 100) / 100,
    bass: Math.round(bass * 100) / 100,
    mid: Math.round(mid * 100) / 100,
    high: Math.round(high * 100) / 100,
  });
}

// オンセット強度を計算（実際のbeatAnalyzerと同じロジック）
const frameData = rawFrameData.map((curr, i) => {
  if (i === 0) return { ...curr, onset: 0 };
  const prev = rawFrameData[i - 1];
  const bassFlux = Math.max(0, curr.bass - prev.bass) * 2.0;
  const midFlux = Math.max(0, curr.mid - prev.mid) * 1.0;
  const energyFlux = Math.max(0, curr.energy - prev.energy) * 0.5;
  const rawOnset = bassFlux + midFlux + energyFlux;
  return { ...curr, onset: rawOnset };
});
// 正規化
let maxOnset = 0;
for (const d of frameData) if (d.onset > maxOnset) maxOnset = d.onset;
if (maxOnset > 0) for (const d of frameData) d.onset = Math.round((d.onset / maxOnset) * 100) / 100;

// ビートフレーム（120BPM = 0.5秒ごと = 15フレームごと）
const beatFrames = [];
for (let f = 0; f < TOTAL_FRAMES; f += 15) {
  beatFrames.push(f);
}

const props = {
  musicSrc: "music.wav",
  characterSrc: "",
  animMode: "bpm",
  stripeColors: ["#ff0066", "#00ccff"],
  stripeAngle: 45,
  stripeWidth: 60,
  characterColor: "#ffffff",
  bounceIntensity: 0.1,
  beatFrames,
  frameData,
};

const propsFile = path.resolve("out/test_props.json");
fs.writeFileSync(propsFile, JSON.stringify(props), "utf-8");
console.log(`Props file written: ${propsFile}`);
console.log(`Beat frames: ${beatFrames.length}, Frame data: ${frameData.length}`);

const outputPath = path.resolve("out/test_freq.mp4");
const cmd = `npx remotion render src/index.ts BeatSyncVideo "${outputPath}" --props="${propsFile}" --log=verbose`;
console.log(`\nExecuting: ${cmd}\n`);

try {
  execSync(cmd, { stdio: "inherit", timeout: 120000 });
  console.log(`\n✅ テスト動画生成完了: ${outputPath}`);
} catch (err: any) {
  console.error(`\n❌ レンダリング失敗:`, err.message || err);
}
