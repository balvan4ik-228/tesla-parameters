import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UploadedFiles,
  UseInterceptors,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { CURRENT_DRIVER_ID } from '../tesla_parameters/current-driver';
import {
  AddToTripDto,
  CreateParameterDto,
  ListParametersDto,
} from './dto/parameters.dto';
import { MinioUploadService, UploadedFile } from '../tesla_parameters/minio-upload.service';
import { ParametersApiService } from './parameters-api.service';
import { TripsApiService } from './trips-api.service';

// Услуга предметной области — параметр потребления Tesla Model S.
// Все адреса начинаются с /api, методы соответствуют REST.
@Controller('api/parameters')
// Поля, которых нет в DTO, отбрасываются с ошибкой: системные поля
// (идентификатор, статус, создатель, даты) с клиента принять нельзя.
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
)
export class ParametersApiController {
  constructor(
    private readonly parametersService: ParametersApiService,
    private readonly tripsService: TripsApiService,
    private readonly uploads: MinioUploadService,
  ) {}

  // 1. GET /api/parameters — список с фильтрацией.
  // Вместе со списком возвращается черновик текущего водителя.
  @Get()
  list(@Query() filters: ListParametersDto) {
    return this.parametersService.list(filters, CURRENT_DRIVER_ID);
  }

  // 2. GET /api/parameters/:id — одна услуга
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.parametersService.findOne(id);
  }

  // 3. POST /api/parameters — добавление услуги с изображением и видео.
  // Тело запроса — multipart/form-data: поля плюс файлы image и video.
  @Post()
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'image', maxCount: 1 },
      { name: 'video', maxCount: 1 },
    ]),
  )
  async create(
    @Body() dto: CreateParameterDto,
    @UploadedFiles()
    files: { image?: UploadedFile[]; video?: UploadedFile[] },
  ) {
    const image = files?.image?.[0];
    const video = files?.video?.[0];
    if (!image) {
      throw new BadRequestException('Приложите изображение в поле image');
    }
    if (!video) {
      throw new BadRequestException('Приложите короткое видео в поле video');
    }

    const imageKey = await this.uploads.uploadImage(image);
    let videoKey: string;
    try {
      videoKey = await this.uploads.uploadVideo(video);
    } catch (error) {
      // Изображение уже загружено — убираем, чтобы не оставлять мусор в бакете
      await this.uploads.remove(imageKey);
      throw error;
    }

    return this.parametersService.create(
      dto,
      imageKey,
      videoKey,
      CURRENT_DRIVER_ID,
    );
  }

  // 4. POST /api/parameters/:id/draft-trip — добавление услуги в заявку-черновик.
  // Черновик создаётся сам при добавлении первой услуги.
  @Post(':id/draft-trip')
  addToDraft(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AddToTripDto,
  ) {
    return this.tripsService.addParameter(id, dto.hours, CURRENT_DRIVER_ID);
  }
}
