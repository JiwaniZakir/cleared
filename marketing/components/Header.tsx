import { PRODUCT } from "@/lib/product";
import { CopyButton } from "./CopyButton";

/** The word at left, the one button at right, always on screen. Nothing else. */
export function Header() {
  return (
    <header className="header" data-header data-ground="bone">
      <a className="wordmark" href="#top" aria-label={`${PRODUCT.name}, to the top of the page`}>
        {PRODUCT.name}
      </a>
      <CopyButton />
    </header>
  );
}
