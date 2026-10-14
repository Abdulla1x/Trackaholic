---
name: Trackaholic
description: A calorie and macro tracker that reads like a training computer's data page. Big numbers in fixed fields, calm by default, never shaming.
colors:
  ground: "#e4e7e1"
  field: "#eef0eb"
  ink: "#0f1210"
  ink-2: "#485049"
  rule: "#c3c9c1"
  track: "#cfd4cc"
  fill: "#0f1210"
  action: "#1747e0"
  action-ink: "#ffffff"
  plan: "#8c1d8c"
  label: "#f8f9f6"
  fact: "#1d6b3a"
  ground-dark: "#0b0e0c"
  field-dark: "#141815"
  ink-dark: "#e7ebe4"
  ink-2-dark: "#9ba49c"
  rule-dark: "#283029"
  track-dark: "#232924"
  fill-dark: "#e7ebe4"
  action-dark: "#7d9bff"
  action-ink-dark: "#0b0e0c"
  plan-dark: "#e88ae8"
  label-dark: "#050605"
  fact-dark: "#6fd394"
typography:
  display-number:
    fontFamily: "Mona Sans, system-ui, sans-serif"
    fontSize: "92px"
    fontWeight: 820
    lineHeight: 0.86
    letterSpacing: "-0.02em"
  field-number:
    fontFamily: "Mona Sans, system-ui, sans-serif"
    fontSize: "30px"
    fontWeight: 780
    lineHeight: 1
    letterSpacing: "normal"
  row-number:
    fontFamily: "Mona Sans, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 760
    lineHeight: 1.2
    letterSpacing: "normal"
  title:
    fontFamily: "Mona Sans, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 750
    lineHeight: 1.25
    letterSpacing: "normal"
  body:
    fontFamily: "Mona Sans, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "normal"
  small:
    fontFamily: "Mona Sans, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "normal"
  label:
    fontFamily: "Mona Sans, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 650
    lineHeight: 1.3
    letterSpacing: "0.09em"
  label-style-title:
    fontFamily: "Libre Franklin, Helvetica Neue, Arial, sans-serif"
    fontSize: "40px"
    fontWeight: 900
    lineHeight: 1
    letterSpacing: "-0.03em"
rounded:
  tag: "3px"
  control: "5px"
  log: "7px"
  sheet: "14px"
spacing:
  hairline: "2px"
  tight: "8px"
  row: "10px"
  block-y: "14px"
  block-x: "16px"
  block-x-wide: "28px"
components:
  button-primary:
    backgroundColor: "{colors.action}"
    textColor: "{colors.action-ink}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "42px"
  button-secondary:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "42px"
  log-button:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.ground}"
    rounded: "{rounded.log}"
    padding: "0 20px"
    height: "50px"
  input:
    backgroundColor: "{colors.field}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "44px"
  chip-selected:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.ground}"
    rounded: "{rounded.control}"
    height: "36px"
  tag-your-food:
    textColor: "{colors.fact}"
    rounded: "{rounded.tag}"
    padding: "2px 7px"
---

# Design System: Trackaholic

## Overview

**Creative North Star: "The training computer's data page"**

Today reads like the data page of a sports watch or a cycle computer: a few big numbers in fixed places, readable at arm's length, mid-task, with one hand. Each number lives in a **field**. Fields are separated by thin rules and spacing, not by boxes, so the screen reads as one instrument rather than a stack of cards. Boxes are kept for things you can press.

The app is used in short bursts, many times a day: beside the kitchen scale in daylight, on the sofa at night. That scene decides the rest. It is calm and dense rather than decorative, it works in light and dark alike, and every number is set so it can be read at a glance.

The look holds two ideas from the brand. The **segmented gauge** (the calories display, distilled) is the app's signature shape, and it appears in the wordmark and the app icon. The **nutrition label** is the brand's playful side: it is in the wordmark, and anyone can switch the whole app into a black-and-white **Label** style.

**Key characteristics:**
- Big condensed numbers in fixed fields; small wide capital labels above them.
- Thin rules, not cards. Panels only where something is pressed or set apart.
- One action colour per palette, used only on things you can press.
- One **plan** colour, used only for targets, goals and projections, never for data.
- Going over a target is drawn calmly: the gauge fills past the target tick. No red, no shake.
- Light and dark in every palette, following the phone by default.

## Colors

Restrained: a tinted neutral ground, ink, one action colour and one plan colour. The default palette is **Daylight**. Eight more palettes (see Themes and palettes) change the ground tint, the action and plan colours, and the colour of the calories **band**.

### Primary
- **Action blue** (#1747e0 light / #7d9bff dark): primary buttons, links, "Due today", focus rings. Only on things that respond to a tap.

### Secondary
- **Plan purple** (#8c1d8c light / #e88ae8 dark): the target tick at the end of the calories gauge and of each macro row, goal lines and projections on charts. Never used for logged data.

### Tertiary
- **Fact green** (#1d6b3a light / #6fd394 dark): the "Your food" tag on AI results, marking values taken from the user's own saved foods rather than estimated.

### Neutral
- **Ground** (#e4e7e1 / #0b0e0c): the page. A display-glass grey-green in light; near-black in dark.
- **Field** (#eef0eb / #141815): inputs and set-apart panels.
- **Ink** (#0f1210 / #e7ebe4): text, numbers, filled gauge segments, the Log button.
- **Ink 2** (#485049 / #9ba49c): labels, units, secondary text. At least 6.5:1 on ground in both themes.
- **Rule** (#c3c9c1 / #283029): the hairlines between fields and rows.
- **Track** (#cfd4cc / #232924): unfilled gauge segments.
- **Label white** (#f8f9f6 / #050605): the ground of the nutrition-label object.

### Named Rules
**The Press Rule.** The action colour appears only on things that respond to a tap. If it isn't pressable, it isn't action-coloured.

**The Plan Rule.** The plan colour belongs to targets and goals only. Data is ink; the plan is purple (or the palette's plan colour).

**The No Red Rule.** Nothing turns red or alarming because a user ate more than their target. Going over is drawn with the same ink as going under. Error states use ink plus words, not colour alone.

## Typography

**Display, body and labels:** Mona Sans (with system-ui, sans-serif), one family with a width axis.
**Label style and wordmark:** Libre Franklin (with Helvetica Neue, Arial, sans-serif).

**Character:** Mona Sans does every job by changing width. Numbers are narrow and heavy, words are normal, small capital labels are slightly wide. Libre Franklin is the face of the real nutrition label and appears only where the label idea does.

### Hierarchy
- **Display number** (820, 92px phone / 132px desktop, line-height 0.86, width 75%): the calories headline on Today only.
- **Field number** (780, 30px, width 78%): secondary numbers in fields: the weight trend, weekly rate.
- **Row number** (760, 20px, width 80%): kcal on meal rows, and the macro rows in the calories band.
- **Title** (750, 16px, width 112%): screen titles in the app bar and the date bar.
- **Body** (400, 15px, line-height 1.4): rows, descriptions, form text. Prose capped at about 70 characters per line.
- **Small** (400, 13px): captions, helper text, ranges.
- **Label** (650, 11px, letter-spacing 0.09em, uppercase, width 110%): field labels, section labels ("KCAL LEFT", "MEALS · 3") and tracker titles ("WATER", with the tracker's icon at 18px beside it). Every heading inside a screen uses it, so the page has one heading style; the figure at the right of a tracker stays in body type, because it is data.
- **Label-style title** (Libre Franklin 900, 40px phone / 56px desktop, letter-spacing -0.03em): the heading of a nutrition-label block.

### Named Rules
**The Fixed Digits Rule.** Every number uses tabular figures. Values change in place; nothing shifts sideways when a digit changes.

**The Sentence Case Rule.** Headings, buttons and labels are written in sentence case. The uppercase field labels are a typographic treatment of sentence-case text, not title case.

## Layout

One responsive layout. The same screens at every width, with different density and navigation placement.

- **Phone (under 900px):** a bottom tab bar (Today · Progress · Log · You), with the Log button in the middle. Blocks are full width, padded 14px vertically and 16px horizontally, separated by hairline rules.
- **Desktop (900px and up):** a 236px side rail (wordmark, Log button, tabs), and content in two columns (1.25fr / 1fr). On Today, the calories band spans the full width at the top. Meals go on the left, trackers on the right, and both columns run to the same bottom line, so content of different lengths never looks ragged. Blocks pad 28px horizontally.
- **Log panel:** a bottom sheet at 92% height on phones; a 480px right-side panel on desktop.
- **Settings-type screens** (You, the day in detail, meal screens) are a single column capped at 760px.
- **Spacing rhythm:** 8px between related controls, 10px inside rows, 14px/16px block padding. More space above a section title than below it.

## Elevation & Depth

Flat. There are no shadows at rest. Depth comes from tone: the ground, the slightly lighter field for inputs, the coloured calories band, and a scrim behind the Log panel. The only raised surfaces are the Log panel (sheet) and the toast, and both are separated by tone and position, not by shadows.

### Named Rules
**The Flat Rule.** No drop shadows on blocks, rows or buttons. If something needs to stand apart, change its ground, not its shadow.

## Shapes

Nearly square. Controls have a 5px radius, the Log button 7px, tags 3px, checkboxes 4px. The Log panel's top corners are 14px on phones. Gauges and meters are made of square segments with 2–3px gaps. Nothing is pill-shaped except the sheet's grab handle.

## Components

### The calories band (signature)
- **What:** the top of Today. A "KCAL LEFT" (or "KCAL OVER") label, the display number, one line under it reading "1,240 eaten of 2,300 target", a 20-segment gauge with the plan-coloured target tick, then one full-width row per macro: the name, a 10-segment bar closed by the same target tick (no lift: the On target moment is the calories'), and "142 / 240 g". The value column has a fixed width, so every row's bar starts and ends on the same lines.
- **Colour:** the palette's band colour. In Daylight the band is the ground; in the other palettes it is a deep coloured panel with light ink.
- **On target:** within 2% of the day's target, either side (40 kcal on 2,000; the weekly review uses the same band), the label reads "CALORIES" and the display number is replaced by the words "On target" (58px phone / 84px desktop). The line under them stays ("2,008 eaten of 2,000 target"), so the target is still on screen once. Chosen from the 3a prototype (option A) over moving the numbers into the label line. "Kcal left" and "Kcal over" stay exact outside the band.
- **Over target:** past the band, the gauge is full, the label reads "KCAL OVER", and one plain line reads "Over is fine. The week evens out." with a link to spread it.
- **Tap:** opens the day in detail, with calorie plans.
- **Carbs and fat:** when switched on, each adds a row under protein. When off, nothing mentions them.
- **Before a target is set:** the label reads "EATEN TODAY", the display number is what was eaten, and the line under it reads "kcal · no target yet". The macro rows show amounts with no bars, since there is no goal to fill towards. No gauge, no "left", no Spread it. Chosen from the first-use prototype over a quiet "No target yet" line.
- **When a named event moves an automatic target** (the burn becomes measured, the goal weight is reached, a limit starts or stops deciding it), one plain block under the band says so with the old and new numbers, until "Got it". The daily drift of a weigh-in is never mentioned.

### Getting started
- **What:** a block on Today for a new account: two numbered steps (set your daily target · Start; log your first meal · Log), "n of 2", and "New to tracking? How Trackaholic works · Not now". The current step shows its one-line detail and the primary button; a done step shows a filled square with a check.
- **Where:** above the calories band until a target is set, then under it.
- **Not now:** shrinks it to one row (Getting started · 0 of 2 · Show).
- **What's next:** once both steps are done, "That's the basics." and one sentence about what Progress unlocks, with See Progress, How Trackaholic works and Done. Done removes it for good. Remembered per account on the device.

### Setup
- **A pushed screen** (/setup) in the Settings-type single column: the method choice first ("Work it out for me" / "I have my own numbers", with "Only you see these answers"), then one question per screen with an "n of 7" segmented bar, Back beside Next, and Next waiting for a valid answer. Each problem is a plain line under its question (the ink rule on the left, never red). Activity is a list of rows with a radio mark, a name and a description.
- **The target screen:** one bordered block with the target in the number face, the protein range, the pace and the burn, and any limit named with the numbers. While the server wakes: "Working it out…" with the six-segment waking loader.

### Sheets and the one-time popup
- **Sheet:** the Log panel's look and motion sized to its content: a bottom sheet up to 92% on phones, a 480px panel from the right on desktop. "Add or remove trackers" uses it: the weigh-in first, marked On, then each tracker with Add (secondary) or Remove (ghost), saved as pressed.
- **Item sheet (You):** tapping a supplement, food or saved meal opens a sheet titled with its name: its fields and Save, then its other actions, which save straight away (Pause or Resume, Per 100 g, Share), with one line saying what they do, then Delete. "Add a supplement" or "Add a food" opens the same sheet empty, with no Delete. Delete asks in a dialog rendered **inside** the sheet, because a dialog outside the sheet's tree counts as a tap outside and closes the sheet under the question. Closing the sheet forgets what was typed. Chosen from a prototype over a pushed screen per item and over expanding the row in place: the list stays where it was underneath, and there is no third level to go back through.
- **The new Trackaholic:** the same sheet as a 440px centred dialog on desktop, asked once of an account from before trackers were chosen, with its current cards ticked and Save / Keep as is. It waits until release notes are closed.

### Gauges and meters
- **Style:** square segments, filled in ink, unfilled in track. The calories gauge has 20 segments plus the target tick; each macro row has 10 plus the tick; water has 10.
- **Tracker figures** (water, steps) roll their changed digits like the calories number, and their meters fill like the calories gauge, so a tap on +250 is seen as well as counted.
- **Never** rings. Progress is always segmented bars.

### Unlock meters
- **What:** a feature that needs history (the weight trend, measured daily burn, the weekly review, the AI's accuracy) shows how close it is instead of an empty or invented chart: a 10-segment meter in the ground tone, "3 of 7" as the block value or beside the meter's label, and one plain sentence of what it is waiting for. A feature with several conditions (measured burn) has one meter each.
- **The moment:** the first visit after a lock opens plays the Unlock motion and its line from Voice. Once per device; a device that first sees it already unlocked never plays it.

### Charts
- **Marks:** data is ink (the trend line, a day's bar); context is ink 2 (the raw weigh-ins under the trend, axis text); grid lines are rule, horizontal only. Targets and goals are the plan colour, dashed 6/4 — the Plan Rule on a chart — with a key under the chart (a short dashed line, "Target 2,400 kcal"), never a label inside it, where it lands on the data.
- **Colours by token:** charts take the palette's colours by reference, so they follow the palette and the light or dark mode like everything else.
- **Reading values:** tap (or hover) a point for a small panel on the ground colour with a rule border. No legend: the block's label and the series switch say what is drawn.
- **Axes:** dates as "Sep 28"; a weight axis steps in even whole numbers and always includes the goal.
- **Days without data** are gaps, never zero bars.

### Range control
- Five chips sharing the full width (7 days · 30 days · 90 days · 1 year · All), so they never wrap to a second row, even at 320px. One control for the whole of Progress.

### Buttons
- **Shape:** 5px radius, 42px tall (40px minimum touch target, 44px preferred for primary actions).
- **Primary:** action colour fill, action-ink text.
- **Secondary:** transparent with a 1.5px ink border.
- **Ghost:** transparent with a 1.5px rule-coloured border (Undo, Cancel).
- **Log button:** ink fill, ground-coloured text, 7px radius, 50px tall. While an AI estimate runs it shows a spinner; when the estimate is ready it shows a dot and "Ready".
- **Disabled:** 45% opacity, no pointer.

### Chips
- **Style:** 36px tall, 1.5px rule border, 5px radius.
- **Selected:** ink fill, ground-coloured text.

### Blocks and rows
- **Blocks:** no border, no background. A hairline rule along the bottom, with an optional section label and value in the label style.
- **A block that can be put away** (Today's weekly review card): a 36px ghost ✕ after the value in the heading, named for what it does ("Hide until next week"). The block going is the first sign, a toast saying where it went the second. The weekly review card shows from the first open of the week until it is closed or the review is opened, then stays away on that device until the next week.
- **Rows:** at least 52px tall, with a chevron when they open something. Hairline rules between rows.
- **Meal rows:** time (13px, ink 2) · name and detail · kcal (row number), 56px minimum. The time is when the meal was **logged** (no time of eating is recorded), so it shows only beside a meal logged on the day it was eaten, and can be switched off; a list where no row has one carries no time column. Tapping one opens the meal screen (Edit, Log it again, Share as a code, Keep as a saved meal, Delete).

### You
- **One page of rows**, grouped from daily to rare under block labels: Goals and body · Trackers · Food · Appearance · Your data · Account · Help. The account's email sits under the title.
- **A row's detail is its current value** ("2,500 ml a day, from your weight · +250 +500 +750", "Off", "48 foods · 1 possible duplicate"), so most visits end on the page. A row that opens a screen has a chevron. A row that acts on tap (Export meals, Import meals, Download all my data, Log out) has none.
- **Units is answered on the page**: two radio chips, saved on tap.
- **Each row opens its own screen** with its own address (/you/water, /you/password), in the Settings-type column: the back arrow to You, the title in the middle, the form in blocks, and the Save bar at the bottom when something waits.
- **What an action did stays in its row**: an import's counts replace the Import row's detail ("Imported 12 meals. 2 were already here.") until you leave the page.

### Daily targets: the Protein block
- **What:** on You → Daily targets, while the calories are worked out, a block labelled Protein asks "What matters most to you?" with three radio chips: "Keep or build muscle", "Just the scale" and "My own number". The first two show one plain line, "176 g a day, from 80 kg". "My own number" opens a number box (g a day) that starts at the protein already on screen, so nothing jumps until a new number is typed, and a line with the suggested ranges for both goals.
- **What it moves:** calories stay as worked out, so a typed protein takes its room from fat and then carbs (the Fat Gives Way Rule). The stats above carry fat's state as their detail: "A quarter of the day", "Less, to make room for protein" or "At its minimum".
- **When it can't fit:** saving a number that can't fit is refused on the Save bar, naming the most that fits. If a later weigh-in lowers the calories under a number already saved, a status block with the plan-coloured rule on its left says "Your protein no longer fits." and what it leaves room for, and the You row reads "(yours) · doesn't fit". Ink and words, never red.

### Save bar
- **What waits for it:** typed numbers, and the choices on the same form (water's "From my weight" / "My own"). Switches and chips that stand alone save on tap, so the bar appearing is itself the sign that something is still waiting.
- **Look:** pinned to the bottom of the screen just above the tab bar (the bottom of the column on desktop), field ground, a hairline along the top. "Unsaved changes" on the left, or the problem in its place, in ink; then Undo (ghost) and Save (primary), which reads "Saving…" while it works. A "Saved" toast follows, for 1.5 seconds.
- **One draft per screen.** Leaving a screen with changes, by the back arrow, a tab or the phone's back button, asks "Leave without saving?" (Stay / Leave without saving). A reload gets the browser's own prompt. The draft holds only your edits, so a switch saved on the same screen never overwrites a number still being typed.
- **Change password** uses the same bar and the same question over its three boxes. The new password is typed twice while password reset is off, because a typo would lock the account for good.

### Switches
- **Square, not a pill** (Shapes): 44 × 26 with a 5px radius and a 1.5px border, and a 17px square thumb 3px from every edge. Off: rule border on the field ground, ink-2 thumb. On: ink fill, ground-coloured thumb.
- **The whole row is the target**: the label and an optional detail on the left, the switch on the right. It saves on tap, so it never raises the Save bar.

### Inputs
- **Style:** field ground, 1.5px rule border, 5px radius, 44px tall. Number inputs use the condensed bold number face.
- **Focus:** the border turns the action colour; keyboard focus also shows a 2px action-colour outline.

### Navigation
- **Tab bar (phone):** three tabs plus the central Log button. The current tab's icon is **filled** and its label bold, with a 2px ink marker that slides along the top edge.
- **Side rail (desktop):** the wordmark, the Log button, then the tabs. The current tab has a 3px ink bar on its left and a filled icon.

### Delete and Undo
- **Deleting an account is plain ink, not red** (the No Red Rule; the words carry the weight). Its own screen (/you/delete) shows the bold warning, then "Want a copy first? Download all my data", then the password box and a **secondary** "Delete my account" button, disabled until the box has something in it. The button asks once more in a dialog before anything is deleted.
- **Every other delete asks in a dialog too** (a supplement, a food, a saved meal, from its sheet), with Cancel as the filled, safe choice and the delete as the ghost button. Log out asks the same way ("Log out? Your data stays on your account.").
- Deleting a meal returns to Today and leaves a struck-through line in its place, with an **Undo** button and a thin bar along the bottom that drains over **10 seconds**. Then the line folds away and the deletion is final. Undo puts the meal back where it was.

### AI estimate (Log panel)
- **While working:** the user's photos and note sit at the top. Below them are honest stages: "Sending 2 photos" with a real upload bar, then one line saying what the estimate is built from, "Estimating from your note, 2 photos and 1 saved food". The app can't see when the model reads the note or uses a saved food, so those aren't ticked off as steps on a timer. There is no fake percentage. After a long wait the line gains "Still looking. This one's got layers." The panel can be closed; the Log button keeps working, and a toast says when the estimate is ready.
- **Result:** one row per item, with name, quantity source ("200 g from your note", "about 10 g, from the photo"), kcal and range. Items taken from saved foods show a **Your food** tag and "exact". One "Save N new foods to my library" row and one "Keep as a saved meal" row follow. The footer holds Back and "Save meal · 563 kcal".

### The nutrition-label object
- **Used:** everywhere in the Label style, and in the wordmark.
- **Anatomy:** a 2px ink border on label white; a heavy title; a 10px rule, then the calories row, a 5px rule, then the nutrient rows with 1px rules; a 10px rule, then fine print. All in Libre Franklin.
- **On Today** (Label style) it replaces the calories band:
  - "Today" and the date, a 10px rule;
  - **Calories left** as the big line;
  - Eaten so far and Target indented under it;
  - a 5px rule, then Protein (and Carbohydrate and Fat when tracked) "of" their targets;
  - a 10px rule, then "Targets are a guide, not a rule."
  
  It keeps the band's rules:
  - within 2% the big line reads **On target**;
  - past the target it reads **Calories over**, with "Over is fine. The week evens out. Spread it" as the fine print;
  - the whole label opens the day in detail.
  
  With no target yet, it shows Calories with what was eaten, the macro amounts with no "of", and "No target yet." as the fine print.

### Toasts
- Ink ground, ground-coloured text, 8px radius, above the tab bar on phones and bottom-right on desktop. They last 5 seconds and have a close button. The settings screens' "Saved" is the exception at 1.5 seconds: the Save bar going away already said it, and a longer toast covers the bottom of the screen and takes taps meant for it. One optional action ("View").
- **A toast is never the only place.** Anything you might need to read again (an import's counts, a step history's result, a failure) is also written on the screen where it happened. The toast only confirms.

### Hints
- **What:** a one-line tip beside a feature that is easy to miss: a grey sentence (small, ink-2), one link with the quiet underline the Explainer trigger uses, and a 44px close button ("Hide this tip"). An offer, not a call to action, so nothing in it competes with the buttons around it.
- **When:** each tip has its own rule, owned by the screen that shows it, and shows only when it would help. **Saved meal:** on the copy form, from the third log of the same name, never for a name already saved. **Steps:** on the Steps card, only for an account that has never logged a step. **Saved foods:** in the AI box, once a note is typed and the library has foods; not while the picker is open, and never with photos attached, so it never sits beside the question about what a photo can't show.
- **Closing:** ✕ or using the link hides a tip for good on that device (dismissals are per device, like the look). No tip is ever shown when the data it depends on is missing: no count, no tip. Never a popup or a tour.

### Skeletons
- Track-coloured blocks with a slow shimmer, shown for at least 650 ms on first load of a data screen, standing where the content will land. No spinners in content. Under reduced motion the shimmer stops and the blocks simply sit there.

### Named Rules
**The Fat Gives Way Rule.** When protein is typed above the worked-out amount and the calories stay put, the extra comes out of fat first, down to its minimum of 0.5 g per kilo, and only then out of carbs, because carbs fuel training. Protein typed below it frees calories for carbs. If carbs would go below 0, the number doesn't fit and is refused with the most that would.

## Do's and Don'ts

### Do:
- **Do** put every number in a field with a label above it, and use tabular figures.
- **Do** separate content with hairline rules and spacing before reaching for a panel.
- **Do** keep the action colour for pressable things and the plan colour for targets.
- **Do** design every screen's empty state, with the next step in plain words.
- **Do** check every new colour pair at 4.5:1 for text and 3:1 for non-text, in light and dark, in all nine palettes.
- **Do** keep touch targets at least 24px (WCAG 2.2), and 44px for primary actions.

### Don't:
- **Don't** use emoji as icons. Use the icon set.
- **Don't** use rings for progress.
- **Don't** use red, shaking or warning motion for going over a target.
- **Don't** wrap every block in a bordered card. That flattens the hierarchy the fields create.
- **Don't** add drop shadows or gradients.
- **Don't** put a small label or eyebrow above a heading as decoration. Field labels label numbers; headings stand alone.
- **Don't** show a target, chart or trend built on invented numbers. Show what unlocks it instead.

## Motion

Motion says what changed. Nothing moves for decoration. Animations are built with the Motion library (`animate`, `stagger`), loaded lazily, and wrapped so that the reduced-motion setting is respected everywhere.

**Tokens:**
- **Ease (default):** `cubic-bezier(0.16, 1, 0.3, 1)`, an exponential ease-out.
- **Fast:** 150ms (tab changes: a crossfade).
- **Base:** 240ms (most transitions).
- **Screen push and back:** 260ms; content slides 28px from the right on push, from the left on back, and fades in. The direction comes from how deep the screen sits below its tab (a meal is below the day in detail, which is below Today), not from which button was pressed, so the phone's back button and a screen's back arrow look the same. Under reduced motion it is the plain fade. CSS keyframes, like the tab crossfade, so the first screen never waits on Motion.
- **Log panel open:** spring, stiffness 380, damping 36. It rises from the bottom on phones and slides from the right on desktop. The scrim fades in over 200ms.
- **Log panel close:** 240ms, `cubic-bezier(0.4, 0, 1, 1)`.
- **Toast in:** spring, stiffness 420, damping 32, rising 18px.

**The catalogue:**
- **Rolling numbers:** when a value changes, only the digits that changed roll into place (0.45em, 320ms, staggered 40ms from the right). They roll up when the value rises and down when it falls.
- **Gauge fill:** when a gauge first appears, its segments fade in one after another (220ms each, 35ms apart). When it grows afterwards (a meal logged, water added), each new segment lights in the action colour and settles to ink (760ms each, 45ms apart): a bright edge runs along the gauge and leaves the new total behind. It plays the same past the target. Never red.
- **First target:** after setup, the calories number counts up from zero (900ms, the default ease) while the gauge draws in from the left (a clip, 900ms). Once per account on a device; not on reload. Under reduced motion the number is simply there and the gauge fades in.
- **Setup questions:** each question slides in like a pushed screen (28px, 260ms), from the right going forward and from the left going back.
- **AI result:** rows arrive one by one (300ms, 90ms apart, rising 10px). The "Your food" tag snaps in with a small overshoot (scale 0.5 → 1.12 → 1).
- **Save a meal:** the panel drops away, the new meal row opens into the list (360ms) with a brief action-tinted highlight, the gauge fills and the numbers roll.
- **Delete:** the struck-through line draws its strike (350ms); the Undo bar drains linearly over 10 seconds; the line then folds closed (280ms).
- **Unlock:** a locked Progress section is replaced by its content (350ms), and its trend line draws itself (1.1s).
- **Charts:** a range change redraws the trend line (700ms) and grows the bars from the baseline.
- **On target:** when a meal logged today brings the day within 2% of its target, the gauge sweeps as usual, the target tick lifts once in the action colour (620ms), and "On target" rolls up into place (420ms) as the sweep ends. Once a day per device; never on first sight of a day, a past day, or leaving the band. Chosen ("Settle") over a ripple along the gauge, from a prototype.
- **Weekly review:** the checks appear one by one (80ms apart).
- **Once-a-day rewards:** ticking the last supplement pops the checkboxes in turn; reaching the water goal ripples the meter. Each shows once per day.
- **Server waking:** six segments light in sequence where a spinner would be.

**Reduced motion:** with the system setting on (or the in-app choice), only fades remain (120ms), loops stop, and numbers change instantly. The 10-second Undo window still applies.

**The Never Punish Rule.** No motion reacts to going over a target, missing a weigh-in or skipping a day.

## Iconography

- **Set:** Phosphor (MIT). Regular weight everywhere; the **fill** weight only for the current tab.
- **Size:** 22px default, 18px inside buttons and rows.
- **Weigh-in:** Phosphor has no bathroom scale, so this one icon is drawn on Phosphor's 256 grid at its 16-unit line weight:

```svg
<svg viewBox="0 0 256 256" fill="none" stroke="currentColor" stroke-width="16" stroke-linecap="round" stroke-linejoin="round">
  <rect x="40" y="40" width="176" height="176" rx="40"/>
  <path d="M84 112a52 52 0 0 1 88 0"/>
  <path d="M128 136l16-28"/>
</svg>
```

- **Mapping:** Today `calendar-check` · Progress `chart-line` · You `user` · Log `plus` · Water `drop` · Supplements `pill` · Voice `microphone` · Photo `camera` · Saved foods `book-open` · Edit `pencil-simple` · Log it again `copy` · Share `share-network` · Keep `star` · Delete `trash` · Back/next `caret-left`/`caret-right` · Close `x` · Done `check`.
- Every icon is decorative next to a text label, or has an accessible name.

## Brand

**Name:** Trackaholic, renamed from "Macros Calculator" on 2026-10-06.

### Wordmark
The name set in Libre Franklin 900, with the segmented gauge as its rule (nine lit segments, three unlit, and the plan-coloured target tick), and a nutrition-label line beneath: "Serving size … 1 habit". It sits at the top of the desktop rail (28px) and on the sign-in screens (40px). There it is centred over the form with the page title, like a front door; the labels, boxes and notes keep the left edge, and the links under the button are centred.

```svg
<svg viewBox="0 0 212 68" role="img" aria-label="Trackaholic">
  <text x="0" y="34" font-family="Libre Franklin, Helvetica Neue, Arial, sans-serif" font-weight="900" font-size="40" letter-spacing="-1.4" fill="currentColor">Trackaholic</text>
  <g fill="currentColor">
    <rect x="0" y="42" width="15" height="8"/><rect x="17.4" y="42" width="15" height="8"/><rect x="34.8" y="42" width="15" height="8"/>
    <rect x="52.2" y="42" width="15" height="8"/><rect x="69.6" y="42" width="15" height="8"/><rect x="87" y="42" width="15" height="8"/>
    <rect x="104.4" y="42" width="15" height="8"/><rect x="121.8" y="42" width="15" height="8"/><rect x="139.2" y="42" width="15" height="8"/>
    <g opacity="0.22"><rect x="156.6" y="42" width="15" height="8"/><rect x="174" y="42" width="15" height="8"/><rect x="191.4" y="42" width="15" height="8"/></g>
  </g>
  <rect x="209" y="42" width="3" height="8" fill="#8c1d8c"/>
  <rect x="0" y="53" width="212" height="1" fill="currentColor"/>
  <text x="0" y="66" font-family="Libre Franklin, Helvetica Neue, Arial, sans-serif" font-size="12" fill="currentColor">Serving size</text>
  <text x="212" y="66" text-anchor="end" font-family="Libre Franklin, Helvetica Neue, Arial, sans-serif" font-weight="800" font-size="12" fill="currentColor">1 habit</text>
</svg>
```

Convert the text to outlines when the logo files are produced, so the mark does not depend on the font being installed.

### App icon
The gauge: five lit segments, two dark, and the target tick, centred as one group on near-black. It reads at 48px, survives Android's round crop (the group sits inside the central 80% safe zone), and has no letters to blur.

```svg
<svg viewBox="0 0 100 100" role="img" aria-label="Trackaholic">
  <rect width="100" height="100" fill="#0f1210"/>
  <g fill="#f2f4ef"><rect x="15.6" y="41" width="7" height="18"/><rect x="25.0" y="41" width="7" height="18"/><rect x="34.4" y="41" width="7" height="18"/><rect x="43.8" y="41" width="7" height="18"/><rect x="53.2" y="41" width="7" height="18"/></g>
  <g fill="#3a423c"><rect x="62.6" y="41" width="7" height="18"/><rect x="72.0" y="41" width="7" height="18"/></g>
  <rect x="81.4" y="37" width="3" height="26" fill="#e88ae8"/>
</svg>
```

## Voice

Wry, in small doses. Humour lives in quiet, good moments. Errors, going over a target, and anything about the body stay plain.

| Moment | What the app says |
|---|---|
| No meals yet today | Nothing logged yet. Suspiciously disciplined. |
| First weigh-in saved | First weigh-in. Your trend line starts now. |
| Weight trend unlocks | Seven weigh-ins. You've earned a trend line. |
| Daily burn unlocks | Enough data. Here's what you actually burn, measured, not guessed. |
| All supplement doses ticked | All doses done. Your future self says thanks. |
| Water goal reached | 2.5 litres. Fully hydrated, mildly smug. |
| AI estimate taking a while | Still looking. This one's got layers. |
| Weekly review, nothing to fix | Nothing to fix this week. Carry on. |
| Server waking up | Waking the server. It's on a free plan and naps a lot. About a minute; you can keep going. |
| Target set | Your target: 2,100 kcal and 150 g protein. A guide, not a rule. |
| Before a target is set | no target yet · Target: Not set yet |
| Getting started, both steps done | That's the basics. Progress fills in as you log. |
| Why setup asks (plain) | Only you see these answers. They're used to work out your target, nothing else. |
| A limit changed the pace (plain) | You asked to lose 1.5 kg a week; 1% of your body weight a week is the most it plans, so it plans 0.8 kg. |
| Pregnancy (plain) | Pregnant or breastfeeding? These targets aren't built for that. Your midwife or doctor can set one; you can still log meals. |
| The target moved (plain) | Your burn is now measured from your weigh-ins and meals: 2,690 kcal a day, not the 2,975 the formula estimated. Your target moved from 2,425 to 2,140 kcal. |
| An estimate failed (plain) | You can still log it. Search a food to get its numbers, or type the calories and protein yourself. |
| Within 2% of the calorie target | On target |
| Over the calorie target (plain) | Over is fine. The week evens out. Spread it across the next few days if you like. |
| A save fails (plain) | That didn't save. Check your connection, then try again. |
| Deleting an account (plain) | This deletes everything: meals, weigh-ins, foods. It can't be undone. |
| Logging out (plain) | Log out? Your data stays on your account. |
| Importing meals again (plain) | No new meals. 2 were already here. |
| Tip: a meal logged often (plain) | You've logged this 2 times before. · Keep as a saved meal |
| Tip: no steps logged yet (plain) | Use Samsung Health? Bring in your step history from its export. · Import my steps |
| Tip: saved foods in the AI box (plain) | Logging something you've saved? · Use my saved foods |

## Themes and palettes

**Theme:** light and dark, following the phone's setting by default, with an Automatic / Light / Dark choice in You → Appearance.

**Style:** **Fields** (default, this document) or **Label** (every screen as a black-and-white nutrition label, in Libre Franklin). Palettes apply to Fields only. On Appearance, the colour swatches are disabled in Label, with a line saying why.

**Per device, not per account.** Theme, style and palette are kept together in one localStorage key, `trackaholic_appearance`, so every account on a phone shares them, as they share the phone's own dark mode. The defaults are Automatic, Daylight and Fields, and anything unrecognised falls back to its default.

**Before the first paint.** `public/theme-init.js`, a plain script at the top of `<head>`, sets `data-theme`, `data-palette` and `data-style` on `<html>` from that key before anything is drawn, so a dark phone never flashes light. It is a file because the CSP blocks inline scripts. If it never runs, the page is Daylight light. Once the app runs, `AppearanceContext` takes over: it follows the phone on Automatic and carries a change made in another tab.

**The browser bar** is the ground: two `theme-color` metas give Daylight's ground for each theme from the first paint, and the app then sets them to the ground actually painted. The install manifest holds one colour, so the splash screen stays Daylight dark (accepted).

**The Label style in the app.** A `label:` variant (`:where([data-style="label"] *)`, so no added specificity) carries each change on the primitive it belongs to, and every radius token is 0:
- **Blocks:** a white box with a 2px ink border on the grey ground, the heading in heavy type (20px/900, not capitals) over a 5px rule. The sections that are not Blocks use the same classes from `ui/block`.
- **Controls:** buttons, chips, inputs and the switch are square, with a 2px ink border. The primary button is ink with white text.
- **Stats** are label rows: the name in bold at the left, the number at the right.
- **Meters** on the ground are a 2px ink box filled with ink.
- **The shell:**
  - screen bars, page headers, the Save bar, the tab bar, the rail and sheets sit on 5px rules;
  - the current tab's name is underlined;
  - the current rail item is inverted.
- **Today's calories** are the nutrition label (Components: The nutrition-label object).

**Make it yours.** "Make it yours: pick a colour", with five palette dots, links to You → Appearance from Getting started's last moment and from the new-Trackaholic prompt. It is an invitation, not a setup step.

**Palettes:** nine, chosen in You → Appearance, in this order: Daylight, Ocean, Teal, Citrus, Violet, Berry, Clay, Sand, Ember. Every text pair measures at least 4.5:1 and every non-text pair at least 3:1, in both themes; the lowest are on Citrus's light ground, its fact colour at 4.60:1 and its action colour at 4.65:1. Daylight keeps the calories band on the ground; every other palette gives the band its own deep colour.

The exact tokens, as CSS custom properties. Each palette defines the full set for light; its dark block redefines the same names. In the band tokens, `band-ink` and the like apply to text and segments drawn on the band.

```css
/* Daylight (default) */
--ground: #e4e7e1; --field: #eef0eb; --ink: #0f1210; --ink-2: #485049; --rule: #c3c9c1; --track: #cfd4cc; --fill: #0f1210;
--action: #1747e0; --action-ink: #ffffff; --plan: #8c1d8c; --label: #f8f9f6; --fact: #1d6b3a;
--band: var(--ground); --band-ink: var(--ink); --band-ink-2: var(--ink-2); --band-track: var(--track); --band-fill: var(--fill); --band-plan: var(--plan); --band-rule: var(--rule);
/* Daylight dark */
--ground: #0b0e0c; --field: #141815; --ink: #e7ebe4; --ink-2: #9ba49c; --rule: #283029; --track: #232924; --fill: #e7ebe4;
--action: #7d9bff; --action-ink: #0b0e0c; --plan: #e88ae8; --label: #050605; --fact: #6fd394;

/* Ocean */
--ground: #dce5ee; --field: #e9eff5; --ink: #0b1a2a; --ink-2: #3d5064; --rule: #b5c4d2; --track: #c3d0dc; --fill: #0b1a2a;
--action: #0b57c4; --action-ink: #ffffff; --plan: #7a4300; --label: #f6f9fc; --fact: #0f6a46;
--band: #0e2a47; --band-ink: #f2f6fa; --band-ink-2: #a9bfd3; --band-track: #26486b; --band-fill: #f2f6fa; --band-plan: #ffb24a; --band-rule: #23436a;
/* Ocean dark */
--ground: #06101a; --field: #0c1825; --ink: #e6eef5; --ink-2: #93a8bb; --rule: #1b2b3b; --track: #172635; --fill: #e6eef5;
--action: #6fa8ff; --action-ink: #06101a; --plan: #ffb24a; --label: #03080d; --fact: #5fd6a2; --band: #0f2d4d; --band-rule: #23466e;

/* Teal */
--ground: #dde9e6; --field: #eaf2f0; --ink: #0b1f1c; --ink-2: #3e5651; --rule: #b5cbc6; --track: #c4d6d2; --fill: #0b1f1c;
--action: #0b6b62; --action-ink: #ffffff; --plan: #a8431f; --label: #f7fbfa; --fact: #1d6b3a;
--band: #0d3b3a; --band-ink: #eef8f6; --band-ink-2: #a6cbc5; --band-track: #2a5c59; --band-fill: #eef8f6; --band-plan: #ff9e7a; --band-rule: #24524f;
/* Teal dark */
--ground: #071413; --field: #0d1d1b; --ink: #e4f1ee; --ink-2: #93aea8; --rule: #1a2f2c; --track: #162a27; --fill: #e4f1ee;
--action: #4fd1c1; --action-ink: #071413; --plan: #ff9e7a; --label: #030a09; --fact: #6fd394; --band: #0e3634; --band-rule: #23504d;

/* Citrus */
--ground: #f3f3ee; --field: #fbfbf7; --ink: #1a1c14; --ink-2: #50544a; --rule: #d6d7cd; --track: #dfe0d6; --fill: #1a1c14;
--action: #c2410c; --action-ink: #ffffff; --plan: #2f7d32; --label: #fdfdfa; --fact: #2f7d32;
--band: #24561f; --band-ink: #f6fbf2; --band-ink-2: #c3dbbd; --band-track: #3f7339; --band-fill: #f6fbf2; --band-plan: #ffb067; --band-rule: #386a32;
/* Citrus dark */
--ground: #0f110c; --field: #171a12; --ink: #eef0e6; --ink-2: #a4a99a; --rule: #2a2e23; --track: #252a1e; --fill: #eef0e6;
--action: #ff9a4d; --action-ink: #0f110c; --plan: #8fd88a; --label: #070806; --fact: #8fd88a; --band: #1f4a1b; --band-rule: #2f6229;

/* Violet */
--ground: #e6e2ee; --field: #f0edf5; --ink: #17122a; --ink-2: #4f4766; --rule: #c9c1d8; --track: #d5cee2; --fill: #17122a;
--action: #5b2fc9; --action-ink: #ffffff; --plan: #9a4508; --label: #faf9fc; --fact: #1d6b3a;
--band: #2a1a5e; --band-ink: #f4f0ff; --band-ink-2: #bfb2e6; --band-track: #45358a; --band-fill: #f4f0ff; --band-plan: #ffb067; --band-rule: #3f3080;
/* Violet dark */
--ground: #0d0a17; --field: #151122; --ink: #ece8f7; --ink-2: #a49cbc; --rule: #2a2440; --track: #241e38; --fill: #ece8f7;
--action: #a98bff; --action-ink: #0d0a17; --plan: #ffb067; --label: #06050b; --fact: #6fd394; --band: #2b1b60; --band-rule: #46368a;

/* Berry */
--ground: #ecdfe7; --field: #f5ecf1; --ink: #22101c; --ink-2: #5d4555; --rule: #d1bbca; --track: #dccad6; --fill: #22101c;
--action: #8c1a5a; --action-ink: #ffffff; --plan: #0d6a64; --label: #fcf7fa; --fact: #0d6a64;
--band: #3a1430; --band-ink: #fbeef6; --band-ink-2: #d6b0c8; --band-track: #5c2b4f; --band-fill: #fbeef6; --band-plan: #7fe0d6; --band-rule: #57284b;
/* Berry dark */
--ground: #120a10; --field: #1b1018; --ink: #f3e6ee; --ink-2: #b399a9; --rule: #2e1d29; --track: #2a1a25; --fill: #f3e6ee;
--action: #ff8fc8; --action-ink: #120a10; --plan: #7fe0d6; --label: #0a0509; --fact: #7fe0d6; --band: #3d1633; --band-rule: #5c2c50;

/* Clay */
--ground: #ece3dc; --field: #f5efea; --ink: #21160f; --ink-2: #5c4a3f; --rule: #d2c2b6; --track: #dccdc1; --fill: #21160f;
--action: #a33c12; --action-ink: #ffffff; --plan: #1f5f78; --label: #fcf8f5; --fact: #1d6b3a;
--band: #63301f; --band-ink: #fbeee6; --band-ink-2: #dcb7a6; --band-track: #7e4734; --band-fill: #fbeee6; --band-plan: #9fd6e8; --band-rule: #74402d;
/* Clay dark */
--ground: #140d0a; --field: #1d1410; --ink: #f1e4dc; --ink-2: #b39d90; --rule: #33241d; --track: #2c1f19; --fill: #f1e4dc;
--action: #ff8a5c; --action-ink: #140d0a; --plan: #8fd0e6; --label: #0a0605; --fact: #6fd394; --band: #4a2216; --band-rule: #63321f; --band-track: #6e3c2b;

/* Sand */
--ground: #eae1d2; --field: #f3ede2; --ink: #1f1a14; --ink-2: #5a5044; --rule: #cdc1ae; --track: #d8cdbb; --fill: #1f1a14;
--action: #12595e; --action-ink: #ffffff; --plan: #8a2d5a; --label: #fbf8f2; --fact: #12595e;
--band: #2b2420; --band-ink: #f5ede1; --band-ink-2: #c6b6a2; --band-track: #4b4038; --band-fill: #f5ede1; --band-plan: #f2a6cb; --band-rule: #463b33;
/* Sand dark */
--ground: #14110d; --field: #1c1813; --ink: #efe6d8; --ink-2: #ab9e8c; --rule: #2e281f; --track: #2a241c; --fill: #efe6d8;
--action: #5cc6c9; --action-ink: #14110d; --plan: #f2a6cb; --label: #0a0806; --fact: #5cc6c9; --band: #2e2621; --band-rule: #4a3f36;

/* Ember */
--ground: #e3e5e8; --field: #eff1f3; --ink: #121315; --ink-2: #4b4f56; --rule: #c5c9cf; --track: #d0d4d9; --fill: #121315;
--action: #b3121b; --action-ink: #ffffff; --plan: #b3121b; --label: #ffffff; --fact: #1d6b3a;
--band: #131416; --band-ink: #f3f4f6; --band-ink-2: #a9aeb6; --band-track: #34373c; --band-fill: #e6e8ec; --band-plan: #ff3b44; --band-rule: #2c2f34;
/* Ember dark */
--ground: #0b0c0e; --field: #15171a; --ink: #eceef1; --ink-2: #a3a8b0; --rule: #2a2d32; --track: #25282c; --fill: #eceef1;
--action: #ff4d55; --action-ink: #0b0c0e; --plan: #ff4d55; --label: #050506; --fact: #6fd394; --band: #1b1d21; --band-rule: #34373d;

/* Label style (palettes do not apply; it sets every token a palette sets, so none leaks through) */
--ground: #e9ebec; --label: #ffffff; --ink: #000000; --ink-2: #3f4245; --track: #d4d7d9; --action: #000000; --action-ink: #ffffff; --field: #ffffff; --rule: #000000; --fill: #000000; --plan: #000000; --fact: #000000;
--band: var(--label); --band-ink: var(--ink); --band-ink-2: var(--ink-2); --band-track: var(--track); --band-fill: var(--fill); --band-plan: var(--plan); --band-rule: var(--rule);
/* Label style dark */
--ground: #161718; --label: #000000; --ink: #ffffff; --ink-2: #c4c7ca; --track: #3a3c3e; --action: #ffffff; --action-ink: #000000; --field: #000000; --rule: #ffffff; --fill: #ffffff; --plan: #ffffff; --fact: #ffffff;
```
