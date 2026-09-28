import { NavLink } from "react-router-dom";
import { motion } from "framer-motion";
import { PlusCircleIcon, ChartIcon, ListIcon, FuelIcon, MapPinIcon, SettingsIcon } from "./icons";

const TABS = [
  { to: "/gas", label: "Gas", icon: FuelIcon },
  { to: "/new", label: "New Job", icon: PlusCircleIcon },
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
          {({ isActive }) =>
            isActive ? (
              <>
                <motion.div
                  className="bottom-nav-pill"
                  layoutId="bottom-nav-pill"
                  transition={{ type: "spring", stiffness: 500, damping: 34 }}
                />
                <Icon size={22} />
                <span>{label}</span>
              </>
            ) : (
              <>
                <Icon size={22} />
                <span>{label}</span>
              </>
            )
          }
        </NavLink>
      ))}
    </nav>
  );
}
