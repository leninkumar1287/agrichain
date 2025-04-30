const { Media } = require('../models');
const path = require('path');
const fs = require('fs').promises;

class MediaService {
  async uploadMedia(file, requestId) {
    try {
      // In production, you would upload to a cloud storage service
      // For now, we'll just move the file to the uploads directory
      const uploadDir = path.join(__dirname, '../uploads');
      await fs.mkdir(uploadDir, { recursive: true });

      const fileName = `${Date.now()}-${file.originalname}`;
      const filePath = path.join(uploadDir, fileName);

      await fs.writeFile(filePath, file.buffer);

      // Create media record
      const media = await Media.create({
        type: file.mimetype.startsWith('image/') ? 'image' : 'video',
        url: `/uploads/${fileName}`,
        hash: fileName, // In production, use IPFS hash
        requestId
      });

      return media;
    } catch (error) {
      throw new Error(`Error uploading media: ${error.message}`);
    }
  }

  async getMediaByRequest(requestId) {
    try {
      return await Media.findAll({
        where: { requestId }
      });
    } catch (error) {
      throw new Error(`Error fetching media: ${error.message}`);
    }
  }

  async deleteMedia(mediaId) {
    try {
      const media = await Media.findByPk(mediaId);
      if (!media) {
        throw new Error('Media not found');
      }

      // Delete file from storage
      const filePath = path.join(__dirname, '..', media.url);
      await fs.unlink(filePath).catch(() => {}); // Ignore error if file doesn't exist

      // Delete media record
      await media.destroy();

      return { message: 'Media deleted successfully' };
    } catch (error) {
      throw new Error(`Error deleting media: ${error.message}`);
    }
  }

  async updateMedia(mediaId, updateData) {
    try {
      const media = await Media.findByPk(mediaId);
      if (!media) {
        throw new Error('Media not found');
      }

      await media.update(updateData);
      return media;
    } catch (error) {
      throw new Error(`Error updating media: ${error.message}`);
    }
  }
}

module.exports = new MediaService(); 