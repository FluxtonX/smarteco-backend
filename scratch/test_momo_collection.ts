import { MomoService } from '../src/integrations/momo/momo.service';
import { ConfigService } from '@nestjs/config';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env from backend directory
dotenv.config({ path: path.join(__dirname, '../.env') });

async function testCollection() {
  console.log('--- TESTING MTN MOMO COLLECTION API ---');
  
  // Mock ConfigService to use the real .env values
  const configServiceMock = {
    get: (key: string) => process.env[key],
  } as any as ConfigService;

  const momoService = new MomoService(configServiceMock);

  const testParams = {
    amount: 100,
    currency: 'EUR', // Sandbox usually requires EUR
    phone: '250780000000', // Typical Rwanda test number
    externalId: 'TEST-' + Date.now(),
    payerMessage: 'Testing SmartEco Payment',
    payeeNote: 'Waste Pickup Payment',
  };

  console.log('Requesting payment with params:', testParams);

  try {
    const result = await momoService.requestToPay(
      testParams.amount,
      testParams.currency,
      testParams.phone,
      testParams.externalId,
      testParams.payerMessage,
      testParams.payeeNote
    );

    console.log('SUCCESS: Payment request initiated!');
    console.log('Reference ID:', result.referenceId);
    console.log('Status:', result.status);
    console.log('External ID:', result.externalId);

    console.log('\nWaiting 5 seconds to check status...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    const statusResult = await momoService.checkPaymentStatus(result.referenceId);
    console.log('Current Payment Status:', statusResult.status);
    console.log('Full Status Response:', JSON.stringify(statusResult, null, 2));

  } catch (error: any) {
    console.error('ERROR: Payment request failed!');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Message:', error.message);
    }
  }
}

testCollection();
