import { IsEnum, IsOptional } from 'class-validator';
import { OrderStatusList } from '../enums/order.enum';
import { OrderStatus } from '@prisma/client';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class OrderPaginationDto extends PaginationDto {
  @IsOptional()
  @IsEnum(OrderStatusList, {
    message: `Valid status are ${OrderStatusList.toString()}`,
  })
  status: OrderStatus;
}
