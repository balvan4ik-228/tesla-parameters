import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Driver } from './driver.entity';
import { TeslaParameterLike } from './tesla-parameter-like.entity';

export enum TeslaParameterStatus {
  Draft = 'черновик',
  Published = 'опубликован',
  Deleted = 'удален',
}

// PostgreSQL отдаёт numeric строкой — переводим в число
const numericToNumber = {
  to: (value?: number | null) => value,
  from: (value?: string | null) =>
    value === null || value === undefined ? null : Number(value),
};

// Параметр потребления Tesla Model S — услуга по варианту.
// Частичный уникальный индекс: у водителя не больше одного черновика.
@Entity('tesla_parameters')
@Index('uq_tesla_parameters_one_draft_per_creator', ['creatorId'], {
  unique: true,
  where: `"status" = 'черновик'`,
})
export class TeslaParameter {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'parameter_name', type: 'varchar', length: 100 })
  parameterName: string;

  @Column({
    name: 'short_description',
    type: 'varchar',
    length: 1000,
    nullable: true,
  })
  shortDescription: string | null;

  @Column({ type: 'varchar', length: 20, default: TeslaParameterStatus.Draft })
  status: TeslaParameterStatus;

  // Ключи объектов в бакете Minio, латиница
  @Column({ name: 'image_key', type: 'varchar', length: 255 })
  imageKey: string;

  @Column({ name: 'video_key', type: 'varchar', length: 255 })
  videoKey: string;

  // Поле по теме: потребляемая сила тока, А (по нему фильтрация)
  @Column({
    name: 'current_a',
    type: 'numeric',
    precision: 5,
    scale: 1,
    nullable: true,
    transformer: numericToNumber,
  })
  currentA: number | null;

  // Поле по теме: потребляемая мощность, Вт
  @Column({ name: 'power_w', type: 'integer', nullable: true })
  powerW: number | null;

  @Column({ name: 'creator_id', type: 'integer' })
  creatorId: number;

  // Каскадное удаление запрещено
  @ManyToOne(() => Driver, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'creator_id' })
  creator: Driver;

  @OneToMany(() => TeslaParameterLike, (like) => like.teslaParameter)
  likes: TeslaParameterLike[];
}
