import crypto from 'crypto';
import Razorpay from 'razorpay';
import { env, isRazorpayConfigured } from '../config/env.js';

export interface CreateOrderInput {
  amountInSmallestUnit: number;
  currency: string;
  receipt: string;
  notes?: Record<string, string>;
}

export interface CreateOrderOutput {
  gateway: 'razorpay' | 'dev_simulator';
  orderId: string;
  amount: number;
  currency: string;
  keyId?: string;
  isSimulated: boolean;
}

export interface VerifyPaymentInput {
  orderId: string;
  paymentId: string;
  signature: string;
}

export interface IPaymentGateway {
  readonly name: 'razorpay' | 'dev_simulator';
  createOrder(input: CreateOrderInput): Promise<CreateOrderOutput>;
  verifySignature(input: VerifyPaymentInput): boolean;
  verifyWebhookSignature(rawBody: string | Buffer, signature: string): boolean;
}

const DEV_SIM_SECRET = 'rentflow-dev-simulator-hmac-secret-not-for-production';

class RazorpayGateway implements IPaymentGateway {
  public readonly name = 'razorpay' as const;
  private client: Razorpay;

  constructor() {
    this.client = new Razorpay({
      key_id: env.RAZORPAY_KEY_ID,
      key_secret: env.RAZORPAY_KEY_SECRET,
    });
  }

  async createOrder(input: CreateOrderInput): Promise<CreateOrderOutput> {
    const order = await this.client.orders.create({
      amount: input.amountInSmallestUnit,
      currency: input.currency,
      receipt: input.receipt,
      notes: input.notes,
    });

    return {
      gateway: 'razorpay',
      orderId: order.id,
      amount: Number(order.amount),
      currency: order.currency,
      keyId: env.RAZORPAY_KEY_ID,
      isSimulated: false,
    };
  }

  verifySignature(input: VerifyPaymentInput): boolean {
    const expected = crypto
      .createHmac('sha256', env.RAZORPAY_KEY_SECRET)
      .update(`${input.orderId}|${input.paymentId}`)
      .digest('hex');
    return safeEqualHex(expected, input.signature);
  }

  verifyWebhookSignature(rawBody: string | Buffer, signature: string): boolean {
    const secret = env.RAZORPAY_WEBHOOK_SECRET || env.RAZORPAY_KEY_SECRET;
    if (!secret || !signature) return false;
    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    return safeEqualHex(expected, signature);
  }
}

class DevSimulatedGateway implements IPaymentGateway {
  public readonly name = 'dev_simulator' as const;

  async createOrder(input: CreateOrderInput): Promise<CreateOrderOutput> {
    const orderId = `order_sim_${crypto.randomBytes(8).toString('hex')}`;
    return {
      gateway: 'dev_simulator',
      orderId,
      amount: input.amountInSmallestUnit,
      currency: input.currency,
      isSimulated: true,
    };
  }

  verifySignature(input: VerifyPaymentInput): boolean {
    const expected = computeDevSimulatorSignature(input.orderId, input.paymentId);
    return safeEqualHex(expected, input.signature);
  }

  verifyWebhookSignature(rawBody: string | Buffer, signature: string): boolean {
    const expected = crypto.createHmac('sha256', DEV_SIM_SECRET).update(rawBody).digest('hex');
    return safeEqualHex(expected, signature);
  }
}

export function computeDevSimulatorSignature(orderId: string, paymentId: string): string {
  return crypto
    .createHmac('sha256', DEV_SIM_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
}

function safeEqualHex(expectedHex: string, actualHex: string): boolean {
  if (!expectedHex || !actualHex) return false;
  const a = Buffer.from(expectedHex, 'utf8');
  const b = Buffer.from(actualHex, 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function getPaymentGateway(): IPaymentGateway {
  if (isRazorpayConfigured) {
    return new RazorpayGateway();
  }
  return new DevSimulatedGateway();
}
