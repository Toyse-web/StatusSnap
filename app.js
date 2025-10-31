require("dotenv").config();
const express = require("express");
const multer = require("multer");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegInstaller = require("@ffmpeg-installer/ffmpeg");
const path = require("path");
const fs = require("fs");
const fsp = require("fs").promises;

//Use static FFmpeg binary
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const app = express();
const PORT = process.env.PORT || 3000;

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// Ensure necessary folders exist
// const dirs = ["uploads", "output"];
// for (const dir of dirs) {
    const uploadsDir = path.join(__dirname, "uploads");
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const upload = multer({
    dest: "uploads/",
    limits: { fileSize: 100 * 1024 * 1024 } // 100MB max
});

app.get("/", (req, res) => {
    res.render("index", { message: null, downloadUrl: null });
});

// Process video
app.post("/process-video", upload.single("video"), async (req, res) => {
    if (!req.file) {
        return res.render("index", { message: "Please upload a video!", downloadUrl: null });
    }

    const inputPath = req.file.path;
    const outputFilename = `StatusSnap-${Date.now()}.mp4`;
    const outputPath = path.join(__dirname, "temp-" + outputFilename);

    try {

        await new Promise((resolve, reject) => {
            let command = ffmpeg(inputPath)
                .duration(90)
                .outputOptions([
  "-c:v libx264",               // H.264 video codec
  "-profile:v baseline",        // Ensures compatibility with older devices
  "-level 3.0",                 // WhatsApp-safe level
  "-pix_fmt yuv420p",           // Required pixel format
  "-b:v 1500k",                 // Video bitrate
  "-maxrate 1500k",
  "-bufsize 3000k",
  "-c:a aac",                   // AAC audio codec
  "-b:a 128k",                  // Audio bitrate
  "-movflags +faststart"        // Enables mobile streaming
])
.format("mp4")
.fps(30)

                .format("mp4")
                .fps(30); // Lower framerate
                
                if (req.body.resolution === "status") {
  command = command.videoFilters([
    "scale='min(720,iw)':-2", // Max width 720, maintain aspect ratio
    "pad=ceil(iw/2)*2:ceil(ih/2)*2" // Ensure even dimensions
  ]);
} else {
  command = command.videoFilters([
    "scale=trunc(iw/2)*2:trunc(ih/2)*2"
  ]);
}

                command
    .on("start", cmd => console.log("FFmpeg started:", cmd))
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

if (!fs.existsSync(outputPath)) {
  throw new Error("Processed video not found");
}
                 // Send the file for download
        res.download(outputPath, outputFilename, async (err) => {
            // Clean up both files regardless of success
            await fsp.unlink(inputPath).catch(() => {});
            await fsp.unlink(outputPath).catch(() => {});
            
            if (err) {
                console.error('Download error:', err);
            }
        });

    } catch (err) {
        console.error("Processing error:", err);
        // Clean up input file on error
        await fsp.unlink(inputPath).catch(() => {});
        await fsp.unlink(outputPath).catch(() => {});
        res.render("index", {
            message: "Error processing video. Please try a different file.",
            downloadUrl: null,
            outputFilename: null
        });
    }
});

app.get("/test-ffmpeg", (req, res) => {
    ffmpeg.getAvailableCodecs((err, codecs) => {
        if (err) return res.send("FFmpeg error: " + err.message);
        res.send(`FFmpeg is working! Available codecs: ${Object.keys(codecs).length}`);
    });
});

const ffmpegPath = ffmpegInstaller.path;
const ffprobe = require('ffprobe');
const ffprobeStatic = require('ffprobe-static');

const isValidVideo = async (filePath) => {
  try {
    const info = await ffprobe(filePath, { path: ffprobeStatic.path });
    return info.streams.some(s => s.codec_type === 'video');
  } catch (err) {
    return false;
  }
};


app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
});
