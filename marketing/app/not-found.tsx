import type { Metadata } from "next";
import Link from "next/link";
import { PRODUCT } from "@/lib/product";

export const metadata: Metadata = { title: "Not here. Cleared." };

/** A wrong address: say so, and offer the one page there is. */
export default function NotFound() {
  return (
    <main className="hero">
      <div className="hero__copy">
        <p className="label label--eyebrow">404</p>
        <h1 className="headline headline--hero">This Page Is Not Here.</h1>
        <p className="lead">{PRODUCT.name} is one page.</p>
        <Link href="/" className="btn btn--md">
          <span className="btn__label">Go to the Page</span>
        </Link>
      </div>
    </main>
  );
}
