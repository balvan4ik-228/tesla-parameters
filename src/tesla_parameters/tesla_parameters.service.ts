import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Between,
  LessThanOrEqual,
  MoreThan,
  MoreThanOrEqual,
  Repository,
} from 'typeorm';
import {
  TeslaParameter,
  TeslaParameterStatus,
} from './entities/tesla-parameter.entity';

export interface CreateTeslaParameterData {
  parameterName: string;
  imageKey: string;
  videoKey: string;
}

export interface PublishTeslaParameterData {
  shortDescription: string;
  currentA: number;
  powerW: number;
}

@Injectable()
export class TeslaParametersService {
  constructor(
    @InjectRepository(TeslaParameter)
    private readonly teslaParameterRepository: Repository<TeslaParameter>,
  ) {}

  // ORM: список опубликованных параметров с фильтром по силе тока
  findPublishedParameters(
    minCurrent?: number,
    maxCurrent?: number,
  ): Promise<TeslaParameter[]> {
    return this.teslaParameterRepository.find({
      where: {
        status: TeslaParameterStatus.Published,
        ...this.buildCurrentFilter(minCurrent, maxCurrent),
      },
      relations: { likes: true },
      order: { id: 'ASC' },
    });
  }

  // Двойной слайдер: нижняя и верхняя границы силы тока
  private buildCurrentFilter(minCurrent?: number, maxCurrent?: number) {
    if (minCurrent !== undefined && maxCurrent !== undefined) {
      return { currentA: Between(minCurrent, maxCurrent) };
    }
    if (minCurrent !== undefined) {
      return { currentA: MoreThanOrEqual(minCurrent) };
    }
    if (maxCurrent !== undefined) {
      return { currentA: LessThanOrEqual(maxCurrent) };
    }
    return {};
  }

  // ORM: один опубликованный параметр. Удалённые и черновики не отдаются.
  findPublishedParameterById(id: number): Promise<TeslaParameter | null> {
    return this.teslaParameterRepository.findOne({
      where: { id, status: TeslaParameterStatus.Published },
      relations: { likes: true },
    });
  }

  findFirstPublishedParameter(): Promise<TeslaParameter | null> {
    return this.teslaParameterRepository.findOne({
      where: { status: TeslaParameterStatus.Published },
      relations: { likes: true },
      order: { id: 'ASC' },
    });
  }

  // ORM: следующий опубликованный после id; после последнего — первый
  async findNextPublishedParameter(id: number): Promise<TeslaParameter | null> {
    const next = await this.teslaParameterRepository.findOne({
      where: { status: TeslaParameterStatus.Published, id: MoreThan(id) },
      relations: { likes: true },
      order: { id: 'ASC' },
    });
    return next ?? this.findFirstPublishedParameter();
  }

  // ORM: черновик водителя
  findDraft(creatorId: number): Promise<TeslaParameter | null> {
    return this.teslaParameterRepository.findOne({
      where: { creatorId, status: TeslaParameterStatus.Draft },
    });
  }

  // ORM: создание черновика кнопкой «Далее».
  // Если черновик уже есть — второй не создаётся.
  async createDraft(
    creatorId: number,
    data: CreateTeslaParameterData,
  ): Promise<TeslaParameter> {
    const existingDraft = await this.findDraft(creatorId);
    if (existingDraft) {
      return existingDraft;
    }
    const draft = this.teslaParameterRepository.create({
      parameterName: data.parameterName,
      imageKey: data.imageKey,
      videoKey: data.videoKey,
      status: TeslaParameterStatus.Draft,
      creatorId,
    });
    return this.teslaParameterRepository.save(draft);
  }

  // ORM: публикация черновика — заполнение полей и смена статуса
  async publishDraft(
    creatorId: number,
    data: PublishTeslaParameterData,
  ): Promise<TeslaParameter | null> {
    const draft = await this.findDraft(creatorId);
    if (!draft) {
      return null;
    }
    draft.shortDescription = data.shortDescription;
    draft.currentA = data.currentA;
    draft.powerW = data.powerW;
    draft.status = TeslaParameterStatus.Published;
    return this.teslaParameterRepository.save(draft);
  }

  // Логическое удаление: сырой SQL через курсор, без ORM.
  //
  // Курсор объявляется на выборке из одной строки, открывается,
  // читается командой FETCH и закрывается. Обновление выполняется
  // по позиции курсора — WHERE CURRENT OF. Запись физически остаётся
  // в таблице, меняется только статус.
  async deleteParameterWithSql(id: number): Promise<void> {
    // Блок DO не принимает параметры запроса, поэтому идентификатор
    // подставляется в текст. Чтобы подстановка была безопасной,
    // он приводится к целому числу и проверяется.
    const parameterId = Number.parseInt(String(id), 10);
    if (!Number.isInteger(parameterId) || parameterId <= 0) {
      throw new BadRequestException('Некорректный идентификатор параметра');
    }

    await this.teslaParameterRepository.query(`
      DO $$
      DECLARE
        parameter_cursor CURSOR FOR
          SELECT id, status
            FROM tesla_parameters
           WHERE id = ${parameterId}
             AND status = 'опубликован'
             FOR UPDATE;
        found_row record;
      BEGIN
        OPEN parameter_cursor;
        FETCH parameter_cursor INTO found_row;

        IF FOUND THEN
          UPDATE tesla_parameters
             SET status = 'удален'
           WHERE CURRENT OF parameter_cursor;
        END IF;

        CLOSE parameter_cursor;
      END $$;
    `);
  }
}
