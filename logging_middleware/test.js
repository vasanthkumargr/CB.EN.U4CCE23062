require('dotenv').config();
const { log } = require('./index');

console.log("Token loaded:", process.env.AUTH_TOKEN ? "YES" : "NO - TOKEN MISSING");

async function test() {
  console.log("Sending log...");
  await log("backend", "info", "utils", "Logging middleware initialized successfully");
  console.log("Finished.");
}

test();