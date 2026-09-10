/**
 * THE STATE FIXTURES, AND WHAT CAN HONESTLY BE FORCED.
 *
 * Every variation in the manifest declares the states it must handle. Until this file existed
 * that declaration was a list of words on a page: a reviewer could read "handles empty, long,
 * open" and had no way to see any of them without editing code, which is the same as not having
 * been told. Spec section 7 names a browsable state per variation in acceptance, and the critic
 * named it as the second required item, so this is the surface that closes it.
 *
 * THE STATES SPLIT THREE WAYS, AND THE SPLIT IS THE HONEST PART.
 *
 * 1. CONTENT STATES (empty, long) are a matter of what the piece is given. They are fixtures:
 *    props chosen to put the piece under that condition, rendered by the real component at build
 *    time. Nothing is simulated, and a piece that cannot survive its own fixture fails the build.
 *
 * 2. RUNTIME STATES (open, loading, success, error) belong to the piece's own script. They are
 *    driven, never faked: the demo presses the piece's own control, or stubs the one network call
 *    the piece makes and lets the piece decide what to show. A CSS class that merely looks like a
 *    loading state would pass a screenshot and prove nothing about the code that ships.
 *
 * 3. POINTER AND KEYBOARD STATES cannot both be forced. `focus` can: focus is programmatic, so
 *    the demo moves focus into the piece and the real focus styling appears. `hover` cannot be
 *    synthesised at all, because the browser grants :hover only to a real pointer. The state page
 *    says so plainly rather than dressing a resting render up as a hovered one.
 *
 * A STATE BROWSER THAT LIES IS WORSE THAN THE TEXT LIST IT REPLACES, because the text list at
 * least does not claim to have been checked.
 *
 * The people, firms, figures and file paths below are invented for these demos. Nothing here is a
 * real business, and none of it is a component default: a component that defaulted any of it
 * would put an invented firm on a real client's site.
 */

export type KitDemoState = "empty" | "long" | "open" | "loading" | "success" | "error" | "focus" | "hover";

/** How a state is produced, which is what the state page tells the reader. */
export type StateKind = "content" | "driven" | "unforceable";

export const STATE_KIND: Record<KitDemoState, StateKind> = {
  empty: "content",
  long: "content",
  open: "driven",
  loading: "driven",
  success: "driven",
  error: "driven",
  focus: "driven",
  hover: "unforceable",
};

/** One line per state, written for whoever opens the page rather than for whoever wrote it. */
export const STATE_NOTE: Record<KitDemoState, string> = {
  empty:
    "The piece is given no items at all. This is what a client sees on the day the section goes " +
    "in and before anything has been written for it, so it has to read as deliberate rather than broken.",
  long:
    "Real content at roughly two to three times the usual length: the way a client who writes too " +
    "much actually writes. Nothing is repeated to pad it out, because repeated words wrap " +
    "differently from prose and would prove the wrong thing.",
  open:
    "The piece's own control has been pressed, so what you are looking at is the piece's script " +
    "deciding what open means. Press it again to close it.",
  loading:
    "The piece has been driven into its in-flight state and the one network call it makes is held " +
    "open on purpose, so it stays there to be looked at. Nothing was styled to imitate it.",
  success:
    "The piece was filled in and sent, with the network call answered as a success. What you see " +
    "is the piece's own confirmation, reached the way a visitor reaches it.",
  error:
    "The same submission, with the network call answered as a server fault. The piece has to say " +
    "what went wrong and leave the visitor a way through, and that is what is being shown.",
  focus:
    "Keyboard focus has been moved to the first thing in the piece that takes it. Nothing is " +
    "styled to imitate a ring. Some browsers paint the visible ring only when they believe the " +
    "last input was a keyboard, so if you cannot see one, press Tab once.",
  hover:
    "Hover cannot be forced. The browser grants it to a real pointer only, so this page will not " +
    "pretend: move your own pointer over the piece below to see it.",
};

/**
 * Where the state driver should aim, when the piece's own control is not the obvious first one.
 * Empty means "the first control the piece offers", which is right for most of them.
 */
export const OPEN_TARGET: Record<string, string> = {
  NavSimple: "[data-kit-sheet-toggle]",
  NavDropdown: "[data-kit-sheet-toggle]",
  NavMobileSheet: "[data-kit-sheet-toggle]",
  DemoScreenshots: "[data-ds-open]",
  FaqAccordion: "details[data-kit-disclosure] > summary",
};

/**
 * Pieces whose open state only exists below the small-screen breakpoint. The state page opens
 * these in the narrow frame by default, because opening a mobile sheet in a 1280px frame shows
 * the reader an empty bar and teaches them the piece is broken.
 */
export const NARROW_BY_DEFAULT = new Set(["NavSimple", "NavDropdown", "NavMobileSheet"]);

/**
 * Pieces that have NO desktop presence at all, in any state. NavMobileSheet is the small-screen
 * half of a navigation and renders a toggle that is display:none above the breakpoint, so its
 * page at full width is a blank frame. Found by sweeping every state page and reading what was
 * actually in the document rather than by looking at the component.
 */
export const MOBILE_ONLY = new Set(["NavMobileSheet"]);

/** Empty is one prop set to nothing. The key differs per piece, so it is stated rather than guessed. */
export const EMPTY_PROPS: Record<string, Record<string, unknown>> = {
  TrustLogos: { logos: [] },
  TrustRatings: { ratings: [] },
  TrustResults: { results: [] },
  BenefitCards: { items: [] },
  BenefitAlternating: { items: [] },
  DemoScreenshots: { screenshots: [] },
  ProcessDetailed: { stages: [] },
  UseCasesAudience: { audiences: [] },
  UseCasesIndustry: { industries: [] },
  UseCasesTask: { tasks: [] },
  TestimonialGrid: { items: [] },
  CaseResults: { results: [] },
  CaseCards: { studies: [] },
  FaqVisible: { items: [] },
  FaqAccordion: { items: [] },
  // A booking form with no services and no open days has nothing to book, which is a real
  // condition (a business that has closed its diary) and not the same as an empty list.
  FormBooking: { services: [], openDays: [] },
};

/**
 * LONG-CONTENT FIXTURES, one per variation that declares the state.
 *
 * "Built to handle short and long real content" is one of the six things that make a piece
 * finished, and until now nothing demonstrated or protected it. These are REALISTIC at two to
 * three times the default: the way a client who writes too much actually writes, not a word
 * repeated. A repeated word wraps differently from prose and would prove the wrong thing.
 *
 * Only the fields that carry the wrap risk are overridden. Everything else stays on the piece's
 * own defaults, so what you are comparing against the resting page is the length and nothing else.
 */
export const LONG_PROPS: Record<string, Record<string, unknown>> = {
  NavSimple: {
    siteName: "Ridgeway, Calder and Associates",
    links: [
      { href: "/services", label: "Everything we do for you" },
      { href: "/approach", label: "How we approach a project" },
      { href: "/case-studies", label: "Work we finished recently" },
      { href: "/about", label: "The people you will deal with" },
      { href: "/contact", label: "Start a conversation" },
    ],
    cta: { label: "Ask for a written quote today", href: "/quote" },
  },
  NavDropdown: {
    siteName: "Ridgeway, Calder and Associates",
    groups: [
      {
        label: "Everything we make and fit",
        links: [
          { href: "/windows", label: "Windows, awning and double hung" },
          { href: "/doors", label: "Doors, including bifold and stacker" },
          { href: "/screens", label: "Security screens and flyscreens" },
          { href: "/repairs", label: "Repairs to frames nobody still makes" },
        ],
      },
      {
        label: "How we work with you",
        links: [
          { href: "/measure", label: "The measure, and why it comes first" },
          { href: "/lead-times", label: "What a realistic lead time looks like" },
          { href: "/warranty", label: "What the warranty actually covers" },
        ],
      },
    ],
    links: [{ href: "/about", label: "The people you will deal with" }],
    cta: { label: "Book a measure at your place", href: "/measure" },
  },
  NavMobileSheet: {
    groups: [
      {
        label: "Everything we make and fit",
        links: [
          { href: "/windows", label: "Windows, awning and double hung" },
          { href: "/doors", label: "Doors, including bifold and stacker" },
          { href: "/screens", label: "Security screens and flyscreens" },
        ],
      },
    ],
    links: [
      { href: "/approach", label: "How we approach a project" },
      { href: "/about", label: "The people you will deal with" },
    ],
    cta: { label: "Book a measure at your place", href: "/measure" },
  },
  HeroTextImage: {
    headline: "Windows and doors measured at your place, made in our own workshop and fitted by the people who made them",
    lede:
      "Nothing here is ordered in and passed on. Somebody comes out and records the opening as it " +
      "actually sits, including the out of square that a drawing will never show you, and the same " +
      "hands that cut and assembled it are the ones adjusting the hardware on the day.",
    ctas: [
      { label: "Book a measure at your place", href: "/measure", variant: "primary" },
      { label: "See work we finished recently", href: "/work", variant: "secondary" },
    ],
  },
  HeroCentredPreview: {
    headline: "Every quote we send names the profile, the glass and the hardware, so you can compare it against anyone else's",
    lede:
      "Most quotes in this trade are a single number with a line of description, which makes them " +
      "impossible to compare and easy to cut corners inside. Ours lists what is going in, so the " +
      "difference between two prices is a difference you can actually see.",
    ctas: [
      { label: "Ask for a written quote today", href: "/quote", variant: "primary" },
      { label: "Read a sample quote first", href: "/sample-quote", variant: "secondary" },
    ],
    note: "No obligation, and we will tell you honestly when a repair beats a replacement.",
  },
  HeroServicePhoto: {
    headline: "Twenty three years of repairs to frames that nobody has manufactured since the eighties",
    lede:
      "If a supplier has told you the whole unit has to come out, it is worth one phone call before " +
      "you agree. We hold cutters for profiles that left production decades ago, and that is what " +
      "lets a repair be a real answer rather than a polite way of declining the work.",
    ctas: [
      { label: "Send a photo and we will tell you", href: "/repairs", variant: "primary" },
      { label: "What a repair usually costs", href: "/repairs/pricing", variant: "secondary" },
    ],
  },
  TrustLogos: {
    intro:
      "Builders, strata managers and heritage architects who send us the openings nobody else will " +
      "quote, and have kept doing it long enough that most of this year's work came from one of them.",
    logos: [
      { name: "Harrowgate Building Company (Southern Region)" },
      { name: "Millbrook Strata and Facilities Management" },
      { name: "Ashcombe Heritage Architects and Conservators" },
      { name: "The Fennimore Group, Residential Division" },
    ],
  },
  TrustResults: {
    heading: "What twenty three years of trading under one name actually adds up to",
    results: [
      {
        figure: "1,480",
        label: "Separate installations completed across the region since the workshop opened",
        source: "Counted from job records, not estimated",
      },
      {
        figure: "23 years",
        label: "Continuously trading under the same ownership and the same name",
        source: "Registered 2003",
      },
      {
        figure: "94%",
        label: "Of last year's work came from a referral or a returning customer",
        source: "Measured across the 2025 financial year",
      },
    ],
  },
  ProblemBeforeAfter: {
    heading: "The same opening, before and after a repair that three other firms had already declined to quote",
    lede:
      "The frame is original to the house and the profile has not been manufactured since 1987, " +
      "which is why every quote before ours was for a full replacement plus making good.",
    before: {
      label: "What was there when we first came out to measure",
      caption:
        "Corroded sill, hardware seized solid, and a previous repair that had moved the whole frame " +
        "about four millimetres out of square without anybody noticing.",
    },
    after: {
      label: "The same opening once the repair was finished and adjusted",
      caption:
        "Original frame kept, sill section cut and replaced on the bench, new hardware in the same " +
        "footprint so nothing about the room had to change.",
    },
  },
  ProblemSideBySide: {
    heading: "What changes when the people who made it are the people who fit it",
    lede:
      "Every line below is something a customer has actually told us went wrong somewhere else, " +
      "which is the only reason it is on the list.",
    pairs: [
      {
        from: "Measured from the builder's plan, so the first anyone knows about the out of square is on install day",
        to: "Measured on site with the existing frame opened up, and the opening recorded as it actually sits",
      },
      {
        from: "Fabrication subcontracted out, so a fault on the day belongs to somebody who is not there",
        to: "Cut and assembled in our own workshop, by the person who will be adjusting it in front of you",
      },
      {
        from: "A single price with one line of description, impossible to compare against anyone else's",
        to: "Profile, glass specification and hardware all named, so two quotes can be read side by side",
      },
    ],
  },
  ProblemStory: {
    heading: "A heritage sash that three firms had already written off, and what it took to keep it",
    paragraphs: [
      "The owners rang us in the second week of a very wet March, after a builder had told them the " +
      "whole bank of windows on the western elevation would have to come out. They had two quotes " +
      "for a full replacement and neither of them mentioned the render, which would also have had " +
      "to be cut back and made good afterwards.",
      "What we found when we opened the first frame up was that the timber was sound everywhere " +
      "except a two hundred millimetre run of sill, and that a repair some years earlier had pulled " +
      "the whole assembly about four millimetres out of square. That is enough to seize the hardware " +
      "and not nearly enough to see from the ground, which is why nobody had found it.",
      "The repair took eleven days, most of which was the sill sections being made on the bench " +
      "rather than anything happening at the house. The render was never touched, the frames are " +
      "the ones the house was built with, and the total came to a little under a third of the " +
      "cheapest replacement quote they had been given.",
    ],
  },
  BenefitCards: {
    heading: "Three things about how we work that are worth knowing before you ask anyone for a price",
    lede:
      "None of these are unusual on their own. Together they are the reason a quote from us reads " +
      "differently from the two either side of it.",
    items: [
      {
        title: "Measured on site rather than estimated from a plan",
        body:
          "Somebody comes out, opens what is already there, and records the opening as it actually " +
          "sits, including the out of square that a drawing will never show you. It costs nothing " +
          "and it is the single biggest reason install day goes quietly.",
        href: "/approach/the-measure",
      },
      {
        title: "Made in our own workshop instead of ordered in",
        body:
          "That is what lets us match a profile nobody has manufactured for thirty years, and why a " +
          "repair is a real answer rather than a polite way of declining the work.",
        href: "/approach/the-workshop",
      },
      {
        title: "Fitted by the same people who made it",
        body:
          "Nothing is subcontracted, so the person adjusting the hardware on the day is the person " +
          "who cut and assembled it, and there is nobody to blame in between.",
        href: "/approach/installation",
      },
    ],
  },
  BenefitAlternating: {
    heading: "The parts of the job that most people never see, and where the difference actually lives",
    lede:
      "A finished window looks much the same whoever made it. What separates them is decided weeks " +
      "earlier, on a bench nobody visits.",
    items: [
      {
        title: "The measure, which is the only part that cannot be corrected later",
        body:
          "We open the existing frame rather than measuring around it, because a previous repair " +
          "will have moved something and a rendered reveal hides more than it shows. Everything " +
          "downstream is cut to what that measure says, so an hour spent here saves a day on site.",
      },
      {
        title: "Fabrication, where a profile nobody still makes stops being a problem",
        body:
          "The cutters we hold cover profiles that left production in the eighties. That is a room " +
          "full of tooling earning nothing most weeks, and the reason we can quote a repair when " +
          "the answer everywhere else is a replacement plus making good.",
      },
    ],
  },
  BenefitShowcase: {
    title: "Why the quote names the glass, the profile and the hardware instead of giving you one number",
    body:
      "Most quotes in this trade are a single figure with a line of description underneath. That " +
      "makes them impossible to compare, and it makes it very easy for the cheapest of three to be " +
      "cheap in a way you will not find out about for four years. Ours is itemised for exactly that " +
      "reason, and we are happy for you to take it to whoever else is quoting.",
    // ShowcasePoint is a string or { label, detail }, never { title, body }. The first version of
    // this fixture used the wrong keys and rendered three empty points, which looked like a
    // component fault and was a fixture fault.
    points: [
      {
        label: "The glass specification is set by where the panel sits, not by preference",
        detail: "A panel within 500mm of a floor is toughened because the standard says so, and the quote says which ones and why.",
      },
      {
        label: "The profile is named, so a substitution is visible",
        detail: "If somebody quotes cheaper on a lighter profile, that is a legitimate choice, and you should be able to see that it was made.",
      },
      {
        label: "Hardware is listed by manufacturer and range",
        detail: "It is the part that fails first and the part nobody itemises, which is not a coincidence.",
      },
    ],
    ctaLabel: "Read a sample quote before you ask for yours",
    ctaHref: "/sample-quote",
  },
  DemoScreenshots: {
    heading: "What the written quote looks like when it lands in your inbox, page by page",
    lede:
      "There is nothing clever about it. It is simply itemised, and being able to see it before you " +
      "ask for one is the point of putting it here.",
    screenshots: [
      {
        src: "/images/kit/screen-quote.svg",
        alt: "The first page of a written quote, showing the opening schedule",
        caption:
          "Page one lists every opening with its measured size, so you can check against your own " +
          "plan before you read a single price.",
      },
      {
        src: "/images/kit/screen-job.svg",
        alt: "The second page of a written quote, showing glass and hardware",
        caption:
          "Page two names the glass specification for each panel and the reason it is what it is, " +
          "which is usually the standard rather than a preference.",
      },
      {
        src: "/images/kit/screen-schedule.svg",
        alt: "The third page of a written quote, showing terms and lead time",
        caption:
          "Page three is the lead time and the payment terms, both as real figures rather than as " +
          "the word shortly.",
      },
    ],
  },
  ProcessThreeStep: {
    heading: "Three steps from the first phone call to a window that opens the way it should",
    lede:
      "The whole thing usually runs three to five weeks, and the longest part is the one where " +
      "nothing appears to be happening at your house.",
    steps: [
      {
        title: "The measure, usually within a week of you ringing",
        body:
          "Somebody comes out, opens the existing frame and records the opening as it actually sits. " +
          "It costs nothing, and you get the written quote from it whether or not you go ahead.",
      },
      {
        title: "Fabrication on our own bench, which is where the time goes",
        body:
          "Everything is cut to your opening rather than picked off a shelf, so this is two to three " +
          "weeks and it is not a queue we can jump for you or for anybody else.",
      },
      {
        title: "Installation by the people who made it",
        body:
          "Most openings are done inside a day. The person adjusting the hardware is the person who " +
          "assembled it, which is why the adjustment happens while they are still there.",
      },
    ],
    footnote: "If something is genuinely urgent, say so when you ring and we will tell you honestly whether it can be moved.",
  },
  ProcessDetailed: {
    heading: "What actually happens between the first phone call and the last adjustment",
    lede:
      "Written out in full because the middle of it is quiet, and a quiet fortnight is the part " +
      "people ring up worried about.",
    stages: [
      {
        title: "The call, and the questions we will ask you on it",
        body:
          "Roughly where the property is, how many openings, and whether anything has been repaired " +
          "before. That last one matters more than it sounds, because a previous repair is the " +
          "commonest reason an opening is not square.",
        duration: "About ten minutes",
      },
      {
        title: "The measure at your place",
        body:
          "We open the existing frame rather than measuring around it. You do not need to be there " +
          "for all of it, but it is worth being there at the start so we can be told what has been " +
          "annoying you about the current windows.",
        duration: "Half an hour to two hours",
      },
      {
        title: "The written quote, itemised",
        body:
          "Every opening with its measured size, the glass specification for each panel and the " +
          "reason for it, the hardware by manufacturer and range, then the lead time and terms.",
        duration: "Two to three working days",
      },
      {
        title: "Fabrication, which is the long quiet part",
        body:
          "Everything is cut to your opening on our own bench. Nothing visible happens at your house " +
          "during this and that is expected rather than a sign anything has gone wrong.",
        duration: "Two to three weeks",
      },
      {
        title: "Installation and the adjustment that follows it",
        body:
          "Most openings are finished within a day. The hardware is adjusted while the person who " +
          "assembled it is still standing there, which is the only reason it gets adjusted properly.",
        duration: "One day per opening, usually",
      },
    ],
  },
  UseCasesAudience: {
    heading: "Different people ring us for completely different reasons, so here is the one that probably applies to you",
    lede: "Each of these is a real pattern in the work rather than a category we invented to fill a grid.",
    audiences: [
      {
        name: "Homeowners partway through a renovation that has gone sideways",
        need:
          "Usually because the windows were the last thing anyone thought about and the opening " +
          "sizes on the plan have stopped matching the building. We measure what is actually there.",
        href: "/homeowners",
        linkLabel: "What we do for homeowners mid-renovation",
      },
      {
        name: "Builders who need one supplier who will answer the phone on site",
        need:
          "The value is not the price, it is that the person who made the unit is the person who " +
          "turns up when something does not fit, and that happens the same week rather than the next month.",
        href: "/builders",
        linkLabel: "How we work with builders",
      },
      {
        name: "Strata managers holding a maintenance budget and forty identical openings",
        need:
          "Repeatable work, priced once, scheduled around residents rather than around us, with a " +
          "written condition report for every opening before anything is touched.",
        href: "/strata",
        linkLabel: "Strata and multi-unit work",
      },
    ],
  },
  UseCasesIndustry: {
    heading: "The kinds of buildings we spend most of our time in, and what each one usually needs",
    lede: "Ordered by how much of last year's work each accounted for, rather than by how interesting it is.",
    industries: [
      {
        name: "Federation and interwar housing stock across the inner suburbs",
        application:
          "Almost always a repair rather than a replacement, because the profile is long out of " +
          "production and the render around it would have to be cut back and made good.",
        href: "/heritage",
      },
      {
        name: "Nineteen seventies and eighties walk-up apartment blocks",
        application:
          "Forty or more identical openings, one condition report each, and a schedule built around " +
          "residents being at work rather than around our own convenience.",
        href: "/strata",
      },
      {
        name: "New residential builds where the opening has moved off the plan",
        application:
          "Measured on site once the frame is up, which is later than most suppliers will accept and " +
          "is the entire reason install day goes quietly.",
        href: "/new-builds",
      },
    ],
  },
  UseCasesTask: {
    heading: "If you already know what you need doing, start from the job rather than from the category",
    lede: "Every one of these ends in a real page with real prices on it, not a contact form.",
    tasks: [
      {
        name: "A window that has stopped opening, or opens and will not stay put",
        outcome: "Usually a hardware failure rather than a frame failure, and usually fixable in one visit.",
        href: "/repairs/hardware",
      },
      {
        name: "Condensation and draughts through frames that are otherwise sound",
        outcome: "Reglazing or a seal replacement, which is a fraction of what a full replacement costs.",
        href: "/repairs/seals",
      },
      {
        name: "A whole elevation being replaced as part of a renovation",
        outcome: "Measured on site after the frame is up, made on our bench, fitted by the people who made it.",
        href: "/replacements",
      },
    ],
  },
  TestimonialSingle: {
    quote:
      "Three other firms had told us the whole western elevation had to come out, and none of them " +
      "had mentioned that the render would have to be cut back and made good afterwards, which was " +
      "most of the real cost. The repair took eleven days, the frames are the ones the house was " +
      "built with, and the whole thing came to under a third of the cheapest replacement quote.",
    name: "Marguerite Ashby-Pell",
    role: "Owner and project manager on the restoration",
    location: "Ashfield",
  },
  TestimonialGrid: {
    heading: "What people said afterwards, including the parts we would rather they had left out",
    lede: "Published as written. Where somebody has been critical it is here with the rest.",
    items: [
      {
        quote:
          "The quote was the only one of four that told me which panels were being toughened and " +
          "why, which meant I could finally compare the other three against something.",
        name: "Desmond Halloway-Reid",
        role: "Homeowner partway through a first-floor addition",
        location: "Marrickville",
      },
      {
        quote:
          "They were a fortnight later than the original estimate and they rang to tell us about it " +
          "rather than letting us find out. The work itself was faultless and the adjustment was " +
          "done while they were still on site.",
        name: "Priyanka Venkataraman",
        role: "Building manager, forty two unit block",
        location: "Rosebery",
      },
      {
        quote:
          "I had been told twice that nobody makes that profile any more, which turned out to be " +
          "true and also completely beside the point, because they cut it themselves.",
        name: "Terrence Okonkwo-Barrett",
        role: "Owner, Federation semi",
        location: "Stanmore",
      },
    ],
  },
  CaseFeatured: {
    heading: "A forty two unit block, every opening different from its condition report, and a schedule built around residents",
    customer: "Millbrook Strata and Facilities Management",
    title: "Forty two openings replaced over nine weeks without a single resident having to take a day off work",
    situation:
      "The block was built in 1978 and the previous manager had a maintenance file describing " +
      "openings that no longer matched the building, because at least two elevations had been " +
      "repaired at some point without anything being recorded.",
    action:
      "Every opening was measured and condition-reported before anything was ordered, then " +
      "scheduled in runs of four so that no resident lost access to more than one room at a time, " +
      "and every run was confirmed with the resident by phone the week before.",
    outcome:
      "Nine weeks end to end against an eleven week estimate, no variations, and a written record " +
      "for every opening that the next manager will actually be able to use.",
    outcomeFigures: [
      { value: "42", label: "Openings replaced and condition-reported individually" },
      { value: "9 weeks", label: "End to end, against an eleven week estimate" },
      { value: "0", label: "Variations raised after the quote was accepted" },
    ],
    linkLabel: "Read the full account of the Millbrook job",
  },
  CaseResults: {
    heading: "Results from jobs where the customer has agreed to let us publish the numbers",
    lede:
      "Every figure below came from the customer's own records rather than ours, which is why there " +
      "are fewer of them than there are jobs.",
    results: [
      {
        figure: "68%",
        label: "Less than the cheapest of three replacement quotes, for a repair that kept the original frames",
        customer: "A Federation semi in Stanmore",
        note: "Compared against written quotes the owner still holds",
      },
      {
        figure: "9 weeks",
        label: "To replace forty two openings across a 1978 walk-up, against an eleven week estimate",
        customer: "Millbrook Strata and Facilities Management",
      },
      {
        figure: "0",
        label: "Variations raised after the quote was accepted, across the whole of that job",
        customer: "Millbrook Strata and Facilities Management",
        note: "Which is a consequence of measuring first, not of good luck",
      },
    ],
    sourceNote:
      "Figures supplied by the customers named and used with their permission. Where a customer has " +
      "asked not to be named, the job is not listed here at all rather than listed anonymously.",
  },
  CaseCards: {
    heading: "Jobs worth reading about, mostly because something on them went wrong first",
    lede: "Three accounts, each written after the job finished rather than while it was being sold.",
    studies: [
      {
        title: "The western elevation three firms had already declined to quote",
        customer: "A Federation semi in Stanmore",
        outcome:
          "Original frames kept, render never touched, and a final figure under a third of the " +
          "cheapest replacement quote the owner had been given.",
        href: "/work/stanmore-semi",
        tag: "Heritage repair",
      },
      {
        title: "Forty two openings, forty two condition reports, nine weeks",
        customer: "Millbrook Strata and Facilities Management",
        outcome:
          "Scheduled in runs of four so no resident lost access to more than one room at a time, " +
          "and finished two weeks inside the estimate with no variations.",
        href: "/work/millbrook-block",
        tag: "Strata",
      },
      {
        title: "A new build where the openings had moved 30mm off the plan",
        customer: "Harrowgate Building Company",
        outcome:
          "Measured on site after the frame went up rather than off the drawings, which is why " +
          "install day took one afternoon instead of a fortnight of arguing.",
        href: "/work/harrowgate-new-build",
        tag: "New build",
      },
    ],
  },
  PricingCards: {
    heading: "Three ways of working with us, priced so you can tell which one you are actually asking for",
    lede:
      "Most people want the middle one. The other two exist because a single emergency repair and a " +
      "forty two unit programme are not the same purchase.",
    plans: [
      {
        name: "Single repair or one opening",
        price: "From $480",
        cadence: "per opening",
        description: "For one window or door that has stopped working, where the frame itself is sound.",
        features: [
          "Attendance, diagnosis and a written report on what is actually wrong",
          "Hardware replacement from stock where the range is still made",
          "A firm price before anything is ordered, not an hourly rate",
        ],
        ctaLabel: "Book a repair visit",
        ctaHref: "/repairs",
      },
      {
        name: "Measured, made and fitted",
        price: "Quoted per job",
        description: "The usual arrangement: a measure at your place, an itemised quote, then fabrication and installation.",
        features: [
          "Site measure with the existing frame opened up, at no charge",
          "Itemised written quote naming the profile, the glass and the hardware",
          "Fabrication on our own bench and installation by the people who made it",
          "Adjustment on the day, while the person who assembled it is still there",
        ],
        ctaLabel: "Book a measure at your place",
        ctaHref: "/measure",
        recommended: true,
        recommendedLabel: "What most people are asking for",
      },
      {
        name: "Programme work across a building",
        price: "Scheduled",
        description: "Ten openings or more, usually for a strata manager or a building owner holding a maintenance budget.",
        features: [
          "A written condition report for every opening before anything is ordered",
          "Runs scheduled around residents rather than around us",
          "One price for the programme, with variations agreed in writing or not at all",
        ],
        ctaLabel: "Talk to us about a programme",
        ctaHref: "/strata",
      },
    ],
    footnote:
      "All figures include GST. A measure costs nothing whether or not you go ahead, and we will " +
      "tell you when a repair beats a replacement even though the replacement is worth more to us.",
  },
  PricingTable: {
    heading: "The three arrangements side by side, including the parts that are deliberately not included",
    lede: "Read down the left column first. Most of the differences are about who does what, rather than about price.",
    caption: "What is included in a single repair, a measured installation and a building programme",
    plans: [
      { name: "Single repair or one opening", price: "From $480", cadence: "per opening", ctaLabel: "Book a repair", ctaHref: "/repairs" },
      { name: "Measured, made and fitted", price: "Quoted per job", ctaLabel: "Book a measure", ctaHref: "/measure", recommended: true, recommendedLabel: "Most common" },
      { name: "Programme work across a building", price: "Scheduled", ctaLabel: "Talk to us", ctaHref: "/strata" },
    ],
    attributes: [
      { name: "Site measure with the existing frame opened up, at no charge", values: [false, true, true] },
      { name: "Written condition report for every opening before anything is ordered", values: [false, "", true] },
      { name: "Itemised quote naming the profile, the glass specification and the hardware range", values: [true, true, true] },
      {
        name: "Fabrication on our own bench rather than ordered in from a national supplier",
        values: ["", true, true],
        note: "A single hardware repair usually needs no fabrication at all, which is why the first column is blank rather than a cross.",
      },
      { name: "Runs scheduled around residents rather than around our own convenience", values: [false, false, true] },
    ],
    footnote: "All figures include GST. A blank cell means the item does not apply to that arrangement, not that it has been left out.",
  },
  PricingQuote: {
    heading: "Why there is no price list on this page, and what actually decides the number",
    lede:
      "Anyone quoting a per-window figure without seeing the opening is quoting the opening they " +
      "hope it is. Here is what really moves it, so you can work out roughly where you sit before " +
      "you ring anyone.",
    range: "$1,900 to $4,600 per opening",
    rangeNote: "The middle eighty per cent of last year's residential work, including GST and installation.",
    drivers: [
      {
        title: "The size of the opening, and whether it is square",
        detail:
          "The single biggest factor and the one nobody can guess from a photograph. A previous " +
          "repair will usually have moved something, and that only shows up once the frame is opened.",
      },
      {
        title: "Whether the existing frame can be kept",
        detail:
          "Keeping it removes both the removal and the making good, which between them are often " +
          "more than the unit itself.",
      },
      {
        title: "The glass specification, which is set by where the panel sits",
        detail:
          "A panel within 500mm of a floor is toughened because the standard says so. That is not a " +
          "preference and it is not negotiable, so it belongs in the quote rather than in a conversation.",
      },
    ],
    send: [
      "A photograph of each opening from inside, taken square on rather than at an angle",
      "The rough width and height, measured anywhere, just so we know what scale we are talking about",
      "Anything you already know about previous repairs, even if it is only that there were some",
    ],
    turnaround: "Two to three working days from the measure",
    ctaLabel: "Book a measure at your place",
    ctaHref: "/measure",
    secondaryLabel: "Or send photos first and we will tell you whether it is worth a visit",
    secondaryHref: "/photos",
    note: "A measure costs nothing whether or not you go ahead, and it is the only way anybody can give you a real number.",
  },
  CompareAlternatives: {
    heading: "Us against the two things most people are actually choosing between",
    lede:
      "Written to be fair rather than flattering. Both of the alternatives beat us on something, " +
      "and those rows are in the table with the rest.",
    caption: "How a local fabricator compares against a national supplier and doing it yourself",
    yourName: "A local fabricator, which is us",
    alternatives: ["A national window supplier", "Buying the units and fitting them yourself"],
    attributes: [
      {
        name: "Who measures the opening, and when",
        yours: "We do, on site, with the existing frame opened up, before anything is ordered",
        others: [
          "Usually from your builder's plan, with the site measure happening on install day",
          "You do, and the risk of an error the whole way through is yours",
        ],
      },
      {
        name: "What happens when something does not fit on the day",
        yours: "The person who made it is standing there and fixes it that week",
        others: [
          "Logged with a national service desk and rebooked, typically three to six weeks",
          "You take it back, or you live with it",
        ],
      },
      {
        name: "Price for a straightforward, square, standard-size opening",
        yours: "Usually more, because a bench-made unit costs more than a production line one",
        others: [
          "Usually less, and genuinely so on volume standard sizes",
          "Least of all by a wide margin, if nothing goes wrong",
        ],
        source: "Compared against three written quotes on the same job, March 2026",
      },
      {
        name: "Lead time from order to installation",
        yours: "Three to five weeks, most of it fabrication",
        others: [
          "Often faster on stock sizes, sometimes considerably",
          "Immediate, if the size you need is on a shelf",
        ],
      },
    ],
    fairnessNote:
      "Written by us in March 2026 and checked against three written quotes on one job. A national " +
      "supplier will usually beat us on price and lead time for a square, standard-size opening, and " +
      "if that is what you have, that is the honest answer.",
  },
  CompareBeforeAfter: {
    heading: "What changes about the job itself once somebody has actually measured the opening",
    lede: "Every line is something that has genuinely happened on a job, which is why the list is this specific.",
    beforeLabel: "Quoted from the plan, measured on install day",
    afterLabel: "Measured on site before anything is ordered",
    pairs: [
      {
        before: "The out of square is discovered by an installer standing in your hallway with a unit that does not fit",
        after: "The out of square is in the quote, and the unit is cut to it three weeks earlier",
      },
      {
        before: "A previous repair nobody recorded turns into a variation and a fortnight of delay",
        after: "The previous repair is found during the measure and priced before you agree to anything",
      },
      {
        before: "The render has to be cut back and made good, which was not in anybody's number",
        after: "Either the frame is kept, or the making good is in the quote as its own line",
      },
    ],
    note:
      "None of this makes us cheaper on a straightforward opening. It makes the number you are given " +
      "at the start much more likely to be the number you pay at the end.",
  },
  FaqVisible: {
    title: "The questions we get asked on almost every first phone call, answered at the length they deserve",
    intro:
      "Written out properly rather than in one line each, because the one-line versions are what " +
      "make people ring up again a fortnight later.",
    items: [
      {
        question: "How long does a job like this normally take from the first phone call to being finished?",
        answer:
          "Most jobs run three to five weeks from the measure, and the measure itself is usually " +
          "within a week of you ringing. Fabrication is the longest part and it is where the time " +
          "actually goes, because everything is cut to your opening rather than picked off a shelf. " +
          "If something is genuinely urgent, say so when you ring and we will tell you honestly " +
          "whether it can be moved rather than promising and then apologising.",
      },
      {
        question: "What happens if the opening turns out to be different from what was measured?",
        answer:
          "It sometimes does, particularly in older houses where a previous repair has moved " +
          "something. We measure before we cut for exactly that reason, and if what we find on the " +
          "day differs from what we recorded, we tell you before anything is made rather than after.",
      },
      {
        question: "Is it worth repairing, or should we just replace the lot while the scaffolding is up?",
        answer:
          "Sometimes replacing is genuinely right, and we will say so even though a repair is worth " +
          "less to us. The thing that usually decides it is whether the frame is sound everywhere " +
          "except one run, because a bench repair to a sound frame is a fraction of a replacement " +
          "plus the render being cut back and made good afterwards.",
      },
    ],
  },
  FaqAccordion: {
    title: "Everything else people ask, in the order they usually ask it",
    intro: "Open whichever applies. Nothing here is a sales answer wearing a question mark.",
    items: [
      {
        question: "How long does a job like this normally take from the first phone call to being finished?",
        answer:
          "Most jobs run three to five weeks from the measure, and the measure itself is usually " +
          "within a week of you ringing. Fabrication is the longest part and it is where the time " +
          "actually goes, because everything is cut to your opening rather than picked off a shelf. " +
          "If something is genuinely urgent, say so when you ring and we will tell you honestly " +
          "whether it can be moved rather than promising and then apologising.",
      },
      {
        question: "What happens if the opening turns out to be different from what was measured?",
        answer:
          "It sometimes does, particularly in older houses where a previous repair has moved " +
          "something. We measure before we cut for exactly that reason, and if what we find on the " +
          "day differs from what we recorded, we tell you before anything is made rather than after.",
      },
      {
        question: "Do you charge for the measure, and am I committed to anything once it is done?",
        answer:
          "It costs nothing and it commits you to nothing. You get the written quote from it either " +
          "way, and a fair number of people use ours to check the two they already had.",
      },
    ],
  },
  CtaBanner: {
    text:
      "A measure costs nothing, takes about an hour, and is the only way anybody can give you a real " +
      "number rather than the opening they hope you have.",
    action: { label: "Book a measure at your place", href: "/measure" },
    note: "Usually within a week of you ringing, and we will tell you when a repair beats a replacement.",
  },
  CtaClosing: {
    headline: "If three firms have told you the whole lot has to come out, it is worth one more phone call before you agree",
    body:
      "We hold cutters for profiles that left production in the eighties, which is the entire reason " +
      "a repair can be a real answer here rather than a polite way of declining the work. Send a " +
      "photograph and we will tell you honestly whether it is worth us coming out at all.",
    primary: { label: "Book a measure at your place", href: "/measure" },
    secondary: { label: "Send a photograph first", href: "/photos" },
    note: "No obligation either way, and no charge for the measure whether or not you go ahead.",
  },
  CtaWithProof: {
    headline: "Twenty three years, fourteen hundred installations, and most of last year's work came from somebody's recommendation",
    body:
      "None of which means we are right for your job. It means that if we say a repair will hold, " +
      "there is a long enough record behind it for you to check.",
    primary: { label: "Book a measure at your place", href: "/measure" },
    secondary: { label: "Read what people said afterwards", href: "/reviews" },
    quote: {
      text:
        "Three other firms had told us the whole western elevation had to come out, and none of them " +
        "had mentioned the render being cut back afterwards, which was most of the real cost.",
      name: "Marguerite Ashby-Pell",
      role: "Owner and project manager on the restoration",
    },
    figures: [
      { value: "1,480", label: "Installations completed since the workshop opened", note: "Counted from job records" },
      { value: "94%", label: "Of last year's work came from a referral or a returning customer" },
    ],
  },
  FormContact: {
    title: "Tell us roughly what you have got, and we will tell you honestly whether it is worth a visit",
    intro:
      "You do not need measurements or a specification. What is useful is where the property is, " +
      "roughly how many openings there are, and anything you already know about repairs somebody " +
      "has done to them before, because that is the commonest reason an opening is not square.",
    aside: {
      heading: "If you would rather just ring, which most people do",
      lines: [
        "The workshop line is answered between seven and four on weekdays, by somebody who has actually seen the jobs",
        "Outside those hours it goes to a message that gets read the next morning, not to an overseas answering service",
      ],
    },
    submitLabel: "Send this to the workshop",
    privacyNote:
      "What you send here goes to the workshop email and nowhere else. It is not added to a mailing " +
      "list, and we do not pass it on to anybody who supplies us.",
  },
  FormEnquiry: {
    title: "An enquiry with enough detail that the first thing we send back is useful rather than a request for more information",
    intro:
      "The more of this you fill in, the more likely the reply is an actual answer. If you would " +
      "rather leave most of it blank and talk it through instead, that is completely fine and the " +
      "phone number is at the bottom of every page.",
    services: [
      "Repair to a window or door that has stopped working properly",
      "Replacing one or two openings as part of a renovation",
      "A whole elevation, or a whole house",
      "Programme work across a building with ten openings or more",
      "Something else, or I genuinely do not know yet",
    ],
    submitLabel: "Send this enquiry to the workshop",
    privacyNote:
      "What you send here goes to the workshop email and nowhere else. It is not added to a mailing " +
      "list, and we do not pass it on to anybody who supplies us.",
  },
  FooterSimple: {
    businessName: "Ridgeway, Calder and Associates Window Fabrication",
    tagline:
      "Measured at your place, made on our own bench, and fitted by the people who made it. Trading " +
      "under one name in the same workshop since 2003.",
    links: [
      { label: "Everything we make and fit", href: "/services" },
      { label: "How we approach a project", href: "/approach" },
      { label: "Work we finished recently", href: "/work" },
      { label: "The people you will actually deal with", href: "/about" },
    ],
    legalLinks: [
      { label: "Privacy and what we do with an enquiry", href: "/privacy" },
      { label: "Terms of trade and warranty", href: "/terms" },
    ],
  },
  FooterGrouped: {
    businessName: "Ridgeway, Calder and Associates Window Fabrication",
    description:
      "Measured at your place, made on our own bench, and fitted by the people who made it. We hold " +
      "cutters for profiles that left production in the eighties, which is why a repair is often a " +
      "real answer here rather than a polite way of declining the work.",
    groups: [
      {
        heading: "Everything we make and fit",
        links: [
          { label: "Windows, awning and double hung", href: "/windows" },
          { label: "Doors, including bifold and stacker", href: "/doors" },
          { label: "Security screens and flyscreens", href: "/screens" },
          { label: "Repairs to frames nobody still makes", href: "/repairs" },
        ],
      },
      {
        heading: "How we work with you",
        links: [
          { label: "The measure, and why it comes first", href: "/measure" },
          { label: "What a realistic lead time looks like", href: "/lead-times" },
          { label: "What the warranty actually covers", href: "/warranty" },
        ],
      },
    ],
    companyDetails: [
      { term: "Licence number", value: "Contractor licence 214-887-C" },
      { term: "Workshop address", value: "Unit 4, 118 Wentworth Parade, Marrickville" },
    ],
    legalLinks: [
      { label: "Privacy and what we do with an enquiry", href: "/privacy" },
      { label: "Terms of trade and warranty", href: "/terms" },
    ],
  },
};

/**
 * The props a state renders with, on top of whatever the resting demo already passes.
 *
 * A driven state renders the resting content on purpose: the point of `loading` is what the
 * piece's own script does to the piece you already saw, so changing the content underneath it at
 * the same time would make the two pages incomparable.
 */
export function statePropsFor(variationId: string, state: KitDemoState): Record<string, unknown> {
  if (state === "empty") return EMPTY_PROPS[variationId] ?? {};
  if (state === "long") return LONG_PROPS[variationId] ?? {};
  return {};
}
