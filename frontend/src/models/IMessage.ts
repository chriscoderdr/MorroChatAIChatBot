export interface IMessage {
  text: string;
  isUser: boolean;
  messageId: string;
  isCodingRelated: boolean;
  isError?: boolean;
}
