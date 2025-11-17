import { config } from "../config";

export async function getPaypalAccessToken(): Promise<string | null> {
  const credentials = Buffer.from(
    `${config.paypal.client_id}:${config.paypal.client_secret}`
  ).toString("base64");

  const response = await fetch(`${config.paypal.base_url}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Failed to fetch PayPal access token: ${response.status} ${text}`
    );
  }

  const data = await response.json();
  const accessToken = data.access_token;
  if (typeof accessToken !== "string" || !accessToken.length) {
    return null;
  }
  return accessToken;
}
