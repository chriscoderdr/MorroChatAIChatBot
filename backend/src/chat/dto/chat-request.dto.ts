import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChatRequestDto {
  @ApiProperty({
    description: 'The message from the user to be processed by the chatbot',
    example: 'Tell me about Dominican food',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  message: string;
}
