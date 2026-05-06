require('dotenv').config();
const axios = require('axios');
const { log } = require('../logging_middleware');

const AUTH_TOKEN = process.env.AUTH_TOKEN;
const TEST_SERVER_URL = process.env.TS_URL;

const weights = {
  Placement: 3,
  Result: 2,
  Event: 1
};

async function getTopNotifications(n = 10) {
  await log("backend", "info", "service", "fetching notifications for priority inbox");

  try {
    const res = await axios.get(`${TEST_SERVER_URL}/notifications`, {
      headers: { Authorization: `Bearer ${AUTH_TOKEN}` }
    });

    const notifs = res.data.notifications;
    await log("backend", "info", "service", `got ${notifs.length} notifications from api`);

    const now = new Date();

    const scored = notifs.map(n => {
      const w = weights[n.Type] ?? 1;
      const hoursAgo = (now - new Date(n.Timestamp)) / (1000 * 60 * 60);
      const score = w * (1 / (hoursAgo + 0.01));
      return { ...n, score: parseFloat(score.toFixed(4)) };
    });

    scored.sort((a, b) => b.score - a.score);

    const top = scored.slice(0, n);

    await log("backend", "info", "service", `top ${n} notifications computed successfully`);

    console.log(`\ntop ${n} priority Notifications\n`);
    top.forEach((item, i) => {
      console.log(`${i + 1}. [${item.Type}] ${item.Message}`);
      console.log(`   Score: ${item.score} | Time: ${item.Timestamp}\n`);
    });

    return top;

  } catch (err) {
    await log("backend", "error", "service", `failed to compute priority inbox: ${err.message}`);
    console.error("error:", err.message);
  }
}

getTopNotifications(10);