import Stripe from 'stripe';
import { config } from '../config';

type StripeEndpoint = {
  host: string;
  protocol: 'http' | 'https';
  port?: string;
};

function resolveStripeEndpoint(baseUrl: string): StripeEndpoint {
  try {
    const url = new URL(baseUrl);
    const protocol = url.protocol.replace(':', '');
    if (protocol !== 'http' && protocol !== 'https') {
      throw new Error(`Unsupported protocol: ${url.protocol}`);
    }

    return {
      host: url.hostname,
      protocol,
      port: url.port || undefined,
    };
  } catch (error) {
    console.warn(
      `Invalid STRIPE_BASE_URL "${baseUrl}". Falling back to Stripe default endpoint. Original error:`,
      error,
    );
    return {
      host: 'api.stripe.com',
      protocol: 'https',
    };
  }
}

const endpoint = resolveStripeEndpoint(config.stripe.base_url);

const stripe = new Stripe(config.stripe.api_key, {
  host: endpoint.host,
  protocol: endpoint.protocol,
  port: endpoint.port,
});

export { stripe };
