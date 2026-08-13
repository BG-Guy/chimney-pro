import { NavLink } from "react-router-dom";
import { PlusCircleIcon, ChartIcon, ListIcon, FuelIcon } from "./icons";

const TABS = [
  { to: "/gas", label: "Gas", icon: FuelIcon },
  { to: "/new", label: "New Job", icon: PlusCircleIcon },
  { to: "/insights", label: "Insights", icon: ChartIcon },
  { to: "/jobs", label: "Jobs", icon: ListIcon },
];

export default function BottomNav() {
  return (
    <nav className="bottom-nav">
      {TABS.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) => `bottom-nav-item${isActive ? " active" : ""}`}
        >
          <Icon size={22} />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
