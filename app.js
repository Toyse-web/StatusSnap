require("dotenv").config();
const express = require("express");
const multer = require("multer");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegInstaller = require("@ffmpeg-installer/ffmpeg");
const path = require("path");
const fs = require("fs");
const fsp = require("fs").promises;
const crypto = require("crypto");

ffmpeg.setFfmpegPath(ffmpegInstaller.path);
console.log("Using ffmpeg binary:", ffmpegInstaller.path);

const app = express();
const PORT = process.env.PORT || 3000;

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// Ensure directories exist
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// Multer setup (temporary upload location)
const upload = multer({
  dest: "/tmp/",
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
});

// Root page
app.get("/", (req, res) => {
  res.render("index", { message: null, downloadUrl: null });
});

app.post("/process-video", upload.single("video"), async (req, res) => {
  if (!req.file) {
    return res.render("index", { message: "Please upload a video!", downloadUrl: null });
  }

  const inputPath = req.file.path;
  const baseName = `StatusSnap-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
  const tempPath = path.join(uploadsDir, "temp-" + baseName + ".mp4");
  const finalPath = path.join(uploadsDir, baseName + ".mp4");
  const logFile = path.join(uploadsDir, "ffmpeg-debug.log");

  try {
    const inputStats = await fsp.stat(inputPath);
    if (!inputStats || inputStats.size === 0) throw new Error("Uploaded file is empty");

    // Step 1: Encode (safe H.264 baseline)
    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .duration(90)
        .videoFilters("scale=-2:720:flags=lanczos,setsar=1")
        .outputOptions([
          "-r", "30",
          "-c:v", "libx264",
          "-profile:v", "baseline",
          "-level", "3.0",
          "-pix_fmt", "yuv420p",
          "-b:v", "1500k",
          "-maxrate", "1500k",
          "-bufsize", "3000k",
          "-c:a", "aac",
          "-ac", "2",
          "-ar", "44100",
          "-b:a", "96k",
          "-preset", "veryfast",
          "-movflags", "+faststart",
          "-tune", "film",
          "-shortest",
          "-avoid_negative_ts", "make_zero"
        ])
        .format("mp4")
        .fps(30)
        .on("start", cmd => console.log("FFmpeg started:", cmd))
        .on("stderr", line => fs.appendFileSync(logFile, line + "\n"))
        .on("end", () => {
          console.log("FFmpeg processing completed ->", tempPath);
          resolve();
        })
        .on("error", err => reject(err))
        .save(tempPath);
    });

    // Step 2: Move final file to safe location
    await fsp.rename(tempPath, finalPath);

    // Step 3: Respond with a download link
    res.download(finalPath, path.basename(finalPath), async (err) => {
      if (err) console.error("Download error:", err);
      await fsp.unlink(inputPath).catch(() => {});
      // Delay cleanup to ensure browser fully downloads before deletion
      setTimeout(() => fsp.unlink(finalPath).catch(() => {}), 10000);
    });

  } catch (err) {
    console.error("Processing error:", err);
    const debug = await fsp.readFile(logFile, "utf8").catch(() => "No log found");
    console.log("==== FFmpeg LOG START ====\n" + debug + "\n==== LOG END ====");

    await fsp.unlink(inputPath).catch(() => {});
    await fsp.unlink(tempPath).catch(() => {});
    await fsp.unlink(finalPath).catch(() => {});

    res.render("index", {
      message: "Error processing video. Please try again.",
      downloadUrl: null
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
