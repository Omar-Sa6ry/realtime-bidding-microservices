export interface IPromptStrategy {
  build(context: any, language: string): string;
}
