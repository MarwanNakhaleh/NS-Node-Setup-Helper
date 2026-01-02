import { NS_NODE_SERVICES } from "@/lib/ns-node-services";

type Answers = Record<string, string | number | null>;

export function generateRecommendationsPrompt(answers: Answers): string {
  // Build the prompt with user answers and available services
  const location = `${answers.location_city || ""}, ${answers.location_state || ""}, ${answers.location_country || ""}`.trim();
  const servicesList = NS_NODE_SERVICES.map(
    (s) => `- ${s.label} (${s.id}): ${s.description}`
  ).join("\n");

  return `You are a helpful assistant that provides recommendations for setting up services in a specific geographic location.

    User's location: ${location}
    Initial budget: $${answers.initial_budget_usd || 0}
    Target monthly cost: $${answers.monthly_target_usd || 0}
    Household size: ${answers.household_size || "Not specified"}
    Values to foster: ${answers.values || "Not specified"}
    Priority: ${answers.priority || "Not specified"}
    Willing to use used items: ${answers.used_items || "Yes"}

    Available services to recommend:
    ${servicesList}

    Please search the internet for current prices, availability, and options for these services in ${location}. Provide detailed recommendations in JSON format with the following structure:
    {
      "recommendations": [
        {
          "serviceId": "service_id",
          "serviceName": "Service Name",
          "estimatedInitialCost": number,
          "estimatedMonthlyCost": number,
          "steps": ["step 1", "step 2", ...],
          "specificRecommendations": "Detailed recommendations based on web search",
          "sources": ["source 1", "source 2", ...]
        }
      ],
      "totalEstimatedInitialCost": number,
      "totalEstimatedMonthlyCost": number,
      "notes": "Overall notes and considerations",
      "totalEstimatedCostOverBudget": number | null,
      "overBudgetReason": string | null,
    }

    For the real estate criterion, if there are no properties available for purchase with the user's initial or monthly budget, search for properties that are available for rent with the user's budget. If you can find specific properties, include the URL to the specific listing in the "sources" field.

    If the user is willing to use used items, make sure to search websites like Craigslist, Facebook Marketplace, and other similar websites you are able to access to find used items. If you can find specific items, include the URL to the specific listing in the "sources" field.

    Make sure to:
    1. Search for real, current prices and options in the specified location
    2. Provide specific recommendations based on the user's budget and preferences
    3. Include actual service providers, stores, or resources available in that area
    4. Consider the user's values and priorities when making recommendations
    5. Try your best to make the total costs align with the user's budget constraints. If it is not possible, fill the "totalEstimatedCostOverBudget" field with the amount of the overage and the "overBudgetReason" field with the reason why it is not possible to align the costs with the user's budget constraints.
    
    Please output *only* the JSON, no markdown fences. Thank you.`;
}

