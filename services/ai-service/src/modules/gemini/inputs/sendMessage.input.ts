import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

@InputType()
export class SendMessageInput {
  @Field()
  @IsString()
  @IsNotEmpty()
  auctionId: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  text: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  language?: string;
}
