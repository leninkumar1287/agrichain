const { exec } = require('child_process');

function runCommand(command, label) {
  return new Promise((resolve, reject) => {
    const proc = exec(command);

    proc.stdout.on('data', (data) => {
      process.stdout.write(`[${label}] ${data}`);
    });

    proc.stderr.on('data', (data) => {
      process.stderr.write(`[${label} ERROR] ${data}`);
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`${label} exited with code ${code}`));
      } else {
        resolve();
      }
    });

    proc.on('error', (err) => {
      reject(err);
    });
  });
}

async function main() {
  try {
    console.log('Deploying contract...');
    await runCommand('node scripts/deploy.js', 'DEPLOY');

    console.log('Starting server...');
    await runCommand('node server.js', 'SERVER');
  } catch (error) {
    console.error('Error in main process:', error);
    process.exit(1);
  }
}

main(); 