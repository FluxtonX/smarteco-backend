import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { SendOtpDto, VerifyOtpDto, RefreshTokenDto } from './dto';
import { JwtPayload } from './strategies/jwt.strategy';
import {
  OTP_LENGTH,
  OTP_EXPIRY_MINUTES,
  OTP_MAX_ATTEMPTS,
  OTP_RATE_LIMIT_MINUTES,
  OTP_RATE_LIMIT_MAX,
  SANDBOX_OTP,
  ECOPOINTS,
  BINS_PER_USER,
  BIN_WASTE_TYPES,
  BIN_QR_PREFIX,
} from '../../common/constants';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
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

    // Rate limiting: max OTP_RATE_LIMIT_MAX per OTP_RATE_LIMIT_MINUTES
    const rateLimitWindow = new Date();
    rateLimitWindow.setMinutes(
      rateLimitWindow.getMinutes() - OTP_RATE_LIMIT_MINUTES,
    );

    const recentOtps = await this.prisma.otpVerification.count({
      where: {
        phone,
        createdAt: { gte: rateLimitWindow },
      },
    });

    if (recentOtps >= OTP_RATE_LIMIT_MAX) {
      throw new BadRequestException(
        `Too many OTP requests. Try again in ${OTP_RATE_LIMIT_MINUTES} minutes.`,
      );
    }

    // Generate OTP
    const isDev = this.configService.get('NODE_ENV') !== 'production';
    const otp = isDev ? SANDBOX_OTP : this.generateOtp();

    // Hash OTP before storing
    const hashedOtp = await bcrypt.hash(otp, 10);

    // Set expiry
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + OTP_EXPIRY_MINUTES);

    // Store OTP
    await this.prisma.otpVerification.create({
      data: {
        phone,
        otp: hashedOtp,
        expiresAt,
      },
    });

    // TODO: Send OTP via SMS (Africa's Talking) — will be implemented in Chunk 8
    this.logger.log(
      `OTP for ${phone}: ${isDev ? otp : '[hidden]'} (dev mode: ${isDev})`,
    );

    return {
      success: true,
      message: 'OTP sent successfully',
      data: {
        expiresIn: OTP_EXPIRY_MINUTES * 60,
        isNewUser: !existingUser,
      },
    };
  }

  // ─── VERIFY OTP ──────────────────────────────────

  async verifyOtp(dto: VerifyOtpDto) {
    const { phone, otp, referralCode, fcmToken } = dto;

    // Find the latest unverified OTP for this phone
    const otpRecord = await this.prisma.otpVerification.findFirst({
      where: {
        phone,
        verified: false,
        expiresAt: { gte: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpRecord) {
      throw new BadRequestException(
        'No valid OTP found. Please request a new one.',
      );
    }

    // Check max attempts
    if (otpRecord.attempts >= OTP_MAX_ATTEMPTS) {
      throw new BadRequestException(
        'Maximum verification attempts exceeded. Please request a new OTP.',
      );
    }

    // Verify OTP
    const isValid = await bcrypt.compare(otp, otpRecord.otp);

    if (!isValid) {
      // Increment attempts
      await this.prisma.otpVerification.update({
        where: { id: otpRecord.id },
        data: { attempts: { increment: 1 } },
      });

      throw new BadRequestException('Invalid OTP. Please try again.');
    }

    // Mark OTP as verified
    await this.prisma.otpVerification.update({
      where: { id: otpRecord.id },
      data: { verified: true },
    });

    // Find or create user
    let user = await this.prisma.user.findUnique({
      where: { phone },
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

      // Create 5 default bins for user
      await this.createDefaultBins(user.id);

      this.logger.log(
        `New user registered: ${phone} (referral: ${referralCode || 'none'})`,
      );
    } else {
      // Update FCM token if provided
      if (fcmToken) {
        await this.prisma.user.update({
          where: { id: user.id },
          data: { fcmToken },
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

    // Generate new access token only
    const accessPayload: JwtPayload = {
      sub: user.id,
      phone: user.phone,
      role: user.role,
      type: 'access',
    };

    const accessToken = this.jwtService.sign(
      accessPayload as any,
      {
        secret: this.configService.get<string>('JWT_SECRET'),
        expiresIn: this.configService.get<string>('JWT_EXPIRY') || '24h',
      } as any,
    );

    return {
      success: true,
      data: {
        accessToken,
        expiresIn: 86400,
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

  // ─── PRIVATE HELPERS ─────────────────────────────

  private generateOtp(): string {
    const digits = '0123456789';
    let otp = '';
    for (let i = 0; i < OTP_LENGTH; i++) {
      otp += digits[Math.floor(Math.random() * digits.length)];
    }
    return otp;
  }

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

    const accessToken = this.jwtService.sign(
      accessPayload as any,
      {
        secret: this.configService.get<string>('JWT_SECRET'),
        expiresIn: this.configService.get<string>('JWT_EXPIRY') || '24h',
      } as any,
    );

    const refreshExpiry =
      this.configService.get<string>('JWT_REFRESH_EXPIRY') || '7d';
    const refreshToken = this.jwtService.sign(
      refreshPayload as Record<string, any>,
      {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: refreshExpiry,
      } as any,
    );

    // Calculate refresh token expiry date
    const expiresAt = new Date();
    const days = parseInt(refreshExpiry) || 7;
    expiresAt.setDate(expiresAt.getDate() + days);

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

    const binData = BIN_WASTE_TYPES.map((wasteType) => ({
      userId,
      wasteType: wasteType as any,
      qrCode: this.generateBinQrCode(userPrefix),
    }));

    await this.prisma.bin.createMany({ data: binData });

    this.logger.log(`Created ${BINS_PER_USER} default bins for user ${userId}`);
  }
}
