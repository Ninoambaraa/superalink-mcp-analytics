import { getStripeCharges } from "./mastra/tools/stripe-charge-tool";

const data = await getStripeCharges('2025-10-01', '2025-10-10')
// console.log(data)