import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Driver } from './driver.entity';
import { TripParameter } from './trip-parameter.entity';

// Статусы заявки. Выставляются только на бэкенде, с клиента не принимаются.
export enum TripStatus {
  Draft = 'черновик',
  Formed = 'сформирована',
  Completed = 'завершена',
  Rejected = 'отклонена',
  Deleted = 'удалена',
}

// PostgreSQL отдаёт numeric строкой — переводим в число
const numericToNumber = {
  to: (value?: number | null) => value,
  from: (value?: string | null) =>
    value === null || value === undefined ? null : Number(value),
};

// Заявка — день поездки Tesla Model S.
// Объединяет параметры потребления и хранит расчёт остатка заряда.
// Частичный уникальный индекс: у водителя не больше одного черновика.
@Entity('trips')
@Index('uq_trips_one_draft_per_creator', ['creatorId'], {
  unique: true,
  where: `"status" = 'черновик'`,
})
export class Trip {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 20, default: TripStatus.Draft })
  status: TripStatus;

  // --- поля по предметной области, заполняет создатель при формировании

  // Дата дня поездки
  @Column({ name: 'trip_date', type: 'date', nullable: true })
  tripDate: string | null;

  // Заряд батареи на начало дня, %
  @Column({
    name: 'start_charge_percent',
    type: 'numeric',
    precision: 5,
    scale: 1,
    nullable: true,
    transformer: numericToNumber,
  })
  startChargePercent: number | null;

  // --- вычисляемые поля, считаются при формировании

  // Суммарный расход за день, кВт*ч
  @Column({
    name: 'total_consumed_kwh',
    type: 'numeric',
    precision: 7,
    scale: 2,
    nullable: true,
    transformer: numericToNumber,
  })
  totalConsumedKwh: number | null;

  // Остаток заряда на конец дня, %
  @Column({
    name: 'remaining_charge_percent',
    type: 'numeric',
    precision: 5,
    scale: 1,
    nullable: true,
    transformer: numericToNumber,
  })
  remainingChargePercent: number | null;

  // --- системные даты

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @Column({ name: 'formed_at', type: 'timestamp', nullable: true })
  formedAt: Date | null;

  @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
  completedAt: Date | null;

  // --- участники

  @Column({ name: 'creator_id', type: 'integer' })
  creatorId: number;

  @ManyToOne(() => Driver, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'creator_id' })
  creator: Driver;

  @Column({ name: 'moderator_id', type: 'integer', nullable: true })
  moderatorId: number | null;

  @ManyToOne(() => Driver, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'moderator_id' })
  moderator: Driver | null;

  // --- связь многие-ко-многим с параметрами потребления

  @OneToMany(() => TripParameter, (link) => link.trip)
  tripParameters: TripParameter[];
}
