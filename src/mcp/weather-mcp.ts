import { MCPServer } from "@mastra/mcp";
import { weatherAgent } from "../mastra/agents/weather-agent";
import { weatherWorkflow } from "../mastra/workflows/weather-workflow";
import { weatherTool } from "../mastra/tools/weather-tool";
import { stripeChargeTool } from "../mastra/tools/stripe-charge-tool";
import { stripeChargeSummaryTool, stripeTopCustomersTool } from "../mastra/tools/stripe-analytics-tools";
import { analyticsAgent } from "../mastra/agents/analytics-agent";

export const myMcpServer = new MCPServer({
  name: "SuperalinkAnalytics Mcp Server",
  version: "1.0.0",
  tools: { stripeChargeTool, stripeChargeSummaryTool, stripeTopCustomersTool },
  agents: { analyticsAgent },
});
