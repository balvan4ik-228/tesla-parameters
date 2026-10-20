import { TeslaParameter } from '../tesla_parameters/entities/tesla-parameter.entity';
import { Trip } from '../tesla_parameters/entities/trip.entity';
import { TripParameter } from '../tesla_parameters/entities/trip-parameter.entity';

// Адрес бакета Minio: в базе лежит только имя файла
const BUCKET_URL =
  process.env.MINIO_BUCKET_URL || 'http://localhost:9000/tesla-parameters';

const fileUrl = (key?: string | null): string | null =>
  key ? `${BUCKET_URL}/${key}` : null;

// Сериализаторы: наружу уходят вычисленные адреса файлов,
// а не внутренние ключи объектов.

export interface ParameterView {
  id: number;
  parameterName: string;
  shortDescription: string | null;
  currentA: number | null;
  powerW: number | null;
  imageUrl: string | null;
  videoUrl: string | null;
  status: string;
}

export const toParameterView = (p: TeslaParameter): ParameterView => ({
  id: p.id,
  parameterName: p.parameterName,
  shortDescription: p.shortDescription,
  currentA: p.currentA,
  powerW: p.powerW,
  imageUrl: fileUrl(p.imageKey),
  videoUrl: fileUrl(p.videoKey),
  status: p.status,
});

export interface TripParameterView extends ParameterView {
  hours: number;
  // Расход этого параметра за день, кВт*ч
  consumedKwh: number;
}

// Расход одного параметра: сила тока (А) * 400 В * часы / 1000
export const consumedKwh = (currentA: number | null, hours: number): number =>
  Math.round(((currentA ?? 0) * 400 * hours) / 1000 * 100) / 100;

export const toTripParameterView = (
  link: TripParameter,
): TripParameterView => ({
  ...toParameterView(link.teslaParameter),
  hours: link.hours,
  consumedKwh: consumedKwh(link.teslaParameter?.currentA ?? null, link.hours),
});

export interface TripListView {
  id: number;
  status: string;
  tripDate: string | null;
  startChargePercent: number | null;
  totalConsumedKwh: number | null;
  remainingChargePercent: number | null;
  createdAt: Date;
  formedAt: Date | null;
  completedAt: Date | null;
  creatorLogin: string | null;
  moderatorLogin: string | null;
  // Вычисляемое поле по таблице связи
  parametersCount: number;
}

export const toTripListView = (
  trip: Trip,
  parametersCount: number,
): TripListView => ({
  id: trip.id,
  status: trip.status,
  tripDate: trip.tripDate,
  startChargePercent: trip.startChargePercent,
  totalConsumedKwh: trip.totalConsumedKwh,
  remainingChargePercent: trip.remainingChargePercent,
  createdAt: trip.createdAt,
  formedAt: trip.formedAt,
  completedAt: trip.completedAt,
  creatorLogin: trip.creator ? trip.creator.login : null,
  moderatorLogin: trip.moderator ? trip.moderator.login : null,
  parametersCount,
});

export interface TripDetailView extends TripListView {
  parameters: TripParameterView[];
}

export const toTripDetailView = (
  trip: Trip,
  links: TripParameter[],
): TripDetailView => ({
  ...toTripListView(trip, links.length),
  parameters: links.map(toTripParameterView),
});
