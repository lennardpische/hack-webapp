import { tool } from "ai";
import { z } from "zod";
import {
  readOnlySupplyChainTools,
  supplyChainAgentTools,
} from "@/lib/tools/supply-chain";

/**
 * Example tools for the hackathon starter.
 *
 * Add your own tools here — connect APIs, databases, Cloudflare Workers,
 * Baseten endpoints, or wrap MCP server tools (see lib/tools/mcp-tools.ts).
 */
export const getWeather = tool({
  description: "Get the current weather for a city",
  inputSchema: z.object({
    city: z.string().describe("City name, e.g. Boston"),
    units: z
      .enum(["fahrenheit", "celsius"])
      .optional()
      .describe("Temperature units"),
  }),
  execute: async ({ city, units = "fahrenheit" }) => {
    const tempF = 55 + Math.floor(Math.random() * 30);
    const tempC = Math.round(((tempF - 32) * 5) / 9);
    return {
      city,
      condition: ["sunny", "cloudy", "rainy", "windy"][
        Math.floor(Math.random() * 4)
      ],
      temperature: units === "celsius" ? tempC : tempF,
      units,
      source: "demo-tool",
    };
  },
});

export const calculate = tool({
  description: "Evaluate a basic math expression (numbers and + - * / parentheses)",
  inputSchema: z.object({
    expression: z
      .string()
      .describe("Math expression, e.g. (17 * 23) + 4"),
  }),
  execute: async ({ expression }) => {
    const sanitized = expression.replace(/[^0-9+\-*/().\s]/g, "");
    if (!sanitized.trim()) {
      return { error: "Invalid expression" };
    }
    const result = Function(`"use strict"; return (${sanitized})`)();
    return { expression, result };
  },
});

export const webSearch = tool({
  description:
    "Search the web for information. Replace this stub with Tavily, SerpAPI, or your own search API.",
  inputSchema: z.object({
    query: z.string().describe("Search query"),
    maxResults: z.number().min(1).max(10).optional(),
  }),
  execute: async ({ query, maxResults = 3 }) => {
    await new Promise((resolve) => setTimeout(resolve, 800));
    return {
      query,
      results: Array.from({ length: maxResults }, (_, i) => ({
        title: `Result ${i + 1} for "${query}"`,
        url: `https://example.com/search?q=${encodeURIComponent(query)}&r=${i + 1}`,
        snippet:
          "Replace lib/tools/index.ts webSearch with a real API call during the hackathon.",
      })),
      note: "Stub — wire up a real search provider to go further.",
    };
  },
});

export const runLongTask = tool({
  description:
    "Run a multi-step background task. Use for demos of long-running agent work.",
  inputSchema: z.object({
    taskName: z.string().describe("Short label for the task"),
    steps: z
      .number()
      .min(1)
      .max(8)
      .optional()
      .describe("Number of simulated steps"),
  }),
  execute: async ({ taskName, steps = 4 }) => {
    const log: string[] = [];
    for (let i = 1; i <= steps; i++) {
      await new Promise((resolve) => setTimeout(resolve, 600));
      log.push(`Step ${i}/${steps}: processed "${taskName}"`);
    }
    return {
      taskName,
      status: "complete",
      stepsCompleted: steps,
      log,
    };
  },
});

export const demoTools = {
  getWeather,
  calculate,
  webSearch,
  runLongTask,
};

export const chatTools = {
  ...readOnlySupplyChainTools,
};

export const agentTools = {
  ...supplyChainAgentTools,
};
