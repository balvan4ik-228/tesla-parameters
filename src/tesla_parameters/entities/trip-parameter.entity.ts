import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Trip } from './trip.entity';
import { TeslaParameter } from './tesla-parameter.entity';

// PostgreSQL отдаёт numeric строкой — переводим в число
const numericToNumber = {
  to: (value?: number | null) => value,
  from: (value?: string | null) =>
    value === null || value === undefined ? null : Number(value),
};

// Связь многие-ко-многим: какие параметры потребления вошли в заявку
// и сколько часов за день работал каждый из них.
// Поле hours — то самое «значение в м-м», которое меняется методом PUT.
@Entity('trip_parameters')
@Index('uq_trip_parameters_pair', ['tripId', 'teslaParameterId'], {
  unique: true,
})
export class TripParameter {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'trip_id', type: 'integer' })
  tripId: number;

  @ManyToOne(() => Trip, (trip) => trip.tripParameters, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'trip_id' })
  trip: Trip;

  @Column({ name: 'tesla_parameter_id', type: 'integer' })
  teslaParameterId: number;

  @ManyToOne(() => TeslaParameter, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'tesla_parameter_id' })
  teslaParameter: TeslaParameter;

  // Сколько часов за день работал параметр. Расход = сила тока * 400 В * часы.
  @Column({
    type: 'numeric',
    precision: 4,
    scale: 1,
    default: 1,
    transformer: numericToNumber,
  })
  hours: number;
}
