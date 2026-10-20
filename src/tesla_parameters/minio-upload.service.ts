import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'minio';
import { randomBytes } from 'crypto';
import { extname } from 'path';

// Файл, пришедший через multipart/form-data
export interface UploadedFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

const IMAGE_EXT = ['.jpg', '.jpeg', '.png', '.webp'];
const VIDEO_EXT = ['.mp4', '.webm'];
const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 МБ
const MAX_VIDEO_BYTES = 100 * 1024 * 1024; // 100 МБ

// Загрузка изображений и видео в бакет Minio.
// Имена файлов генерируются на латинице, в базе хранится только имя объекта.
@Injectable()
export class MinioUploadService {
  private readonly logger = new Logger(MinioUploadService.name);
  private readonly client: Client;
  private readonly bucket: string;

  constructor(config: ConfigService) {
    this.bucket = config.get<string>('MINIO_BUCKET', 'tesla-parameters');
    this.client = new Client({
      endPoint: config.get<string>('MINIO_ENDPOINT', 'localhost'),
      port: Number(config.get<string>('MINIO_PORT', '9000')),
      useSSL: config.get<string>('MINIO_USE_SSL', 'false') === 'true',
      accessKey: config.get<string>('MINIO_ACCESS_KEY', 'minioadmin'),
      secretKey: config.get<string>('MINIO_SECRET_KEY', 'minioadmin'),
    });
  }

  async uploadImage(file: UploadedFile): Promise<string> {
    return this.upload(file, IMAGE_EXT, MAX_IMAGE_BYTES, 'изображения');
  }

  async uploadVideo(file: UploadedFile): Promise<string> {
    return this.upload(file, VIDEO_EXT, MAX_VIDEO_BYTES, 'видео');
  }

  // Удаление объекта: нужно, когда файл заменяется новым
  async remove(key?: string | null): Promise<void> {
    if (!key) {
      return;
    }
    try {
      await this.client.removeObject(this.bucket, key);
    } catch (error) {
      this.logger.warn(`Не удалось удалить ${key} из Minio: ${String(error)}`);
    }
  }

  private async upload(
    file: UploadedFile,
    allowed: string[],
    maxBytes: number,
    kind: string,
  ): Promise<string> {
    if (!file || !file.buffer) {
      throw new BadRequestException(`Файл ${kind} не передан`);
    }

    const ext = extname(file.originalname || '').toLowerCase();
    if (!allowed.includes(ext)) {
      throw new BadRequestException(
        `Для ${kind} допустимы форматы: ${allowed.join(', ')}`,
      );
    }
    if (file.size > maxBytes) {
      throw new BadRequestException(
        `Файл ${kind} больше ${Math.round(maxBytes / 1024 / 1024)} МБ`,
      );
    }

    // Имя только из латиницы: исходное имя может быть кириллическим
    const key = `${Date.now()}-${randomBytes(6).toString('hex')}${ext}`;

    await this.ensureBucket();
    await this.client.putObject(this.bucket, key, file.buffer, file.size, {
      'Content-Type': file.mimetype,
    });

    return key;
  }

  private async ensureBucket(): Promise<void> {
    const exists = await this.client.bucketExists(this.bucket);
    if (!exists) {
      await this.client.makeBucket(this.bucket);
      this.logger.log(`Создан бакет ${this.bucket}`);
    }
  }
}
