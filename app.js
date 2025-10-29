require("dotenv").config();
const express = require("express");
const multer = require("multer");
const ffmpeg = require("fluent-ffmpeg");
const path = require("path");
const fs = require("fs"); // Regular fs for sync operations
const fsp = require("fs").promises; // Promises version for async operations

const app = express();
const PORT = process.env.PORT || 3000;

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({extended: true}));
app.use(express.static(path.join(__dirname, "public")));

// Multer for video uploads (temp storage)
const upload = multer({ 
    dest: "uploads/",
    limits: {
        fileSize: 100 * 1024 * 1024 //100MB max
    }
});

// Ensure output directory exists
const outputDir = path.join(__dirname, "output");
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, {recursive: true});
}

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, {recursive: true});
}

app.get("/", (req, res) => {
    res.render("index", {message: null, downloadUrl: null});
});

// Process video route
app.post('/process-video', upload.single('video'), async (req, res) => {
    if (!req.file) {
        return res.render('index', { message: 'Please upload a video!', downloadUrl: null });
    }

    const inputPath = req.file.path;
    const outputFilename = `StatusSnap-${Date.now()}.mp4`;
    const outputPath = path.join(__dirname, 'output', outputFilename);
    const resolution = req.body.resolution || 'original';

    console.log('Processing video:', { inputPath, outputPath, resolution });

    try {
        await new Promise((resolve, reject) => {
            // Build the command step by step
            let command = ffmpeg(inputPath)
                .duration(89)
                .outputOptions([
                    '-c:v libx264',
                    '-c:a aac',
                    '-crf 23',
                    '-preset ultrafast',
                    '-profile:v baseline',
                    '-level 3.1',
                    '-pix_fmt yuv420p',
                    '-movflags +faststart'
                ]);

            // Add scaling filter for status resolution
            if (resolution === "status") {
                command = command.videoFilters([
                    'scale=1080:1920:force_original_aspect_ratio=decrease:force_divisible_by=2',
                    'pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black'
                ]);
            }

            // Set output format
            command = command.format('mp4');

            command
                .on("start", (commandLine) => {
                    console.log("FFmpeg command started:", commandLine);
                })
                .on('progress', (progress) => {
                    if (progress.percent && !isNaN(progress.percent)) {
                        console.log(`Processing: ${progress.percent.toFixed(2)}% done`);
                    }
                })
                .on('end', async () => {
                    console.log('FFmpeg processing completed');
                    try {
                        // Verify the output file
                        await fsp.access(outputPath);
                        const stats = await fsp.stat(outputPath);
                        
                        if (stats.size === 0) {
                            throw new Error("Output file is empty");
                        }

                        const sizeMB = stats.size / (1024 * 1024);
                        console.log(`Output file size: ${sizeMB.toFixed(2)}MB`);

                        let message;
                        if (sizeMB > 16) {
                            message = `File size (${sizeMB.toFixed(2)}MB) is large. WhatsApp may compress it further.`;
                        } else {
                            message = 'Video processed successfully!';
                        }

                        res.render('index', {
                            message: message,
                            downloadUrl: `/download/${outputFilename}`,
                            outputFilename: outputFilename
                        });
                        resolve();
                    } catch (err) {
                        console.error('File verification error:', err);
                        reject(new Error("Output file corrupted or missing"));
                    }
                })
                .on('error', (err) => {
                    console.error('FFmpeg processing error:', err);
                    reject(err);
                })
                .save(outputPath);
        });

        // Clean up input file
        await fsp.unlink(inputPath);
        console.log('Input file cleaned up');

    } catch (err) {
        console.error('Processing error:', err);
        
        // Clean up input file even on error
        await fsp.unlink(inputPath).catch(cleanupErr => 
            console.error('Cleanup error:', cleanupErr)
        );

        res.render('index', {
            message: 'Error processing video. Please try a different video.',
            downloadUrl: null,
            outputFilename: null
        });
    }
});

app.get('/download/:filename', (req, res) => {
    const filePath = path.join(__dirname, 'output', req.params.filename);
    res.download(filePath, (err) => {
        if (!err) {
            //Keep file for a while
            setTimeout(() => {
                 fsp.unlink(filePath).catch((err) => console.error('Download cleanup error:', err));
            }, 30000)
        }
    });
});

app.listen(PORT, "0.0.0.0", () => { // The 0.0.0.0 is for render
    console.log(`Server running on localhost${PORT}`)
});