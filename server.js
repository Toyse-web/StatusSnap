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

// Simple storage configuration
const upload = multer({ 
    dest: "uploads/",
    limits: {
        fileSize: 100 * 1024 * 1024 // 100MB max
    }
});

// Ensure directories exist
["uploads", "optimized"].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// Cleanup function
const cleanupFile = (filePath) => {
    if (filePath && fs.existsSync(filePath)) {
        try {
            fs.unlinkSync(filePath);
        } catch (err) {
            console.warn("Could not delete file:", filePath);
        }
    }
};

app.post("/api/optimize-video", upload.single("video"), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: "No video file provided" });
    }

    const inputPath = req.file.path;
    const outputPath = path.join("optimized", `whatsapp_${Date.now()}.mp4`);
    
    const quality = req.body.quality || "balanced";
    const startTime = parseFloat(req.body.startTime) || 0;
    let endTime = parseFloat(req.body.endTime);

    // First, analyze the video to detect if it's a screen recording
    ffmpeg.ffprobe(inputPath, (err, metadata) => {
        if (err) {
            cleanupFile(inputPath);
            return res.status(500).json({ error: "Could not analyze video" });
        }

        const videoStream = metadata.streams.find(s => s.codec_type === 'video');
        const audioStream = metadata.streams.find(s => s.codec_type === 'audio');
        
        if (!videoStream) {
            cleanupFile(inputPath);
            return res.status(400).json({ error: "No video stream found" });
        }

        const originalWidth = videoStream.width;
        const originalHeight = videoStream.height;
        const frameRate = eval(videoStream.r_frame_rate); // Convert fraction to number
        const bitrate = metadata.format.bit_rate;
        
        // Detect if it's likely a screen recording
        const isScreenRecording = detectScreenRecording(videoStream, metadata);
        
        console.log(`Video Analysis:`);
        console.log(`   Dimensions: ${originalWidth}x${originalHeight}`);
        console.log(`   Frame Rate: ${frameRate}fps`);
        console.log(`   Bitrate: ${bitrate ? Math.round(bitrate/1000) + 'kbps' : 'unknown'}`);
        console.log(`   Screen Recording: ${isScreenRecording ? 'YES' : 'NO'}`);

        const qualitySettings = {
            high: { videoBitrate: "4000k", audioBitrate: "192k", crf: 21 },
            balanced: { videoBitrate: "2500k", audioBitrate: "128k", crf: 23 },
            small: { videoBitrate: "1500k", audioBitrate: "96k", crf: 25 }
        };

        const settings = qualitySettings[quality] || qualitySettings.balanced;

        try {
            let command = ffmpeg(inputPath);

            // Apply trimming
            if (startTime > 0) command = command.setStartTime(startTime);
            if (endTime && endTime > startTime) {
                command = command.duration(endTime - startTime);
            } else {
                command = command.duration(90);
            }

            // Build output options based on video type
            const outputOptions = [
                "-pix_fmt yuv420p",
                "-movflags +faststart",
                `-b:a ${settings.audioBitrate}`,
                "-ac 2",
                "-ar 48000"
            ];

            const videoFilters = [];

            if (isScreenRecording) {
                // SPECIAL PROCESSING FOR SCREEN RECORDINGS
                console.log("Using screen recording optimization");
                
                outputOptions.push(
                    "-preset slower", // Slower preset for better compression
                    `-crf ${Math.max(18, settings.crf - 3)}`, // Lower CRF for screen content
                    `-maxrate ${settings.videoBitrate}`,
                    "-bufsize 8000k",
                    "-profile:v high",
                    "-level 4.0",
                    // Screen recording specific options
                    "-x264-params",
                    "aq-mode=3:deblock=1,1:psy-rd=1.0,0.15" // Better for text/graphics
                );

                // For screen recordings, preserve original dimensions if they're reasonable
                let targetWidth = originalWidth;
                let targetHeight = originalHeight;

                // Only scale down if necessary, never scale up
                if (originalWidth > 1080 || originalHeight > 1920) {
                    const scaleRatio = Math.min(1080 / originalWidth, 1920 / originalHeight);
                    targetWidth = Math.round(originalWidth * scaleRatio);
                    targetHeight = Math.round(originalHeight * scaleRatio);
                    
                    // Ensure even dimensions
                    targetWidth = targetWidth % 2 === 0 ? targetWidth : targetWidth - 1;
                    targetHeight = targetHeight % 2 === 0 ? targetHeight : targetHeight - 1;
                    
                    videoFilters.push(`scale=${targetWidth}:${targetHeight}:flags=lanczos`);
                } else {
                    // Keep original dimensions
                    console.log(`Keeping original dimensions: ${targetWidth}x${targetHeight}`);
                }

                // Add sharpening for screen content (text, UI elements)
                videoFilters.push("unsharp=3:3:0.5");

            } else {
                // NORMAL PROCESSING FOR CAMERA VIDEOS
                console.log("Using camera video optimization");
                
                outputOptions.push(
                    "-preset medium",
                    `-crf ${settings.crf}`,
                    `-maxrate ${settings.videoBitrate}`,
                    "-bufsize 6000k"
                );

                // For camera videos, use standard WhatsApp-friendly dimensions
                videoFilters.push(
                    "scale=1080:1920:force_original_aspect_ratio=decrease:flags=lanczos",
                    "pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black"
                );
            }

            videoFilters.push("format=yuv420p");

            command
                .videoCodec("libx264")
                .audioCodec("aac")
                .outputOptions(outputOptions)
                .videoFilters(videoFilters)
                .on("start", (commandLine) => {
                    console.log("FFmpeg command started for", isScreenRecording ? "screen recording" : "camera video");
                })
                .on("progress", (progress) => {
                    console.log(`Progress: ${progress.percent || 0}%`);
                })
                .on("end", () => {
                    console.log("Processing completed!");
                    cleanupFile(inputPath);
                    
                    const stats = fs.statSync(outputPath);
                    console.log(`Final size: ${Math.round(stats.size / 1024 / 1024)}MB`);
                    
                    res.download(outputPath, "whatsapp_status.mp4", (err) => {
                        setTimeout(() => cleanupFile(outputPath), 30000);
                    });
                })
                .on("error", (err) => {
                    console.error("Processing error:", err);
                    cleanupFile(inputPath);
                    cleanupFile(outputPath);
                    res.status(500).json({ error: err.message });
                })
                .save(outputPath);

        } catch (error) {
            cleanupFile(inputPath);
            res.status(500).json({ error: error.message });
        }
    });
});

// Function to detect screen recordings
function detectScreenRecording(videoStream, metadata) {
    const originalWidth = videoStream.width;
    const originalHeight = videoStream.height;
    const frameRate = eval(videoStream.r_frame_rate);
    const bitrate = metadata.format.bit_rate;
    
    // Screen recording indicators:
    let score = 0;
    
    // Common screen recording dimensions
    const commonScreenResolutions = [
        [1080, 1920], [1080, 2340], [1440, 2560], [1440, 3040],
        [720, 1280], [720, 1560], [1125, 2436], [1170, 2532]
    ];
    
    // Check if dimensions match common screen recording sizes
    const isCommonResolution = commonScreenResolutions.some(([w, h]) => 
        Math.abs(originalWidth - w) <= 10 && Math.abs(originalHeight - h) <= 10
    );
    
    if (isCommonResolution) score += 2;
    
    // High frame rate (screen recordings often 60fps+)
    if (frameRate >= 55) score += 1;
    
    // Unusual aspect ratios (not 16:9, 4:3, etc.)
    const aspectRatio = originalWidth / originalHeight;
    const commonAspectRatios = [16/9, 4/3, 1/1, 9/16, 3/4];
    const isUnusualAspect = !commonAspectRatios.some(common => Math.abs(aspectRatio - common) < 0.1);
    if (isUnusualAspect) score += 1;
    
    // High bitrate for the resolution (screen content compresses poorly)
    if (bitrate) {
        const bitsPerPixel = bitrate / (originalWidth * originalHeight * frameRate);
        if (bitsPerPixel > 0.1) score += 1; // Higher than typical camera video
    }
    
    return score >= 2; // If 2 or more indicators, treat as screen recording
}

// Test endpoint
app.get("/api/test", (req, res) => {
    res.json({ status: "Server is running", timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`WhatsApp Video Optimizer API ready`);
});