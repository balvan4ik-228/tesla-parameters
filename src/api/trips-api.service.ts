import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Between,
  FindOptionsWhere,
  LessThanOrEqual,
  MoreThanOrEqual,
  Repository,
} from 'typeorm';
import { Driver } from '../tesla_parameters/entities/driver.entity';
import {
  TeslaParameter,
  TeslaParameterStatus,
} from '../tesla_parameters/entities/tesla-parameter.entity';
import { Trip, TripStatus } from '../tesla_parameters/entities/trip.entity';
import { TripParameter } from '../tesla_parameters/entities/trip-parameter.entity';
import {
  CompleteTripDto,
  FormTripDto,
  ListTripsDto,
  UpdateTripParameterDto,
} from './dto/parameters.dto';
import {
  TripDetailView,
  TripListView,
  consumedKwh,
  toTripDetailView,
  toTripListView,
} from './views';

// Ёмкость батареи Tesla Model S: 100 кВт*ч.
// Значит один киловатт-час расхода — это ровно один процент заряда.
const BATTERY_KWH = 100;

@Injectable()
export class TripsApiService {
  constructor(
    @InjectRepository(Trip)
    private readonly trips: Repository<Trip>,
    @InjectRepository(TripParameter)
    private readonly links: Repository<TripParameter>,
    @InjectRepository(TeslaParameter)
    private readonly parameters: Repository<TeslaParameter>,
    @InjectRepository(Driver)
    private readonly drivers: Repository<Driver>,
  ) {}

  // ---------------------------------------------------------------- связь м-м

  // Добавление услуги в заявку-черновик.
  // Если черновика нет — он создаётся пустым: создатель, дата создания
  // и статус выставляются автоматически, POST для заявки не нужен.
  async addParameter(
    parameterId: number,
    hours: number | undefined,
    driverId: number,
  ): Promise<TripDetailView> {
    const parameter = await this.parameters.findOne({
      where: { id: parameterId },
    });
    if (!parameter || parameter.status !== TeslaParameterStatus.Published) {
      throw new NotFoundException('Параметр потребления не найден');
    }

    let draft = await this.trips.findOne({
      where: { creatorId: driverId, status: TripStatus.Draft },
    });
    if (!draft) {
      draft = await this.trips.save(
        this.trips.create({
          creatorId: driverId,
          status: TripStatus.Draft,
        }),
      );
    }

    const existing = await this.links.findOne({
      where: { tripId: draft.id, teslaParameterId: parameterId },
    });
    if (existing) {
      throw new ConflictException('Этот параметр уже добавлен в заявку');
    }

    await this.links.save(
      this.links.create({
        tripId: draft.id,
        teslaParameterId: parameterId,
        hours: hours ?? 1,
      }),
    );

    return this.findOne(draft.id, driverId);
  }

  // Удаление услуги из заявки. Первичный ключ связи в адресе не используется.
  async removeParameter(
    tripId: number,
    parameterId: number,
    driverId: number,
  ): Promise<TripDetailView> {
    const trip = await this.loadEditableDraft(tripId, driverId);

    const link = await this.links.findOne({
      where: { tripId: trip.id, teslaParameterId: parameterId },
    });
    if (!link) {
      throw new NotFoundException('Этот параметр в заявке не найден');
    }

    await this.links.remove(link);
    return this.findOne(trip.id, driverId);
  }

  // Изменение значения в связи: сколько часов работал параметр.
  async updateParameter(
    tripId: number,
    parameterId: number,
    dto: UpdateTripParameterDto,
    driverId: number,
  ): Promise<TripDetailView> {
    const trip = await this.loadEditableDraft(tripId, driverId);

    const link = await this.links.findOne({
      where: { tripId: trip.id, teslaParameterId: parameterId },
    });
    if (!link) {
      throw new NotFoundException('Этот параметр в заявке не найден');
    }

    link.hours = dto.hours;
    await this.links.save(link);

    return this.findOne(trip.id, driverId);
  }

  // ---------------------------------------------------------------- заявки

  // Список заявок: без удалённых и без черновиков,
  // с фильтрами по диапазону даты формирования и по статусу.
  async list(filters: ListTripsDto): Promise<TripListView[]> {
    const where: Record<string, unknown> = {};

    if (filters.status) {
      const status = this.parseStatus(filters.status);
      if (status === TripStatus.Draft || status === TripStatus.Deleted) {
        throw new BadRequestException(
          'Черновики и удалённые заявки в списке не отдаются',
        );
      }
      where.status = status;
    }

    const from = this.parseDate(filters.formedFrom, 'formedFrom');
    const to = this.parseDate(filters.formedTo, 'formedTo');
    if (from && to) {
      where.formedAt = Between(from, to);
    } else if (from) {
      where.formedAt = MoreThanOrEqual(from);
    } else if (to) {
      where.formedAt = LessThanOrEqual(to);
    }

    const rows = await this.trips.find({
      where: where as FindOptionsWhere<Trip>,
      relations: { creator: true, moderator: true },
      order: { id: 'DESC' },
    });

    const visible = rows.filter(
      (t) => t.status !== TripStatus.Draft && t.status !== TripStatus.Deleted,
    );

    const result: TripListView[] = [];
    for (const trip of visible) {
      const count = await this.links.count({ where: { tripId: trip.id } });
      result.push(toTripListView(trip, count));
    }
    return result;
  }

  // Одна заявка: её поля и список услуг с изображениями
  async findOne(id: number, driverId: number): Promise<TripDetailView> {
    const trip = await this.trips.findOne({
      where: { id },
      relations: { creator: true, moderator: true },
    });
    if (!trip || trip.status === TripStatus.Deleted) {
      throw new NotFoundException('Заявка не найдена');
    }

    // Чужой черновик не показываем
    const driver = await this.drivers.findOne({ where: { id: driverId } });
    if (
      trip.status === TripStatus.Draft &&
      trip.creatorId !== driverId &&
      !driver?.isModerator
    ) {
      throw new ForbiddenException('Это черновик другого водителя');
    }

    const links = await this.links.find({
      where: { tripId: trip.id },
      relations: { teslaParameter: true },
      order: { id: 'ASC' },
    });

    return toTripDetailView(trip, links);
  }

  // Формирование заявки создателем.
  // Проверяются обязательные поля, проставляется дата формирования,
  // считается остаток заряда по формуле из лабораторной 2.
  async form(
    id: number,
    dto: FormTripDto,
    driverId: number,
  ): Promise<TripDetailView> {
    const trip = await this.loadEditableDraft(id, driverId);

    const links = await this.links.find({
      where: { tripId: trip.id },
      relations: { teslaParameter: true },
    });
    if (links.length === 0) {
      throw new BadRequestException(
        'Нельзя сформировать заявку без параметров потребления',
      );
    }

    const tripDate = this.parseDate(dto.tripDate, 'tripDate');
    if (!tripDate) {
      throw new BadRequestException('Дата поездки указана неверно');
    }

    // Расход за день: сумма по всем параметрам заявки
    const total = links.reduce(
      (sum, link) =>
        sum + consumedKwh(link.teslaParameter?.currentA ?? null, link.hours),
      0,
    );
    const totalConsumedKwh = Math.round(total * 100) / 100;

    // Ёмкость 100 кВт*ч: один киловатт-час равен одному проценту
    const remaining =
      dto.startChargePercent - (totalConsumedKwh / BATTERY_KWH) * 100;

    trip.tripDate = dto.tripDate;
    trip.startChargePercent = dto.startChargePercent;
    trip.totalConsumedKwh = totalConsumedKwh;
    trip.remainingChargePercent = Math.round(Math.max(remaining, 0) * 10) / 10;
    trip.status = TripStatus.Formed;
    trip.formedAt = new Date();

    await this.trips.save(trip);
    return this.findOne(trip.id, driverId);
  }

  // Завершение или отклонение модератором.
  // Проставляются модератор и дата завершения.
  async complete(
    id: number,
    dto: CompleteTripDto,
    moderatorId: number,
  ): Promise<TripDetailView> {
    const moderator = await this.drivers.findOne({
      where: { id: moderatorId },
    });
    if (!moderator || !moderator.isModerator) {
      throw new ForbiddenException(
        'Завершать и отклонять заявки может только модератор',
      );
    }

    const trip = await this.trips.findOne({ where: { id } });
    if (!trip || trip.status === TripStatus.Deleted) {
      throw new NotFoundException('Заявка не найдена');
    }
    if (trip.status !== TripStatus.Formed) {
      throw new BadRequestException(
        `Модератор работает только со сформированными заявками, а эта в статусе «${trip.status}»`,
      );
    }

    if (dto.action === 'завершить') {
      trip.status = TripStatus.Completed;
    } else if (dto.action === 'отклонить') {
      trip.status = TripStatus.Rejected;
    } else {
      throw new BadRequestException(
        'Допустимые действия: завершить или отклонить',
      );
    }

    trip.moderatorId = moderatorId;
    trip.completedAt = new Date();

    await this.trips.save(trip);
    return this.findOne(trip.id, moderatorId);
  }

  // ---------------------------------------------------------------- служебное

  // Черновик, который принадлежит текущему водителю и ещё редактируется
  private async loadEditableDraft(
    tripId: number,
    driverId: number,
  ): Promise<Trip> {
    const trip = await this.trips.findOne({ where: { id: tripId } });
    if (!trip || trip.status === TripStatus.Deleted) {
      throw new NotFoundException('Заявка не найдена');
    }
    if (trip.creatorId !== driverId) {
      throw new ForbiddenException('Это заявка другого водителя');
    }
    if (trip.status !== TripStatus.Draft) {
      throw new BadRequestException(
        `Заявку в статусе «${trip.status}» изменять нельзя`,
      );
    }
    return trip;
  }

  private parseStatus(value: string): TripStatus {
    const found = Object.values(TripStatus).find((s) => s === value);
    if (!found) {
      throw new BadRequestException(
        `Неизвестный статус «${value}». Допустимы: ${Object.values(TripStatus).join(', ')}`,
      );
    }
    return found;
  }

  private parseDate(value: string | undefined, field: string): Date | null {
    if (!value) {
      return null;
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(
        `Поле ${field} должно быть датой в формате ГГГГ-ММ-ДД`,
      );
    }
    return date;
  }
}
