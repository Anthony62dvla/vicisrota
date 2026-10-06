# VicisRota in the app stores

VicisRota already works as an app: on a phone, open https://vicisrota.app and choose **Add to Home Screen** (iPhone: Share, then Add to Home Screen; Android: the menu, then Install app). It opens full screen, works offline for the shift list, and sends notifications.

Putting it in Google Play and the App Store uses the same website inside a store app, so every update to the site reaches the apps straight away, with no new app version to send.

## Google Play (Android)

You need a Google Play developer account (a one-off $25) in DMST Ltd's name.

1. Go to https://www.pwabuilder.com, enter `https://vicisrota.app` and choose **Package for stores → Android**.
2. Use package ID `app.vicisrota.twa`, app name VicisRota, and keep "Signing key: create new". Download the package. **Keep the signing key file and its passwords somewhere safe**; you need them for every future update.
3. In the Play Console, create the app and upload the `.aab` file from the package. Fill in the store listing, the content rating, and the data safety form (the privacy policy is https://vicisrota.app/privacy).
4. In the Play Console, open **Setup → App signing** and copy the SHA-256 certificate fingerprint. The package's `assetlinks.json` also lists your upload key's fingerprint.
5. On the server, add both fingerprints, comma-separated, without showing them on screen:

   ```
   cd /opt/vicisrota/deploy
   echo "ANDROID_PACKAGE=app.vicisrota.twa" >> app.env
   read -rsp "Fingerprints: " v && echo "ANDROID_CERT_SHA256=$v" >> app.env
   ./update.sh
   ```

6. Check https://vicisrota.app/.well-known/assetlinks.json shows them. Without this, the app shows a browser bar along the top.

## App Store (iPhone)

You need an Apple Developer account (£79 a year) in DMST Ltd's name, which needs a D-U-N-S number for the company, and a Mac with Xcode to send the app to Apple.

1. In PWABuilder choose **Package for stores → iOS**, with bundle ID `app.vicisrota`. Download the Xcode project.
2. On the Mac, open it in Xcode, sign in with the developer account, and choose **Product → Archive**, then **Distribute App**.
3. In App Store Connect, fill in the listing and privacy answers. Apple can reject apps that only wrap a website, so the review notes should mention that it works offline, sends shift notifications, and has clocking in, the Easy Read view and Raise a concern.

Staff on iPhone can already use Add to Home Screen, so the App Store version can wait until there is demand for it.
