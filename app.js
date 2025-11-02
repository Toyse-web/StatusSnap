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
app.post("/process-video", upload.single("video"), async (req, res) => {
  if (!req.file) {
    return res.render("index", { message: "Please upload a video!", downloadUrl: null });
  }

  const inputPath = req.file.path;
  const outputFilename = `StatusSnap-${Date.now()}.mp4`;
  const outputPath = path.join("/tmp", "temp-" + outputFilename);
  const logFile = "/tmp/ffmpeg-debug.log";

  try {

    const inputStats = await fsp.stat(inputPath).catch(() => null);
    if (!inputStats || inputStats.size === 0) {
      throw new Error("Uploaded file is empty or missing in Render /tmp");
    }

    // Encode video
    await new Promise((resolve, reject) => {
    ffmpeg(inputPath)
    .duration(90)
    .outputOptions([
      "-c:v libx264",
      "-profile:v baseline",
      "-level 3.0",
      "-pix_fmt yuv420p",
      "-b:v 2500k",
      "-maxrate 2500k",
      "-bufsize 5000k",
      "-c:a aac",
      "-b:a 128k",
      "-ac 2",
      "-ar 44100",
      "movflags +faststart"
    ])
    .format("mp4")
    .fps(30)
    .videoFilters([
      "scale='min(720,iw)':-2",
      "pad=ceil(iw/2)*2:ceil(ih/2)*2"
    ])
    .on("start", cmd => console.log("FFmpeg started:", cmd))
    .on("codecData", data => console.log("Input codec info:", data))
    .on("stderr", line => {
      fs.appendFileSync(logFile, line + "\n"); // write every line
    })
    .on("end", () => {
      console.log("FFmpeg processing completed");
      resolve();
    })
    .on("error", err => {
      console.log("FFmpeg error:", err);
      reject(err);
    })
    .save(outputPath);
});

    // Verify output file
    const stats = await fsp.stat(outputPath);
    if (!stats.size || stats.size < 1000) throw new Error("Output file is empty or invalid");

    // Send processed video for download
    res.download(outputPath, outputFilename, async (err) => {
      // Cleanup both files
      await fsp.unlink(inputPath).catch(() => {});
      await fsp.unlink(outputPath).catch(() => {});
      if (err) console.error("Download error:", err);
    });

  } catch (err) {
    console.error("Processing error:", err);

    // Print FFmpeg log contents
    const debug = await fsp.readFile(logFile, "utf8").catch(() => "No log found");
    console.log("==== FULL FFmpeg LOG START ====");
    console.log(debug);
    console.log("==== FULL FFmpeg LOG END ====");

    await fsp.unlink(inputPath).catch(() => {});
    await fsp.unlink(outputPath).catch(() => {});

    res.render("index", {
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
