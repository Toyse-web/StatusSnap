require("dotenv").config();
const express = require("express");
const multer = require("multer");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegInstaller = require("@ffmpeg-installer/ffmpeg");
const path = require("path");
const fs = require("fs");
const fsp = require("fs").promises;

// Use static FFmpeg binary (works on Render)
ffmpeg.setFfmpegPath(ffmpegInstaller.path);
console.log("Using ffmpeg binary:", ffmpegInstaller.path);

const app = express();
const PORT = process.env.PORT || 3000;

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// Multer setup
const upload = multer({
  dest: "/tmp/",
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB max
});

// Root route
app.get("/", (req, res) => {
  res.render("index", { message: null, downloadUrl: null });
});

// Process video (optimized for WhatsApp)
const crypto = require("crypto");

app.post("/process-video", upload.single("video"), async (req, res) => {
  if (!req.file) {
    return res.render("index", { message: "Please upload a video!", downloadUrl: null });
  }

  const inputPath = req.file.path;
  const baseName = `StatusSnap-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
  const tempPath = path.join("/tmp", "temp-" + baseName + ".mp4");   // encode -> temp mp4
  const finalPath = path.join("/tmp", baseName + ".mp4");           // remuxed final mp4
  const logFile = "/tmp/ffmpeg-debug.log";

  try {
    // sanity check uploaded file
    const inputStats = await fsp.stat(inputPath).catch(() => null);
    if (!inputStats || inputStats.size === 0) {
      throw new Error("Uploaded file is empty or missing");
    }

    // remove any previous debug log
    try { await fsp.unlink(logFile).catch(() => {}); } catch(e){}

    // 1) Encode into a temp MP4 (explicit MP4 container)
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
          "-tune", "film",
          "-fflags", "+genpts",
          "-avoid_negative_ts", "make_zero",
          "-max_muxing_queue_size", "1024",
          "-map", "0:v:0",
          "-map", "0:a:0?",
          "-shortest"
        ])
        .format("mp4")               // <<< important: encode to MP4 container
        .fps(30)
        .on("start", cmd => console.log("FFmpeg encode started:", cmd))
        .on("stderr", line => fs.appendFileSync(logFile, "[encode] " + line + "\n"))
        .on("end", () => {
          console.log("FFmpeg encode completed ->", tempPath);
          resolve();
        })
        .on("error", err => {
          console.error("FFmpeg encode error:", err);
          reject(err);
        })
        .save(tempPath);
    });

    // check temp output
    const tempStats = await fsp.stat(tempPath).catch(() => null);
    if (!tempStats || tempStats.size < 1000) throw new Error("Temp encoded file missing or too small");

    // 2) Remux copy to final MP4 forcing movflags +faststart to ensure moov atom at start
    await new Promise((resolve, reject) => {
      // Use copying (no re-encode) to avoid heavy CPU; this step fixes container atoms
      ffmpeg(tempPath)
        .outputOptions([
          "-c", "copy",
          "-movflags", "+faststart"   // ensure moov atom at start
        ])
        .format("mp4")
        .on("start", cmd => console.log("FFmpeg remux started:", cmd))
        .on("stderr", line => fs.appendFileSync(logFile, "[remux] " + line + "\n"))
        .on("end", () => {
          console.log("FFmpeg remux completed ->", finalPath);
          resolve();
        })
        .on("error", err => {
          console.error("FFmpeg remux error:", err);
          reject(err);
        })
        .save(finalPath);
    });

    // final check
    const finalStats = await fsp.stat(finalPath).catch(() => null);
    if (!finalStats || finalStats.size < 1000) throw new Error("Final file missing or invalid");

    // optional: probe final file (logs result for debugging)
    try {
      ffmpeg.ffprobe(finalPath, (err, meta) => {
        if (err) console.error("ffprobe error:", err);
        else console.log("ffprobe final file streams:", meta.streams.map(s => `${s.codec_type}:${s.codec_name}:${s.width || s.channels}`));
      });
    } catch(e){ console.warn("ffprobe thrown", e); }

    // Serve final file for download (filename ends with .mp4)
    res.download(finalPath, `${baseName}.mp4`, async (err) => {
      // cleanup: remove temp and uploaded files
      await fsp.unlink(inputPath).catch(() => {});
      await fsp.unlink(tempPath).catch(() => {});
      await fsp.unlink(finalPath).catch(() => {});
      if (err) console.error("Download error:", err);
    });

  } catch (err) {
    console.error("Processing error:", err);

    // dump ffmpeg debug log to console to inspect
    const debug = await fsp.readFile(logFile, "utf8").catch(() => "No log found");
    console.log("==== FULL FFmpeg LOG START ====");
    console.log(debug);
    console.log("==== FULL FFmpeg LOG END ====");

    // cleanup
    await fsp.unlink(inputPath).catch(() => {});
    await fsp.unlink(tempPath).catch(() => {});
    await fsp.unlink(finalPath).catch(() => {});

    return res.render("index", {
      message: "Error processing video. Please try a different file.",
      downloadUrl: null
    });
  }
});


// Test FFmpeg route
app.get("/test-ffmpeg", (req, res) => {
  ffmpeg.getAvailableCodecs((err, codecs) => {
    if (err) return res.send("FFmpeg error: " + err.message);
    res.send(`FFmpeg OK! Available codecs: ${Object.keys(codecs).length}`);
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
