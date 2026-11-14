# Sources

Every rule, statistic, and legal citation cleared uses, with a primary or authoritative source and a last-verified date. If something here could change (a law, a timeline figure, an API version), it's cited rather than asserted from memory. This file backs the live [`/sources`](https://cleared-mcp.vercel.app/sources) page; `tests/unit/data-integrity.test.ts` confirms every URL in `data/rules.json`/`data/timelines.json` appears somewhere below.

This project was built end-to-end in one concentrated session, and every citation below was actually opened and confirmed live as part of that build — which is why the dates cluster together rather than reflecting a staggered, ongoing audit. Treat each date as that content's build-time snapshot, not a promise of continuous re-checking.

---

## From `data/rules.json`, `data/timelines.json` and `data/pipeline-steps.json`

_Generated from `data/rules.json` (lastVerified 2026-11-13), `data/timelines.json` (lastVerified 2026-11-12) and `data/pipeline-steps.json` (checked 2026-11-13) by `scripts/generate-sources.ts`. Do not hand-edit this section — edit the data files and regenerate._

### ITAR & export control, eligibility, clearance process, sponsorship, reciprocity, continuous vetting, verification tech, pre-employment

**ITAR "U.S. Person" Definition** (`itar-us-person`, itar)
  - [22 CFR § 120.62 — U.S. Person (eCFR)](https://www.ecfr.gov/current/title-22/chapter-I/subchapter-M/part-120/subpart-C/section-120.62) — verified 2026-11-11
  - [22 CFR § 120.63 — Foreign Person (eCFR)](https://www.ecfr.gov/current/title-22/chapter-I/subchapter-M/part-120/subpart-C/section-120.63) — verified 2026-11-11
  - [8 U.S.C. § 1324b(a)(3) — "Protected Individual" Defined (Cornell LII)](https://www.law.cornell.edu/uscode/text/8/1324b) — verified 2026-11-11

**Security Clearances Require U.S. Citizenship: a Green Card Is Not Enough** (`clearance-citizenship`, eligibility)
  - [Executive Order 12968 — Access to Classified Information, §§ 2.6 and 3.1(b) (Federal Register)](https://www.federalregister.gov/documents/1995/08/07/95-19654/access-to-classified-information) — verified 2026-11-12
  - [32 CFR § 117.10(k)–(l) — Non-U.S. citizens; temporary eligibility (eCFR)](https://www.ecfr.gov/current/title-32/subtitle-A/chapter-I/subchapter-D/part-117/section-117.10) — verified 2026-11-12
  - [22 CFR § 120.62 — U.S. Person (eCFR)](https://www.ecfr.gov/current/title-22/chapter-I/subchapter-M/part-120/subpart-C/section-120.62) — verified 2026-11-12

**Limited Access Authorization (LAA) for Non-U.S. Citizens** (`laa-non-citizen`, eligibility)
  - [32 CFR § 117.10 — Determination of Eligibility for Access to Classified Information for Contractor Employees (eCFR)](https://www.ecfr.gov/current/title-32/subtitle-A/chapter-I/subchapter-D/part-117/section-117.10) — verified 2026-11-12
  - [32 CFR § 117.10 — Limited Access Authorization text (Cornell LII mirror)](https://www.law.cornell.edu/cfr/text/32/117.10) — verified 2026-11-12
  - [Executive Order 12968 — Access to Classified Information, § 2.6 (Federal Register)](https://www.federalregister.gov/documents/1995/08/07/95-19654/access-to-classified-information) — verified 2026-11-12

**EAR "Deemed Export" vs. ITAR** (`deemed-export`, itar)
  - [15 CFR § 734.13 — Export, Reexport, and Release (eCFR)](https://www.ecfr.gov/current/title-15/subtitle-B/chapter-VII/subchapter-C/part-734/section-734.13) — verified 2026-11-11
  - [BIS — Deemed Exports Policy Guidance](https://www.bis.doc.gov/index.php/enforcement/oee/14-policy-guidance/deemed-exports) — verified 2026-11-11

**SF-86 and the eApp Filing System** (`sf86-eapp`, clearance-process)
  - [Federal Register — OPM Notice on SF-86/SF-85 Information Collection](https://www.govinfo.gov/content/pkg/FR-2026-07-09/html/2026-13868.htm) — verified 2026-11-11
  - [DCSA — Electronic Questionnaires for Investigations Processing (e-QIP)](https://www.dcsa.mil/Systems-Applications/Electronic-Questionnaires-for-Investigations-Processing-e-QIP/) — verified 2026-11-14
  - [Trusted Workforce 2.0 Quarterly Progress Report, FY2026 Q3 (Performance Accountability Council)](https://assets.performance.gov/files/Personnel_Vetting_QPR_(FY26-Q3).pdf) — verified 2026-11-11

**NBIS vs. DISS: Current System of Record** (`nbis-diss`, clearance-process)
  - [DCSA News — Industry Transition to DISS for Initiate and Review (I/R) Functionality](https://www.dcsa.mil/About-Us/News/Article/Article/4563691/industry-transition-to-diss-for-initiate-and-review-ir-functionality/) — verified 2026-11-11
  - [National Background Investigation Services (NBIS) Portal](https://vetting.nbis.mil/authentication) — verified 2026-11-11
  - [Trusted Workforce 2.0 Quarterly Progress Report, FY2026 Q3 (Performance Accountability Council)](https://assets.performance.gov/files/Personnel_Vetting_QPR_(FY26-Q3).pdf) — verified 2026-11-11

**SEAD 4: The 13 Adjudicative Guidelines** (`sead4`, eligibility)
  - [SEAD 4 — National Security Adjudicative Guidelines (June 8, 2017) — hosted by U.S. Department of Energy](https://www.energy.gov/sites/prod/files/2018/02/f48/SEAD4_20170608.pdf) — verified 2026-11-11
  - [SEAD 4 — National Security Adjudicative Guidelines (Federation of American Scientists mirror)](https://sgp.fas.org/othergov/intel/sead-4.pdf) — verified 2026-11-11
  - [DOD CAF — Whole Person Concept Fact Sheet](https://www.dcsa.mil/Portals/91/Documents/pv/DODCAF/DOD_CAF_Whole_Person_Factsheet_042021.pdf) — verified 2026-11-11

**SEAD 7: Clearance Reciprocity** (`sead7`, reciprocity)
  - [SEAD 7 — Reciprocity of Background Investigations and National Security Adjudications (Federation of American Scientists mirror)](https://sgp.fas.org/othergov/intel/sead-7.pdf) — verified 2026-11-11
  - [ICPG 704.4 — Reciprocity of Personnel Security Clearance and Access Determinations (April 6, 2022)](https://archive.dni.gov/files/documents/ICPG/ICPG-704-4-Reciprocity-of-Personnel-Security-Clearance-and-Access-Determinations-20220406.pdf) — verified 2026-11-11
  - [32 CFR § 117.10 — Determination of Eligibility for Access to Classified Information for Contractor Employees (Cornell LII)](https://www.law.cornell.edu/cfr/text/32/117.10) — verified 2026-11-11
  - [32 CFR § 156.5(h)(3) — DoD Personnel Security Program: reciprocal acceptance (eCFR)](https://www.ecfr.gov/current/title-32/subtitle-A/chapter-I/subchapter-F/part-156/section-156.5) — verified 2026-11-12

**Continuous Vetting (Trusted Workforce 2.0)** (`continuous-vetting`, continuous-vetting)
  - [Trusted Workforce 2.0 Quarterly Progress Report, FY2026 Q3 (Performance Accountability Council)](https://assets.performance.gov/files/Personnel_Vetting_QPR_(FY26-Q3).pdf) — verified 2026-11-11
  - [DCSA — Continuous Vetting](https://www.dcsa.mil/Personnel-Vetting/Continuous-Vetting/) — verified 2026-11-11

**Interim (Temporary) Clearance Eligibility** (`interim-clearance`, clearance-process)
  - [32 CFR § 117.10 — Determination of Eligibility for Access to Classified Information for Contractor Employees (Cornell LII)](https://www.law.cornell.edu/cfr/text/32/117.10) — verified 2026-11-11
  - [DCSA — Interim Clearances](https://www.dcsa.mil/Industrial-Security/Entity-Vetting-Facility-Clearances-FOCI/Facility-Clearances/Interim-Clearances/) — verified 2026-11-14

**Facility Clearance (FCL) Sponsorship for a New Company** (`fcl-sponsorship`, sponsorship)
  - [DCSA — Facility Clearance Orientation Handbook (August 2026)](https://www.dcsa.mil/Portals/128/Documents/CTP/fc/DCSA%20FCL_Orientation_Handbook_20260828.pdf) — verified 2026-11-11
  - [DCSA — Small Business Guide to the Facility Clearance Process](https://www.dcsa.mil/Portals/91/Documents/about/business/DCSA_SB_Guide_Facility_Clearance_Process_Aug2019.pdf) — verified 2026-11-11
  - [Office of Naval Research — Roadmap to Getting a Facility Clearance/FCL Sponsorship](https://www.onr.navy.mil/media/document/roadmap-getting-facility-clearancefcl-sponsorship) — verified 2026-11-11

**Current DCSA Clearance Timeliness (FY2026 Q3)** (`dcsa-timeliness`, clearance-process)
  - [DCSA Inventory & Timeliness | Industry — NISPPAC Public Meeting Slides, September 2, 2026 (data as of Aug. 17, 2026)](https://www.archives.gov/files/isoo/oversight-groups/nisppac/20260902-nisppac-public-meeting-slides.pdf) — verified 2026-11-11
  - [Trusted Workforce 2.0 Quarterly Progress Report, FY2026 Q3 (Performance Accountability Council)](https://assets.performance.gov/files/Personnel_Vetting_QPR_(FY26-Q3).pdf) — verified 2026-11-11

**Zero-Knowledge Passport Proofs (Self, zkPassport)** (`zkp-credentials`, verification-tech)
  - [Self Protocol — Official Site](https://self.xyz/) — verified 2026-11-11
  - [zkPassport — Documentation](https://docs.zkpassport.id/intro) — verified 2026-11-11

**W3C Verifiable Credentials 2.0 and SD-JWT** (`w3c-vc`, verification-tech)
  - [W3C — Verifiable Credentials Data Model v2.0 (Recommendation)](https://www.w3.org/TR/vc-data-model-2.0/) — verified 2026-11-11
  - [W3C News — The Verifiable Credentials 2.0 Family of Specifications Is Now a W3C Recommendation](https://www.w3.org/news/2025/the-verifiable-credentials-2-0-family-of-specifications-is-now-a-w3c-recommendation/) — verified 2026-11-11
  - [RFC 9901 — Selective Disclosure for JSON Web Tokens (SD-JWT)](https://www.rfc-editor.org/rfc/rfc9901.html) — verified 2026-11-11
  - [IETF — draft-ietf-oauth-sd-jwt-vc-22 (SD-JWT-based Verifiable Digital Credentials)](https://datatracker.ietf.org/doc/draft-ietf-oauth-sd-jwt-vc/22/) — verified 2026-11-11
  - [W3C Verifiable Credentials Working Group Charter (2026-2028)](https://w3c.github.io/vc-charter-2026/) — verified 2026-11-11

**Mobile Driver's License (mDL) / ISO 18013-5** (`mdl-iso18013`, verification-tech)
  - [ISO/IEC 18013-5:2021 — Personal Identification — ISO-compliant Driving Licence — Part 5: Mobile Driving Licence (mDL) Application](https://www.iso.org/standard/69084.html) — verified 2026-11-11

**Background Checks: the FCRA Sequence** (`fcra-background-check`, pre-employment)
  - [15 U.S.C. § 1681b — Permissible purposes of consumer reports; conditions for employment use (Cornell LII)](https://www.law.cornell.edu/uscode/text/15/1681b) — verified 2026-11-13
  - [15 U.S.C. § 1681d — Disclosure of investigative consumer reports (Cornell LII)](https://www.law.cornell.edu/uscode/text/15/1681d) — verified 2026-11-13
  - [15 U.S.C. § 1681c — Information excluded from consumer reports; $75,000 salary exception (Cornell LII)](https://www.law.cornell.edu/uscode/text/15/1681c) — verified 2026-11-13
  - [15 U.S.C. § 1681n — Civil liability for willful noncompliance (Cornell LII)](https://www.law.cornell.edu/uscode/text/15/1681n) — verified 2026-11-13
  - [FTC — Using Consumer Reports: What Employers Need to Know](https://www.ftc.gov/business-guidance/resources/using-consumer-reports-what-employers-need-know) — verified 2026-11-13

**Adverse Action After a Background Check** (`fcra-adverse-action`, pre-employment)
  - [15 U.S.C. § 1681b — Permissible purposes of consumer reports; conditions for employment use (Cornell LII)](https://www.law.cornell.edu/uscode/text/15/1681b) — verified 2026-11-13
  - [15 U.S.C. § 1681m — Requirements on users of consumer reports: adverse action notice (Cornell LII)](https://www.law.cornell.edu/uscode/text/15/1681m) — verified 2026-11-13
  - [FTC — Using Consumer Reports: What Employers Need to Know](https://www.ftc.gov/business-guidance/resources/using-consumer-reports-what-employers-need-know) — verified 2026-11-13
  - [FTC staff — Advisory Opinion to Weisberg (June 27, 1997): waiting period before adverse action](https://www.ftc.gov/legal-library/browse/advisory-opinions/advisory-opinion-weisberg-06-27-97) — verified 2026-11-13
  - [29 CFR § 1602.14 — Preservation of employment records (eCFR)](https://www.ecfr.gov/current/title-29/subtitle-B/chapter-XIV/part-1602/subpart-C/section-1602.14) — verified 2026-11-13
  - [California Government Code § 12946 — Four-year retention of applications and personnel records](https://california.public.law/codes/government_code_section_12946) — verified 2026-11-13

**Fair-Chance Laws: When Criminal History May Be Checked** (`fair-chance-timing`, pre-employment)
  - [41 U.S.C. § 4714 — Fair Chance Act: no criminal-history inquiries by civilian-agency contractors before a conditional offer (Cornell LII)](https://www.law.cornell.edu/uscode/text/41/4714) — verified 2026-11-13
  - [10 U.S.C. § 4657 — Fair Chance Act: no criminal-history inquiries by defense contractors before a conditional offer (Cornell LII)](https://www.law.cornell.edu/uscode/text/10/4657) — verified 2026-11-13
  - [California Civil Rights Department — Criminal History and Employment fact sheet (June 2025)](https://calcivilrights.ca.gov/wp-content/uploads/sites/32/2025/07/Fair-Chance-Act-Factsheet_English.pdf) — verified 2026-11-13
  - [NYC Commission on Human Rights — Fair Chance Act legal guidance](https://www.nyc.gov/site/cchr/law/fair-chance-act.page) — verified 2026-11-13
  - [775 ILCS 5/2-103.1 — Illinois Human Rights Act: conviction record and interactive assessment](https://ilga.gov/documents/legislation/ilcs/documents/077500050K2-103.1.htm) — verified 2026-11-13
  - [Illinois Department of Human Rights — Conviction Record Protections FAQ](https://dhr.illinois.gov/about-us/idhr-faqs/know-your-rights-faqs/conviction-record-protections----faq.html) — verified 2026-11-13

**Form I-9: Employment Eligibility Verification** (`form-i9`, pre-employment)
  - [8 CFR § 274a.2 — Verification of identity and employment authorization (Form I-9) (eCFR)](https://www.ecfr.gov/current/title-8/chapter-I/subchapter-B/part-274a/subpart-A/section-274a.2) — verified 2026-11-13
  - [USCIS — Form I-9, Employment Eligibility Verification (page updated 06/03/2026)](https://www.uscis.gov/i-9) — verified 2026-11-13
  - [DOJ Civil Rights Division (IER) — Employer Fact Sheet: Avoiding Immigration-Related Discrimination when Complying with U.S. Export Control Laws (rev. March 2024)](https://www.justice.gov/crt/media/1287536/dl) — verified 2026-11-13

**E-Verify for New Hires** (`e-verify`, pre-employment)
  - [FAR 52.222-54 — Employment Eligibility Verification (Jan 2025)](https://www.acquisition.gov/far/52.222-54) — verified 2026-11-13
  - [8 CFR § 214.2(f)(10)(ii)(C) — STEM OPT extension: employer E-Verify, Form I-983 and reporting duties (eCFR)](https://www.ecfr.gov/current/title-8/chapter-I/subchapter-B/part-214/section-214.2) — verified 2026-11-13
  - [E-Verify — Tentative Nonconfirmations (Mismatches)](https://www.e-verify.gov/employers/verification-process/tentative-nonconfirmations-mismatches) — verified 2026-11-13

**Conditional Offers and Their Contingencies** (`offer-contingencies`, pre-employment)
  - [32 CFR § 117.10 — Eligibility for access to classified information: pre-employment action, SF 86 review, SF 312 (eCFR)](https://www.ecfr.gov/current/title-32/subtitle-A/chapter-I/subchapter-D/part-117/section-117.10) — verified 2026-11-13
  - [42 U.S.C. § 12112 — ADA: medical examinations and inquiries before and after an offer (Cornell LII)](https://www.law.cornell.edu/uscode/text/42/12112) — verified 2026-11-13
  - [8 CFR § 274a.2 — Verification of identity and employment authorization (Form I-9) (eCFR)](https://www.ecfr.gov/current/title-8/chapter-I/subchapter-B/part-274a/subpart-A/section-274a.2) — verified 2026-11-13
  - [22 CFR § 120.50 — Export, including release of technical data to a foreign person in the U.S. (Cornell LII)](https://www.law.cornell.edu/cfr/text/22/120.50) — verified 2026-11-13
  - [California Civil Rights Department — Criminal History and Employment fact sheet (June 2025)](https://calcivilrights.ca.gov/wp-content/uploads/sites/32/2025/07/Fair-Chance-Act-Factsheet_English.pdf) — verified 2026-11-13

**Confidentiality and Invention-Assignment Agreements** (`confidentiality-invention-assignment`, pre-employment)
  - [18 U.S.C. § 1833(b) — Defend Trade Secrets Act whistleblower immunity and the notice requirement (Cornell LII)](https://www.law.cornell.edu/uscode/text/18/1833) — verified 2026-11-13
  - [California Labor Code § 2870 — Limits on invention-assignment clauses](https://california.public.law/codes/labor_code_section_2870) — verified 2026-11-13
  - [California Labor Code § 2872 — Written notice of the § 2870 limit](https://california.public.law/codes/labor_code_section_2872) — verified 2026-11-13
  - [32 CFR § 117.10 — Eligibility for access to classified information: pre-employment action, SF 86 review, SF 312 (eCFR)](https://www.ecfr.gov/current/title-32/subtitle-A/chapter-I/subchapter-D/part-117/section-117.10) — verified 2026-11-13

**Export-Control Check After an Offer** (`export-determination-after-offer`, itar)
  - [DOJ Civil Rights Division (IER) — Employer Fact Sheet: Avoiding Immigration-Related Discrimination when Complying with U.S. Export Control Laws (rev. March 2024)](https://www.justice.gov/crt/media/1287536/dl) — verified 2026-11-13
  - [22 CFR § 120.50 — Export, including release of technical data to a foreign person in the U.S. (Cornell LII)](https://www.law.cornell.edu/cfr/text/22/120.50) — verified 2026-11-13
  - [8 U.S.C. § 1324b — Unfair immigration-related employment practices (Cornell LII)](https://www.law.cornell.edu/uscode/text/8/1324b) — verified 2026-11-13
  - [International Trade Administration — Consolidated Screening List](https://www.trade.gov/consolidated-screening-list) — verified 2026-11-13

### Clearance investigation timelines

**Secret clearance investigation**
  - [DCSA Inventory & Timeliness | Industry — NISPPAC Public Meeting Slides, September 2, 2026 (data as of Aug. 17, 2026)](https://www.archives.gov/files/isoo/oversight-groups/nisppac/20260902-nisppac-public-meeting-slides.pdf) — verified 2026-11-11

**Top Secret clearance investigation**
  - [DCSA Inventory & Timeliness | Industry — NISPPAC Public Meeting Slides, September 2, 2026 (data as of Aug. 17, 2026)](https://www.archives.gov/files/isoo/oversight-groups/nisppac/20260902-nisppac-public-meeting-slides.pdf) — verified 2026-11-11

**Modifier: interim**
  - [32 CFR § 117.10 — Determination of Eligibility for Access to Classified Information for Contractor Employees (Cornell LII)](https://www.law.cornell.edu/cfr/text/32/117.10) — verified 2026-11-12

**Modifier: lapsed lt 2y**
  - [32 CFR § 156.5(h)(3) — DoD Personnel Security Program: reciprocal acceptance (eCFR)](https://www.ecfr.gov/current/title-32/subtitle-A/chapter-I/subchapter-F/part-156/section-156.5) — verified 2026-11-12
  - [SEAD 7 — Reciprocity of Background Investigations and National Security Adjudications (Federation of American Scientists mirror)](https://sgp.fas.org/othergov/intel/sead-7.pdf) — verified 2026-11-12

**Modifier: lapsed gt 2y**
  - [32 CFR § 156.5(h)(3) — DoD Personnel Security Program: reciprocal acceptance (eCFR)](https://www.ecfr.gov/current/title-32/subtitle-A/chapter-I/subchapter-F/part-156/section-156.5) — verified 2026-11-12

**Modifier: no fcl**
  - [32 CFR § 117.9 — Entity eligibility determination for access to classified information (eCFR)](https://www.ecfr.gov/current/title-32/subtitle-A/chapter-I/subchapter-D/part-117/section-117.9) — verified 2026-11-12

### Recruiter guide: the 38 pipeline steps (`data/pipeline-steps.json`)

- [32 CFR § 117.10 — Eligibility for access to classified information (eCFR)](https://www.ecfr.gov/current/title-32/subtitle-A/chapter-I/subchapter-D/part-117/section-117.10) — verified 2026-11-13 — steps 1, 2, 14, 26, 27, 28, 29
- [32 CFR § 117.12 — Security training and briefings (eCFR)](https://www.ecfr.gov/current/title-32/subtitle-A/chapter-I/subchapter-D/part-117/section-117.12) — verified 2026-11-13 — step 29
- [22 CFR § 120.50 — Export, including deemed export (Cornell LII)](https://www.law.cornell.edu/cfr/text/22/120.50) — verified 2026-11-13 — steps 1, 22, 23
- [California Labor Code § 432.3 — Pay scale in postings; salary history](https://california.public.law/codes/labor_code_section_432.3) — verified 2026-11-13 — step 3
- [DOJ Civil Rights Division (IER) — Employer Fact Sheet on export control laws (rev. March 2024)](https://www.justice.gov/crt/media/1287536/dl) — verified 2026-11-13 — steps 4, 8, 22, 23, 32
- [California Civil Rights Department — Criminal History and Employment fact sheet (June 2025)](https://calcivilrights.ca.gov/wp-content/uploads/sites/32/2025/07/Fair-Chance-Act-Factsheet_English.pdf) — verified 2026-11-13 — steps 4, 16, 19, 20, 21
- [NYC DCWP — Automated Employment Decision Tools (Local Law 144)](https://www.nyc.gov/site/dca/about/automated-employment-decision-tools.page) — verified 2026-11-13 — steps 4, 6, 10
- [29 CFR § 1602.14 — Preservation of employment records (eCFR)](https://www.ecfr.gov/current/title-29/subtitle-B/chapter-XIV/part-1602/subpart-C/section-1602.14) — verified 2026-11-13 — steps 5, 6, 9, 13, 38
- [11 CCR § 7012 — Notice at collection (CCPA regulations, effective 2026-01-01, CPPA)](https://cppa.ca.gov/regulations/pdf/ccpa_statute_eff_20260101.pdf) — verified 2026-11-13 — step 6
- [42 U.S.C. § 12112 — ADA: accommodation; medical inquiries before and after an offer (Cornell LII)](https://www.law.cornell.edu/uscode/text/42/12112) — verified 2026-11-13 — steps 7, 8, 9, 12, 14
- [8 U.S.C. § 1324b — Unfair immigration-related employment practices (Cornell LII)](https://www.law.cornell.edu/uscode/text/8/1324b) — verified 2026-11-13 — step 8
- [Title VII disparate-impact doctrine, 42 U.S.C. § 2000e-2(k) (Cornell LII)](https://www.law.cornell.edu/uscode/text/42/2000e-2) — verified 2026-11-11 — steps 9, 12
- [15 U.S.C. § 1681b — Conditions for employment use of consumer reports (Cornell LII)](https://www.law.cornell.edu/uscode/text/15/1681b) — verified 2026-11-13 — steps 15, 17, 20
- [15 U.S.C. § 1681m — Adverse action notice (Cornell LII)](https://www.law.cornell.edu/uscode/text/15/1681m) — verified 2026-11-13 — step 21
- [FTC — Using Consumer Reports: What Employers Need to Know](https://www.ftc.gov/business-guidance/resources/using-consumer-reports-what-employers-need-know) — verified 2026-11-13 — steps 17, 20, 38
- [FTC staff — Advisory Opinion to Weisberg (June 27, 1997)](https://www.ftc.gov/legal-library/browse/advisory-opinions/advisory-opinion-weisberg-06-27-97) — verified 2026-11-13 — step 21
- [41 U.S.C. § 4714 — Fair Chance Act, civilian contractors (Cornell LII)](https://www.law.cornell.edu/uscode/text/41/4714) — verified 2026-11-13 — step 16
- [10 U.S.C. § 4657 — Fair Chance Act, defense contractors (Cornell LII)](https://www.law.cornell.edu/uscode/text/10/4657) — verified 2026-11-13 — step 16
- [NYC Commission on Human Rights — Fair Chance Act legal guidance](https://www.nyc.gov/site/cchr/law/fair-chance-act.page) — verified 2026-11-13 — steps 16, 19
- [775 ILCS 5/2-103.1 — Illinois: conviction record and interactive assessment](https://ilga.gov/documents/legislation/ilcs/documents/077500050K2-103.1.htm) — verified 2026-11-13 — steps 19, 21
- [International Trade Administration — Consolidated Screening List](https://www.trade.gov/consolidated-screening-list) — verified 2026-11-13 — step 24
- [18 U.S.C. § 1833(b) — Defend Trade Secrets Act immunity notice (Cornell LII)](https://www.law.cornell.edu/uscode/text/18/1833) — verified 2026-11-13 — step 30
- [California Labor Code § 2870 — Limits on invention assignment](https://california.public.law/codes/labor_code_section_2870) — verified 2026-11-13 — step 30
- [California Labor Code § 2872 — Written notice of the § 2870 limit](https://california.public.law/codes/labor_code_section_2872) — verified 2026-11-13 — step 30
- [8 CFR § 274a.2 — Form I-9 timing and retention (eCFR)](https://www.ecfr.gov/current/title-8/chapter-I/subchapter-B/part-274a/subpart-A/section-274a.2) — verified 2026-11-13 — steps 31, 32, 38
- [USCIS — Form I-9, Employment Eligibility Verification](https://www.uscis.gov/i-9) — verified 2026-11-13 — step 31
- [FAR 52.222-54 — Employment Eligibility Verification (Jan 2025)](https://www.acquisition.gov/far/52.222-54) — verified 2026-11-13 — step 33
- [8 CFR § 214.2(f)(10)(ii)(C) — STEM OPT employer duties (eCFR)](https://www.ecfr.gov/current/title-8/chapter-I/subchapter-B/part-214/section-214.2) — verified 2026-11-13 — steps 33, 37
- [E-Verify — Tentative Nonconfirmations (Mismatches)](https://www.e-verify.gov/employers/verification-process/tentative-nonconfirmations-mismatches) — verified 2026-11-13 — step 33
- [42 U.S.C. § 653a — State new-hire reporting (Cornell LII)](https://www.law.cornell.edu/uscode/text/42/653a) — verified 2026-11-13 — step 34
- [U.S. Department of Labor — Fact Sheet #71: Internship Programs Under the FLSA (Jan 2018)](https://www.dol.gov/agencies/whd/fact-sheets/71-flsa-internships) — verified 2026-11-13 — step 36
- [California Government Code § 12946 — Four-year record retention](https://california.public.law/codes/government_code_section_12946) — verified 2026-11-13 — steps 6, 38
- [Checkr API — Create a new Candidate (email is the only required field with Invitations)](https://docs.checkr.com/apis/openapi/candidates/createcandidate) — verified 2026-11-13 — step 16
- [Checkr API — Create a new Adverse Action (post-adverse notice defaults to 7 days)](https://docs.checkr.com/apis/openapi/adverse-actions/createadverseaction) — verified 2026-11-13 — step 21

---

## Hiring compliance & bias law

Backs the rule that no tool scores or ranks a person or infers anything demographic; "fit" is sourced work-style alignment only. Independently verified in a dedicated research pass. **Verified 2026-11-11.**

**Title VII disparate impact doctrine** — still valid, binding federal law; available to private plaintiffs regardless of current EEOC enforcement posture (EEOC's own AI-specific guidance was withdrawn in Jan. 2025).
  - [42 U.S.C. § 2000e-2(k) (Cornell LII)](https://www.law.cornell.edu/uscode/text/42/2000e-2) — verified 2026-11-11
  - [E.O. 14281, Federal Register (Apr. 23, 2025)](https://www.govinfo.gov/content/pkg/FR-2025-04-28/html/2025-07378.htm) — verified 2026-11-11

**NYC Local Law 144** — in force, unchanged since Jan. 2023; bias audit + 10-business-day candidate notice required for automated employment decision tools. Lowest-risk citation of the six.
  - [NYC DCWP — Automated Employment Decision Tools](https://www.nyc.gov/site/dca/about/automated-employment-decision-tools.page) — verified 2026-11-11

**Illinois AI hiring-notice law** — Public Act 103-0804, effective Jan. 1, 2026. *Caveat: corroborated by multiple consistent secondary sources; a direct ilga.gov read is still an open follow-up (fetch errors this pass).*
  - [Illinois Public Act 103-0804](https://www.ilga.gov/Legislation/PublicActs/View/103-0804) — verified 2026-11-11 (secondary-corroborated)

**Colorado AI Act** — the original SB 24-205 was repealed before taking effect; replaced by SB 26-189 (effective Jan. 1, 2027). *The least durable of the six citations — re-verify close to any ship date.*
  - [Colorado General Assembly — SB 26-189](https://leg.colorado.gov/bills/SB26-189) — verified 2026-11-11

**EU AI Act** — Annex III classifies hiring/employment AI as high-risk (unchanged); compliance deadline delayed to Dec. 2, 2027.
  - [EU AI Act Service Desk — Annex III](https://ai-act-service-desk.ec.europa.eu/en/ai-act/annex-3) — verified 2026-11-11
  - [European Commission — AI Act Regulatory Framework](https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai) — verified 2026-11-11

***Mobley v. Workday*** — active, unsettled litigation (N.D. Cal. No. 3:23-cv-00770-RFL); disparate-impact and FEHA claims proceeding, nationwide ADEA collective certified.
  - [Court docket (PacerMonitor mirror)](https://www.pacermonitor.com/public/case/47898981/Mobley_v_WORKDAY,_INC) — verified 2026-11-11
  - [Civil Rights Litigation Clearinghouse case tracker](https://clearinghouse.net/case/44074/) — verified 2026-11-11

---

## Assessment science

Backs `build_trial_assessment`, `run_job_preview`, and `generate_interview_guide`. Each link is the paper's DOI, checked on 2026-11-13 against its Crossref record (title, authors, year, journal, volume and pages match).

- [Sackett, Zhang, Berry & Lievens (2022) — revisiting meta-analytic estimates of validity in personnel selection, *Journal of Applied Psychology* 107(11)](https://doi.org/10.1037/apl0000994) — verified 2026-11-13 — structured interviews .42 vs. unstructured .19; work samples .33 (backs `generate_interview_guide` and `build_trial_assessment`)
- [Sackett, Zhang, Berry & Lievens (2023) — revisiting the design of selection systems, *Industrial and Organizational Psychology* 16(3)](https://doi.org/10.1017/iop.2023.24) — verified 2026-11-13
- [Schmidt & Hunter (1998) — the validity and utility of selection methods in personnel psychology, *Psychological Bulletin* 124(2)](https://doi.org/10.1037/0033-2909.124.2.262) — verified 2026-11-13 — structured interviews .51 vs. unstructured .38, the earlier estimates Sackett et al. (2022) revised
- [Callinan & Robertson (2000) — work sample testing, *International Journal of Selection and Assessment* 8(4)](https://doi.org/10.1111/1468-2389.00154) — verified 2026-11-13
- [Campion, Palmer & Campion (1997) — a review of structure in the selection interview, *Personnel Psychology* 50(3)](https://doi.org/10.1111/j.1744-6570.1997.tb00709.x) — verified 2026-11-13
- [Smith & Kendall (1963) — retranslation of expectations: unambiguous anchors for rating scales, *Journal of Applied Psychology* 47(2)](https://doi.org/10.1037/h0047060) — verified 2026-11-13 — the origin of behaviorally anchored rating scales
- [Premack & Wanous (1985) — a meta-analysis of realistic job preview experiments, *Journal of Applied Psychology* 70(4)](https://doi.org/10.1037/0021-9010.70.4.706) — verified 2026-11-13 — effect sizes relayed via Earnest et al. (2011)'s direct citation, not read as full primary text
- [Earnest, Allen & Landis (2011) — mechanisms linking realistic job previews with turnover, *Personnel Psychology* 64(4)](https://doi.org/10.1111/j.1744-6570.2011.01230.x) — verified 2026-11-13 — full text read

---

## Platform & engineering sources

Not statistics, but attribution for where data and design patterns come from:

- [a16z speedrun Talent Network](https://speedrun-talent-network.com) — the public API `search_defense_roles` and `get_company_profile` query — verified 2026-11-13
- [GitHub public REST API](https://docs.github.com/en/rest) — `verify_evidence`'s data source — verified 2026-11-13
- [GitLab public REST API](https://docs.gitlab.com/api/rest/) — `verify_evidence`'s data source — verified 2026-11-13
- [Cosign public directory API](https://cosign.co/docs) — `verify_evidence`'s data source — verified 2026-11-13

