# Tom's Pixel call-recording app

Brisbane Calls is the installable Android app for Calendar follow-up calls. It
uses the lead ID already stored in Operations and keeps Tom's current mobile
number.

## Call flow

1. Tom opens a follow-up event in Google Calendar and taps **Open in Brisbane Calls**.
2. The app resolves the Calendar lead reference to the canonical D1 lead.
3. Tom taps **Call & record**. Google Phone opens with the customer's number.
4. During the call, Tom starts **Call Assist > Call recording**. Google Phone
   announces the recording to both people.
5. After the call, Tom opens the saved recording in Phone history and chooses
   **Share > Brisbane Calls**.
6. Tom confirms that the announcement played. The app uploads the file and the
   recording appears under **Operations > Workspace > Calls**.

Google documents the Pixel recording and sharing steps in [Use the Phone app to
record calls](https://support.google.com/phoneapp/answer/9803950?hl=en-AU).
Availability depends on the Pixel model, Android version, carrier and region.

## Android limit

Android does not give a normal installed app access to both sides of a cellular
call. Direct call-audio capture is reserved for a privileged preinstalled app or
specific accessibility use cases. The platform rules are documented in
[Sharing audio input](https://developer.android.com/media/platform/sharing-audio-input).

The first release uses Google Phone for recording and Brisbane Calls for lead
matching and upload. A fully automatic recorder would need a phone provider or
PBX that records calls on the network.

## Calendar link

Each Calendar Calls event description needs this URL:

```text
https://brisbanetvs.com/operations/phone/call/?ref=<sheet-lead-id>&source=<lead-source>
```

Use `source=website` for website leads and `source=google_lead_sheet` for
Facebook or Instagram rows synced from the shared Sheet. Android verifies this
domain through `/.well-known/assetlinks.json` and opens the installed app.

The helper functions are in
`integrations/google-apps-script/phone-call-links.gs`. The current Calendar
event builder must call `operationsAppendPhoneCallLink_` when it sets the event
description.

## Pairing and storage

- A staff member opens `/operations/phone/pair/` behind Cloudflare Access.
- The pairing code lasts ten minutes and can be used once.
- The app stores its device token with Android Keystore encryption.
- D1 stores SHA-256 hashes of pairing codes and device tokens.
- Audio uploads stream directly to the private `brisbanetvs-call-recordings` R2
  bucket. The Worker rejects non-audio content and files larger than 100 MB.
- The default retention period is 90 days.
- Playback runs through `/operations/api/recordings/<recording-id>` behind
  Cloudflare Access. R2 has no public URL.

Queensland's current [Invasion of Privacy Act
1971](https://www.legislation.qld.gov.au/view/whole/html/inforce/current/act-1971-050)
contains separate rules for recording a conversation and communicating that
recording. The app requires the Google Phone announcement and an upload
confirmation. This setup is an operational safeguard, not legal advice.

## Build and signing

The Android source is in `android/brisbane-calls`. The release key is stored
outside Git under the current Windows user's `.android` directory. Its password
is protected with Windows DPAPI. The signed APK is copied to:

```text
android/brisbane-calls/releases/Brisbane-Calls-v0.1.0.apk
```

Tom can download the same signed file through
`/operations/api/app/android`. Cloudflare Access protects the download.

Keep the release key and DPAPI password file. Android will reject an update
signed with a different key.
