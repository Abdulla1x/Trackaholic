import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import Wordmark from '../components/shell/Wordmark'

/** The privacy policy, at /privacy.
 *
 *  Public, outside the sign-in gate: Google's sign-in setup links to it from
 *  its consent screen and checks it during brand verification, and anyone
 *  deciding whether to sign up should be able to read it first.
 *
 *  ⚠️ Every sentence here is a claim about the code, checked against it when
 *  written (2026-10-21). Changing what is stored, sent or kept means changing
 *  this page in the same PR, and moving the date below. */
const UPDATED = '24 October 2026'
const PRIVACY_EMAIL = 'privacy@trackaholic.app'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-2.5">
      <h2 className="text-title">{title}</h2>
      {children}
    </section>
  )
}

function List({ children }: { children: ReactNode }) {
  return <ul className="grid list-disc gap-1.5 pl-5 marker:text-ink-2">{children}</ul>
}

const LINK =
  'font-semibold text-action underline underline-offset-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action'

export default function Privacy() {
  return (
    <main className="mx-auto grid max-w-[760px] gap-7 px-5 py-8">
      <Link to="/" aria-label="Trackaholic home" className="justify-self-start">
        <Wordmark size="large" />
      </Link>
      <div className="grid gap-7 measure">
        <header className="grid gap-1.5">
          <h1 className="text-[26px] leading-tight font-bold text-balance [font-stretch:105%]">Privacy</h1>
          <p className="text-small text-ink-2">Last updated {UPDATED}</p>
        </header>

        <p>
          Trackaholic is a calorie and macro tracker that I build and run myself. This page says what it
          stores, where it goes, and how to get it back or delete it. There are no ads, no analytics and no
          trackers, and I don&rsquo;t sell or share your data with anyone.
        </p>

        <Section title="What the app stores">
          <List>
            <li>
              <strong>Your account:</strong> your email address and a scrambled form of your password (never
              the password itself). If you sign in with Google, Google gives the app your email address and an
              account number that identifies you to it; your name and photo are not kept.
            </li>
            <li>
              <strong>What you log:</strong> meals and their foods, amounts and nutrition, saved foods and saved
              meals, weigh-ins, water, steps, supplements and the doses you tick off, and calorie plans.
            </li>
            <li>
              <strong>Your settings:</strong> targets, and the body details you enter for them: height, birth
              date, sex, activity level and goal weight.
            </li>
            <li>
              <strong>AI estimates:</strong> the text of your meal note, the transcript of a voice note, and the
              estimate the AI gave back.
            </li>
          </List>
        </Section>

        <Section title="Photos and voice notes go to Google">
          <p>
            The AI estimates come from Google&rsquo;s Gemini service. When you ask for one, your photos, voice
            note and meal note are sent to Google to be analysed. Photos are shrunk on your device first,
            which also strips their location data. The app doesn&rsquo;t keep the photos or the
            recording, only the text described above.
          </p>
          <p>
            The app uses Gemini&rsquo;s free tier. Under{' '}
            <a href="https://ai.google.dev/terms" className={LINK}>
              Google&rsquo;s terms for it
            </a>
            , Google may use what is sent to improve its products, and people at Google may review some of it
            after it has been disconnected from the app&rsquo;s account. It reaches Google as a request from the
            app, not from your Google account. If you&rsquo;d rather not send a photo, you can always type the
            meal or enter the numbers yourself.
          </p>
        </Section>

        <Section title="Where it lives">
          <List>
            <li>The database is hosted by Neon and the server by Render, both in the United States.</li>
            <li>The app itself is served by Vercel.</li>
            <li>Password reset emails are sent through Resend.</li>
            <li>
              Food searches send the words you search for to Open Food Facts, and nothing that identifies you.
            </li>
          </List>
          <p>
            The server keeps short-lived logs of the requests it receives, which include your IP address and
            the addresses requested, with what you searched for blanked out. The app&rsquo;s own log lines
            name accounts by number, not by email.
          </p>
        </Section>

        <Section title="In your browser">
          <p>
            The app keeps your login, your look (theme and colours) and a few conveniences, like a half-written
            note and which tips you&rsquo;ve closed, in your browser&rsquo;s storage. No cookies are set.
          </p>
        </Section>

        <Section title="Who can see it">
          <p>
            Only you, through your account. I can see account emails, signup dates, when each account was last
            used and how many things it has logged on an admin page, but not the entries themselves. As the person running the
            server I could read the database directly, and I only do that to fix a problem.
          </p>
          <p>
            A meal you share by code is written into the code itself, so anyone you give the code to can read
            that meal.
          </p>
        </Section>

        <Section title="Getting your data, and deleting it">
          <List>
            <li>
              <strong>Download everything:</strong> You &rarr; Your data exports all of it, as a file you can
              keep.
            </li>
            <li>
              <strong>Delete your account:</strong> You &rarr; Delete account removes the account and everything
              in it from the database straight away. The database host keeps a rolling six-hour history for
              recovery, so after six hours no copy is left. The app keeps anonymous daily totals (how many
              people signed up or logged a meal that day), which say nothing about who.
            </li>
          </List>
        </Section>

        <Section title="Trying the demo">
          <p>
            The demo gives you a temporary account of your own, filled with a month of made-up data, without
            asking for an email or a password. Anything you change or add stays in that account. It is deleted,
            with everything in it, about a day after it starts, or straight away when you end the demo. The demo
            doesn&rsquo;t run the AI, so it never sends anything to Google. The app only keeps a count of how
            many demos start each day.
          </p>
        </Section>

        <Section title="Questions">
          <p>
            Email{' '}
            <a href={`mailto:${PRIVACY_EMAIL}`} className={LINK}>
              {PRIVACY_EMAIL}
            </a>{' '}
            about anything on this page, including a request to see or delete your data. If this page changes,
            the date at the top changes with it.
          </p>
        </Section>
      </div>
    </main>
  )
}
