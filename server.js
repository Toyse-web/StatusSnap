const express = require("express");
const multer = require("multer");
const ffmpeg = require("fluent-ffmpeg");
const path = require("path");
const fs = require("fs");
const cors = require("cors");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const upload = multer({ 
    dest: "uploads/",
    limits: {
        fileSize: 500 * 1024 * 1024 // 500MB max
    }
});

// Ensure directories exist
["uploads", "optimized"].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

const cleanupFile = (filePath) => {
    if (filePath && fs.existsSync(filePath)) {
        try {
            fs.unlinkSync(filePath);
        } catch (err) {
            console.warn("Could not delete file:", filePath);
        }
    }
};

// SIMPLE & EFFECTIVE VIDEO OPTIMIZATION
app.post("/api/optimize-video", upload.single("video"), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: "No video file provided" });
    }

    const inputPath = req.file.path;
    const outputPath = path.join("optimized", `whatsapp_${Date.now()}.mp4`);
    
    const startTime = parseFloat(req.body.startTime) || 0;
    let endTime = parseFloat(req.body.endTime);

    console.log("🔄 Starting QUALITY PRESERVATION processing...");

    // Analyze the video to get original properties
    ffmpeg.ffprobe(inputPath, (err, metadata) => {
        if (err) {
            cleanupFile(inputPath);
            return res.status(500).json({ error: "Could not analyze video" });
        }

        const videoStream = metadata.streams.find(s => s.codec_type === 'video');
        const originalWidth = videoStream.width;
        const originalHeight = videoStream.height;
        
        console.log(`📊 Original Video: ${originalWidth}x${originalHeight}`);

        try {
            let command = ffmpeg(inputPath);

            // Apply trimming only
            if (startTime > 0) command = command.setStartTime(startTime);
            if (endTime && endTime > startTime) {
                command = command.duration(endTime - startTime);
            } else {
                command = command.duration(90); // WhatsApp limit
            }

            // 🎯 ULTIMATE QUALITY PRESERVATION SETTINGS
            command
                .videoCodec("libx264")
                .audioCodec("aac")
                .outputOptions([
                    // QUALITY PRESERVATION SETTINGS
                    "-preset medium", // Good balance of speed/quality
                    "-crf 18", // NEAR-LOSSLESS QUALITY (18 is excellent)
                    "-maxrate 8000k", // High bitrate cap
                    "-bufsize 16000k", // Large buffer
                    "-pix_fmt yuv420p", // WhatsApp compatible
                    "-movflags +faststart", // For quick playback
                    
                    // Audio settings
                    "-b:a 192k", // High quality audio
                    "-ac 2",
                    "-ar 48000",
                    
                    // Advanced quality settings
                    "-profile:v high",
                    "-level 4.0",
                    "-x264-params",
                    "aq-mode=1:psy-rd=1.0,0.0" // Minimal processing
                ])
                // NO SCALING - PRESERVE ORIGINAL DIMENSIONS
                // Only add format conversion if needed
                .videoFilters([
                    "format=yuv420p" // Only ensure pixel format, no scaling
                ])
                .on("start", (commandLine) => {
                    console.log("🚀 FFmpeg command started - PRESERVING ORIGINAL QUALITY");
                    console.log("Command:", commandLine);
                })
                .on("progress", (progress) => {
                    console.log(`📊 Progress: ${progress.percent || 0}%`);
                })
                .on("end", () => {
                    console.log("✅ QUALITY PRESERVATION completed!");
                    
                    if (!fs.existsSync(outputPath)) {
                        cleanupFile(inputPath);
                        return res.status(500).json({ error: "Output file missing" });
                    }

                    const stats = fs.statSync(outputPath);
                    console.log(`💾 Final size: ${Math.round(stats.size / 1024 / 1024)}MB`);
                    cleanupFile(inputPath);
                    
                    res.download(outputPath, "whatsapp_original_quality.mp4", (err) => {
                        if (err) console.error("Download error:", err);
                        setTimeout(() => cleanupFile(outputPath), 30000);
                    });
                })
                .on("error", (err) => {
                    console.error("❌ Processing failed:", err);
                    cleanupFile(inputPath);
                    cleanupFile(outputPath);
                    res.status(500).json({ 
                        error: "Video processing failed",
                        details: err.message
                    });
                })
                .save(outputPath);

        } catch (error) {
            cleanupFile(inputPath);
            res.status(500).json({ error: error.message });
        }
    });
});

// Test endpoint
app.get("/api/test", (req, res) => {
    res.json({ 
        status: "QUALITY PRESERVATION Optimizer Running",
        features: ["Original Quality Preservation", "No Scaling", "Crystal Clear Output"],
        timestamp: new Date().toISOString()
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 QUALITY PRESERVATION WhatsApp Optimizer running on port ${PORT}`);
    console.log(`🎯 Features: Original Quality | No Scaling | Crystal Clear`);
});