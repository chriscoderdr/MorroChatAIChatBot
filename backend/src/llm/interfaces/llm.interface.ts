export interface Llm {
  generateResponse(prompt: string): Promise<string>;
}