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

    try {
        // Process video to memory buffer instead of disk
        const videoBuffer = await new Promise((resolve, reject) => {
            const chunks = [];

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
                
                if (req.body.resolution === "status") {
                    // This will scale to fit within 480x854 but maintain aspect ratio
                    command = command.size('480x854');
                } else {
                    // Keep original size but ensure compatibility
                    command = command.videoFilters([
                        "scale=trunc(iw/2)*2:trunc(ih/2)*2"
                    ]);
                }

                command
                    .on("start", (cmd) => console.log("FFmpeg started:", cmd))
                    .on("end", () => {
                        console.log("FFmpeg processing completed");
                        resolve(Buffer.concat(chunks));
                    })
                    .on("error", (err) => {
                        console.log("FFmpeg error:", err);
                        reject(err);
                    })
                    .pipe();

                    // Collect the output chunks
                    command.on("data", (chunk) => chunks.push(chunk));
                });

                // Delete input file immediatly after processing
                await fsp.unlink(inputPath).catch(err => console.error("Input cleanup error:", err));

                // Send success response with download
                res.set({
                    "Content-Type": "video/mp4",
                    "Content-Disposition": `attachment; filename="${outputFilename}"`,
                    "Content-Length": videoBuffer.length
                });

                res.render("index", {
                    message: "Video processed successfully! Download will start automatically.",
                    downloadUrl: null,
                    outputFilename: outputFilename
                });

                // Send the video buffer
                res.send(videoBuffer);

    } catch (err) {
        console.error("Processing error:", err);
        // Clean up input file on error
        await fsp.unlink(inputPath).catch(cleanupErr => 
            console.error("Cleanup error:", cleanupErr)
        );
        res.render("index", {
            message: "Error processing video. Please try a different file.",
            downloadUrl: null,
            outputFilename: outputFilename
        });
    }
});

app.get("/test-ffmpeg", (req, res) => {
    ffmpeg.getAvailableCodecs((err, codecs) => {
        if (err) return res.send("FFmpeg error: " + err.message);
        res.send(`FFmpeg is working! Available codecs: ${Object.keys(codecs).length}`);
    });
});

// app.get("/download/:filename", async (req, res) => {
//     const filePath = path.join(__dirname, "output", req.params.filename);
//     try {
//         await fsp.access(filePath);
//         res.download(filePath, req.params.filename, { headers: { "Content-Type": "video/mp4" } }, err => {
//             if (!err) {
//                 // Delete after 30 seconds
//                 setTimeout(() => {
//                     fsp.unlink(filePath).catch(err => console.error("Cleanup error:", err));
//                 }, 30000);
//             }
//         });
//     } catch (err) {
//         console.error("File not found for download:", err);
//         res.status(404).send("File not found");
//     }
// });

app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
