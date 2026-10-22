[← Back to the README](../README.md)

# 📲 Install it on your phone

The app is a **PWA**, so it can be added to your home screen and opened like a
native app — its own icon, its own window, no address bar. There is nothing to
download and no app store involved: it is the same
[live app](https://trackaholic.app), saved as a shortcut that
the browser then treats as an app.

**On Android** (Chrome, Edge, Samsung Internet)

1. Open the app in your browser.
2. Open the browser menu — the **⋮** in the corner.
3. Tap **Install app**, or **Add to Home screen** if that is the wording you see.
4. Confirm. The icon appears with your other apps.

**On iPhone or iPad** (Safari)

1. Open the app in Safari.
2. Tap **Share** — the square with the arrow pointing up.
3. Scroll down the list and tap **Add to Home Screen**.
4. Tap **Add**.

On iOS 16.4 and later, Chrome, Edge and Firefox can add to the home screen from
their own share menus too; before that, it has to be Safari.

**On a desktop** (Chrome, Edge) — an install icon appears at the right-hand end
of the address bar; the browser menu has the same option if it doesn't.

The app offers the same steps itself, for the phone and browser you are on:
once on Today after your first meal, and any time from **You → Add to home screen**.

**What you get:** the app opens full-screen with no browser chrome, on its own
icon, with a dark splash screen while it starts.

⚠️ **What you do not get, said rather than left for you to discover:**

- **It does not work offline.** The service worker caches the app shell only,
  and API responses are deliberately never cached — a shared browser cache
  holding one account's data is exactly what per-user isolation exists to
  prevent. With no connection the app opens and has nothing to show.
- **It cannot notify you.** Installing changes nothing about reminders: the
  supplement and weigh-in reminders still speak only while the app is open, for
  the reasons given under the [supplement tracker](features.md#-today).
