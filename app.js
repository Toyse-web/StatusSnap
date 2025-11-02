require("dotenv").config();
const express = require("express");
const multer = require("multer");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegInstaller = require("@ffmpeg-installer/ffmpeg");
const path = require("path");
const fs = require("fs");
const fsp = require("fs").promises;
const cloudinary = require("cloudinary").v2;

// configure with env vars
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

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

  const localPath = req.file.path;

  try {
    // Upload & create eager (transcoded) version so result is available immediately
    const result = await cloudinary.uploader.upload(localPath, {
      resource_type: "video",
      folder: "statussnap",     // optional organizational folder
      // Eager transformations are generated during upload and returned in the result
      eager: [
        {
          // WhatsApp-friendly transformation:
          width: 720,
          crop: "limit",            // limit to 720 while preserving aspect ratio
          format: "mp4",
          video_codec: "h264",
          audio_codec: "aac",
          // quality: "auto" or "auto:best" (Cloudinary chooses optimal bitrate)
          // If you prefer fixed bitrate, you can try bit_rate: "1200k"
          quality: "auto:good"
        }
      ],
      eager_async: false, // wait for eager transform before returning (default false)
      invalidate: true
    });

    // the transformed asset (first eager) is typically in result.eager[0].secure_url
    const downloadUrl = (result.eager && result.eager[0] && result.eager[0].secure_url) || result.secure_url;

    // cleanup local file
    await fsp.unlink(localPath).catch(()=>{});

    // render page with download link (you can also redirect or return JSON)
    return res.render("index", {
      message: "Video processed successfully!",
      downloadUrl
    });

  } catch (err) {
    console.error("Cloudinary upload/transform error:", err);
    await fsp.unlink(localPath).catch(()=>{});
    return res.render("index", {
      message: "Error processing video via Cloudinary. Try again.",
      downloadUrl: null
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
