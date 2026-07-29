import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import axios from 'axios';
import { SortingCategory, EcoTier } from '@prisma/client';

// Simple UUID generator helper
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

async function runTests() {
  console.log('--- STARTING AI KIOSK INTEGRATION TESTS ---');

  let app: INestApplication | undefined;
  let prisma: PrismaService;
  const PORT = 3333;
  const API_URL = `http://localhost:${PORT}/api/v1`;

  // Seed Data Identifiers
  const kioskId = 'kiosk-test-device-999';
  const apiKey = 'test_kiosk_secret_api_key_xyz_123';
  const userPhone = '+250780000999';
  let userId: string;

  try {
    // 1. Bootstrap NestJS Application
    console.log('Bootstrapping NestJS Application on port', PORT);
    app = await NestFactory.create(AppModule, { logger: ['error', 'warn'] });
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );

    await app.listen(PORT);
    console.log('NestJS Application is running.');

    // 2. Setup Database Connection & Seed Data
    prisma = app.get(PrismaService);
    console.log('Seeding test Kiosk and User...');

    // Clean up any stale test data first
    await cleanup(prisma, kioskId, userPhone);

    // Create Kiosk
    const kiosk = await prisma.kiosk.create({
      data: {
        kioskId,
        name: 'Test Kiosk Depot A',
        location: 'Kigali Sector 4',
        status: 'ACTIVE',
        apiKey,
      },
    });
    console.log(`Created Test Kiosk: ${kiosk.id}`);

    // Create User (starting with 0 points)
    const user = await prisma.user.create({
      data: {
        phone: userPhone,
        email: 'kiosk.tester@smarteco.rw',
        firstName: 'Sorting',
        lastName: 'Tester',
        role: 'USER',
        referralCode: 'TESTSORT',
      },
    });
    userId = user.id;
    console.log(`Created Test User: ${user.id}`);

    // 3. RUN TEST CASES

    // --- TEST 1: Heartbeat Ingestion ---
    console.log('\n--- TEST 1: Kiosk Heartbeat ---');
    try {
      const response = await axios.post(
        `${API_URL}/kiosks/${kioskId}/heartbeat`,
        {
          status: 'online',
          appVersion: 'v1.0.0-test',
          onnxModelVersion: 'trees_v1',
          cpuLoad: 25.4,
          diskUsagePercentage: 42.1,
        },
        {
          headers: { Authorization: `Bearer ${apiKey}` },
        },
      );
      if (response.status === 200 && response.data.success) {
        console.log('✅ Test 1 Passed: Heartbeat recorded successfully.');
      } else {
        throw new Error(`Unexpected status code: ${response.status}`);
      }
    } catch (err: any) {
      console.error('❌ Test 1 Failed:', err.response?.data || err.message);
      throw err;
    }

    // --- TEST 2: Heartbeat Unauthorized ---
    console.log('\n--- TEST 2: Heartbeat Unauthorized ---');
    try {
      await axios.post(
        `${API_URL}/kiosks/${kioskId}/heartbeat`,
        { status: 'online' },
        { headers: { Authorization: `Bearer invalid_api_key` } },
      );
      throw new Error('❌ Test 2 Failed: Request succeeded when it should have failed with 401.');
    } catch (err: any) {
      if (err.response?.status === 401) {
        console.log('✅ Test 2 Passed: Unauthorized request correctly rejected with 401.');
      } else {
        console.error('❌ Test 2 Failed with unexpected error:', err.message);
        throw err;
      }
    }

    // --- TEST 3: Classification Ingestion & Points Awarding ---
    console.log('\n--- TEST 3: Classification & Points Ingestion ---');
    const idempotencyKey1 = generateUUID();
    const idempotencyKey2 = generateUUID();

    try {
      const response = await axios.post(
        `${API_URL}/sorting/classify`,
        {
          events: [
            {
              idempotencyKey: idempotencyKey1,
              category: SortingCategory.PLASTIC, // PLASTIC = 10 points
              confidence: 0.94,
              capturedAt: new Date().toISOString(),
              userId,
            },
            {
              idempotencyKey: idempotencyKey2,
              category: SortingCategory.METAL, // METAL = 15 points
              confidence: 0.88,
              capturedAt: new Date().toISOString(),
              userId,
            },
          ],
        },
        {
          headers: { Authorization: `Bearer ${apiKey}` },
        },
      );

      const data = response.data.data;
      if (
        response.status === 200 &&
        response.data.success &&
        data.processedCount === 2 &&
        data.totalPointsAwarded === 25
      ) {
        console.log(
          `✅ Test 3 Passed: Ingested 2 items, awarded ${data.totalPointsAwarded} points.`,
        );
      } else {
        throw new Error(`Unexpected classification response: ${JSON.stringify(response.data)}`);
      }
    } catch (err: any) {
      console.error('❌ Test 3 Failed:', err.response?.data || err.message);
      throw err;
    }

    // --- TEST 4: Idempotency Verification ---
    console.log('\n--- TEST 4: Idempotency Duplicate Detection ---');
    try {
      const response = await axios.post(
        `${API_URL}/sorting/classify`,
        {
          events: [
            {
              idempotencyKey: idempotencyKey1, // Re-submitting the same key
              category: SortingCategory.PLASTIC,
              confidence: 0.94,
              capturedAt: new Date().toISOString(),
              userId,
            },
          ],
        },
        {
          headers: { Authorization: `Bearer ${apiKey}` },
        },
      );

      const data = response.data.data;
      const skippedEvent = data.details.find((d: any) => d.idempotencyKey === idempotencyKey1);

      if (
        response.status === 200 &&
        data.processedCount === 0 &&
        skippedEvent?.status === 'skipped_duplicate' &&
        skippedEvent?.pointsAwarded === 0
      ) {
        console.log('✅ Test 4 Passed: Duplicate request successfully skipped without double points award.');
      } else {
        throw new Error(`Idempotency check failed: ${JSON.stringify(response.data)}`);
      }
    } catch (err: any) {
      console.error('❌ Test 4 Failed:', err.response?.data || err.message);
      throw err;
    }

    // --- TEST 5: EcoPoints Ledger & Tier Progression ---
    console.log('\n--- TEST 5: Ledger Retrieve & Tier Shift ---');
    try {
      // Currently, the user has 25 points -> should be ECO_STARTER
      let ledgerRes = await axios.get(`${API_URL}/ecopoints/ledger/${userId}`);
      let ledgerData = ledgerRes.data.data;

      if (
        ledgerRes.status === 200 &&
        ledgerData.currentPoints === 25 &&
        ledgerData.tier === EcoTier.ECO_STARTER &&
        ledgerData.ledger.length === 2
      ) {
        console.log(
          `✅ Test 5a Passed: Ledger returned 2 entries, 25 points, Tier: ECO_STARTER.`,
        );
      } else {
        throw new Error(`Unexpected ledger structure: ${JSON.stringify(ledgerRes.data)}`);
      }

      // Ingest more classification events to push user points over 500 (threshold for ECO_WARRIOR)
      console.log('Ingesting large telemetry batch to trigger tier shift to ECO_WARRIOR (>= 500)...');
      const largeBatchEvents: any[] = [];
      for (let i = 0; i < 35; i++) {
        largeBatchEvents.push({
          idempotencyKey: generateUUID(),
          category: SortingCategory.METAL, // 15 points * 35 = 525 points
          confidence: 0.90,
          capturedAt: new Date().toISOString(),
          userId,
        });
      }

      await axios.post(
        `${API_URL}/sorting/classify`,
        { events: largeBatchEvents },
        { headers: { Authorization: `Bearer ${apiKey}` } },
      );

      // Fetch ledger again -> check updated points & tier shift to ECO_WARRIOR
      ledgerRes = await axios.get(`${API_URL}/ecopoints/ledger/${userId}`);
      ledgerData = ledgerRes.data.data;

      if (
        ledgerData.currentPoints === 550 &&
        ledgerData.tier === EcoTier.ECO_WARRIOR &&
        ledgerData.nextTier === 'ECO_CHAMPION'
      ) {
        console.log(
          `✅ Test 5b Passed: Tier successfully shifted to ECO_WARRIOR (Current points: ${ledgerData.currentPoints}).`,
        );
      } else {
        throw new Error(
          `Tier shift verification failed. Expected 550 points and ECO_WARRIOR. Got: ${JSON.stringify(
            ledgerData,
          )}`,
        );
      }
    } catch (err: any) {
      console.error('❌ Test 5 Failed:', err.response?.data || err.message);
      throw err;
    }

    // 4. Cleanup and Shutdown
    console.log('\nTests completed successfully. Cleaning up seeded database records...');
    await cleanup(prisma, kioskId, userPhone);
    console.log('Database cleaned.');

    await app.close();
    console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY! EXITING...');
    process.exit(0);
  } catch (error) {
    console.error('\n💥 Test suite execution failed:', error);
    if (app) {
      await app.close();
    }
    process.exit(1);
  }
}

async function cleanup(prisma: PrismaService, kioskId: string, userPhone: string) {
  // Find test user
  const user = await prisma.user.findUnique({
    where: { phone: userPhone },
  });

  if (user) {
    // Delete EcoPointsLedger entries for user
    await prisma.ecoPointsLedger.deleteMany({
      where: { userId: user.id },
    });

    // Delete EcoPointTransaction records
    await prisma.ecoPointTransaction.deleteMany({
      where: { userId: user.id },
    });

    // Delete SortingEvent records
    await prisma.sortingEvent.deleteMany({
      where: { userId: user.id },
    });

    // Delete User
    await prisma.user.delete({
      where: { id: user.id },
    });
  }

  // Delete Kiosk
  await prisma.kiosk.deleteMany({
    where: { kioskId },
  });
}

runTests();
