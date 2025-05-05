const { CertificationRequest, Media, Checkpoint, User } = require('../models');
const blockchainService = require('./blockchain');

class CertificationService {
  async createRequest(data, userId, mediaFiles) {
    try {
      // Create certification request
      const request = await CertificationRequest.create({
        productName: data.productName,
        description: data.description,
        farmerId: userId,
        status: 'pending'
      });

      // Handle checkpoints
      const checkpoints = JSON.parse(data.checkpoints || '[]');
      for (const cp of checkpoints) {
        let mediaFile = mediaFiles.find(f => f.fieldname === `checkpointMedia_${cp.id}`);
        let mediaUrl = mediaFile ? `/uploads/${mediaFile.filename}` : null;
        await Checkpoint.create({
          requestId: request.requestId,
          checkpointId: cp.id,
          answer: cp.answer,
          mediaUrl
        });
      }

      // Handle media files
      const mediaHashes = [];
      for (const file of mediaFiles) {
        const media = await Media.create({
          type: file.mimetype.startsWith('image/') ? 'image' : 'video',
          url: `/uploads/${file.filename}`,
          hash: file.filename, // In production, use IPFS hash
          requestId: request.requestId
        });
        mediaHashes.push(media.hash);
      }

      // Create request on blockchain
      const blockchainResult = await blockchainService.createCertificationRequest(
        data.requestId,
        data.productName,
        data.description,
        mediaHashes
      );

      // Update request with blockchain ID and transaction hash
      await request.update({
        blockchainTransactionHash: blockchainResult.transactionHash,
        blockchainRequestId: blockchainResult.requestId
      });

      return { 
        request, 
        blockchainResult,
        blockchainRequestId: blockchainResult.requestId 
      };
    } catch (error) {
      throw new Error(`Error creating certification request: ${error.message}`);
    }
  }

  async getFarmerRequests(userId) {
    try {
      return await CertificationRequest.findAll({
        where: { farmerId: userId },
        include: [
          { model: Media },
          { model: User, as: 'inspector' },
          { model: User, as: 'certifier' }
        ]
      });
    } catch (error) {
      throw new Error(`Error fetching farmer requests: ${error.message}`);
    }
  }

  async getInspectionRequests() {
    try {
      return await CertificationRequest.findAll({
        where: { status: 'pending' },
        include: [
          { model: Media },
          { model: User, as: 'farmer' }
        ]
      });
    } catch (error) {
      throw new Error(`Error fetching inspection requests: ${error.message}`);
    }
  }

  async inspectRequest( approved, inspectorId) {
    try {
      const request = await CertificationRequest.findByPk(requestId);
      if (!request) throw new Error('Request not found');
      if (request.status !== 'pending') throw new Error('Request already inspected');

      // Update blockchain
      await blockchainService.inspectRequest(request.blockchainTransactionHash, approved);

      // Update database
      await request.update({
        status: approved ? 'approved' : 'rejected',
        inspectorId
      });

      return request;
    } catch (error) {
      throw new Error(`Error inspecting request: ${error.message}`);
    }
  }

  async issueCertificate( certifierId) {
    try {
      const request = await CertificationRequest.findByPk(requestId);
      if (!request) throw new Error('Request not found');
      if (request.status !== 'approved') throw new Error('Request not approved');

      // Update blockchain
      await blockchainService.issueCertificate(request.blockchainTransactionHash);

      // Update database
      await request.update({
        status: 'certified',
        certifierId
      });

      return request;
    } catch (error) {
      throw new Error(`Error issuing certificate: ${error.message}`);
    }
  }

  async revertRequest(requestId) {
    try {
      const request = await CertificationRequest.findByPk(requestId);
      if (!request) throw new Error('Request not found');
      if (request.id !== requestId) throw new Error('Not authorized');
      if (request.status === 'certified') throw new Error('Cannot revert a certified request');

      // Update blockchain
      const blockchainResult = await blockchainService.revertRequest(request.blockchainTransactionHash);

      // Delete request
      await request.destroy();

      return { message: 'Request reverted successfully', blockchainResult };
    } catch (error) {
      throw new Error(`Error reverting request: ${error.message}`);
    }
  }

  async getRequestDetails(requestId) {
    try {
      const request = await CertificationRequest.findByPk( {
        include: [
          { model: Media },
          { model: User, as: 'farmer' },
          { model: User, as: 'inspector' },
          { model: User, as: 'certifier' },
          { model: Checkpoint }
        ]
      });

      if (!request) {
        throw new Error('Request not found');
      }

      // Format the response
      const formattedRequest = {
        id: request.requestId,
        productName: request.productName,
        description: request.description,
        status: request.status,
        createdAt: request.createdAt,
        updatedAt: request.updatedAt,
        farmer: {
          id: request.farmer?.id,
          username: request.farmer?.username,
          email: request.farmer?.email
        },
        inspector: request.inspector ? {
          id: request.inspector.id,
          username: request.inspector.username,
          email: request.inspector.email
        } : null,
        certifier: request.certifier ? {
          id: request.certifier.id,
          username: request.certifier.username,
          email: request.certifier.email
        } : null,
        checkpoints: request.Checkpoints.map(checkpoint => ({
          id: checkpoint.id,
          checkpointId: checkpoint.checkpointId,
          answer: checkpoint.answer,
          mediaUrl: checkpoint.mediaUrl,
          createdAt: checkpoint.createdAt
        })),
        media: request.Media.map(media => ({
          id: media.id,
          type: media.type,
          url: media.url,
          hash: media.hash,
          createdAt: media.createdAt
        }))
      };

      return formattedRequest;
    } catch (error) {
      throw new Error(`Error fetching request details: ${error.message}`);
    }
  }
}

module.exports = new CertificationService(); 