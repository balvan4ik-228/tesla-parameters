import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Between,
  FindOptionsWhere,
  LessThanOrEqual,
  Like,
  MoreThanOrEqual,
  Repository,
} from 'typeorm';
import {
  TeslaParameter,
  TeslaParameterStatus,
} from '../tesla_parameters/entities/tesla-parameter.entity';
import { Trip, TripStatus } from '../tesla_parameters/entities/trip.entity';
import { TripParameter } from '../tesla_parameters/entities/trip-parameter.entity';
import { CreateParameterDto, ListParametersDto } from './dto/parameters.dto';
import { ParameterView, toParameterView } from './views';

@Injectable()
export class ParametersApiService {
  constructor(
    @InjectRepository(TeslaParameter)
    private readonly parameters: Repository<TeslaParameter>,
    @InjectRepository(Trip)
    private readonly trips: Repository<Trip>,
    @InjectRepository(TripParameter)
    private readonly tripParameters: Repository<TripParameter>,
  ) {}

  // Фильтр по потребляемой силе тока. Обе границы, одна или ни одной.
  private currentFilter(
    min?: number,
    max?: number,
  ): Record<string, unknown> {
    if (min !== undefined && max !== undefined) {
      return { currentA: Between(min, max) };
    }
    if (min !== undefined) {
      return { currentA: MoreThanOrEqual(min) };
    }
    if (max !== undefined) {
      return { currentA: LessThanOrEqual(max) };
    }
    return {};
  }

  // Список услуг с фильтрацией на бэкенде.
  // Вместе со списком отдаётся черновик текущего водителя: его идентификатор
  // и количество услуг в нём — это данные для иконки корзины.
  async list(
    filters: ListParametersDto,
    driverId: number,
  ): Promise<{
    parameters: ParameterView[];
    draftTripId: number | null;
    draftParametersCount: number;
  }> {
    const where: Record<string, unknown> = {
      status: TeslaParameterStatus.Published,
      ...this.currentFilter(filters.minCurrent, filters.maxCurrent),
    };
    if (filters.name) {
      where.parameterName = Like(`%${filters.name}%`);
    }

    const rows = await this.parameters.find({
      where: where as FindOptionsWhere<TeslaParameter>,
      order: { id: 'ASC' },
    });

    const draft = await this.trips.findOne({
      where: { creatorId: driverId, status: TripStatus.Draft },
    });

    const draftParametersCount = draft
      ? await this.tripParameters.count({ where: { tripId: draft.id } })
      : 0;

    return {
      parameters: rows.map(toParameterView),
      draftTripId: draft ? draft.id : null,
      draftParametersCount,
    };
  }

  // Одна услуга. Удалённые клиенту не отдаются.
  async findOne(id: number): Promise<ParameterView> {
    const row = await this.parameters.findOne({ where: { id } });
    if (!row || row.status === TeslaParameterStatus.Deleted) {
      throw new NotFoundException('Параметр потребления не найден');
    }
    return toParameterView(row);
  }

  // Создание услуги. Статус, создатель и даты выставляются здесь,
  // с клиента они не принимаются.
  async create(
    dto: CreateParameterDto,
    imageKey: string,
    videoKey: string,
    creatorId: number,
  ): Promise<ParameterView> {
    const parameter = this.parameters.create({
      parameterName: dto.parameterName,
      shortDescription: dto.shortDescription ?? null,
      currentA: dto.currentA,
      powerW: dto.powerW,
      imageKey,
      videoKey,
      status: TeslaParameterStatus.Published,
      creatorId,
    });

    const saved = await this.parameters.save(parameter);
    return toParameterView(saved);
  }
}
