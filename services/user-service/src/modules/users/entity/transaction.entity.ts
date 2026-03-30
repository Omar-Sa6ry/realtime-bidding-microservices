import { BaseEntity } from '@bts-soft/core';
import { Field, ObjectType, registerEnumType } from '@nestjs/graphql';
import { TransactionStatus, TransactionType } from '@bidding-micro/shared';
import { Entity, Column, ManyToOne, Index } from 'typeorm';
import { User } from './user.entity';

registerEnumType(TransactionType, {
  name: 'TransactionType',
});

registerEnumType(TransactionStatus, {
  name: 'TransactionStatus',
});

@ObjectType()
@Entity('transactions')
@Index(['userId', 'createdAt'])
export class Transaction extends BaseEntity {
  @Field(() => String)
  @Column()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user: User;

  @Field(() => Number)
  @Column('decimal', { precision: 12, scale: 2 })
  amount: number;

  @Field(() => TransactionType)
  @Column({
    type: 'enum',
    enum: TransactionType,
  })
  type: TransactionType;

  @Field(() => TransactionStatus)
  @Column({
    type: 'enum',
    enum: TransactionStatus,
    default: TransactionStatus.COMPLETED,
  })
  status: TransactionStatus;

  @Field(() => String, { nullable: true })
  @Column({ nullable: true })
  referenceId?: string;

  @Field(() => String, { nullable: true })
  @Column({ nullable: true })
  description?: string;
}
