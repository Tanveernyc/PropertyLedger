# Setting up Sign in with Apple and Google

One-time console work. Nothing here is secret: both Google client IDs appear in
network traffic and are restricted by bundle id. Do these before building 1.2.

## 1. Apple (5 minutes)

1. developer.apple.com → Certificates, Identifiers & Profiles → **Identifiers**.
2. Open `com.trueorganichub.propertyledger`.
3. Tick **Sign in with Apple** → **Save**. Leave "Server-to-Server Notification
   Endpoint" blank; Supabase does not use it.

No Services ID and no `.p8` key: those belong to the web OAuth flow, which this
app does not use, so there is also no six-month secret rotation.

## 2. Google (10 minutes)

1. console.cloud.google.com → create a project (e.g. "PropertyLedger").
2. **APIs & Services → OAuth consent screen**: External, app name
   "PropertyLedger", support email `support@trueorganichub.com`, developer email
   the same. Scopes: `openid`, `.../auth/userinfo.email`,
   `.../auth/userinfo.profile` — the three defaults, nothing more, or Google
   review is triggered.
3. **Credentials → Create credentials → OAuth client ID → iOS**:
   bundle id `com.trueorganichub.propertyledger`. Copy the client ID.
4. **Create credentials → OAuth client ID → Web application**, name it
   "Supabase". Copy that client ID too. Under **Authorized redirect URIs** add
   `https://dxjwyaldmxquuztmnrsb.supabase.co/auth/v1/callback`.
5. Optional but recommended: start **Branding** verification so the consent
   screen shows "PropertyLedger" instead of the Supabase project URL. It takes
   a few business days, so start it early.

## 3. Supabase (3 minutes)

Dashboard → Authentication → **Providers**:

- **Apple**: enable. In *Authorized Client IDs* put
  `com.trueorganichub.propertyledger`. Leave Secret Key empty (native flow only).
- **Google**: enable. *Client ID* = the **Web** client ID from step 2.4.
  *Client Secret* = that web client's secret. In *Authorized Client IDs* put the
  **iOS** client ID from step 2.3.
- Leave **Confirm email** OFF — see §4 of the design spec for why, and what to
  change if that decision is revisited.

## 4. This repository (2 minutes)

In `.env` (never committed):

```
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=<iOS client id>.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=<web client id>.apps.googleusercontent.com
```

In `app.json`, replace the placeholder in the google-signin plugin with the
**reversed** iOS client ID:

```json
["@react-native-google-signin/google-signin",
  { "iosUrlScheme": "com.googleusercontent.apps.<iOS client id without the suffix>" }]
```

Then rebuild — both modules are native, so an OTA update cannot deliver them:

```bash
npx eas-cli@latest build -p ios --profile production --auto-submit
```

## 5. Verify on a device

- Continue with Apple on a fresh account → lands on the first-run chooser.
- Sign out, Continue with Apple again → same ledgers.
- Same two steps for Google.
- Create a password account, sign out, Continue with Google with that same
  address → the same ledgers appear (identity linking).
- Delete account still removes everything.
