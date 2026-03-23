/**
 * HeaderActionsPortal – portals content into the #sprout-header-actions element.
 */

import { createPortal } from "react-dom";

export const HeaderActionsPortal = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  if (typeof document === "undefined") return null;
  const target = document.getElementById("sprout-header-actions");
  if (!target) return null;
  return createPortal(children, target);
};
