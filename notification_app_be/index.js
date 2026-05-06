require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const { log } = require('../logging_middleware');

const app = express();
app.use(cors());
app.use(express.json());

const AUTH_TOKEN = process.env.AUTH_TOKEN;
const TEST_SERVER_URL = process.env.TS_URL;
const PORT = process.env.PORT || 3001;

// DEBUG - remove after fixing
console.log("Token:", AUTH_TOKEN ? AUTH_TOKEN.substring(0, 20) + "..." : "MISSING");
console.log("URL:", TEST_SERVER_URL);

app.get('/api/notifications', async (req, res) => {
  await log("backend", "info", "handler", "Fetching notifications");

  console.log("Calling URL:", `${TEST_SERVER_URL}/notifications`);

  try {
    const response = await axios.get(`${TEST_SERVER_URL}/notifications`, {
      headers: { 
        Authorization: `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json'
      },
      params: {
        limit: req.query.limit,
        page: req.query.page,
        notification_type: req.query.notification_type
      }
    });

    await log("backend", "info", "handler", "Notifications fetched successfully");
    res.json(response.data);

  } catch (err) {
    console.error("Status:", err.response?.status);
    console.error("Error data:", err.response?.data);
    console.error("Full error:", err.message);

    await log("backend", "error", "handler", `Failed to fetch notifications: ${err.message}`);

    res.status(500).json({ 
      error: err.response?.data || err.message,
      status: err.response?.status
    });
  }
});

app.listen(PORT, () => {
  log("backend", "info", "utils", `Server running on port ${PORT}`);
  console.log(`Server running on port ${PORT}`);
});