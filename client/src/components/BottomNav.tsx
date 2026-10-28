import { NavLink } from "react-router-dom";
import { PlusCircleIcon, ChartIcon, ListIcon, MapPinIcon, SettingsIcon } from "./icons";

const TABS = [
  { to: "/new", label: "New job", icon: PlusCircleIcon },
  { to: "/insights", label: "Insights", icon: ChartIcon },
  { to: "/jobs", label: "Jobs", icon: ListIcon },
  { to: "/route", label: "Route", icon: MapPinIcon },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
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
          <Icon size={24} />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
