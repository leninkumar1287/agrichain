// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract OrganicCertification {
    struct CertificationRequest {
        address farmer;
        string productName;
        string description;
        string[] mediaHashes;
        bool isInspected;
        bool isApproved;
        bool isCertified;
        address inspector;
        address certifier;
        uint256 timestamp;
    }

    mapping(uint256 => CertificationRequest) public certificationRequests;
    uint256 public requestCount;
    
    event RequestCreated(uint256 indexed  address indexed farmer, string productName);
    event RequestInspected(uint256 indexed  address indexed inspector, bool approved);
    event CertificateIssued(uint256 indexed  address indexed certifier);
    event RequestReverted(uint256 indexed  address indexed farmer);

    function createRequest(
        string memory _productName,
        string memory _description,
        string[] memory _mediaHashes
    ) public {
        uint256 requestId = requestCount++;
        certificationRequests[requestId] = CertificationRequest({
            farmer: msg.sender,
            productName: _productName,
            description: _description,
            mediaHashes: _mediaHashes,
            isInspected: false,
            isApproved: false,
            isCertified: false,
            inspector: address(0),
            certifier: address(0),
            timestamp: block.timestamp
        });
        
        emit RequestCreated( msg.sender, _productName);
    }

    function inspectRequest(uint256 _requestId, bool _approved) public {
        require(!certificationRequests[_requestId].isInspected, "Request already inspected");
        certificationRequests[_requestId].isInspected = true;
        certificationRequests[_requestId].isApproved = _approved;
        certificationRequests[_requestId].inspector = msg.sender;
        
        emit RequestInspected(_requestId, msg.sender, _approved);
    }

    function issueCertificate(uint256 _requestId) public {
        require(certificationRequests[_requestId].isInspected, "Request not inspected");
        require(certificationRequests[_requestId].isApproved, "Request not approved");
        require(!certificationRequests[_requestId].isCertified, "Already certified");
        
        certificationRequests[_requestId].isCertified = true;
        certificationRequests[_requestId].certifier = msg.sender;
        
        emit CertificateIssued(_requestId, msg.sender);
    }

    function getRequest(uint256 _requestId) public view returns (
        address farmer,
        string memory productName,
        string memory description,
        string[] memory mediaHashes,
        bool isInspected,
        bool isApproved,
        bool isCertified,
        address inspector,
        address certifier,
        uint256 timestamp
    ) {
        CertificationRequest memory request = certificationRequests[_requestId];
        return (
            request.farmer,
            request.productName,
            request.description,
            request.mediaHashes,
            request.isInspected,
            request.isApproved,
            request.isCertified,
            request.inspector,
            request.certifier,
            request.timestamp
        );
    }

    function revertRequest(uint256 _requestId) public {
        require(certificationRequests[_requestId].farmer == msg.sender, "Only the farmer can revert");
        require(!certificationRequests[_requestId].isCertified, "Cannot revert a certified request");
        delete certificationRequests[_requestId];
        emit RequestReverted(_requestId, msg.sender);
    }
} 