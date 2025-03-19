import {
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { PrismaClient } from '@prisma/client';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { OrderPaginationDto } from './dto/order-pagination.dto';
import { ChangeOrderStatusDto } from './dto/change-order-status.dto';
import { PRODUCT_SERVICE } from 'src/config/services';
import { catchError, firstValueFrom } from 'rxjs';

@Injectable()
export class OrdersService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger('OrdersService');

  constructor(
    @Inject(PRODUCT_SERVICE)
    private readonly productsClient: ClientProxy,
  ) {
    super();
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Database connected.');
  }

  async create(createOrderDto: CreateOrderDto) {
    const productIds = createOrderDto.items.map((i) => i.productId);
    const products = await firstValueFrom(
      this.productsClient
        .send<
          {
            id: number;
            name: string;
            price: number;
            available: boolean;
            createdAt: Date;
            updatedAt: Date;
          }[]
        >({ cmd: 'validate_products' }, productIds)
        .pipe(
          catchError((err: Error) => {
            throw new RpcException(err);
          }),
        ),
    );

    const totalAmount = createOrderDto.items.reduce((acc, orderItem) => {
      const { price } = products.find(
        (product) => product.id === orderItem.productId,
      )!;

      return acc + price * orderItem.quantity;
    }, 0);

    const totalItems = createOrderDto.items.reduce((acc, orderItem) => {
      return acc + orderItem.quantity;
    }, 0);

    const order = await this.order.create({
      data: {
        totalAmount,
        totalItems,
        OrderItem: {
          createMany: {
            data: createOrderDto.items.map((item) => {
              const { price } = products.find(
                (product) => product.id === item.productId,
              )!;

              return {
                price,
                productId: item.productId,
                quantity: item.quantity,
              };
            }),
          },
        },
      },
      include: {
        OrderItem: {
          select: {
            price: true,
            quantity: true,
            productId: true,
          },
        },
      },
    });

    return {
      id: order.id,
      totalAmount: order.totalAmount,
      totalItems: order.totalItems,
      status: order.status,
      paid: order.paid,
      paidAt: order.paidAt,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      orderItem: order.OrderItem.map((orderItem) => ({
        ...orderItem,
        productName: products.find(
          (product) => product.id === orderItem.productId,
        )!.name,
      })),
    };
  }

  async findAll(orderPaginationDto: OrderPaginationDto) {
    const totalPages = await this.order.count({
      where: {
        status: orderPaginationDto.status,
      },
    });
    const currentPage = orderPaginationDto.page;
    const perPage = orderPaginationDto.limit;

    return {
      data: await this.order.findMany({
        skip: (currentPage - 1) * perPage,
        take: perPage,
        where: {
          status: orderPaginationDto.status,
        },
      }),
      metadata: {
        totalPages,
        currentPage,
        lastPage: Math.ceil(totalPages / perPage),
      },
    };
  }

  async findOne(id: string) {
    const order = await this.order.findUnique({
      where: {
        id,
      },
      include: {
        OrderItem: {
          select: {
            price: true,
            quantity: true,
            productId: true,
          },
        },
      },
    });

    if (!order)
      throw new RpcException({
        status: HttpStatus.NOT_FOUND,
        message: `Order with id ${id} not found.`,
      });

    const products = await firstValueFrom(
      this.productsClient
        .send<
          {
            id: number;
            name: string;
            price: number;
            available: boolean;
            createdAt: Date;
            updatedAt: Date;
          }[]
        >(
          { cmd: 'validate_products' },
          order.OrderItem.map((i) => i.productId),
        )
        .pipe(
          catchError((err: Error) => {
            throw new RpcException(err);
          }),
        ),
    );

    return {
      id: order.id,
      totalAmount: order.totalAmount,
      totalItems: order.totalItems,
      status: order.status,
      paid: order.paid,
      paidAt: order.paidAt,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      orderItem: order.OrderItem.map((orderItem) => ({
        ...orderItem,
        productName: products.find(
          (product) => product.id === orderItem.productId,
        )!.name,
      })),
    };
  }

  async changeStatus(changeOrderStatusDto: ChangeOrderStatusDto) {
    const order = await this.findOne(changeOrderStatusDto.id);

    if (order.status === changeOrderStatusDto.status) return order;

    return await this.order.update({
      where: {
        id: order.id,
      },
      data: {
        status: changeOrderStatusDto.status,
      },
    });
  }
}
