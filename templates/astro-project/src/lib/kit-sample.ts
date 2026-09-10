/**
 * SAMPLE CONTENT FOR THE KIT DEMO PAGES, AND FOR NOTHING ELSE.
 *
 * ============================ WHY THIS FILE EXISTS ============================
 *
 * A component must never invent a person, a firm or a file. A build that forgets to pass
 * `siteName`, `businessName`, `poster` or a testimonial array has to get NOTHING back, because
 * the alternative is a plausible-looking fiction: a real client's header carrying an invented
 * joinery firm on every page, six invented customers saying invented things under their site's
 * own logo, or a broken-image marker where a video poster should be. This repo has already
 * shipped invented testimonials signed with real customers' names, so the defect is not
 * hypothetical.
 *
 * But the demo pages at /kit/<piece>/<variation> still have to look like something. A section
 * library shown entirely in its empty state proves nothing about whether the sections are any
 * good, and the kit index exists precisely so the kit can be judged rather than asserted.
 *
 * So the two needs are separated: the COMPONENT defaults to empty and renders its empty state,
 * and the DEMO PAGE passes sample props in from here. The fiction lives in one file that no
 * real page imports, rather than scattered through forty-five components where a forgotten prop
 * turns it into a claim about a real business.
 *
 * ============================== THE RULE ==============================
 *
 * NEVER import this from a page, a layout or a component that ships to a client. It is imported
 * by exactly one file, src/pages/kit/[piece]/[variation].astro, which is noindex and which
 * gate-shipready strips at handover along with the other working surfaces.
 *
 * Everyone and everything named below is invented. The names, firms, ratings, figures, licence
 * numbers and quotes are all fictional, and the phone numbers and email addresses use the
 * reserved example ranges so nothing here can reach a real person.
 *
 * Image paths point at public/images/kit/placeholder.svg, a real file with nothing drawn in it,
 * so a demo page shows a correctly sized empty frame rather than a broken-image marker. The two
 * video files are the exception and are deliberately absent; the note beside them says why.
 */

/** Keyed by the variation id in src/lib/kit.ts. Spread into the component by the demo page. */
export const kitSamples: Record<string, Record<string, unknown>> = {
  // ---------------------------------------------------------------- navigation
  NavSimple: {
    siteName: "Halbrook Joinery",
  },
  NavDropdown: {
    siteName: "Marram Supply",
  },

  // ---------------------------------------------------------------- trust
  TrustLogos: {
    logos: [
      { name: "Northbeam Civil" },
      { name: "Harbourline Freight" },
      { name: "Tallow Creek Dairy" },
      { name: "Verrall & Sons Joinery" },
      { name: "Kestrel Signage" },
      { name: "Merrivale Health" },
    ],
  },
  TrustRatings: {
    ratings: [
      {
        value: 4.8,
        outOf: 5,
        count: 312,
        sourceName: "Coastwide Trades Register",
        sourceUrl: "#",
        note: "Verified jobs only, collected since March 2024.",
      },
      {
        value: 4.6,
        outOf: 5,
        count: 87,
        sourceName: "Fernbrook Business Directory",
        sourceUrl: "#",
      },
    ],
  },

  // ---------------------------------------------------------------- problem
  ProblemStory: {
    heading: "A dairy that had stopped answering its own phone",
    image: {
      ratio: "photo",
      alt: "",
      caption: "The order board in the Tallow Creek dispatch shed, photographed the week the form went live.",
    },
    paragraphs: [
      "Tallow Creek took orders on a mobile that lived in the milk room. Half of them arrived while the plant was running, which meant nobody heard it, and the voicemail box had been full since the previous spring.",
      "They were not losing customers to a competitor. They were losing them to a busy signal. The first thing we did was count it: over six weeks, 118 calls went unanswered and 41 of those callers never rang back.",
      "The fix was not a bigger website. It was an order form that worked on a phone, a number that rang two handsets, and a page that said plainly what could be delivered and when.",
      "Orders through the site now cover about a third of weekly volume, and the milk room phone rings for the things a form cannot handle.",
    ],
    attribution: { name: "Tallow Creek Dairy", role: "Wholesale orders", org: "Fernbrook" },
  },

  // ---------------------------------------------------------------- demo
  DemoScreenshots: {
    screenshots: [
      {
        src: "/images/kit/placeholder.svg",
        alt: "A week view with eight jobs laid out across three vans, two of them marked as running late.",
        caption: "The week, before anyone rings to change it",
      },
      {
        src: "/images/kit/placeholder.svg",
        alt: "One job opened, showing the accepted quote, the site notes and two photographs from the last visit.",
        caption: "One job, with the quote and the site notes in the same place",
      },
      {
        src: "/images/kit/placeholder.svg",
        alt: "A quote being built on a phone, with four line items and a running total at the bottom of the screen.",
        caption: "Quoting from the van, in about four minutes",
      },
      {
        src: "/images/kit/placeholder.svg",
        alt: "The customer's confirmation screen, showing an arrival window and the name of the technician.",
        caption: "What the customer sees when you book them in",
      },
    ],
  },
  DemoVideo: {
    // The mp4 below does not exist and is not meant to. It is the only way a demo page can reach
    // the error state the manifest declares for this piece: press play, get the error overlay and
    // the fallback link. Swap it for a real file on any site that ships one.
    src: "/media/kit/product-tour.mp4",
    poster: "/images/kit/placeholder.svg",
  },

  // ---------------------------------------------------------------- testimonials
  TestimonialGrid: {
    items: [
      {
        quote: "They turned up when they said they would, three times running. I know that sounds like a low bar. It is not one our last two trades cleared.",
        name: "Priya Raghavan",
        company: "Corbett Street Dental",
      },
      {
        quote: "The quote explained what was optional and what was not, so we could actually choose. Nobody had done that for us before.",
        name: "Tomas Lindqvist",
        role: "Facilities lead",
        company: "Ferndale Community Housing",
      },
      {
        quote: "Half the job was undoing someone else's shortcut, and they showed me photographs of it rather than just adding a line to the bill.",
        name: "Dee Ashworth",
        location: "Pemberton",
      },
      {
        quote: "We were quoted six weeks by two other firms. This came in at nine days and it held.",
        name: "Owen Brickhill",
        company: "Tumbleweed Coffee Roasters",
      },
      {
        quote: "Careful with the floors, careful with the dog, and they swept up. Small things, but they are the things I remember.",
        name: "Marguerite Sowden",
        location: "Ashgrove",
      },
      {
        quote: "The follow-up call six months later was not a sales call. They wanted to know whether the drainage had held through the wet season. It had.",
        name: "Callum Whittaker",
        company: "Brindle Veterinary",
      },
    ],
  },
  TestimonialVideo: {
    poster: "/images/kit/placeholder.svg",
    // Absent on purpose, as above: pressing play is how the declared error state gets seen.
    videoUrl: "/media/kit/testimonial.mp4",
    name: "Dee Ashworth",
    role: "Owner",
    location: "Pemberton",
  },

  // ---------------------------------------------------------------- case studies
  CaseFeatured: {
    customer: "Ferndale Community Housing",
    image: {
      src: "/images/kit/placeholder.svg",
      alt: "Roofers working on one section of a terrace roof while the flats below remain occupied",
    },
  },
  CaseResults: {
    results: [
      {
        figure: "9 days",
        label: "On site for a roof replacement across eleven occupied units",
        customer: "Ferndale Community Housing",
        note: "Quoted elsewhere at three weeks plus rehousing.",
      },
      {
        figure: "31%",
        label: "Lower gas use across a full brewing season",
        customer: "Copperline Brewing",
        note: "Season on season, measured from their own meter readings.",
      },
      {
        figure: "0",
        label: "Callbacks in two winters since handover",
        customer: "Ferndale Community Housing",
      },
      {
        figure: "4 hours",
        label: "Total downtime during the changeover",
        customer: "Tumbleweed Coffee Roasters",
        note: "Overnight, so no trading hours were lost.",
      },
    ],
  },
  CaseCards: {
    studies: [
      {
        title: "Eleven occupied units re-roofed in nine days",
        customer: "Ferndale Community Housing",
        outcome: "No tenant was rehoused and the work came in under the original rehousing budget alone.",
        image: {
          src: "/images/kit/placeholder.svg",
          alt: "A terrace roof part way through replacement, with the flats below still occupied",
        },
        href: "/case-studies/ferndale-community-housing",
        tag: "Social housing",
      },
      {
        title: "Heat recovery retrofitted around a working brewhouse",
        customer: "Copperline Brewing",
        outcome: "Gas use fell 31 per cent across a full season, with no lost brewing days.",
        image: {
          src: "/images/kit/placeholder.svg",
          alt: "Stainless heat exchange pipework running above brewing vessels",
        },
        href: "/case-studies/copperline-brewing",
        tag: "Food and drink",
      },
      {
        title: "A four-hour overnight changeover for a roastery",
        customer: "Tumbleweed Coffee Roasters",
        outcome: "The old system came out and the new one went in between close and the first roast.",
        image: {
          src: "/images/kit/placeholder.svg",
          alt: "A coffee roaster with new extraction ducting fitted overhead",
        },
        href: "/case-studies/tumbleweed-coffee-roasters",
        tag: "Manufacturing",
      },
    ],
  },

  // ---------------------------------------------------------------- footer
  FooterSimple: {
    businessName: "Harrow & Vale",
    contact: { label: "(02) 5550 0142", href: "tel:+61255500142" },
    contactSecondary: { label: "hello@harrowandvale.example", href: "mailto:hello@harrowandvale.example" },
  },
  FooterGrouped: {
    businessName: "Harrow & Vale",
    description: "Roofing, guttering and repairs across the northern suburbs since 2009.",
    contacts: [
      { label: "(02) 5550 0142", href: "tel:+61255500142" },
      { label: "hello@harrowandvale.example", href: "mailto:hello@harrowandvale.example" },
    ],
    companyDetails: [
      { term: "ABN", value: "12 345 678 901" },
      { term: "Builder's licence", value: "BL-204417" },
      { term: "Insurance", value: "Public liability to $20m" },
    ],
  },
};
