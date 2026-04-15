import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

@Injectable()
export class FirebaseService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseService.name);
  private firebaseApp: admin.app.App;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const serviceAccount = this.configService.get<string>('FIREBASE_SERVICE_ACCOUNT');
    
    if (!serviceAccount) {
      this.logger.warn('FIREBASE_SERVICE_ACCOUNT not found in environment variables. Firebase features will be disabled.');
      return;
    }

    try {
      let config: any;
      if (serviceAccount.trim().startsWith('{')) {
        config = JSON.parse(serviceAccount);
      } else {
        // Assume it's a path if it doesn't look like JSON
        const fs = require('fs');
        const path = require('path');
        const absolutePath = path.isAbsolute(serviceAccount) 
          ? serviceAccount 
          : path.join(process.cwd(), serviceAccount);
        
        config = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
      }

      this.firebaseApp = admin.initializeApp({
        credential: admin.credential.cert(config),
      });
      this.logger.log('Firebase Admin SDK initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Firebase Admin SDK', error.stack);
    }
  }

  async verifyIdToken(idToken: string): Promise<admin.auth.DecodedIdToken> {
    if (!this.firebaseApp) {
      throw new Error('Firebase Admin SDK not initialized');
    }
    return admin.auth().verifyIdToken(idToken);
  }
}
