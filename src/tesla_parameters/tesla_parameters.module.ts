import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TeslaParametersController } from './tesla_parameters.controller';
import { TeslaParametersService } from './tesla_parameters.service';
import { MinioObjectsService } from './minio-objects.service';
import { MinioUploadService } from './minio-upload.service';
import { Driver } from './entities/driver.entity';
import { TeslaParameter } from './entities/tesla-parameter.entity';
import { TeslaParameterLike } from './entities/tesla-parameter-like.entity';

@Module({
  // Все три сущности: autoLoadEntities подхватывает только зарегистрированные здесь
  imports: [
    TypeOrmModule.forFeature([Driver, TeslaParameter, TeslaParameterLike]),
  ],
  controllers: [TeslaParametersController],
  providers: [TeslaParametersService, MinioObjectsService, MinioUploadService],
})
export class TeslaParametersModule {}
