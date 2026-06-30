'use strict'

const { execFileSync } = require('child_process')

/**
 * Ad-hoc code-sign the macOS .app after packing.
 *
 * We don't have a paid Apple Developer certificate, so electron-builder ships
 * the app with `identity: null` (no signature). On Apple Silicon an app with a
 * missing/broken signature is reported by Gatekeeper as "VibeDuck is damaged
 * and can't be opened". Applying an ad-hoc signature ("-") gives the app a
 * valid signature, so it instead shows the normal "unidentified developer"
 * prompt that users can bypass with right-click → Open (or `xattr -cr`).
 *
 * This runs before the DMG target is assembled, so the signed app is what ends
 * up inside the installer.
 */
exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return

  const appName = context.packager.appInfo.productFilename
  const appPath = `${context.appOutDir}/${appName}.app`

  // --force: replace any existing (broken) signature.
  // --deep: also sign nested frameworks/helpers.
  // --sign -: ad-hoc identity (no certificate required).
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', '--timestamp=none', appPath], {
    stdio: 'inherit'
  })

  // Sanity check — fail the build if the signature didn't take.
  execFileSync('codesign', ['--verify', '--deep', '--strict', '--verbose=2', appPath], {
    stdio: 'inherit'
  })

  console.log(`[afterPack] ad-hoc signed ${appName}.app`)
}
