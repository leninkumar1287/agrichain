const { exec } = require('child_process');
const path = require('path');

async function deployContract() {
  return new Promise((resolve, reject) => {
    exec('node scripts/deploy.js', (error, stdout, stderr) => {
      if (error) {
        console.error('Error deploying contract:', error);
        reject(error);
        return;
      }
      console.log('Contract deployment output:', stdout);
      resolve();
    });
  });
}

async function startServer() {
  return new Promise((resolve, reject) => {
    const server = exec('node server.js', (error, stdout, stderr) => {
      if (error) {
        console.error('Error starting server:', error);
        reject(error);
        return;
      }
      console.log('Server output:', stdout);
    });

    server.stdout.on('data', (data) => {
      console.log(data);
    });

    server.stderr.on('data', (data) => {
      console.error(data);
    });

    resolve(server);
  });
}

async function main() {
  try {
    console.log('Deploying contract...');
    await deployContract();
    
    console.log('Starting server...');
    await startServer();
  } catch (error) {
    console.error('Error in main process:', error);
    process.exit(1);
  }
}

main(); 