
const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const app = express();
const PORT = 3000;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

// Project directories
const uploadDir = path.join(__dirname, "uploads");
const publicDir = path.join(__dirname, "public");

// Create folders automatically
fs.mkdirSync(uploadDir, { recursive: true });
fs.mkdirSync(publicDir, { recursive: true });

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(publicDir));

// File storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },

  filename: (req, file, cb) => {
    const uniqueId = crypto.randomUUID();
    const extension = path.extname(file.originalname).slice(0, 20);

    cb(null, `${uniqueId}${extension}`);
  },
});

// Multer configuration
const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1,
  },
});

// Validate generated filenames
function isValidStoredFilename(filename) {
  return /^[0-9a-f-]{36}(?:\.[a-zA-Z0-9]{1,20})?$/i.test(filename);
}

// Home page
app.get("/", (req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

// Upload file
app.post("/upload", (req, res) => {
  upload.single("file")(req, res, (err) => {
    if (err) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          message: "File size must be 10 MB or less.",
        });
      }

      if (err.code === "LIMIT_FILE_COUNT") {
        return res.status(400).json({
          message: "Upload one file at a time.",
        });
      }

      return res.status(400).json({
        message: err.message || "File upload failed.",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        message: "Please select a file first.",
      });
    }

    return res.status(201).json({
      message: "File uploaded successfully!",
      fileName: req.file.originalname,
      size: req.file.size,
      downloadLink: `/download/${req.file.filename}`,
    });
  });
});

// GET ALL UPLOADED FILES
app.get("/api/files", (req, res) => {
  try {
    const entries = fs.readdirSync(uploadDir, {
      withFileTypes: true,
    });

    const files = entries
      .filter((entry) => entry.isFile())
      .map((entry) => {
        const filePath = path.join(uploadDir, entry.name);
        const stats = fs.statSync(filePath);

        return {
          id: entry.name,
          name: entry.name,
          size: stats.size,
          uploadedAt: stats.mtime.toISOString(),
          downloadLink: `/download/${entry.name}`,
        };
      })
      .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));

    return res.json(files);
  } catch (err) {
    console.error("API error:", err);

    return res.status(500).json({
      message: "Could not retrieve uploaded files.",
    });
  }
});

// DOWNLOAD FILE
app.get("/download/:filename", (req, res) => {
  const filename = req.params.filename;

  if (!isValidStoredFilename(filename)) {
    return res.status(400).send("Invalid download link.");
  }

  const filePath = path.join(uploadDir, filename);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      return res.status(404).send("File not found.");
    }

    res.download(filePath, (downloadErr) => {
      if (downloadErr) {
        console.error("Download error:", downloadErr.message);

        if (!res.headersSent) {
          res.status(500).send("Could not download the file.");
        }
      }
    });
  });
});

// 404 handler — keep this AFTER all routes
app.use((req, res) => {
  res.status(404).send("Route not found.");
});

// General error handler
app.use((err, req, res, next) => {
  console.error("Server error:", err.message);

  if (res.headersSent) {
    return next(err);
  }

  res.status(500).json({
    message: "Internal server error.",
  });
});

// Start server
app.listen(PORT, () => {
  console.log("================================");
  console.log("     FILE SHARING APP");
  console.log("================================");
  console.log(`App: http://localhost:${PORT}`);
  console.log(`Upload: POST /upload`);
  console.log(`Files API: GET /api/files`);
  console.log(`Download: GET /download/:filename`);
  console.log("Maximum file size: 10 MB");
  console.log("================================");
});

