import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from 'node:crypto';

@Injectable()
export class EncryptionService {
  private readonly algorithm = 'aes-256-cbc';
  private readonly key: Buffer;
  private readonly ivLength = 16;

  constructor(private readonly configService: ConfigService) {
    const encryptionKey =
      this.configService.getOrThrow<string>('ENCRYPTION_KEY');

    this.key = Buffer.from(encryptionKey, 'hex');

    if (this.key.length !== 32) {
      throw new Error(
        'ENCRYPTION_KEY debe representar exactamente 32 bytes en formato hexadecimal',
      );
    }
  }

  encrypt(text: string): string {
    if (typeof text !== 'string') {
      throw new TypeError('El valor a encriptar debe ser una cadena de texto');
    }

    const iv = randomBytes(this.ivLength);

    const cipher = createCipheriv(
      this.algorithm,
      this.key,
      iv,
    );

    const encrypted = Buffer.concat([
      cipher.update(text, 'utf8'),
      cipher.final(),
    ]);

    return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
  }

  decrypt(encryptedText: string): string {
    if (typeof encryptedText !== 'string' || encryptedText.trim() === '') {
      throw new TypeError(
        'El valor encriptado debe ser una cadena de texto válida',
      );
    }

    const parts = encryptedText.split(':');

    if (parts.length !== 2) {
      throw new InternalServerErrorException(
        'El texto encriptado no tiene el formato esperado',
      );
    }

    const [ivHex, ciphertextHex] = parts;

    const iv = Buffer.from(ivHex, 'hex');
    const encryptedData = Buffer.from(ciphertextHex, 'hex');

    if (iv.length !== this.ivLength) {
      throw new InternalServerErrorException(
        'El vector de inicialización no tiene la longitud requerida',
      );
    }

    try {
      const decipher = createDecipheriv(
        this.algorithm,
        this.key,
        iv,
      );

      const decrypted = Buffer.concat([
        decipher.update(encryptedData),
        decipher.final(),
      ]);

      return decrypted.toString('utf8');
    } catch {
      throw new InternalServerErrorException(
        'No fue posible desencriptar la información',
      );
    }
  }
}