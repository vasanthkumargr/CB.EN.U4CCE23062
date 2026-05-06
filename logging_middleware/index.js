require('dotenv').config();
const axios = require('axios');

const AUTH_TOKEN = process.env.AUTH_TOKEN;
const TEST_SERVER_URL = "http://20.207.122.201/evaluation-service";

async function log(stack, level, packageName, message) {
  try {
    const response = await axios.post(
      `${TEST_SERVER_URL}/logs`,
      { stack, level, package: packageName, message },
      {
        headers: {
          Authorization: `Bearer ${AUTH_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log("Log sent:", response.data);
    return response.data;
  } catch (err) {
    console.error("Log failed:", err.message);
    return null;
  }
}

module.exports = { log };