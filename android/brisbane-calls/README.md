# Brisbane Calls Android app

This Pixel app opens a Brisbane TVs Calendar link and loads the matching
Operations lead. Tom starts the call in Google Phone. When the call ends, he
shares the saved recording with Brisbane Calls. The app uploads it to private
Cloudflare storage under the same lead ID.

Google Phone records the audio and announces the recording to both people. Tom
confirms that the announcement played before upload. The app does not request
Accessibility access or capture cellular audio itself.

## Calendar URL

Use this HTTPS form in a Calendar event description:

```text
https://brisbanetvs.com/operations/phone/call/?ref=<sheet-lead-id>&source=<lead-source>
```

For website leads, `source=website`. For Facebook and Instagram rows synced
from the shared Sheet, `source=google_lead_sheet`. The app resolves that stable
external reference to the canonical D1 lead before the call.

## Local build

The project uses Android API 35, JDK 17 or newer, Gradle 8.11.1 and Android
Gradle Plugin 8.10.1. `local.properties` and signing files are intentionally not
committed.

```powershell
$env:JAVA_HOME = 'C:\Program Files\Java\jdk-21'
./gradlew.bat :app:assembleDebug
```

The debug APK is written to `app/build/outputs/apk/debug/app-debug.apk`.
Production signing values are read only from the four
`BRISBANE_CALLS_KEYSTORE*` environment variables; no key or password belongs in
Git. A signed release build is written to
`app/build/outputs/apk/release/app-release.apk`.
