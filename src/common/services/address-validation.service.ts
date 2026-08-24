import { BadRequestException } from '@nestjs/common';

export class AddressValidationService {
  /**
   * Validates that an address is provided and contains a valid street location.
   */
  static validateAddress(address?: string | null): string {
    if (!address || typeof address !== 'string') {
      throw new BadRequestException(
        'A valid street address is required.',
      );
    }

    const trimmed = address.trim();

    if (trimmed.length < 4) {
      throw new BadRequestException(
        'Address is too short. Please provide a full street address.',
      );
    }

    // Require basic street address pattern (letters, numbers, street/rd/ave/kn/kk keywords or numbers)
    const hasAlphanumeric = /[a-zA-Z0-9]/.test(trimmed);
    if (!hasAlphanumeric) {
      throw new BadRequestException(
        'Invalid street address format. Please enter a valid street name or building location.',
      );
    }

    return trimmed;
  }
}
