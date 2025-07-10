const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const https = require('https');
const { v4: uuid } = require('uuid');
const cors = require('cors'); // ✅ CORS for frontend connection

const app = express();
const PORT = process.env.PORT || 8080; // ✅ Railway uses 8080

app.use(cors()); // ✅ Enable CORS
app.use(bodyParser.json());
app.use(express.static('public')); // ✅ Serves index.html from public folder

// 💤 Sleep function for delay between batches
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ✅ Check if top-up plan is available
function checkTopUpPlans(response) {
  return response.planCategories?.some(plan => plan.type === "Top-up") || false;
}

// ✅ Get recharge plans after authorization
async function getRechargePlans(mobileNumber, auth, id) {
  const options = {
    httpsAgent: new https.Agent({
      secureOptions: crypto.constants.SSL_OP_LEGACY_SERVER_CONNECT,
    }),
  };

  const response = await axios.get(
    `https://www.jio.com/api/jio-recharge-service/recharge/plans/serviceId/${mobileNumber}`,
    {
      ...options,
      headers: {
        'Host': 'www.jio.com',
        'Cookie': `JioSessionID=${id}; ssjsid=${id}; Authorization=${auth};`,
      },
    }
  );

  return checkTopUpPlans(response.data);
}

// ✅ Register session and get auth
async function register(mobileNumber, id) {
  const options = {
    httpsAgent: new https.Agent({
      secureOptions: crypto.constants.SSL_OP_LEGACY_SERVER_CONNECT,
    }),
  };

  const response = await axios.get(
    `https://www.jio.com/api/jio-recharge-service/recharge/mobility/number/${mobileNumber}`,
    {
      ...options,
      headers: {
        'Host': 'www.jio.com',
        'Cookie': `JioSessionID=${id}; ssjsid=${id};`,
      },
    }
  );

  let auth = "";
  for (let header of response.headers['set-cookie'] || []) {
    const [key, value] = header.split("=");
    if (key?.toLowerCase() === 'authorization') {
      auth = value.split(';')[0];
      break;
    }
  }

  if (!auth) throw new Error('Authorization failed');
  return await getRechargePlans(mobileNumber, auth, id);
}

// ✅ Process numbers in batches
async function processInBatches(numbers, batchSize = 20, delay = 1000) {
  const results = [];

  for (let i = 0; i < numbers.length; i += batchSize) {
    const batch = numbers.slice(i, i + batchSize);

    const batchResults = await Promise.all(batch.map(async (mobileNumber) => {
      try {
        const id = uuid();
        const isTopUpAvailable = await register(mobileNumber, id);
        return { mobileNumber, isTopUpAvailable };
      } catch (err) {
        return { mobileNumber, isTopUpAvailable: false, error: err.message };
      }
    }));

    results.push(...batchResults);

    if (i + batchSize < numbers.length) {
      await sleep(delay); // ✅ Wait before next batch
    }
  }

  return results;
}

// ✅ API endpoint to handle number list
app.post('/check-topup-bulk', async (req, res) => {
  const { mobileNumbers } = req.body;

  if (!Array.isArray(mobileNumbers) || mobileNumbers.length === 0) {
    return res.status(400).json({ error: "No mobile numbers provided." });
  }

  try {
    const results = await processInBatches(mobileNumbers, 20, 1000); // batch of 20, 1s delay
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ✅ Start the server
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
