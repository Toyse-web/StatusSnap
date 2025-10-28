const express = require("express");
const multer = require("multer");
const ffmpeg = require("fluent-ffmpeg");
const path = require("path");
const fs = require("fs"); // Regular fs for sync operations
const fsp = require("fs").promises; // Promises version for async operations

const app = express();
const PORT = 3000;

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

    try {
        await new Promise((resolve, reject) => {
            const command = ffmpeg(inputPath)
                .duration(90)
                .videoCodec('libx264')
                .audioCodec("aac")
                .format("mp4");

                // WhatsApp HD-compatible settings
                if (resolution === 'status') {
                    command
                        .size('1080x1920?') // 9:16 aspect ratio for status
                        .videoFilter('pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black')
                        .videoBitrate('1500k')
                        .outputOption([
                            '-crf 23', //For quality and reasonable file size
                            '-preset fast', //Faster encoding
                            '-profile:v baseline', //Better compatibility
                            '-level 3.1',
                            '-movflags +faststart', //Enable streaming
                            '-maxrate 2000k',
                            '-bufsize 4000k'
                        ])
                        .audioBitrate('128k')
                        .audioChannels(2)
                        .audioFrequency(44100);
                } else {
                    // Original resolution but optimized for WhatsApp
                    command
                        .videoBitrate("1000k")
                        .outputOptions([
                            '-crf 25',
                            '-preset fast',
                            '-profile:v baseline',
                            '-level 3.1',
                            '-movflags +faststart',
                            '-maxrate 1500k',
                            '-bufsize 3000k'
                        ])
                        .audioBitrate("96k")
                        .audioChannels(2)
                        .audioFrequency(44100);
                }

            command
                .on("start", (commandLine) => {
                    console.log("FFmpeg command:", commandLine);
                })
                .on('progress', (progress) => {
                    if (progress.percent && !isNaN(progress.percent)) {
                        console.log(`Processing: ${progress.percent.toFixed(2)}% done`);
                    } else {
                        console.log('Progress: Unavailable or invalid data');
                    }
                })
                .on('end', async () => {
                    try {
                        const stats = await fsp.stat(outputPath); // Use fs.promises.stat
                        const sizeMB = stats.size / (1024 * 1024);

                        if (sizeMB > 16) { //WhatsApp has 16MB limit for statuses
                            res.render('index', {
                                message: `File size (${sizeMB.toFixed(2)}MB) is larde. WhatsApp may compress it further.`,
                                downloadUrl: `/download/${outputFilename}`
                            });
                        } else {
                            res.render('index', {
                                message: 'Video processed successfully!',
                                downloadUrl: `/download/${outputFilename}`
                            });
                        }
                        resolve();
                    } catch (err) {
                        reject(err);
                    }
                })
                .on('error', (err) => {
                    if (err.message.includes('aac')) {
                        ffmpeg(inputPath)
                            .seekInput(0)
                            .duration(90)
                            .videoCodec('libx264')
                            .videoBitrate('8000k')
                            .outputOptions(['-crf 8', '-preset slow', '-tune animation', '-profile:v high', '-maxrate 9000k', '-bufsize 18000k'])
                            .audioCodec('mp3')
                            .audioBitrate('128k')
                            .format('mp4')
                            .on('progress', (progress) => {
                                if (progress.percent && !isNaN(progress.percent)) {
                                    console.log(`Processing: ${progress.percent.toFixed(2)}% done`);
                                }
                            })
                            .on('end', resolve)
                            .on('error', reject)
                            .save(outputPath);
                    } else {
                        reject(err);
                    }
                })
                .save(outputPath);
        });

        await fsp.unlink(inputPath).catch((err) => console.error('Cleanup error:', err));
    } catch (err) {
        console.error('Processing error:', err);
        res.render('index', {
            message: 'Error processing video. Try again!',
            downloadUrl: null
        });
        await fsp.unlink(inputPath).catch((err) => console.error('Cleanup error:', err));
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

app.listen(PORT, () =>
    console.log(`Server running on port ${PORT}`)
);