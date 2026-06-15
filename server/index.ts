import express from "express";
import multer from "multer";
import cors from "cors";
import path from "path";
import fs from "fs/promises";
import { startRender, getJob, getAllJobs } from "./renderer";

const app = express();
const PORT = 3456;

// ミドルウェア
app.use(cors());
app.use(express.json());

// 静的ファイル配信（WebUI）
app.use(express.static(path.resolve("server/public")));

// =============================================
// multer設定
// =============================================
const uploadDir = path.resolve("uploads");

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB制限
  fileFilter: (_req, file, cb) => {
    const allowedImages = [".png", ".svg", ".jpg", ".jpeg", ".webp"];
    const allowedAudio = [".mp3", ".wav", ".ogg", ".m4a", ".aac"];
    const ext = path.extname(file.originalname).toLowerCase();

    if (file.fieldname === "image" && allowedImages.includes(ext)) {
      cb(null, true);
    } else if (file.fieldname === "music" && allowedAudio.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${ext}`));
    }
  },
});

// =============================================
// API エンドポイント
// =============================================

/**
 * POST /api/render
 * 画像+音楽アップロード → レンダリング開始
 */
app.post(
  "/api/render",
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "music", maxCount: 1 },
  ]),
  async (req: express.Request, res: express.Response) => {
    try {
      const files = req.files as {
        image?: Express.Multer.File[];
        music?: Express.Multer.File[];
      };

      if (!files.image?.[0] || !files.music?.[0]) {
        res.status(400).json({ error: "画像と音楽ファイルが必要です" });
        return;
      }

      const body = req.body;
      const stripeColorsRaw = body.stripeColors;
      let stripeColors: [string, string] = ["#ff0066", "#00ccff"];
      if (typeof stripeColorsRaw === "string") {
        try {
          stripeColors = JSON.parse(stripeColorsRaw);
        } catch {
          // デフォルト値を使用
        }
      }

      const jobId = await startRender({
        musicFilePath: files.music[0].path,
        characterFilePath: files.image[0].path,
        animMode: body.animMode || "onset",
        stripeColors,
        stripeAngle: Number(body.stripeAngle) || 45,
        stripeWidth: Number(body.stripeWidth) || 60,
        characterColor: body.characterColor || "#ffffff",
        bounceIntensity: Number(body.bounceIntensity) || 0.5,
      });

      res.json({ id: jobId, status: "pending" });
    } catch (err: any) {
      console.error("Render error:", err);
      res.status(500).json({ error: err.message });
    }
  }
);

/**
 * GET /api/render/:id/status
 * レンダリング進捗確認
 */
app.get("/api/render/:id/status", (req: express.Request, res: express.Response) => {
  const id = req.params.id as string;
  const job = getJob(id);
  if (!job) {
    res.status(404).json({ error: "ジョブが見つかりません" });
    return;
  }
  res.json({
    id: job.id,
    status: job.status,
    progress: job.progress,
    bpm: job.bpm,
    error: job.error,
  });
});

/**
 * GET /api/render/:id/download
 * 完成したMP4をダウンロード
 */
app.get("/api/render/:id/download", (req: express.Request, res: express.Response) => {
  const id = req.params.id as string;
  const job = getJob(id);
  if (!job) {
    res.status(404).json({ error: "ジョブが見つかりません" });
    return;
  }
  if (job.status !== "done" || !job.outputPath) {
    res.status(400).json({ error: "まだレンダリングが完了していません" });
    return;
  }

  res.download(job.outputPath, `beatsync_${job.id}.mp4`, (err) => {
    if (err) {
      console.error("Download error:", err);
    }
  });
});

/**
 * GET /api/jobs
 * 全ジョブ一覧
 */
app.get("/api/jobs", (_req: express.Request, res: express.Response) => {
  res.json(getAllJobs());
});

// =============================================
// サーバー起動
// =============================================
async function main() {
  await fs.mkdir(uploadDir, { recursive: true });
  app.listen(PORT, () => {
    console.log(`\nBeat-Sync Video Server running at http://localhost:${PORT}\n`);
  });
}

main().catch(console.error);
