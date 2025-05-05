const { ethers } = require('ethers');
const { abi, address } = require('../contracts/OrganicCertification.json');

class BlockchainService {
    constructor() {
        // Connect to local Ganache
        this.provider = new ethers.JsonRpcProvider('http://127.0.0.1:7545');
        this.wallet = new ethers.Wallet(process.env.PRIVATE_KEY, this.provider);
        this.contract = new ethers.Contract(
            address,
            abi,
            this.wallet
        );
    }

    async createCertificationRequest(requestId, productName, description, mediaHashes) {
        try {
            console.log(requestId,
                productName,
                description,
                mediaHashes)
            const tx = await this.contract.createRequest(
                requestId,
                productName,
                description,
                mediaHashes
            );
            const receipt = await tx.wait();

            // Get the RequestCreated event from the logs
            const event = receipt.logs
                .map(log => {
                    try {
                        return this.contract.interface.parseLog(log);
                    } catch (e) {
                        return null;
                    }
                })
                .find(event => event && event.name === 'RequestCreated');

            return {
                requestId: requestId.toString(),
                transactionHash: receipt.hash,
                blockHash: receipt.blockHash
            };
        } catch (error) {
            console.error('Error creating certification request:', error);
            throw error;
        }
    }

    async approveRequest(requestId) {
        try {
            const tx = await this.contract.approveRequest(
                requestId
            );
            const receipt = await tx.wait();
            return {
                success: true,
                transactionHash: receipt.transactionHash,
                blockHash: receipt.blockHash
            };
        } catch (error) {
            console.error('Error inspecting request:', error);
            throw error;
        }
    }

    async markInProgress(requestId) {
        try {
            const tx = await this.contract.markInProgress(requestId);
            const receipt = await tx.wait();
            return {
                success: true,
                transactionHash: receipt.hash,
                blockHash: receipt.blockHash
            };
        } catch (error) {
            console.error('Error marking request as in progress:', error);
            throw error;
        }
    }

    async issueCertificate(requestId) {
        try {
            const tx = await this.contract.issueCertificate(requestId);
            const receipt = await tx.wait();
            return {
                success: true,
                transactionHash: receipt.transactionHash,
                blockHash: receipt.blockHash
            };
        } catch (error) {
            console.error('Error issuing certificate:', error);
            throw error;
        }
    }

    async getRequestDetails(requestId) {
        try {
            const request = await this.contract.getRequest(requestId);
            return {
                farmer: request.farmer,
                productName: request.productName,
                description: request.description,
                mediaHashes: request.mediaHashes,
                isInspected: request.isInspected,
                isApproved: request.isApproved,
                isCertified: request.isCertified,
                inspector: request.inspector,
                certifier: request.certifier,
                timestamp: request.timestamp.toString()
            };
        } catch (error) {
            console.error('Error getting request details:', error);
            throw error;
        }
    }

    async revertRequest(requestId) {
        try {
            const tx = await this.contract.revertRequest(requestId);
            const receipt = await tx.wait();
            return {
                success: true,
                transactionHash: receipt.transactionHash,
                blockHash: receipt.blockHash
            };
        } catch (error) {
            console.error('Error reverting request:', error);
            throw error;
        }
    }
}

module.exports = new BlockchainService(); 