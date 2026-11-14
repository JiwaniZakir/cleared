import type { Metadata } from "next";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";
import { RecruiterGuide } from "@/components/recruiter-guide";

export const metadata: Metadata = {
  title: "Recruiter guide",
  description:
    "The 38 steps from opening a role to day one: what cleared does, what a named person must do and why, and what must never happen before what. Every legal point linked to its source.",
};

// Static: everything on this page comes from data/pipeline-steps.json at build
// time. The guide body lives in components/ so it can be
// unit tested; a page file may only export the page and its metadata.
export default function RecruiterGuidePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Nav />
      <main id="main-content" className="mx-auto w-full max-w-[860px] flex-1 px-6 py-16 sm:py-20">
        <RecruiterGuide />
      </main>
      <Footer />
    </div>
  );
}
