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
const dirs = ["uploads", "output"];
for (const dir of dirs) {
    const fullPath = path.join(__dirname, dir);
    if (!fs.existsSync(fullPath)) fs.mkdirSync(fullPath, { recursive: true });
}

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
    const outputPath = path.join(__dirname, "output", outputFilename);
    const resolution = req.body.resolution || "original";

    console.log("Processing video:", { inputPath, outputPath, resolution });

    try {
        await new Promise((resolve, reject) => {
            let command = ffmpeg(inputPath)
                .duration(90)
                .outputOptions([
        "-c:v libx264",
        "-c:a aac", 
        "-b:v 500k",
        "-crf 32",
        "-preset ultrfast",
        "-pix_fmt yuv420p",
        "-movflags +faststart"
    ])
    .fps(15); // Lower framerate

    if (resolution === "status") {
        // This will scale to fit within 480x854 but maintain aspect ratio
        command = command.size('480x854');
    } else {
        // Keep original size but ensure compatibility
        command = command.videoFilters([
            "scale=trunc(iw/2)*2:trunc(ih/2)*2"
        ]);
    }

            // Apply scaling for status format
            if (resolution === "status") {
    command = command.size('720x1280'); // Use 720p instead of 1080p
}

            command
                .format("mp4")
                .on("start", cmd => console.log("FFmpeg started:", cmd))
                .on("progress", p => {
                    if (p.percent) console.log(`${p.percent.toFixed(1)}% done`);
                })
                .on("end", async () => {
                    console.log("FFmpeg completed.");

                    try {
                        await fsp.access(outputPath);
                        const stats = await fsp.stat(outputPath);
                        if (stats.size === 0) throw new Error("Output file empty");

                        const sizeMB = stats.size / (1024 * 1024);
                        console.log(`Output size: ${sizeMB.toFixed(2)}MB`);

                        const message =
                            sizeMB > 16
                                ? `File processed (${sizeMB.toFixed(2)}MB). WhatsApp may compress it further.`
                                : "Video processed successfully!";

                        res.render("index", {
                            message,
                            downloadUrl: `/download/${outputFilename}`
                        });
                        resolve();
                    } catch (err) {
                        reject(new Error("Output file missing or corrupted: " + err.message));
                    }
                })
                .on("error", err => {
                    console.error("FFmpeg error:", err);
                    reject(err);
                })
                .save(outputPath);
        });

        // Clean up input file
        await fsp.unlink(inputPath).catch(() => {});
        console.log("Input file cleaned up");

    } catch (err) {
        console.error("Processing error:", err);
        await fsp.unlink(inputPath).catch(() => {});
        res.render("index", {
            message: "Error processing video. Please try a different file.",
            downloadUrl: null
        });
    }
});

app.get("/test-ffmpeg", (req, res) => {
    ffmpeg.getAvailableCodecs((err, codecs) => {
        if (err) return res.send("FFmpeg error: " + err.message);
        res.send(`FFmpeg is working! Available codecs: ${Object.keys(codecs).length}`);
    });
});

app.get("/download/:filename", async (req, res) => {
    const filePath = path.join(__dirname, "output", req.params.filename);
    try {
        await fsp.access(filePath);
        res.download(filePath, req.params.filename, { headers: { "Content-Type": "video/mp4" } }, err => {
            if (!err) {
                // Delete after 30 seconds
                setTimeout(() => {
                    fsp.unlink(filePath).catch(err => console.error("Cleanup error:", err));
                }, 30000);
            }
        });
    } catch (err) {
        console.error("File not found for download:", err);
        res.status(404).send("File not found");
    }
});

app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
