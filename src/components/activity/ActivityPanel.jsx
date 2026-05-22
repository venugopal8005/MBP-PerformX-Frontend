import {
  AlertTriangle,
  Send,
  Sparkles,
} from "lucide-react";

const items = [
  {
    icon: Send,
    title: "Weekly Executive Report sent",
    client: "Nike",
    time: "2m ago",
  },

  {
    icon: AlertTriangle,
    title: "ROAS below 1.8x threshold",
    client: "Gymshark",
    time: "14m ago",
  },

  {
    icon: Sparkles,
    title: "Creative refresh generated",
    client: "Nike",
    time: "31m ago",
  },
];

export default function ActivityPanel() {
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">
          Activity
        </h2>

        <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
          Live
        </span>
      </div>

      <div className="space-y-6">
        {items.map((item, index) => {
          const Icon = item.icon;

          return (
            <div
              key={index}
              className="flex gap-3"
            >
              <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-slate-100">
                <Icon
                  size={15}
                  className="text-slate-600"
                />
              </div>

              <div>
                <p className="text-sm font-medium text-slate-800">
                  {item.title}
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  {item.client}
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  {item.time}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}