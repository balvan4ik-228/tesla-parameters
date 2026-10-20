-- Наполнение таблиц третьей лабораторной.
-- Выполнять ПОСЛЕ команды npm run migrate.
--
-- Скрипт не привязан к конкретным id параметров: они ищутся по названию.
-- Поэтому он отработает и на базе, где уже успели добавить и удалить записи.

-- 1. Заявки. Расчётные поля пока пустые, они считаются ниже.
INSERT INTO trips
  (status, trip_date, start_charge_percent, created_at, formed_at,
   completed_at, creator_id, moderator_id)
VALUES
  ('завершена',    DATE '2026-10-10',  95.0,
   now() - interval '9 days', now() - interval '9 days',
   now() - interval '8 days', 1, 3),
  ('отклонена',    DATE '2026-10-12',  80.0,
   now() - interval '7 days', now() - interval '7 days',
   now() - interval '6 days', 2, 3),
  ('сформирована', DATE '2026-10-17', 100.0,
   now() - interval '2 days', now() - interval '2 days', NULL, 1, NULL),
  ('черновик',     NULL,               NULL,
   now() - interval '1 day', NULL, NULL, 1, NULL);

-- 2. Состав заявок: какой параметр и сколько часов работал.
-- Параметры берутся по названию среди опубликованных.
INSERT INTO trip_parameters (trip_id, tesla_parameter_id, hours)
SELECT t.id, p.id, v.hours
FROM (VALUES
    ('завершена',    'Движение по шоссе 120 км/ч',      2.0),
    ('завершена',    'Городской цикл с рекуперацией',   1.5),
    ('отклонена',    'Обогрев салона при минус 15',     3.0),
    ('сформирована', 'Движение по шоссе 120 км/ч',      1.0),
    ('черновик',     'Городской цикл с рекуперацией',   2.0)
  ) AS v(trip_status, parameter_name, hours)
JOIN trips t
  ON t.status = v.trip_status
JOIN tesla_parameters p
  ON p.parameter_name = v.parameter_name
 AND p.status = 'опубликован'
WHERE NOT EXISTS (
  SELECT 1 FROM trip_parameters tp
  WHERE tp.trip_id = t.id AND tp.tesla_parameter_id = p.id
);

-- 3. Расчёт по формуле из лабораторной 2.
-- Расход одного параметра: сила тока (А) * 400 В * часы / 1000 = кВт*ч.
-- Ёмкость батареи Tesla Model S — 100 кВт*ч,
-- значит один киловатт-час расхода равен одному проценту заряда.
UPDATE trips t
SET total_consumed_kwh = calc.total,
    remaining_charge_percent = GREATEST(t.start_charge_percent - calc.total, 0)
FROM (
  SELECT tp.trip_id,
         ROUND(SUM(p.current_a * 400 * tp.hours / 1000)::numeric, 2) AS total
  FROM trip_parameters tp
  JOIN tesla_parameters p ON p.id = tp.tesla_parameter_id
  GROUP BY tp.trip_id
) AS calc
WHERE calc.trip_id = t.id
  AND t.status <> 'черновик';

-- 4. Проверка: что получилось
SELECT t.id,
       t.status,
       t.trip_date,
       t.start_charge_percent    AS "заряд на начало, %",
       t.total_consumed_kwh      AS "расход, кВт*ч",
       t.remaining_charge_percent AS "остаток, %",
       count(tp.id)              AS "параметров"
FROM trips t
LEFT JOIN trip_parameters tp ON tp.trip_id = t.id
GROUP BY t.id
ORDER BY t.id;
