const express = require('express');
const multer = require('multer');
const { google } = require('googleapis');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// Google Drive setup
const auth = new google.auth.GoogleAuth({
  keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH,
  scopes: ['https://www.googleapis.com/auth/drive'],
});

const drive = google.drive({ version: 'v3', auth });

// Upload endpoint
app.post('/apps/api/proof-upload', upload.single('screenshot'), async (req, res) => {
  try {
    const { name, orderNumber, mobile, email, notes } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ 
        success: false, 
        error: 'Please select a file to upload' 
      });
    }

    console.log(`Processing upload for order #${orderNumber}`);

    // Upload to Google Drive
    const fileMetadata = {
      name: `Payment_Proof_${orderNumber}_${Date.now()}${path.extname(file.originalname)}`,
      parents: [process.env.GOOGLE_DRIVE_FOLDER_ID],
      description: `Proof of payment for Order #${orderNumber}\nCustomer: ${name}\nEmail: ${email}\nMobile: ${mobile}\nNotes: ${notes || 'None'}`
    };

    const media = {
      mimeType: file.mimetype,
      body: require('stream').Readable.from(file.buffer)
    };

    const driveResponse = await drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: 'id,name,webViewLink,webContentLink'
    });

    console.log(`✅ File uploaded: ${driveResponse.data.name}`);

    // Make file publicly viewable
    await drive.permissions.create({
      fileId: driveResponse.data.id,
      requestBody: {
        role: 'reader',
        type: 'anyone'
      }
    });

    res.json({ 
      success: true,
      message: 'Proof uploaded successfully!',
      fileUrl: driveResponse.data.webViewLink,
      fileName: driveResponse.data.name
    });

  } catch (error) {
    console.error('❌ Upload error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to upload file' 
    });
  }
});

// Health check
app.get('/apps/api/health', (req, res) => {
  res.json({ status: 'OK', service: 'Proof Upload API' });
});

app.listen(PORT, () => {
  console.log(`🚀 Proof upload server running on port ${PORT}`);
});
