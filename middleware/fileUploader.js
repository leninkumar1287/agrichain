const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// For checkpoint media
const checkpointStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/checkpoint-media/');
    },
    filename: (req, file, cb) => {
        cb(null, uuidv4() + path.extname(file.originalname));
    }
});

// For common media
const commonStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/common-media/');
    },
    filename: (req, file, cb) => {
        cb(null, uuidv4() + path.extname(file.originalname));
    }
});

const uploadCheckpoint = multer({ storage: checkpointStorage });
const uploadCommon = multer({ storage: commonStorage });

module.exports = { uploadCheckpoint, uploadCommon };
