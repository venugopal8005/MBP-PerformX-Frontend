import {
  Activity,
  AlertTriangle,
  Archive,
  BadgeDollarSign,
  CheckCircle2,
  Circle,
  Clock3,
  DatabaseZap,
  FilePlus2,
  FilterX,
  Gauge,
  GitMerge,
  ImageOff,
  Info,
  Lightbulb,
  MailCheck,
  MousePointerClick,
  PauseCircle,
  Pencil,
  PlayCircle,
  PlugZap,
  Radar,
  RefreshCcw,
  Repeat,
  Rocket,
  RouteOff,
  TrendingDown,
  TrendingUp,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";

import { getActivityPresentation } from "./activityPresentation";

const ICONS = {
  Activity,
  AlertTriangle,
  Archive,
  BadgeDollarSign,
  CheckCircle2,
  Circle,
  Clock3,
  DatabaseZap,
  FilePlus2,
  FilterX,
  Gauge,
  GitMerge,
  ImageOff,
  Info,
  Lightbulb,
  MailCheck,
  MousePointerClick,
  PauseCircle,
  Pencil,
  PlayCircle,
  PlugZap,
  Radar,
  RefreshCcw,
  Repeat,
  Rocket,
  RouteOff,
  TrendingDown,
  TrendingUp,
  Trash2,
  UserPlus,
  Users,
};

export default function ActivityIcon({ activity, size = "md" }) {
  const presentation = getActivityPresentation(activity);
  const Icon = ICONS[presentation.icon.name] || Circle;
  const iconSize = size === "sm" ? 15 : 18;
  const containerSize = size === "sm" ? "h-8 w-8" : "h-10 w-10";

  return (
    <div
      title={presentation.label}
      className={`${containerSize} flex shrink-0 items-center justify-center rounded-full border shadow-sm`}
      style={{
        backgroundColor: presentation.icon.background,
        borderColor: presentation.icon.border,
        color: presentation.icon.color,
      }}
    >
      <Icon size={iconSize} strokeWidth={2.2} />
    </div>
  );
}
