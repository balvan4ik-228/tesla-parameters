import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Driver } from '../tesla_parameters/entities/driver.entity';
import { TeslaParameter } from '../tesla_parameters/entities/tesla-parameter.entity';
import { Trip } from '../tesla_parameters/entities/trip.entity';
import { TripParameter } from '../tesla_parameters/entities/trip-parameter.entity';
import { MinioUploadService } from '../tesla_parameters/minio-upload.service';
import { ParametersApiController } from './parameters-api.controller';
import { ParametersApiService } from './parameters-api.service';
import { TripsApiController } from './trips-api.controller';
import { TripsApiService } from './trips-api.service';

// Веб-сервис третьей лабораторной. Страницы первой и второй лабораторных
// остаются в модуле TeslaParametersModule и работают как раньше.
@Module({
  imports: [
    TypeOrmModule.forFeature([Driver, TeslaParameter, Trip, TripParameter]),
  ],
  controllers: [ParametersApiController, TripsApiController],
  providers: [ParametersApiService, TripsApiService, MinioUploadService],
})
export class ApiModule {}
