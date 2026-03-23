export interface PaymentItem {
  name: string;
  price: number;
  quantity: number;
}

export interface IPaymentStrategy {
  createSession(userId: string, amount: number, items: PaymentItem[]): Promise<string>;
  verifyWebhook(signature: string, payload: Buffer): any;
}
