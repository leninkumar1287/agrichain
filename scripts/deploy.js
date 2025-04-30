const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
const solc = require('solc');

async function main() {
  try {
    // Connect to local Ganache
    const provider = new ethers.JsonRpcProvider('http://127.0.0.1:7545');
    
    // Get the first account from Ganache
    const accounts = await provider.listAccounts();
    console.log('Available accounts:', accounts);
    
    // Get the first account's address
    const deployerAddress = accounts[0].address;
    console.log('Deploying from account:', deployerAddress);
    
    // Create signer using the address
    const signer = await provider.getSigner(deployerAddress);

    // Read contract source
    const contractSource = fs.readFileSync(
      path.join(__dirname, '../contracts/OrganicCertification.sol'),
      'utf8'
    );

    // Compile the contract
    const input = {
      language: 'Solidity',
      sources: {
        'OrganicCertification.sol': {
          content: contractSource
        }
      },
      settings: {
        outputSelection: {
          '*': {
            '*': ['*']
          }
        },
        optimizer: {
          enabled: true,
          runs: 200
        },
        evmVersion: 'london'
      }
    };

    console.log('Compiling contract...');
    const output = JSON.parse(solc.compile(JSON.stringify(input)));
    
    if (output.errors) {
      console.error('Compilation errors:', output.errors);
      process.exit(1);
    }

    const contract = output.contracts['OrganicCertification.sol']['OrganicCertification'];
    if (!contract) {
      console.error('Contract compilation failed - no contract output');
      process.exit(1);
    }

    const bytecode = contract.evm.bytecode.object;
    const abi = contract.abi;

    // Create contract factory
    const factory = new ethers.ContractFactory(abi, bytecode, signer);
    
    console.log('Deploying contract...');
    const deployedContract = await factory.deploy();
    
    // Wait for deployment transaction to be mined
    const deployTx = deployedContract.deploymentTransaction();
    if (deployTx) {
      console.log('Deployment transaction hash:', deployTx.hash);
    }
    
    await deployedContract.waitForDeployment();
    const contractAddress = await deployedContract.getAddress();
    console.log('Contract deployed to:', contractAddress);

    // Save contract data
    const contractData = {
      address: contractAddress,
      abi: abi
    };

    fs.writeFileSync(
      path.join(__dirname, '../contracts/OrganicCertification.json'),
      JSON.stringify(contractData, null, 2)
    );

    console.log('Contract data saved to OrganicCertification.json');
  } catch (error) {
    console.error('Deployment failed with error:', error);
    
    if (error.transaction) {
      console.log('Failed transaction details:', {
        hash: error.transaction.hash,
        from: error.transaction.from,
        to: error.transaction.to,
        data: error.transaction.data,
        gasLimit: error.transaction.gasLimit?.toString()
      });
    }
    
    process.exit(1);
  }
}

main(); 