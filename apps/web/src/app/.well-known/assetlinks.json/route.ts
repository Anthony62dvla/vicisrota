/**
 * Proves to Android that the VicisRota app in Google Play belongs to this website, so the app opens the site full
 * screen with no browser bar. Set ANDROID_PACKAGE and ANDROID_CERT_SHA256 (comma-separated if Google Play and an
 * upload key both sign it) in app.env once the app is made. Until then this is "not found".
 */
export function GET() {
  const pkg = process.env.ANDROID_PACKAGE?.trim();
  const certs = (process.env.ANDROID_CERT_SHA256 ?? "")
    .split(",")
    .map((c) => c.trim().toUpperCase())
    .filter((c) => /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(c));
  if (!pkg || !certs.length) return new Response("Not found", { status: 404 });
  return Response.json(
    [{ relation: ["delegate_permission/common.handle_all_urls"], target: { namespace: "android_app", package_name: pkg, sha256_cert_fingerprints: certs } }],
    { headers: { "Cache-Control": "public, max-age=3600" } },
  );
}
