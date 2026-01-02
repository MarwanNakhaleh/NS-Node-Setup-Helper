export type NsNodeService = {
  id: string;
  label: string;
  description: string;
  steps: string[];
};

export const NS_NODE_SERVICES: NsNodeService[] = [
  {
    id: "meal_prep",
    label: "Meal Prep",
    description: "Prepare meals at home for a healthy lifestyle",
    steps: ["Buy ingredients", "Prepare meals", "Store meals"],
  },
  {
    id: "home_gym",
    label: "Home Gym",
    description: "Build a home gym for fitness and wellness",
    steps: ["Buy equipment", "Set up space", "Train regularly"],
  },
  {
    id: "mixed_use_real_estate",
    label: "Mixed-Use Real Estate",
    description: "Buy or rent a residential or mixed-use property for living and working, depending on cost and the user's preferences",
    steps: ["Find a property", "Buy or rent", "Set up living and working space", "Install utilities and high-speed high-quality Internet"],
  },
  {
    id: "monthly_target_usd",
    label: "Cleaning Services",
    description: "Hire a cleaning service or a janitor for the whole establishment, depending on the amount of cleaning expected for the number of people and the size of the place",
    steps: ["Hire a cleaning service or a janitor", "Schedule cleaning", "Maintain cleanliness"],
  },
];
