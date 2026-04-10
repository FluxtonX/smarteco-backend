import * as dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

async function checkMomoStatus(requestId: string) {
  const MOMO_BASE_URL = process.env.MOMO_BASE_URL || 'https://sandbox.momodeveloper.mtn.com';
  const MOMO_API_USER = process.env.MOMO_API_USER;
  const MOMO_API_KEY = process.env.MOMO_API_KEY;
  const MOMO_SUBSCRIPTION_KEY = process.env.MOMO_SUBSCRIPTION_KEY;

  if (!MOMO_API_USER || !MOMO_API_KEY || !MOMO_SUBSCRIPTION_KEY) {
    console.error('Missing MOMO credentials in .env');
    return;
  }

  try {
    // 1. Get Access Token
    console.log('Refreshing access token...');
    const auth = Buffer.from(`${MOMO_API_USER}:${MOMO_API_KEY}`).toString('base64');
    const tokenResponse = await axios.post(
      `${MOMO_BASE_URL}/collection/token/`,
      {},
      {
        headers: {
          Authorization: `Basic ${auth}`,
          'Ocp-Apim-Subscription-Key': MOMO_SUBSCRIPTION_KEY,
        },
      }
    );

    const accessToken = tokenResponse.data.access_token;
    console.log('Token refreshed successfully.');

    // 2. Check Status
    console.log(`Checking status for Request ID: ${requestId}...`);
    const statusResponse = await axios.get(
      `${MOMO_BASE_URL}/collection/v1_0/requesttopay/${requestId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'X-Target-Environment': 'sandbox',
          'Ocp-Apim-Subscription-Key': MOMO_SUBSCRIPTION_KEY,
        },
      }
    );

    console.log('\n--- PAYMENT STATUS RESPONSE ---');
    console.log(JSON.stringify(statusResponse.data, null, 2));
    
  } catch (error: any) {
    console.error('Error checking MoMo status:', error.response?.data || error.message);
  }
}

const requestId = '9f5dc7a9-0e5c-4948-8d19-646e7940ad8a';
checkMomoStatus(requestId);
