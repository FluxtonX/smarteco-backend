import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { Prisma, WasteType } from '@prisma/client';
import { TwilioService } from '../../integrations/twilio/twilio.service';
import {
  SendOtpDto,
  VerifyOtpDto,
  RefreshTokenDto,
  GoogleLoginDto,
  AdminLoginDto,
} from './dto';
import { FirebaseService } from '../../integrations/firebase/firebase.service';
import * as admin from 'firebase-admin';
import { JwtPayload } from './strategies/jwt.strategy';
import {
  ECOPOINTS,
  BINS_PER_USER,
  BIN_WASTE_TYPES,
  BIN_QR_PREFIX,
} from '../../common/constants';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly twilioService: TwilioService,
    private readonly firebaseService: FirebaseService,
  ) {}

  // ─── SEND OTP ────────────────────────────────────

  async sendOtp(dto: SendOtpDto) {
    const { phone, isLogin } = dto;

    // Check if user exists
    const existingUser = await this.prisma.user.findUnique({
      where: { phone },
    });

    // ─── Existence Checks ─────────────────────────────
    if (isLogin === true && !existingUser) {
      throw new BadRequestException(
        'User not found. Please create an account.',
      );
    }

    if (isLogin === false && existingUser) {
      throw new BadRequestException(
        'User already exists. Please log in instead.',
      );
    }

    // Send OTP via Twilio Verify (handles code gen, expiry, rate‑limiting)
    try {
      const result = await this.twilioService.sendVerification(phone);
      this.logger.log(
        `Twilio Verify OTP sent to ${phone} — status: ${result.status}`,
      );
    } catch (error) {
      // Twilio rate-limit & invalid-number errors already have clear messages
      this.logger.error(
        `Twilio sendVerification failed: ${(error as Error).message}`,
      );
      throw new BadRequestException(
        'Failed to send OTP. Please check the phone number and try again.',
      );
    }

    return {
      success: true,
      message: 'OTP sent successfully',
      data: {
        expiresIn: 600, // Twilio Verify default: 10 minutes
        isNewUser: !existingUser,
      },
    };
  }

  // ─── VERIFY OTP ──────────────────────────────────

  async verifyOtp(dto: VerifyOtpDto) {
    const { phone, otp, referralCode, fcmToken, signupRole } = dto;

    // Verify OTP via Twilio Verify
    let verification: { valid: boolean; status: string };
    try {
      verification = await this.twilioService.checkVerification(phone, otp);
    } catch (error) {
      this.logger.error(
        `Twilio checkVerification failed: ${(error as Error).message}`,
      );
      throw new BadRequestException(
        'Verification failed. Please request a new OTP.',
      );
    }

    if (!verification.valid) {
      throw new BadRequestException('Invalid OTP. Please try again.');
    }

    // Find or create user
    let user = await this.prisma.user.findUnique({
      where: { phone },
      include: {
        collectorProfile: {
          select: { id: true, isApproved: true, collectorName: true },
        },
      },
    });

    let isNewUser = false;

    if (!user) {
      isNewUser = true;

      // Validate referral code if provided
      let referrerId: string | null = null;
      if (referralCode) {
        const referrer = await this.prisma.user.findUnique({
          where: { referralCode },
        });
        if (!referrer) {
          throw new BadRequestException('Invalid referral code.');
        }
        referrerId = referrer.id;
      }

      // Create new user
      const newReferralCode = this.generateReferralCode();

      user = await this.prisma.user.create({
        data: {
          phone,
          referralCode: newReferralCode,
          referredBy: referrerId,
          fcmToken: fcmToken || null,
        },
        include: {
          collectorProfile: {
            select: { id: true, isApproved: true, collectorName: true },
          },
        },
      });

      // Award registration bonus
      await this.prisma.ecoPointTransaction.create({
        data: {
          userId: user.id,
          points: ECOPOINTS.REGISTRATION_BONUS,
          action: 'REGISTRATION',
          description: `Welcome bonus: ${ECOPOINTS.REGISTRATION_BONUS} EcoPoints`,
        },
      });

      // Create default bins only for USER signups (collectors should not have bins by default)
      if (signupRole !== 'COLLECTOR') {
        await this.createDefaultBins(user.id);
      }

      this.logger.log(
        `New user registered: ${phone} (referral: ${referralCode || 'none'})`,
      );
    } else {
      // Update FCM token if provided
      if (fcmToken) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: { fcmToken },
          include: {
            collectorProfile: {
              select: { id: true, isApproved: true, collectorName: true },
            },
          },
        });
      }
    }

    // Generate tokens
    const tokens = await this.generateTokens(user);

    // Calculate EcoPoints
    const totalPoints = await this.getTotalPoints(user.id);
    const ecoTier = this.calculateTier(totalPoints);

    return {
      success: true,
      message: 'Authentication successful',
      data: {
        ...tokens,
        user: {
          id: user.id,
          phone: user.phone,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          userType: user.userType,
          role: user.role,
          referralCode: user.referralCode,
          avatarUrl: user.avatarUrl,
          ecoPoints: totalPoints,
          ecoTier,
          isNewUser,
          collectorProfile: user.collectorProfile
            ? {
                id: user.collectorProfile.id,
                isApproved: user.collectorProfile.isApproved,
                collectorName: user.collectorProfile.collectorName,
              }
            : null,
        },
      },
    };
  }

  // ─── ADMIN LOGIN (Hardcoded) ─────────────────────

  async adminLogin(dto: AdminLoginDto) {
    const { email, password } = dto;

    const adminEmail = this.configService.get<string>('ADMIN_EMAIL');
    const adminPassword = this.configService.get<string>('ADMIN_PASSWORD');

    if (email !== adminEmail || password !== adminPassword) {
      throw new UnauthorizedException('Invalid admin credentials');
    }

    // Find the admin user in DB or create if doesn't exist
    let user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Auto-create admin user if missing
      user = await this.prisma.user.create({
        data: {
          email,
          phone: 'ADMIN_PORTAL', // Fixed placeholder for admin
          role: 'ADMIN',
          referralCode: this.generateReferralCode(),
        },
      });
    } else if (user.role !== 'ADMIN') {
      // Ensure the user actually has the ADMIN role
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { role: 'ADMIN' },
      });
    }

    const tokens = await this.generateTokens(user);
    const totalPoints = await this.getTotalPoints(user.id);
    const ecoTier = this.calculateTier(totalPoints);

    return {
      success: true,
      message: 'Admin login successful',
      data: {
        ...tokens,
        user: {
          id: user.id,
          phone: user.phone,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          userType: user.userType,
          role: user.role,
          referralCode: user.referralCode,
          avatarUrl: user.avatarUrl,
          ecoPoints: totalPoints,
          ecoTier,
          isNewUser: false,
        },
      },
    };
  }

  // ─── REFRESH TOKEN ───────────────────────────────

  async refreshToken(dto: RefreshTokenDto) {
    const { refreshToken } = dto;

    // Verify the refresh token JWT
    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Invalid token type');
    }

    // Check if refresh token exists in DB and is not revoked
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { token: refreshToken },
    });

    if (!storedToken || storedToken.revoked) {
      throw new UnauthorizedException('Refresh token revoked or not found');
    }

    if (storedToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    // Get user
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or deactivated');
    }

    await this.prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revoked: true },
    });

    const tokens = await this.generateTokens({
      id: user.id,
      phone: user.phone,
      role: user.role,
    });

    return {
      success: true,
      data: {
        ...tokens,
      },
    };
  }

  // ─── LOGOUT ──────────────────────────────────────

  async logout(userId: string) {
    // Revoke all refresh tokens for this user
    await this.prisma.refreshToken.updateMany({
      where: { userId, revoked: false },
      data: { revoked: true },
    });

    return {
      success: true,
      message: 'Logged out successfully',
    };
  }

  async googleLogin(dto: GoogleLoginDto) {
    const { idToken, email, displayName, photoUrl, fcmToken, signupRole } = dto;

    // 1. Verify token with Firebase
    let decodedToken: admin.auth.DecodedIdToken;
    try {
      decodedToken = await this.firebaseService.verifyIdToken(idToken);
    } catch (error) {
      this.logger.error(
        `Firebase token verification failed: ${(error as Error).message}`,
      );
      throw new UnauthorizedException('Invalid Google ID Token');
    }

    if (decodedToken.email !== email) {
      throw new BadRequestException('Email mismatch');
    }

    // 2. Find or create user by email
    let user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        collectorProfile: {
          select: { id: true, isApproved: true, collectorName: true },
        },
      },
    });

    let isNewUser = false;

    if (!user) {
      isNewUser = true;
      // For Google login without phone, we handle it as a new profile
      // Note: your current schema might require phone. Let's assume it doesn't or handles it.
      // If phone is required, we might need to ask for it after google login if not linked.

      const newReferralCode = this.generateReferralCode();

      const [firstName, ...lastNameParts] = (displayName || '').split(' ');
      const lastName = lastNameParts.join(' ');

      user = await this.prisma.user.create({
        data: {
          email,
          phone: `GOOGLE_${decodedToken.uid.substring(0, 15)}`, // Satisfy mandatory & unique constraint
          firstName: firstName || null,
          lastName: lastName || null,
          avatarUrl: photoUrl || null,
          referralCode: newReferralCode,
          fcmToken: fcmToken || null,
        },
        include: {
          collectorProfile: {
            select: { id: true, isApproved: true, collectorName: true },
          },
        },
      });

      // Award registration bonus
      await this.prisma.ecoPointTransaction.create({
        data: {
          userId: user.id,
          points: ECOPOINTS.REGISTRATION_BONUS,
          action: 'REGISTRATION',
          description: `Welcome bonus: ${ECOPOINTS.REGISTRATION_BONUS} EcoPoints`,
        },
      });

      // Create default bins only for USER signups (collectors should not have bins by default)
      if (signupRole !== 'COLLECTOR') {
        await this.createDefaultBins(user.id);
      }

      this.logger.log(`New user registered via Google: ${email}`);
    } else {
      // Update profile info from Google if missing
      const updateData: Prisma.UserUpdateInput = {};
      if (!user.firstName && displayName)
        updateData.firstName = displayName.split(' ')[0];
      if (!user.lastName && displayName) {
        const [, ...lastNameParts] = displayName.split(' ');
        const last = lastNameParts.join(' ').trim();
        if (last.length > 0) updateData.lastName = last;
      }
      if (!user.avatarUrl && photoUrl) updateData.avatarUrl = photoUrl;
      if (fcmToken) updateData.fcmToken = fcmToken;

      if (Object.keys(updateData).length > 0) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: updateData,
          include: {
            collectorProfile: {
              select: { id: true, isApproved: true, collectorName: true },
            },
          },
        });
      }
    }

    // 3. Generate tokens
    const tokens = await this.generateTokens({
      id: user.id,
      phone: user.phone || `GOOGLE_${decodedToken.uid.substring(0, 15)}`,
      role: user.role,
    });

    // 4. Calculate stats
    const totalPoints = await this.getTotalPoints(user.id);
    const ecoTier = this.calculateTier(totalPoints);

    return {
      success: true,
      message: 'Authentication successful',
      data: {
        ...tokens,
        user: {
          id: user.id,
          phone: user.phone,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          userType: user.userType,
          role: user.role,
          referralCode: user.referralCode,
          avatarUrl: user.avatarUrl,
          ecoPoints: totalPoints,
          ecoTier,
          isNewUser,
          collectorProfile: user.collectorProfile
            ? {
                id: user.collectorProfile.id,
                isApproved: user.collectorProfile.isApproved,
                collectorName: user.collectorProfile.collectorName,
              }
            : null,
        },
      },
    };
  }

  // ─── PRIVATE HELPERS ─────────────────────────────

  private generateReferralCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = 'ECO';
    for (let i = 0; i < 5; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  }

  private generateBinQrCode(userPrefix: string): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return `${BIN_QR_PREFIX}${userPrefix}-${code}`;
  }

  private async generateTokens(user: {
    id: string;
    phone: string;
    role: string;
  }) {
    const accessPayload: JwtPayload = {
      sub: user.id,
      phone: user.phone,
      role: user.role,
      type: 'access',
    };

    const refreshPayload: JwtPayload = {
      sub: user.id,
      phone: user.phone,
      role: user.role,
      type: 'refresh',
    };

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const accessToken = this.jwtService.sign(accessPayload as any, {
      secret: this.configService.get<string>('JWT_SECRET'),
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      expiresIn: (this.configService.get<string>('JWT_EXPIRY') || '24h') as any,
    });

    const refreshExpiry =
      this.configService.get<string>('JWT_REFRESH_EXPIRY') || '7d';

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const refreshToken = this.jwtService.sign(refreshPayload as any, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      expiresIn: refreshExpiry as any,
    });

    const expiresAt = this.calculateTokenExpiry(refreshExpiry);

    // Store refresh token in DB
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: refreshToken,
        expiresAt,
      },
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: 86400, // 24 hours in seconds
    };
  }

  private calculateTokenExpiry(expiresIn: string): Date {
    const value = expiresIn.trim();
    const match = value.match(/^(\d+)([smhd])$/i);

    if (!match) {
      const fallback = new Date();
      fallback.setDate(fallback.getDate() + 7);
      return fallback;
    }

    const amount = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();
    const expiry = new Date();

    switch (unit) {
      case 's':
        expiry.setSeconds(expiry.getSeconds() + amount);
        break;
      case 'm':
        expiry.setMinutes(expiry.getMinutes() + amount);
        break;
      case 'h':
        expiry.setHours(expiry.getHours() + amount);
        break;
      case 'd':
      default:
        expiry.setDate(expiry.getDate() + amount);
        break;
    }

    return expiry;
  }

  private async getTotalPoints(userId: string): Promise<number> {
    const result = await this.prisma.ecoPointTransaction.aggregate({
      where: { userId },
      _sum: { points: true },
    });
    return result._sum.points || 0;
  }

  private calculateTier(points: number): string {
    if (points >= 5000) return 'ECO_CHAMPION';
    if (points >= 1000) return 'ECO_WARRIOR';
    return 'ECO_STARTER';
  }

  private async createDefaultBins(userId: string): Promise<void> {
    // Generate a 3-char prefix from userId
    const userPrefix = userId.substring(0, 3).toUpperCase();

    const binData: Prisma.BinCreateManyInput[] = BIN_WASTE_TYPES.map(
      (wasteType) => ({
        userId,
        wasteType: wasteType as WasteType,
        qrCode: this.generateBinQrCode(userPrefix),
      }),
    );

    await this.prisma.bin.createMany({ data: binData });

    this.logger.log(`Created ${BINS_PER_USER} default bins for user ${userId}`);
  }
}
