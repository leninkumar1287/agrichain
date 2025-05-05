// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract OrganicCertification {
    enum Status { Pending, InProgress, Approved, Rejected, Certified }

    struct CertificationRequest {
        address farmer;
        string productName;
        string description;
        string[] mediaHashes;
        Status status;
        address inspector;
        address certifier;
        uint256 timestamp;
    }

    mapping(uint256 => CertificationRequest) public certificationRequests;
    uint256 public requestCount;

    event RequestCreated(uint256 indexed requestId, address indexed farmer, string productName);
    event RequestInProgress(uint256 indexed requestId, address indexed inspector);
    event RequestApproved(uint256 indexed requestId, address indexed inspector);
    event RequestRejected(uint256 indexed requestId, address indexed inspector);
    event CertificateIssued(uint256 indexed requestId, address indexed certifier);
    event RequestReverted(uint256 indexed requestId, address indexed farmer);

    function createRequest(
        uint256 requestId,
        string memory _productName,
        string memory _description,
        string[] memory _mediaHashes
    ) public {
        certificationRequests[requestId] = CertificationRequest({
            farmer: msg.sender,
            productName: _productName,
            description: _description,
            mediaHashes: _mediaHashes,
            status: Status.Pending,
            inspector: address(0),
            certifier: address(0),
            timestamp: block.timestamp
        });

        emit RequestCreated(requestId, msg.sender, _productName);
    }

    function markInProgress(uint256 _requestId) public {
        CertificationRequest storage request = certificationRequests[_requestId];
        require(request.status == Status.Pending, "Request must be pending");
        request.status = Status.InProgress;
        request.inspector = msg.sender;
        emit RequestInProgress(_requestId, msg.sender);
    }

    function approveRequest(uint256 _requestId) public {
        CertificationRequest storage request = certificationRequests[_requestId];
        require(request.status == Status.InProgress, "Request must be in progress");
        request.status = Status.Approved;
        request.inspector = msg.sender;
        emit RequestApproved(_requestId, msg.sender);
    }

    function rejectRequest(uint256 _requestId) public {
        CertificationRequest storage request = certificationRequests[_requestId];
        require(request.status == Status.InProgress, "Request must be in progress");
        request.status = Status.Rejected;
        request.inspector = msg.sender;
        emit RequestRejected(_requestId, msg.sender);
    }

    function issueCertificate(uint256 _requestId) public {
        CertificationRequest storage request = certificationRequests[_requestId];
        require(request.status == Status.Approved, "Request must be approved");
        require(request.certifier == address(0), "Already certified");
        request.status = Status.Certified;
        request.certifier = msg.sender;
        emit CertificateIssued(_requestId, msg.sender);
    }

    function getRequest(uint256 _requestId) public view returns (
        address farmer,
        string memory productName,
        string memory description,
        string[] memory mediaHashes,
        Status status,
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
            request.status,
            request.inspector,
            request.certifier,
            request.timestamp
        );
    }

    function revertRequest(uint256 _requestId) public {
        CertificationRequest storage request = certificationRequests[_requestId];
        require(request.farmer == msg.sender, "Only the farmer can revert");
        require(request.status != Status.Certified, "Cannot revert a certified request");
        delete certificationRequests[_requestId];
        emit RequestReverted(_requestId, msg.sender);
    }
}