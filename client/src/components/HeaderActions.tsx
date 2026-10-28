import { createContext, useContext, type ReactNode } from "react";
import { createPortal } from "react-dom";

// The header (in App) owns a slot on the right of the large title; a page drops its own
// buttons there — like the Jobs calendar — by wrapping them in <HeaderActions>.
export const HeaderActionsContext = createContext<HTMLElement | null>(null);

export default function HeaderActions({ children }: { children: ReactNode }) {
  const target = useContext(HeaderActionsContext);
  return target ? createPortal(children, target) : null;
}
