# Setting a calorie target from sources, not round numbers

**11 October 2026 · PRs #136–#142**

A new account in Trackaholic answers a few questions and gets a daily calorie
and protein target. Before the first-use screens were built, every rule behind
that target was checked against a primary source. Five rules I had proposed in
planning didn't survive that check and were replaced before any code was
written; one long-standing default turned out to be too low; and four everyday
gaps in the app turned up along the way.

| | Before | After |
|---|---|---|
| A desk worker's day-one burn | resting burn × 1.2 | × **1.40** (FAO/WHO/UNU measured data) |
| Fastest planned loss for most people | 0.35–0.7 kg a week | **1% of body weight**, up to 1 kg |
| Protein for a 200 kg, 180 cm person | 360 g a day (1.8 g/kg) | **175 g** (same rate, weight capped at BMI 30) |
| A target that hits a limit | "Raised to 1500 kcal" | names what was asked, what is planned and which limit decided it |
| Reaching your goal weight | kept losing past it | **switches to maintain** |

---

## The problem

A target worked out on day one has to come from a formula: there is no history
yet to measure anything from. The formula is an estimate for a group applied to
one person, and the app is about to show it to strangers who may be very light,
very heavy, very active, already underweight, or simply typing in the wrong
units. Two failures matter:

- **A target that is too low.** An underestimated burn plans a bigger cut than
  the pace someone chose. That is the dangerous direction.
- **A target that is wrong without saying so.** If a limit quietly changes the
  number, the user goes on believing the pace they picked.

After about two weeks the app measures the real burn from weigh-ins and meals
(10 weigh-ins over 14 days, with 70% of days logged), and the formula stops
mattering. Everything below is about getting the first two weeks right.

## Every rule and its source

| Rule | Value | Source |
|---|---|---|
| Resting burn | Mifflin-St Jeor | Frankenfield et al. 2005, *J Am Diet Assoc*: the most often within 10% of measured, in obese and non-obese adults |
| Activity multipliers | 1.40 / 1.55 / 1.70 / 1.85 / 2.00 | FAO/WHO/UNU, *Human energy requirements* (2001), Table 5.3: 1.40–1.69 / 1.70–1.99 / 2.00–2.40, from doubly labelled water |
| Energy per kg | 7,700 kcal | A planning figure; Hall et al. 2011, *Lancet*, show it overstates long-term change, which the measured burn corrects |
| Loss pace | ≤ 1% of body weight a week, never over 1 kg | Helms, Aragon & Fitschen 2014, *JISSN*: 0.5–1% a week; CDC: about 1–2 lb a week |
| Gain pace | ≤ 0.5% of body weight a week | Iraki et al. 2019, *Sports*: ~0.25–0.5% a week |
| Gain when underweight | up to +500 kcal a day | NHS, advice for underweight adults: 300–500 extra calories a day |
| No loss plan | below BMI 18.5 | WHO BMI classification |
| Calorie floor | 1,200 women / 1,500 men; 1,500 for anyone 113 kg or more | The sex-based figures are a widely cited convention (attributed to Harvard Health; I couldn't reach the original). NHLBI sets targets by weight: 1,500–1,800 kcal at 250 lb or more |
| Protein, keeping muscle while losing | 2.2 g/kg (1.8–2.6) | Helms 2014 and the ISSN position stand (Jäger et al. 2017): 2.3–3.1 g per kg of lean mass, converted at 15–25% body fat |
| Protein, building muscle | 1.9 g/kg (1.6–2.2) | Iraki 2019: 1.6–2.2; Morton et al. 2018, *BJSM*: no further gain past 1.62 |
| Protein, "just the scale" | 1.4 g/kg (1.2–1.6) | Leidy et al. 2015, *AJCN*: 1.2–1.6 |
| Protein, not answered | 1.8 g/kg (1.6–2.2) | Unchanged from before; inside the ISSN's 1.4–2.0 and Iraki's range |
| Weight used for protein | capped at BMI 30 | Weijs 2024, *Curr Opin Clin Nutr Metab Care*: "a maximum weight of BMI 30" |
| Fat | 25% of calories, never below 0.5 g/kg; gives way first to typed protein | IOM AMDR 20–35%; Iraki 2019: "Fat should be consumed in moderate amounts (0.5–1.5 g/kg/day)" |

Each value carries its source in a comment beside the constant in
[`calculations.py`](../backend/app/calculations.py), and the multipliers have
a test that pins each one inside its measured band, so changing one means
breaking the citation first.

## Four decisions worth telling

### The activity multipliers were a convention, and too low

The five multipliers were the ones nearly every calorie calculator uses (1.2,
1.375, 1.55, 1.725, 1.9), handed down with the Harris-Benedict equation. The
code's own comment called them round numbers chosen decades ago. The FAO/WHO/UNU
expert report, built from doubly labelled water measurements, puts an office
worker at a physical activity level of 1.40–1.69. So "mostly sitting" at 1.2
was below even the lowest measured band, and it erred in the dangerous
direction: a desk worker's target came out too low. The levels now sit inside
the measured bands. A 70 kg, 165 cm woman who mostly sits now maintains on
1,981 kcal instead of 1,698.

### Protein for heavy people, after one test broke the first fix

Protein used to be 1.8 g per kg of body weight for everyone, which gives a
200 kg person 360 g a day. My first fix capped protein by healthy weight plus
"up to 35% of calories". A test with a 200 kg, very active profile gave 397 g
for both answers to "what matters most", which showed two problems at once: the
cap let high-calorie people straight through, and the answer stopped mattering.
That rule was also mine, not from any paper. The published method is simpler:
work protein out from body weight capped at the weight for BMI 30 (Weijs 2024),
because fat mass needs no protein. The 200 kg person now gets 136 g for "just
the scale" and 214 g for "keeping muscle"; a lean 100 kg lifter barely moves.

### Your own protein, and why fat gives way first

Since 2026-10-13 protein can be typed while calories stay worked out
("What matters most to you?" → "My own number" on Daily targets). Carbs and
fat still fill the rest, by one rule for every case:

- protein above the worked-out amount comes out of **fat first**, down to its
  0.5 g/kg minimum, before carbs lose a gram;
- protein typed below it leaves fat at a quarter of calories, and carbs gain;
- if carbs would still go below zero, protein doesn't fit. Save refuses it and
  says the most that fits: everything but the fat minimum, as protein.

Fat first because carbs are what fuel training, and someone typing more
protein than suggested is usually training. My first version took the room
from carbs and only touched fat at the very edge; on a prototype it left a
lifter with almost no carbs at the protein they'd type. At 80 kg and
1,800 kcal, with 176 g worked out for keeping muscle:

| Typed protein | Carbs | Fat |
|---|---|---|
| 176 g (worked out) | 162 g | 50 g |
| 200 g | 160 g | 40 g |
| 250 g | 110 g | 40 g |
| 300 g | 60 g | 40 g |
| 360 g | 0 g | 40 g |
| 361 g | refused: "The most it can be is 360 g" | |

No carb minimum is applied. The IOM's 130 g a day is an RDA for the brain's
glucose, not a training figure, and I decided against adding it.

Two details. The fat minimum comes from Iraki et al. 2019, a review of
bodybuilders in the **off-season**, while the app also uses it while losing.
And worked-out protein splits exactly as before: the old split already put fat
at its minimum whenever it overshot, since overshooting with fat at a quarter
needs over 3.4 g/kg of protein and the most the app works out is 2.6. That
overshoot can still happen, rarely: a sedentary 76-year-old woman, 1.80 m and
100 kg, losing 1 kg a week, lands on the 1,200 kcal floor with 214 g of protein
and 49 g of fat already needing 1,292. The targets then carry
`protein_fits: false`.

If a weigh-in later lowers calories under a typed protein, it is kept rather
than refused: fat sits at its minimum, carbs at zero, and Daily targets says it
no longer fits.

### A faster ceiling was dropped because nothing supported it

During planning I proposed letting very heavy people plan up to 1.5 kg a week
once their burn was measured, and backed it with a gallstone-risk threshold.
The audit found the threshold wasn't real: NIDDK says rapid loss raises
gallstone risk but gives no number. No trusted source supports planning more
than about 1 kg a week without medical supervision, so the ceiling stayed at
1 kg. Heavier people still get the full kilo; the rule that binds for them is
1% of body weight.

## The audit itself

Before writing any of this code, each rule was checked against the source
it claimed. Five proposals were replaced:

- a gallstone threshold that the cited body doesn't give;
- "NHLBI floors by sex" (NHLBI's guidance is by weight);
- the 1.5 kg ceiling;
- the "+30% / 35% of calories" protein rule;
- "1% a week" for underweight people gaining (the NHS gives +300–500 kcal a
  day).

The same pass found the app's own gaps: reaching the goal weight changed
nothing, deleting a weigh-in left a target built on it, typed macros could ask
for more calories than the target (the signup defaults themselves need 2,230
kcal against 2,000 when carbs and fat are tracked), and the weekly review
judged new accounts against a 2,000 kcal target nobody had chosen.

## How it's tested

- 59 new backend tests (931 → 990) across `test_calculations.py`,
  `test_body_targets.py`, `test_banking.py` and the settings and review tests
  pin one behaviour each: every limit, the reason's wording, the limits
  returned as data, the protein table by goal and answer.
- **The preview equals the save.** Setup shows the target live from
  `POST /api/settings/targets/preview`; a test saves the same answers and
  checks the stored goals match, because both go through one function.
- **The fixes' tests fail on the old code.** The tests for the weekly review,
  the weigh-in delete, the goal weight and the typed-macro rule were run
  against the code before the change and failed there.
- **Migrations** 0020–0022 were round-tripped on SQLite and Postgres 18 with
  seeded accounts, including the backfill that tells an untouched account from
  one that chose a target.
- **Your own protein** (2026-10-13): the worked example above as a test
  table, plus one grid of 480 cases (calories × weight × every protein rate)
  showing worked-out protein splits exactly as before, overshoots included.
  The wiring tests cover the refusal and its wording, a weigh-in and its
  delete keeping typed protein, protein that stops fitting being kept and
  flagged while unrelated saves still work, and the weekly review and a
  calorie-plan day reading the typed number. 1,001 → 1,498 backend tests; migration
  0023 round-tripped on SQLite and Postgres 18.
- Calorie banking holds a single planned day to the same floor as a permanent
  target, as its own docstring requires: one standard, not two.

## Limits, honestly

- **The formula is an estimate for one person.** The measured burn replaces it
  after about two weeks; until then the target is a starting point, and the app
  says so.
- **BMI can't tell muscle from fat.** The BMI-30 cap barely touches lean
  lifters, but someone in contest prep should use their coach's numbers, which
  "My own numbers" takes exactly. Since 2026-10-13, protein alone can be typed too.
- **The calorie floors are a convention**, not a study result.
- **Where MacroFactor is still ahead**, as far as I could verify from its help
  centre: it adapts the target weekly from the first week, sets protein from
  estimated lean mass at four levels, and offers more ways to set targets. I
  couldn't verify how MyFitnessPal, Cronometer or Lose It! handle these limits
  beyond user reports, so no comparison here claims more than that.
- Not medical advice. Pregnancy, kidney disease, diabetes medication and
  similar conditions are outside what these formulas cover; the app points
  people to a doctor for them.
