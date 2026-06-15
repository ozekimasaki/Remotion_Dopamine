import { exec } from "child_process";
import path from "path";
import fs from "fs/promises";
import { analyzeBeats } from "./beatAnalyzer";
import { COMPOSITION_FPS } from "../src/lib/types";

export interface RenderJob {
  id: string;
  status: "pending" | "rendering" | "done" | "error";
  progress: number;
  outputPath?: string;
  error?: string;
  bpm?: number;
}

const jobs = new Map<string, RenderJob>();

export function getJob(id: string): RenderJob | undefined {
  return jobs.get(id);
}

export function getAllJobs(): RenderJob[] {
  return Array.from(jobs.values());
}

/**
 * レンダリングジョブを開始する（非同期で実行）
 */
export async function startRender(params: {
  musicFilePath: string;
  characterFilePath: string;
  animMode: string;
  stripeColors: [string, string];
  stripeAngle: number;
  stripeWidth: number;
  characterColor: string;
  bounceIntensity: number;
}): Promise<string> {
  const id = `render_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const job: RenderJob = {
    id,
    status: "pending",
    progress: 0,
  };
  jobs.set(id, job);

  // 非同期でレンダリングを実行
  runRender(job, params).catch((err) => {
    job.status = "error";
    job.error = err instanceof Error ? err.message : (err?.message || err?.stderr || String(err));
    console.error(`[Render ${job.id}] エラー:`, job.error);
  });

  return id;
}

async function runRender(
  job: RenderJob,
  params: {
    musicFilePath: string;
    characterFilePath: string;
    animMode: string;
    stripeColors: [string, string];
    stripeAngle: number;
    stripeWidth: number;
    characterColor: string;
    bounceIntensity: number;
  }
) {
  job.status = "rendering";

  // BPM解析
  console.log(`[Render ${job.id}] BPM解析中...`);
  const analysis = await analyzeBeats(params.musicFilePath, COMPOSITION_FPS);
  job.bpm = analysis.bpm;
  console.log(`[Render ${job.id}] BPM検出: ${analysis.bpm}`);

  // public ディレクトリにファイルをコピー（staticFileとして参照可能に）
  const publicDir = path.resolve("public");
  await fs.mkdir(publicDir, { recursive: true });

  const musicExt = path.extname(params.musicFilePath);
  const characterExt = path.extname(params.characterFilePath);
  const musicDest = path.join(publicDir, `music_${job.id}${musicExt}`);
  const characterDest = path.join(
    publicDir,
    `character_${job.id}${characterExt}`
  );

  await fs.copyFile(params.musicFilePath, musicDest);
  await fs.copyFile(params.characterFilePath, characterDest);

  // 出力ディレクトリ
  const outDir = path.resolve("out");
  await fs.mkdir(outDir, { recursive: true });
  const outputPath = path.join(outDir, `${job.id}.mp4`);

  // props を一時JSONファイルに書き出し（シェルのクォート問題を回避）
  const propsObj = {
    musicSrc: `music_${job.id}${musicExt}`,
    characterSrc: `character_${job.id}${characterExt}`,
    animMode: params.animMode,
    stripeColors: params.stripeColors,
    stripeAngle: params.stripeAngle,
    stripeWidth: params.stripeWidth,
    characterColor: params.characterColor,
    bounceIntensity: params.bounceIntensity,
    beatFrames: analysis.beatFrames,
    // 周波数帯別フレームデータ（JSONサイズ削減のため小数点2桁に丸める）
    frameData: analysis.frameData.map((d) => ({
      energy: Math.round(d.energy * 100) / 100,
      bass: Math.round(d.bass * 100) / 100,
      mid: Math.round(d.mid * 100) / 100,
      high: Math.round(d.high * 100) / 100,
      onset: Math.round(d.onset * 100) / 100,
    })),
  };

  const propsFile = path.join(outDir, `${job.id}_props.json`);
  await fs.writeFile(propsFile, JSON.stringify(propsObj), "utf-8");

  console.log(`[Render ${job.id}] レンダリング開始...`);

  // 非同期 exec でレンダリング（イベントループをブロックしない）
  // --concurrency=2: メモリ使用量を抑制（Page crashed対策）
  const cmd = `npx remotion render src/index.ts BeatSyncVideo "${outputPath}" --props="${propsFile}" --concurrency=2 --log=warn`;
  console.log(`[Render ${job.id}] exec: ${cmd}`);

  await new Promise<void>((resolve, reject) => {
    const child = exec(cmd, { timeout: 15 * 60 * 1000 }, (err, _stdout, stderr) => {
      if (err) {
        reject(new Error(stderr || err.message));
      } else {
        resolve();
      }
    });

    // stderrから進捗をパース
    child.stderr?.on("data", (data: string) => {
      // Remotion出力からフレーム進捗を抽出 (例: "Rendering frame 150/4500")
      const match = data.match(/(\d+)\s*\/\s*(\d+)/);
      if (match) {
        const current = parseInt(match[1], 10);
        const total = parseInt(match[2], 10);
        if (total > 0) {
          job.progress = Math.round((current / total) * 100);
        }
      }
    });
  });

  job.status = "done";
  job.progress = 100;
  job.outputPath = outputPath;
  console.log(`[Render ${job.id}] レンダリング完了: ${outputPath}`);

  // 一時ファイルをクリーンアップ
  await fs.unlink(musicDest).catch(() => {});
  await fs.unlink(characterDest).catch(() => {});
  await fs.unlink(propsFile).catch(() => {});
}
