import { BaseEntity, CapitalTextField, EmailField } from '@bts-soft/core';
import { Directive, Field, ObjectType, registerEnumType } from '@nestjs/graphql';
import { Exclude } from 'class-transformer';
import { Role } from '@bidding-micro/shared';
import { Entity, Column, Index, Check } from 'typeorm';

registerEnumType(Role, {
  name: 'Role',
});

@Directive('@key(fields: "id")')
@Directive('@shareable')
@ObjectType()
@Entity('users')
@Check(`("password" IS NOT NULL) OR ("googleId" IS NOT NULL)`)
@Index(['email', 'id'])
export class User extends BaseEntity {
  @Field(() => String)
  @Column({ length: 100, nullable: true })
  @CapitalTextField('firstName')
  firstName?: string;

  @Field(() => String)
  @Column({ length: 100, nullable: true })
  @CapitalTextField('lastName')
  lastName?: string;

  @Field(() => String)
  @Column({ length: 100, unique: true })
  @EmailField()
  email: string;

  @Exclude()
  @Column({
    type: 'enum',
    enum: Role,
    default: Role.USER,
  })
  role: Role;

  @Exclude()
  @Column({ nullable: true })
  password?: string;

  @Exclude()
  @Column({ nullable: true, unique: true })
  googleId?: string;

  @Field(() => String)
  @Column({ length: 100 })
  country: string;

  @Exclude()
  @Column({ nullable: true })
  resetToken?: string;

  @Exclude()
  @Column({ type: 'timestamp', nullable: true })
  resetTokenExpiry?: Date | null;

  @Field(() => Number, { defaultValue: 0 })
  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  balance: number;

  @Field(() => String, { nullable: true })
  get firstname(): string | undefined {
    return this.firstName;
  }

  @Field(() => String, { nullable: true })
  get lastname(): string | undefined {
    return this.lastName;
  }
}
