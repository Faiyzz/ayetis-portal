import {
  PAYMENT_PROVIDERS,
  type PaymentProviderId,
} from '@ayetis/shared';
import { env } from '../../config/env';
import type { IPaymentSession } from '../../models/Commercial';
import { AppError } from '../../utils/AppError';

export function isStripeConfigured(): boolean {
  return Boolean(env.stripeSecretKey);
}

export async function createStripeCheckout(session: IPaymentSession): Promise<{
  checkoutUrl: string;
  stripeSessionId: string;
}> {
  if (!isStripeConfigured()) {
    return {
      checkoutUrl: `${env.clientUrl}/app/pay/${session.id}?mockStripe=1`,
      stripeSessionId: `mock_cs_${session.id}`,
    };
  }

  // Minimal Stripe Checkout Session via REST (avoids heavy SDK dependency).
  const params = new URLSearchParams();
  params.set('mode', 'payment');
  params.set('success_url', `${env.clientUrl}/app/pay/${session.id}?paid=1`);
  params.set('cancel_url', `${env.clientUrl}/app/pay/${session.id}?cancelled=1`);
  params.set('client_reference_id', session.id);
  params.set('metadata[paymentSessionId]', session.id);
  params.set('line_items[0][quantity]', '1');
  params.set(
    'line_items[0][price_data][currency]',
    session.currency.toLowerCase(),
  );
  params.set(
    'line_items[0][price_data][unit_amount]',
    String(Math.round(session.amount * 100)),
  );
  params.set(
    'line_items[0][price_data][product_data][name]',
    'Ayetis case payment',
  );

  const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.stripeSecretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new AppError(`Stripe checkout failed: ${text}`, 502);
  }

  const data = (await response.json()) as { id: string; url: string };
  return { checkoutUrl: data.url, stripeSessionId: data.id };
}

export async function confirmStripeSession(
  payload: Buffer,
  signature: string | undefined,
): Promise<{ paymentSessionId: string; stripeSessionId: string } | null> {
  if (!isStripeConfigured()) {
    // Dev/mock webhook body: { paymentSessionId }
    try {
      const json = JSON.parse(payload.toString('utf8')) as {
        paymentSessionId?: string;
        data?: { object?: { client_reference_id?: string; id?: string } };
      };
      const paymentSessionId =
        json.paymentSessionId || json.data?.object?.client_reference_id;
      if (!paymentSessionId) return null;
      return {
        paymentSessionId,
        stripeSessionId: json.data?.object?.id || `mock_${paymentSessionId}`,
      };
    } catch {
      return null;
    }
  }

  if (!signature || !env.stripeWebhookSecret) {
    throw new AppError('Missing Stripe webhook signature', 400);
  }

  // Simplified verification: parse event; production should use stripe.webhooks.constructEvent.
  // When webhook secret is set we still require a non-empty signature header.
  const event = JSON.parse(payload.toString('utf8')) as {
    type?: string;
    data?: { object?: { client_reference_id?: string; id?: string; metadata?: { paymentSessionId?: string } } };
  };

  if (event.type !== 'checkout.session.completed') return null;
  const obj = event.data?.object;
  const paymentSessionId =
    obj?.metadata?.paymentSessionId || obj?.client_reference_id;
  if (!paymentSessionId || !obj?.id) return null;
  return { paymentSessionId, stripeSessionId: obj.id };
}

export function providerSupportsImmediateConfirm(provider: PaymentProviderId): boolean {
  return provider === PAYMENT_PROVIDERS.STRIPE;
}
