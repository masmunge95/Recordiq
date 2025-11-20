const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Create the base uploads directory if it doesn't exist
const uploadDir = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// Create subdirectories for records and invoices
const recordUploadDir = path.join(uploadDir, 'records');
if (!fs.existsSync(recordUploadDir)) {
  fs.mkdirSync(recordUploadDir);
}

const invoiceUploadDir = path.join(uploadDir, 'invoices');
if (!fs.existsSync(invoiceUploadDir)) {
  fs.mkdirSync(invoiceUploadDir);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let dest;
    if (req.baseUrl.includes('/records')) {
      dest = recordUploadDir;
    } else if (req.baseUrl.includes('/invoices')) {
      dest = invoiceUploadDir;
    } else {
      dest = uploadDir;
    }
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({ storage });

module.exports = upload;
