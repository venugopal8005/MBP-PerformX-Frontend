export const reports = [
  {
    id: 1,
    title: "Weekly Executive Report",
    client: "Nike",
    campaigns: 7,
    insight:
      "CTR decline detected in retargeting segment. 25-34F audience down 18% WoW.",
    frequency: "Weekly",
    status: "high",
    nextRun: "Tomorrow, 9:00 AM",
  },

  {
    id: 2,
    title: "Retargeting Watchdog",
    client: "Gymshark",
    campaigns: 3,
    insight:
      "Creative fatigue emerging in UGC campaign. Frequency threshold crossed.",
    frequency: "Daily",
    status: "medium",
    nextRun: "Runs in 4h",
  },

  {
    id: 3,
    title: "Monthly Brand Summary",
    client: "Nike",
    campaigns: 12,
    insight:
      "ROAS stabilized at 2.6x after audience consolidation.",
    frequency: "Monthly",
    status: "high",
    nextRun: "Jun 1, 9:00 AM",
  },
];
export const clients = [
  {
    id: 1,
    name: "Nike",
    account: "Nike — Brand US",
    reports: 3,
    campaigns: 22,
    updated: "1h ago",
    status: "stable",
  },

  {
    id: 2,
    name: "Gymshark",
    account: "Gymshark — Performance",
    reports: 2,
    campaigns: 13,
    updated: "31m ago",
    status: "warning",
  },

  {
    id: 3,
    name: "GrowthLabs",
    account: "GrowthLabs — E-comm",
    reports: 1,
    campaigns: 4,
    updated: "2h ago",
    status: "warning",
  },
];