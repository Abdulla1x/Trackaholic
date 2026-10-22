import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  afterNotNow,
  ASK_AGAIN_AFTER_MS,
  deviceOf,
  inAppName,
  installRoute,
  iosBrowserName,
  readInstallMemory,
  shouldAsk,
  type InstallMemory,
} from '../src/lib/install.ts'

// Real user agents, trimmed only where they repeat.
const UA = {
  iphoneSafari:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1',
  iphoneChrome:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/141.0.7390.41 Mobile/15E148 Safari/604.1',
  iphoneFirefox:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/143.0 Mobile/15E148 Safari/605.1.15',
  // iPadOS asks for the desktop site, so it reads as a Mac.
  ipad: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15',
  mac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15',
  samsungChrome:
    'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36',
  samsungInternet:
    'Mozilla/5.0 (Linux; Android 15; SM-S938B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/28.0 Chrome/130.0.0.0 Mobile Safari/537.36',
  huaweiBrowser:
    'Mozilla/5.0 (Linux; Android 10; HMSCore 6.15.0.302; GMSCore 0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.5735.196 HuaweiBrowser/15.0.4.312 Mobile Safari/537.36',
  harmony:
    'Mozilla/5.0 (Phone; OpenHarmony 5.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36 ArkWeb/4.1.6.1 Mobile HuaweiBrowser/5.0.4.300',
  windowsChrome:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
  linkedinIos:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [LinkedInApp]/9.31.1',
  instagramAndroid:
    'Mozilla/5.0 (Linux; Android 14; SM-S918B Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.0.0 Mobile Safari/537.36 Instagram 352.0.0.38.100 Android',
  facebookIos:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/480.0.0.40.109]',
  androidWebView:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.0.0 Mobile Safari/537.36',
}

const route = (userAgent: string, canPrompt = false, maxTouchPoints = 5) =>
  installRoute({ userAgent, maxTouchPoints, canPrompt })

test('an iPhone shows the taps: Safari in its bar, the others in the address bar', () => {
  assert.equal(route(UA.iphoneSafari), 'ios-safari')
  assert.equal(route(UA.iphoneChrome), 'ios-other')
  assert.equal(route(UA.iphoneFirefox), 'ios-other')
  assert.equal(iosBrowserName(UA.iphoneChrome), 'Chrome')
  assert.equal(iosBrowserName(UA.iphoneFirefox), 'Firefox')
})

test('an iPad reads as a Mac, and touch tells them apart', () => {
  assert.equal(deviceOf(UA.ipad, 5), 'ios')
  assert.equal(route(UA.ipad, false, 5), 'ios-safari')
  assert.equal(deviceOf(UA.mac, 0), 'computer')
  assert.equal(route(UA.mac, false, 0), 'none')
})

test('Android gets the Install button when the browser offers it, else the menu', () => {
  for (const userAgent of [UA.samsungChrome, UA.samsungInternet]) {
    assert.equal(route(userAgent, true), 'button')
    assert.equal(route(userAgent, false), 'android-menu')
  }
  // Huawei Browser, and Chrome on a phone without Google services, may never offer it.
  assert.equal(route(UA.huaweiBrowser), 'android-menu')
  assert.equal(deviceOf(UA.harmony, 5), 'android')
})

test('a computer gets the button when Chrome offers it and nothing otherwise', () => {
  assert.equal(route(UA.windowsChrome, true, 0), 'button')
  assert.equal(route(UA.windowsChrome, false, 0), 'none')
})

test('in-app browsers say to open a real one, even if an event somehow arrives', () => {
  assert.equal(route(UA.linkedinIos), 'in-app')
  assert.equal(route(UA.instagramAndroid, true), 'in-app')
  assert.equal(route(UA.facebookIos), 'in-app')
  assert.equal(route(UA.androidWebView), 'in-app')
  assert.equal(inAppName(UA.linkedinIos), 'LinkedIn')
  assert.equal(inAppName(UA.instagramAndroid), 'Instagram')
  assert.equal(inAppName(UA.facebookIos), 'Facebook')
  assert.equal(inAppName(UA.androidWebView), null)
  // Chrome and Samsung Internet are not in-app browsers.
  assert.equal(route(UA.samsungInternet), 'android-menu')
})

const NOW = Date.UTC(2026, 9, 22)
const ask = (overrides: Partial<Parameters<typeof shouldAsk>[0]> = {}) =>
  shouldAsk({
    standalone: false,
    installedAt: null,
    device: 'ios',
    route: 'ios-safari',
    ready: true,
    memory: {},
    now: NOW,
    ...overrides,
  })

test('asks a phone browser once Getting started is done', () => {
  assert.equal(ask(), true)
  assert.equal(ask({ ready: false }), false)
})

test('never asks the installed app or an account seen installed', () => {
  assert.equal(ask({ standalone: true }), false)
  assert.equal(ask({ installedAt: '2026-10-20T08:00:00' }), false)
  assert.equal(ask({ memory: { done: true } }), false)
})

test('never asks while the API predates installed_at', () => {
  assert.equal(ask({ installedAt: undefined }), false)
})

test('never asks a computer, even one with an install dialog', () => {
  assert.equal(ask({ device: 'computer', route: 'button' }), false)
  assert.equal(ask({ device: 'computer', route: 'none' }), false)
})

test('Not now asks once more after a week, then never', () => {
  let memory: InstallMemory = afterNotNow({}, NOW)
  assert.equal(ask({ memory, now: NOW + ASK_AGAIN_AFTER_MS - 1 }), false)
  assert.equal(ask({ memory, now: NOW + ASK_AGAIN_AFTER_MS }), true)

  memory = afterNotNow(memory, NOW + ASK_AGAIN_AFTER_MS)
  assert.equal(memory.notNow, 2)
  assert.equal(ask({ memory, now: NOW + 100 * ASK_AGAIN_AFTER_MS }), false)
})

test('a memory that cannot be read counts as none', () => {
  assert.deepEqual(readInstallMemory(null), {})
  assert.deepEqual(readInstallMemory('not json'), {})
  assert.deepEqual(readInstallMemory('{"notNow":1,"lastAt":5}'), { notNow: 1, lastAt: 5 })
})
