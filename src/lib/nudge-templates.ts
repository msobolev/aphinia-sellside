// src/lib/nudge-templates.ts
//
// Opportunity nudge library for prop_sent deals.
// These are short, decision-forcing follow-ups (vendor-facing) meant to be
// hand-picked per deal — distinct from the auto-selected dispatch templates.
//
// Merge field: {{first_name}}  (the only required variable)
// Signature is appended once via SIGNATURE so it stays consistent everywhere.

export interface NudgeTemplate {
  id: string;        // stable key (used by the picker + URL)
  label: string;     // short name shown in the picker
  trigger: string;   // the persuasion lever (shown as a tag)
  why: string;       // one-line rationale (tooltip / subtext in the picker)
  subject: string;   // lowercase per Aphinia subject-line rules
  body: string;      // {{first_name}} placeholder, no signature
}

export const NUDGE_SIGNATURE = `Misha Sobolev
Aphinia`;

export const NUDGE_TEMPLATES: NudgeTemplate[] = [
  {
    id: "lock-logistics",
    label: "Lock logistics",
    trigger: "Operational constraint",
    why: "Real planning dependency forces timing",
    subject: "quick decision before we lock logistics",
    body: `Hi {{first_name}},

We're locking event logistics this week (format, seating, sponsor integrations).

If you're in, I need to finalize your sponsorship before that.

Should I send the agreement?`,
  },
  {
    id: "good-news-bad-news",
    label: "Good news / bad news",
    trigger: "Contrast + scarcity",
    why: "Emotional contrast sharpens urgency",
    subject: "good news / bad news",
    body: `Hi {{first_name}},

Good news: we added a prominent CISO as a co-host.

Bad news: several proposals are under consideration and we only have two co-sponsor spots left.

Should I lock this in for you?`,
  },
  {
    id: "before-we-announce",
    label: "Before we announce partners",
    trigger: "Status + deadline",
    why: "Visibility tied to action timing",
    subject: "before we announce partners",
    body: `Hi {{first_name}},

We're announcing partners this week.

If you want to be included in the first wave, I'll need to finalize your sponsorship now.

Are you in?`,
  },
  {
    id: "budget-timing",
    label: "Budget timing check",
    trigger: "Loss aversion (budget)",
    why: "Anchors to an internal constraint they already feel",
    subject: "budget timing check",
    body: `Hi {{first_name}},

Quick check—are you still allocating budget for this this quarter?

If yes, we should lock this in now before budgets shift.

Should I move forward?`,
  },
  {
    id: "before-i-release-slot",
    label: "Before I release this slot",
    trigger: "Scarcity + ownership",
    why: "Feels like 'their' slot is at risk",
    subject: "before I release this slot",
    body: `Hi {{first_name}},

I've been holding a sponsor slot for you, but I have others asking about it.

Before I release it, wanted to check—should I lock it in for you?`,
  },
  {
    id: "wrap-this-up",
    label: "Can we wrap this up?",
    trigger: "Momentum",
    why: "Assumes the decision is already made",
    subject: "can we wrap this up?",
    body: `Hi {{first_name}},

Feels like we're aligned.

Next step is just signing the proposal so we can lock your spot.

Should I send it through?`,
  },
  {
    id: "aligning-internally",
    label: "Aligning internally?",
    trigger: "Reciprocity",
    why: "Helps them win the internal approval",
    subject: "aligning internally?",
    body: `Hi {{first_name}},

If this is waiting on internal approval, happy to help.

I can send a concise forwardable summary or jump on a quick call.

What do you need to get this approved?`,
  },
  {
    id: "quick-yes-no",
    label: "Quick yes/no",
    trigger: "Binary framing",
    why: "Reduces cognitive load to a single choice",
    subject: "quick yes/no",
    body: `Hi {{first_name}},

I know things get busy, so I'll keep it simple.

Should I move forward with your sponsorship, or pause?`,
  },
  {
    id: "finalize-roster",
    label: "Before we finalize the roster",
    trigger: "Finality",
    why: "Signals the closing window",
    subject: "before we finalize the roster",
    body: `Hi {{first_name}},

We're locking the final sponsor roster.

If you'd like to be included, I'll need to confirm now.

Should I proceed?`,
  },
  {
    id: "small-update",
    label: "Small update that may help",
    trigger: "Social proof",
    why: "New info reopens the decision loop",
    subject: "small update that may help",
    body: `Hi {{first_name}},

Quick update—we've added several strong attendees since we last spoke.

Thought it might increase the ROI on your side.

Does this change your thinking?`,
  },
  {
    id: "decision-this-week",
    label: "Decision this week?",
    trigger: "Deadline",
    why: "Forces prioritization",
    subject: "decision this week?",
    body: `Hi {{first_name}},

We're aiming to finalize all sponsors this week.

Can you share where you're leaning?`,
  },
  {
    id: "any-blockers",
    label: "Any blockers?",
    trigger: "Objection surfacing",
    why: "Pulls hidden friction into the open",
    subject: "any blockers?",
    body: `Hi {{first_name}},

Before we close this out, want to make sure nothing is holding this up.

Anything I can address?

Otherwise, should I send the agreement?`,
  },
  {
    id: "worth-locking-in",
    label: "Worth locking this in?",
    trigger: "Consistency",
    why: "Aligns with their prior expressed interest",
    subject: "worth locking this in?",
    body: `Hi {{first_name}},

Given the audience and positioning we discussed, this feels like a strong fit.

If aligned, next step is just locking it in.

Should I proceed?`,
  },
  {
    id: "shift-to-execution",
    label: "Before we shift to execution",
    trigger: "Phase change",
    why: "Uses a natural cutoff point",
    subject: "before we shift to execution",
    body: `Hi {{first_name}},

We're moving from partner selection to execution.

Once we do, sponsorships close.

Want to secure your spot before that?`,
  },
  {
    id: "others-moving-forward",
    label: "Others moving forward",
    trigger: "Social proof + scarcity",
    why: "Peer action drives action",
    subject: "others moving forward",
    body: `Hi {{first_name}},

Several sponsors have moved forward this week.

With limited spots remaining, I wanted to check in.

Should I lock one in for you?`,
  },
  {
    id: "easy-next-step",
    label: "Easy next step",
    trigger: "Ease",
    why: "Low effort increases conversion",
    subject: "easy next step",
    body: `Hi {{first_name}},

We're at the point where it's just a quick confirmation.

I can send the agreement and finalize everything.

Want me to proceed?`,
  },
  {
    id: "close-this-out-loss",
    label: "Before I close this out",
    trigger: "Loss aversion",
    why: "The opportunity may disappear",
    subject: "before I close this out",
    body: `Hi {{first_name}},

I'm cleaning up open proposals.

Wanted to check if you want to move forward before I close this.

Should I keep it active?`,
  },
  {
    id: "strong-signal-capacity",
    label: "Strong signal + limited capacity",
    trigger: "Scarcity",
    why: "Demand signals urgency",
    subject: "strong signal + limited capacity",
    body: `Hi {{first_name}},

Interest has picked up recently and capacity is tight.

We're down to a small number of sponsor slots.

Should I reserve one for you?`,
  },
  {
    id: "send-agreement",
    label: "Can I send the agreement?",
    trigger: "Action bias",
    why: "Prompts the immediate next step",
    subject: "can I send the agreement?",
    body: `Hi {{first_name}},

If you're aligned, I can send the agreement today and lock this in.

Want me to move forward?`,
  },
  {
    id: "timing-still-work",
    label: "Timing still work?",
    trigger: "Recommitment",
    why: "Gets a micro-yes toward the bigger yes",
    subject: "timing still work?",
    body: `Hi {{first_name}},

Quick check—does the timing still work on your side?

If yes, we should finalize now to secure your spot.

Should I proceed?`,
  },
  {
    id: "before-priorities-shift",
    label: "Before internal priorities shift",
    trigger: "Urgency (time decay)",
    why: "Anticipates future deprioritization",
    subject: "before internal priorities shift",
    body: `Hi {{first_name}},

I know priorities shift quickly—wanted to check before that happens.

If this is still relevant, we should lock it in now.

Should I send the agreement?`,
  },
  {
    id: "worth-including-you",
    label: "Worth including you?",
    trigger: "Belonging",
    why: "Inclusion drives action",
    subject: "worth including you?",
    body: `Hi {{first_name}},

We're shaping a strong group of partners for this.

If you want to be part of it, I'll need to confirm now.

Should I include you?`,
  },
  {
    id: "final-check",
    label: "Final check",
    trigger: "Finality",
    why: "Signals the last opportunity",
    subject: "final check",
    body: `Hi {{first_name}},

Before I reallocate remaining sponsor slots, wanted to check with you.

Do you want to move forward?`,
  },
  {
    id: "need-anything-to-decide",
    label: "Do you need anything to decide?",
    trigger: "Friction removal",
    why: "Encourages a reply and forward progress",
    subject: "do you need anything to decide?",
    body: `Hi {{first_name}},

Happy to send anything that would help you decide—data, intros, examples.

What would be most useful?`,
  },
  {
    id: "smaller-option",
    label: "Smaller option?",
    trigger: "Objection handling",
    why: "Removes a hidden 'no' on scope/price",
    subject: "smaller option?",
    body: `Hi {{first_name}},

If scope is the blocker, we can simplify the package.

We've done lighter versions that still perform well.

Want me to propose one?`,
  },
  {
    id: "before-terms-expire",
    label: "Before terms expire",
    trigger: "Loss aversion",
    why: "An expiring benefit",
    subject: "before terms expire",
    body: `Hi {{first_name}},

We can hold the current structure and terms for now, but not indefinitely.

If you want them, we should finalize.

Should I send the agreement?`,
  },
  {
    id: "close-this-out-closure",
    label: "Close this out?",
    trigger: "Closure",
    why: "Frames it as near-finished",
    subject: "close this out?",
    body: `Hi {{first_name}},

We're wrapping up sponsor commitments.

If you're in, I'll send the agreement and finalize your spot.

Should I go ahead?`,
  },
  {
    id: "your-call",
    label: "Your call",
    trigger: "Autonomy",
    why: "Reduces resistance by handing over control",
    subject: "your call",
    body: `Hi {{first_name}},

Feels like a good fit, but ultimately your call.

If you want in, I'll move this forward today.

Should I proceed?`,
  },
];

// ---- Helpers --------------------------------------------------------------

export interface NudgeMergeVars {
  first_name?: string | null;
}

/** Replace {{first_name}} (falls back to "there" if missing) and append the signature. */
export function renderNudge(t: NudgeTemplate, vars: NudgeMergeVars): { subject: string; body: string } {
  const firstName = (vars.first_name || "").trim() || "there";
  const body = t.body.replace(/\{\{\s*first_name\s*\}\}/g, firstName);
  return {
    subject: t.subject,
    body: `${body}\n\n${NUDGE_SIGNATURE}`,
  };
}

/** Convenience lookups for the picker / URL params. */
export const NUDGE_BY_ID: Record<string, NudgeTemplate> = Object.fromEntries(
  NUDGE_TEMPLATES.map((t) => [t.id, t]),
);
