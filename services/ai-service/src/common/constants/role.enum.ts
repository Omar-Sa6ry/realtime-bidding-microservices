import { registerEnumType } from "@nestjs/graphql";

export enum ChatRole {
  USER = 'user',
  MODEL = 'model',
}

registerEnumType(ChatRole, {
  name: 'ChatRole',
  description: 'ChatRole in the system',
});
