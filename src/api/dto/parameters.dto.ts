import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';

// Фильтрация списка услуг. Выполняется на бэкенде, параметры приходят в query.
export class ListParametersDto {
  // Подстрока в названии параметра
  @IsOptional()
  @IsString()
  @Length(1, 100)
  name?: string;

  // Нижняя граница потребляемой силы тока, А
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1000)
  minCurrent?: number;

  // Верхняя граница потребляемой силы тока, А
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1000)
  maxCurrent?: number;
}

// Создание услуги. Системные поля (id, статус, создатель, даты) с клиента
// не принимаются — их выставляет бэкенд.
export class CreateParameterDto {
  @IsString()
  @IsNotEmpty({ message: 'Название параметра обязательно' })
  @Length(3, 100, { message: 'Название от 3 до 100 символов' })
  parameterName: string;

  @IsOptional()
  @IsString()
  @Length(0, 1000)
  shortDescription?: string;

  // Потребляемая сила тока, А
  @Type(() => Number)
  @IsNumber({}, { message: 'Сила тока должна быть числом' })
  @Min(0, { message: 'Сила тока не может быть отрицательной' })
  @Max(1000)
  currentA: number;

  // Потребляемая мощность, Вт
  @Type(() => Number)
  @IsInt({ message: 'Мощность должна быть целым числом' })
  @Min(0, { message: 'Мощность не может быть отрицательной' })
  @Max(500000)
  powerW: number;
}

// Добавление услуги в заявку-черновик
export class AddToTripDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.1, { message: 'Продолжительность не меньше 0,1 часа' })
  @Max(24, { message: 'Продолжительность не больше 24 часов за день' })
  hours?: number;
}

// Изменение значения в таблице связи
export class UpdateTripParameterDto {
  @Type(() => Number)
  @IsNumber({}, { message: 'Продолжительность должна быть числом' })
  @Min(0.1, { message: 'Продолжительность не меньше 0,1 часа' })
  @Max(24, { message: 'Продолжительность не больше 24 часов за день' })
  hours: number;
}

// Фильтрация списка заявок: по диапазону даты формирования и по статусу
export class ListTripsDto {
  @IsOptional()
  @IsString()
  status?: string;

  // Дата формирования с ... (формат YYYY-MM-DD)
  @IsOptional()
  @IsString()
  formedFrom?: string;

  // Дата формирования по ... (формат YYYY-MM-DD)
  @IsOptional()
  @IsString()
  formedTo?: string;
}

// Формирование заявки создателем. Здесь же заполняются поля
// по предметной области — они обязательны для формирования.
export class FormTripDto {
  // Дата дня поездки, YYYY-MM-DD
  @IsString()
  @IsNotEmpty({ message: 'Дата поездки обязательна' })
  tripDate: string;

  // Заряд батареи на начало дня, %
  @Type(() => Number)
  @IsNumber({}, { message: 'Заряд должен быть числом' })
  @Min(0, { message: 'Заряд не может быть отрицательным' })
  @Max(100, { message: 'Заряд не может быть больше 100 %' })
  startChargePercent: number;
}

// Завершение или отклонение заявки модератором
export class CompleteTripDto {
  // Допустимые значения: завершить | отклонить
  @Transform(({ value }) => String(value).trim().toLowerCase())
  @IsString()
  @IsNotEmpty({ message: 'Укажите действие: завершить или отклонить' })
  action: string;
}
