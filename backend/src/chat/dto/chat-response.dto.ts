import { ApiProperty } from '@nestjs/swagger';

export class ChatResponseDto {
  @ApiProperty({
    description: 'The response from the AI chatbot',
    example:
      'Dominican food is known for its rich flavors and diverse influences...',
  })
  reply: string;
}
