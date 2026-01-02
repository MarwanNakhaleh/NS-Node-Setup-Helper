export type QuestionType = "text" | "number" | "select" | "textarea" | "radio";

export type Question = {
  id: string;
  label: string;
  type: QuestionType;
  required?: boolean;
  placeholder?: string;
  helpText?: string;
  options?: { label: string; value: string }[]; // for select
  min?: number; // for number
  max?: number; // for number
};

export const QUESTIONS: Question[] = [
  {
    id: "location_country",
    label: "Country",
    type: "text",
    required: true,
    placeholder: "e.g., USA",
  },
  {
    id: "location_state",
    label: "State",
    type: "text",
    required: true,
    placeholder: "e.g., TX",
  },
  {
    id: "location_city",
    label: "City",
    type: "text",
    required: true,
    placeholder: "e.g., Austin",
  },
  {
    id: "initial_budget_usd",
    label: "Up-front budget (USD)",
    type: "number",
    required: true,
    min: 0,
    placeholder: "e.g., 25000",
    helpText: "How much you can spend at the start (equipment, deposits, setup costs, etc.)",
  },
  {
    id: "monthly_target_usd",
    label: "Target monthly cost (USD)",
    type: "number",
    required: true,
    min: 0,
    placeholder: "e.g., 4500",
  },
  {
    id: "values",
    label: "Values you want to foster",
    type: "textarea",
    required: true,
    placeholder: "e.g., health, quiet focus, sustainability, family-friendly, community…",
    helpText: "These will later guide recommendations and trade-offs.",
  },
  {
    id: "household_size",
    label: "Expected number of people living there",
    type: "number",
    required: true,
    min: 1,
    placeholder: "e.g., 3",
  },
  {
    id: "priority",
    label: "Top priority",
    type: "select",
    options: [
      { label: "Minimize cost", value: "min_cost" },
      { label: "Maximize comfort", value: "max_comfort" },
      { label: "Maximize convenience", value: "max_convenience" },
    ],
  },
  {
    id: "used_items",
    label: "Are you willing to use used items?",
    required: true,
    type: "radio",
    options: [
      { label: "Yes, I am willing to use used items", value: "yes" },
      { label: "No, I am not willing to use used items", value: "no" },
    ],
  }
];
