import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class FirebaseService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseService.name);
  private firebaseApp: admin.app.App | undefined;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const serviceAccount = this.configService.get<string>(
      'FIREBASE_SERVICE_ACCOUNT',
    );

    if (!serviceAccount) {
      this.logger.warn(
        'FIREBASE_SERVICE_ACCOUNT not found in environment variables. Firebase features will be disabled.',
      );
      return;
    }

    try {
      let config: admin.ServiceAccount;
      if (serviceAccount.trim().startsWith('{')) {
        config = JSON.parse(serviceAccount) as admin.ServiceAccount;
      } else {
        // Assume it's a path if it doesn't look like JSON
        const absolutePath = path.isAbsolute(serviceAccount)
          ? serviceAccount
          : path.join(process.cwd(), serviceAccount);

        config = JSON.parse(
          fs.readFileSync(absolutePath, 'utf8'),
        ) as admin.ServiceAccount;
      }

      this.firebaseApp = admin.initializeApp({
        credential: admin.credential.cert(config),
      });
      this.logger.log('Firebase Admin SDK initialized successfully');
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.stack : 'Unknown error';
      this.logger.error(
        'Failed to initialize Firebase Admin SDK',
        errorMessage,
      );
    }
  }

  async verifyIdToken(idToken: string): Promise<admin.auth.DecodedIdToken> {
    if (!this.firebaseApp) {
      throw new Error('Firebase Admin SDK not initialized');
    }
    return admin.auth().verifyIdToken(idToken);
  }

  async sendPushNotification(
    token: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<boolean> {
    if (!this.firebaseApp) {
      this.logger.warn('Firebase not initialized. Push notification skipped.');
      return false;
    }

    try {
      await admin.messaging().send({
        token,
        notification: { title, body },
        data,
      });
      this.logger.log(`Push notification sent successfully to ${token.substring(0, 10)}...`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send push notification: ${(error as Error).message}`);
      return false;
    }
  }
}
