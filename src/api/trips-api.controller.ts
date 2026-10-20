import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Put,
  Query,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  CURRENT_DRIVER_ID,
  CURRENT_MODERATOR_ID,
} from '../tesla_parameters/current-driver';
import {
  CompleteTripDto,
  FormTripDto,
  ListTripsDto,
  UpdateTripParameterDto,
} from './dto/parameters.dto';
import { TripsApiService } from './trips-api.service';

// Заявка — день поездки. Все адреса начинаются с /api.
@Controller('api/trips')
// Поля, которых нет в DTO, отбрасываются с ошибкой: системные поля
// (статус, создатель, модератор, даты) с клиента принять нельзя.
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
)
export class TripsApiController {
  constructor(private readonly trips: TripsApiService) {}

  // 5. GET /api/trips — список заявок.
  // Черновики и удалённые не отдаются. Фильтры: статус и диапазон
  // даты формирования.
  @Get()
  list(@Query() filters: ListTripsDto) {
    return this.trips.list(filters);
  }

  // 6. GET /api/trips/:id — одна заявка вместе с услугами
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.trips.findOne(id, CURRENT_DRIVER_ID);
  }

  // 7. PUT /api/trips/:id/parameters/:parameterId — изменение значения
  // в таблице связи: сколько часов работал параметр.
  // Первичный ключ связи в адресе не участвует.
  @Put(':id/parameters/:parameterId')
  updateParameter(
    @Param('id', ParseIntPipe) id: number,
    @Param('parameterId', ParseIntPipe) parameterId: number,
    @Body() dto: UpdateTripParameterDto,
  ) {
    return this.trips.updateParameter(id, parameterId, dto, CURRENT_DRIVER_ID);
  }

  // 8. DELETE /api/trips/:id/parameters/:parameterId — удаление услуги
  // из заявки. Первичный ключ связи в адресе не участвует.
  @Delete(':id/parameters/:parameterId')
  removeParameter(
    @Param('id', ParseIntPipe) id: number,
    @Param('parameterId', ParseIntPipe) parameterId: number,
  ) {
    return this.trips.removeParameter(id, parameterId, CURRENT_DRIVER_ID);
  }

  // 9. PUT /api/trips/:id/form — формирование заявки создателем.
  // Заполняются поля по предметной области, считается остаток заряда.
  @Put(':id/form')
  form(@Param('id', ParseIntPipe) id: number, @Body() dto: FormTripDto) {
    return this.trips.form(id, dto, CURRENT_DRIVER_ID);
  }

  // 10. PUT /api/trips/:id/complete — завершение или отклонение модератором
  @Put(':id/complete')
  complete(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CompleteTripDto,
  ) {
    return this.trips.complete(id, dto, CURRENT_MODERATOR_ID);
  }
}
