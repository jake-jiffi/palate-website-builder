/**
 * THE WEBSITE KIT MANIFEST.
 *
 * Sixteen pieces, forty-five variations. Every entry states the three things Jake's definition
 * of "finished" requires a reusable piece to carry: when to use it, what content it needs, and
 * where on a page it belongs. Read by the Compose stage when choosing sections, by the kit index
 * at /_kit, and by gate-kit-complete.mjs, which fails if a declared variation has no component.
 *
 * THE MANIFEST IS THE SOURCE OF TRUTH FOR WHAT EXISTS. A component with no entry is invisible to
 * Compose; an entry with no component fails the gate. Neither can drift silently.
 *
 * ==================== TWO PROPS EVERY PIECE TAKES ====================
 *
 * They are not listed under `needs` because they are not content, and repeating them forty-five
 * times would bury the fields that differ.
 *
 * `tone: "default" | "subtle" | "inverse"` is the ground the piece sits on. One name and one
 * vocabulary across the kit, so a page can alternate grounds without having to remember which
 * piece called it `variant` and which called the pale ground `plain`. Every semantic token flips
 * with it in foundations.css, so no piece restates a colour to survive a dark band. The one
 * exception is NavMobileSheet, which is not a band: it renders inside NavSimple or NavDropdown
 * and inherits whichever ground they set.
 *
 * `id: string` is the section's anchor, so a page can offer "jump to how it works" and a call to
 * action can point at it. It is never defaulted, because a defaulted anchor collides the moment a
 * page carries two of a piece; with no id the piece still wires its own aria correctly from a
 * per-render value.
 *
 * ==================== WHAT A PIECE MAY NOT INVENT ====================
 *
 * No piece defaults a person, a firm or a file. A build that forgets `siteName`, `businessName`,
 * a poster or a list of quotes gets nothing, not a plausible-looking fiction on a real client's
 * site. The demo pages at /kit/<piece>/<variation> pass sample content from src/lib/kit-sample.ts
 * instead, which no shipping page imports.
 */

export type KitState =
  | "hover" | "focus" | "open" | "loading" | "success" | "error" | "empty" | "long";

export interface KitVariation {
  /** Component file under src/components/kit/<piece>/<id>.astro */
  id: string;
  /** Jake's own words for this variation, from the spec table. */
  name: string;
  /** When to reach for THIS variation rather than its siblings. */
  when: string;
  /** The content it needs. If a build cannot supply this, pick another variation. */
  needs: string[];
  /** The states it implements beyond the resting state. */
  states: KitState[];
}

export interface KitPiece {
  id: string;
  name: string;
  /** When to use the piece at all. */
  when: string;
  /** Where on a page it belongs. */
  where: string;
  variations: KitVariation[];
}

export const kit: KitPiece[] = [
  {
    id: "navigation", name: "Navigation",
    when: "Every page. The only piece that is never optional.",
    where: "Above everything, in the page header.",
    variations: [
      { id: "NavSimple", name: "Simple navigation",
        when: "Five or fewer destinations and no grouping. Most service businesses.",
        needs: ["site name or logo", "2-6 links", "optional one call to action"],
        states: ["hover", "focus", "open", "long"] },
      { id: "NavDropdown", name: "Dropdown navigation",
        when: "More than six destinations, or destinations that group naturally (services, products).",
        needs: ["site name or logo", "2-5 groups each with 2-10 links", "optional call to action"],
        states: ["hover", "focus", "open", "long"] },
      { id: "NavMobileSheet", name: "Mobile menu",
        when: "Paired with either nav above. Ships as the small-screen behaviour, not a separate header.",
        needs: ["the same links as the desktop nav"],
        states: ["open", "focus", "long"] },
    ],
  },
  {
    id: "hero", name: "Hero",
    when: "The first screen of a home page or a landing page.",
    where: "Directly under the navigation, once per page.",
    variations: [
      { id: "HeroTextImage", name: "Text with image",
        when: "There is one strong image and a claim that needs a paragraph to land.",
        needs: ["headline", "1-2 sentence lede", "1-2 calls to action", "one image (16:9 or 4:3)"],
        states: ["hover", "focus", "long"] },
      { id: "HeroCentredPreview", name: "Centred headline with product preview",
        when: "The product IS the proof: software, an app, anything with a screen worth showing.",
        needs: ["headline", "short lede", "1-2 calls to action", "a product screenshot"],
        states: ["hover", "focus", "long"] },
      { id: "HeroServicePhoto", name: "Service hero with real photography",
        when: "A trade or service business with genuinely good photography of their own work.",
        needs: ["headline", "lede", "call to action", "a full-bleed photograph at 1600px or wider"],
        states: ["hover", "focus", "long"] },
    ],
  },
  {
    id: "trust", name: "Trust strip",
    when: "Immediately after the hero, when there is real third-party proof to show.",
    where: "One band under the hero. Never more than one per page.",
    variations: [
      { id: "TrustLogos", name: "Customer logos",
        when: "Recognisable customers who have agreed to be named.",
        needs: ["4-10 logo files", "optional one-line framing"],
        states: ["long", "empty"] },
      { id: "TrustRatings", name: "Review ratings",
        when: "A real aggregate rating from a platform that can be linked to.",
        needs: ["rating value", "review count", "source name and link"],
        states: ["empty"] },
      { id: "TrustResults", name: "Key results",
        when: "Numbers the business can defend. Never invented.",
        needs: ["2-4 figures each with a label and a source note"],
        states: ["long", "empty"] },
    ],
  },
  {
    id: "problem", name: "Problem and solution",
    when: "The visitor does not yet know they have the problem, or thinks it costs more to fix than it does.",
    where: "Early, before features. It frames everything after it.",
    variations: [
      { id: "ProblemBeforeAfter", name: "Before and after",
        when: "The change is visual and there are honest images of both states.",
        needs: ["before image", "after image", "one line each"],
        states: ["hover", "focus", "long"] },
      { id: "ProblemSideBySide", name: "Side-by-side comparison",
        when: "The change is not visual but is enumerable.",
        needs: ["3-6 paired statements", "a label for each column"],
        states: ["long"] },
      { id: "ProblemStory", name: "Short problem-to-outcome story",
        when: "One customer's arc says it better than a list.",
        needs: ["2-4 short paragraphs", "optional image", "optional attribution"],
        states: ["long"] },
    ],
  },
  {
    id: "benefits", name: "Benefits and features",
    when: "The visitor is convinced there is a problem and wants to know what they get.",
    where: "The middle of the page, after the framing and before the proof.",
    variations: [
      { id: "BenefitCards", name: "Feature cards",
        when: "3-8 peers of roughly equal weight.",
        needs: ["3-8 items each with a title and 1-2 sentences", "optional icon"],
        states: ["hover", "focus", "long", "empty"] },
      { id: "BenefitAlternating", name: "Alternating text and images",
        when: "2-4 features each deserving a paragraph and a picture.",
        needs: ["2-4 items each with a title, a paragraph and an image"],
        states: ["long", "empty"] },
      { id: "BenefitShowcase", name: "Detailed feature showcase",
        when: "One feature carries the product and needs room.",
        needs: ["title", "paragraph", "3-5 supporting points", "one large image"],
        states: ["hover", "focus", "long"] },
    ],
  },
  {
    id: "demo", name: "Product demonstration",
    when: "Seeing it work is more persuasive than reading about it.",
    where: "After benefits, before pricing.",
    variations: [
      { id: "DemoScreenshots", name: "Screenshot showcase",
        when: "Several screens worth showing, and the visitor should compare them.",
        needs: ["2-6 screenshots each with a caption"],
        states: ["hover", "focus", "open", "long", "empty"] },
      { id: "DemoVideo", name: "Video preview",
        when: "There is a real video and a poster frame for it.",
        needs: ["poster image", "video URL or file", "duration", "caption"],
        states: ["hover", "focus", "loading", "error"] },
      { id: "DemoEntryPoint", name: "Interactive demo entry point",
        when: "A live demo, sandbox or trial exists and the visitor can enter it now.",
        needs: ["headline", "what they will be able to do", "the entry link", "what it costs them"],
        states: ["hover", "focus"] },
    ],
  },
  {
    id: "process", name: "How it works",
    when: "The visitor's hesitation is about what happens next, not about whether it works.",
    where: "After the offer is clear, before the final call to action.",
    variations: [
      { id: "ProcessThreeStep", name: "Three-step process",
        when: "The process genuinely is short. Do not pad to three.",
        needs: ["3 steps each with a title and 1-2 sentences"],
        states: ["long"] },
      { id: "ProcessDetailed", name: "Detailed onboarding or delivery process",
        when: "A considered purchase where the visitor needs the whole sequence and its timings.",
        needs: ["4-8 stages each with a title, a description and optionally a duration"],
        states: ["long", "empty"] },
    ],
  },
  {
    id: "usecases", name: "Use cases",
    when: "The same product serves several distinct audiences and each needs to see itself.",
    where: "After benefits. Often the section that routes people into deeper pages.",
    variations: [
      { id: "UseCasesAudience", name: "Organised by audience",
        when: "The buyer differs by role or organisation size.",
        needs: ["3-6 audiences each with a name, a one-line need and a link"],
        states: ["hover", "focus", "long", "empty"] },
      { id: "UseCasesIndustry", name: "Organised by industry",
        when: "The product is the same but the vocabulary changes by sector.",
        needs: ["3-8 industries each with a name and a one-line application"],
        states: ["hover", "focus", "long", "empty"] },
      { id: "UseCasesTask", name: "Organised by task",
        when: "People arrive with a job to be done rather than an identity.",
        needs: ["3-8 tasks each with a name, an outcome and a link"],
        states: ["hover", "focus", "long", "empty"] },
    ],
  },
  {
    id: "testimonials", name: "Testimonials",
    when: "There are real, attributable customer words. NEVER write these.",
    where: "Beside or after the claim they support.",
    variations: [
      { id: "TestimonialSingle", name: "Single standout quote",
        when: "One quote is far stronger than the rest.",
        needs: ["the quote verbatim", "a name", "optionally a role and a photograph"],
        states: ["long"] },
      { id: "TestimonialGrid", name: "Testimonial grid",
        when: "Several good quotes and the volume is itself the proof.",
        needs: ["3-9 quotes each with a name", "optional role, company, photograph"],
        states: ["hover", "long", "empty"] },
      { id: "TestimonialVideo", name: "Video testimonial",
        when: "A filmed customer, which outperforms text when it exists.",
        needs: ["poster image", "video URL", "name", "a pull quote for people who will not press play"],
        states: ["hover", "focus", "loading", "error"] },
    ],
  },
  {
    id: "casestudies", name: "Case studies",
    when: "The purchase is considered and the visitor wants evidence of a comparable job.",
    where: "After proof of capability, often linking to full pages.",
    variations: [
      { id: "CaseFeatured", name: "Featured customer story",
        when: "One story is the strongest sales asset the business has.",
        needs: ["customer", "the situation", "what was done", "the outcome", "an image", "a link"],
        states: ["hover", "focus", "long"] },
      { id: "CaseResults", name: "Results summary",
        when: "The outcomes are numeric and comparable across customers.",
        needs: ["3-6 results each with a figure, a label and the customer"],
        states: ["long", "empty"] },
      { id: "CaseCards", name: "Case study cards",
        when: "An index of several stories, each worth its own page.",
        needs: ["3-9 studies each with a title, a customer, a one-line outcome, an image and a link"],
        states: ["hover", "focus", "long", "empty"] },
    ],
  },
  {
    id: "pricing", name: "Pricing and packages",
    when: "The price is public. If it is not, use the custom quote variation.",
    where: "Late, after the value is established.",
    variations: [
      { id: "PricingCards", name: "Pricing cards",
        when: "2-4 packages that differ by inclusion rather than by degree.",
        needs: ["2-4 plans each with a name, a price, a cadence, 3-8 inclusions and a call to action"],
        states: ["hover", "focus", "long"] },
      { id: "PricingTable", name: "Comparison table",
        when: "The plans differ across many attributes and the visitor is comparing carefully.",
        needs: ["2-5 plans", "6-20 attributes with a value per plan"],
        states: ["hover", "focus", "long"] },
      { id: "PricingQuote", name: "Custom quote option",
        when: "Every job is priced individually. The honest answer for most trades.",
        needs: ["what drives the price", "what the visitor should send", "how long a quote takes", "a call to action"],
        states: ["hover", "focus", "long"] },
    ],
  },
  {
    id: "comparison", name: "Comparisons",
    when: "The visitor is actively weighing an alternative, including doing nothing.",
    where: "Late, near pricing. It is a closing argument.",
    variations: [
      { id: "CompareAlternatives", name: "Your solution versus alternatives",
        when: "Named or generic competitors, compared on attributes that can be defended.",
        needs: ["your column", "1-3 alternative columns", "4-10 attributes", "a fairness note"],
        states: ["long"] },
      { id: "CompareBeforeAfter", name: "Current approach versus improved approach",
        when: "The competitor is the status quo, which it usually is.",
        needs: ["4-8 paired statements", "a label for each column"],
        states: ["long"] },
    ],
  },
  {
    id: "faq", name: "FAQs",
    when: "There are real recurring questions. Not as filler.",
    where: "Late, after the offer and before the final call to action.",
    variations: [
      { id: "FaqVisible", name: "Short visible answers",
        when: "Up to six questions with short answers. Everything visible beats everything hidden.",
        needs: ["2-6 question and answer pairs, answers under 60 words"],
        states: ["long", "empty"] },
      { id: "FaqAccordion", name: "Expandable questions",
        when: "More than six questions, or answers long enough to bury the page.",
        needs: ["4-20 question and answer pairs"],
        states: ["open", "hover", "focus", "long", "empty"] },
    ],
  },
  {
    id: "cta", name: "CTA sections",
    when: "At the decision point, and once more at the end of a long page.",
    where: "Mid-page as a banner, and as the closing section.",
    variations: [
      { id: "CtaBanner", name: "Compact banner",
        when: "Mid-page, to catch someone already convinced without interrupting the argument.",
        needs: ["one line", "one call to action"],
        states: ["hover", "focus", "long"] },
      { id: "CtaClosing", name: "Full-width closing section",
        when: "The last thing before the footer.",
        needs: ["headline", "a sentence", "1-2 calls to action"],
        states: ["hover", "focus", "long"] },
      { id: "CtaWithProof", name: "CTA with supporting proof",
        when: "The visitor needs one more reason at the moment of deciding.",
        needs: ["headline", "call to action", "one quote or 2-3 figures"],
        states: ["hover", "focus", "long"] },
    ],
  },
  {
    id: "forms", name: "Conversion forms",
    when: "Wherever the visitor is asked to hand over their details. The page that has to work.",
    where: "On its own page, or as the closing section of a landing page.",
    variations: [
      { id: "FormContact", name: "Contact",
        when: "General enquiries with no structure worth imposing.",
        needs: ["name", "email", "message", "a destination for the submission"],
        states: ["focus", "loading", "success", "error", "long"] },
      { id: "FormEnquiry", name: "Enquiry",
        when: "A quote or a job, where a few structured answers save a phone call.",
        needs: ["name", "contact", "what they need", "location", "optional detail and file"],
        states: ["focus", "loading", "success", "error", "long"] },
      { id: "FormBooking", name: "Booking",
        when: "A time is being reserved.",
        needs: ["name", "contact", "service", "preferred date and time", "availability rules"],
        states: ["focus", "loading", "success", "error", "empty"] },
      { id: "FormSignup", name: "Signup",
        when: "An account or a list. The shortest form on the site.",
        needs: ["email", "optional name", "consent text where required"],
        states: ["focus", "loading", "success", "error"] },
    ],
  },
  {
    id: "footer", name: "Footer",
    when: "Every page.",
    where: "Last.",
    variations: [
      { id: "FooterSimple", name: "Simple footer",
        when: "A small site with few destinations.",
        needs: ["business name", "one contact route", "2-6 links", "copyright"],
        states: ["hover", "focus", "long"] },
      { id: "FooterGrouped", name: "Larger footer with grouped links and company details",
        when: "A site with real depth, or a business with registrations and details worth showing.",
        needs: ["business name", "contact details", "2-4 link groups", "company or licence details", "copyright"],
        states: ["hover", "focus", "long"] },
    ],
  },
];

/** Every variation, flattened. Used by the kit index and the completeness gate. */
export const kitVariations = kit.flatMap((p) =>
  p.variations.map((v) => ({ ...v, piece: p.id, pieceName: p.name })),
);

/** 45 at the time of writing. The gate asserts the components match this number. */
export const KIT_VARIATION_COUNT = kitVariations.length;
