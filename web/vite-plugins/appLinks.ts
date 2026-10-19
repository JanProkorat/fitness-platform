import type { Connect, Plugin } from 'vite'
import { loadEnv } from 'vite'

const AASA_PATH = '/.well-known/apple-app-site-association'
const ASSETLINKS_PATH = '/.well-known/assetlinks.json'

const DEFAULT_APP_ID = 'com.gfplatform.mobile'
const PLACEHOLDER_TEAM_ID = 'APPLE_TEAM_ID_NOT_SET'
const PLACEHOLDER_SHA256 = 'ANDROID_APP_SHA256_NOT_SET'

interface AppLinkFiles {
  aasa: string
  assetlinks: string
  missing: string[]
}

/** Builds both association files from non-VITE_ env vars (never exposed to the client bundle). */
function buildFiles(env: Record<string, string>): AppLinkFiles {
  const missing: string[] = []

  const teamId = env.APPLE_TEAM_ID?.trim()
  if (!teamId) missing.push('APPLE_TEAM_ID')

  const fingerprints = (env.ANDROID_APP_SHA256 ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
  if (fingerprints.length === 0) missing.push('ANDROID_APP_SHA256')

  const iosBundleId = env.IOS_BUNDLE_ID?.trim() || DEFAULT_APP_ID
  const androidPackage = env.ANDROID_PACKAGE?.trim() || DEFAULT_APP_ID

  const aasa = {
    applinks: {
      details: [
        {
          appIDs: [`${teamId || PLACEHOLDER_TEAM_ID}.${iosBundleId}`],
          components: [{ '/': '/verify-email*' }],
        },
      ],
    },
  }

  const assetlinks = [
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: androidPackage,
        sha256_cert_fingerprints: fingerprints.length > 0 ? fingerprints : [PLACEHOLDER_SHA256],
      },
    },
  ]

  return {
    aasa: JSON.stringify(aasa, null, 2),
    assetlinks: JSON.stringify(assetlinks, null, 2),
    missing,
  }
}

/** Serves and emits the iOS/Android app-link association files under /.well-known. */
export function appLinks(): Plugin {
  let files: AppLinkFiles = { aasa: '{}', assetlinks: '[]', missing: [] }

  const middleware: Connect.NextHandleFunction = (req, res, next) => {
    const pathname = (req.url ?? '').split('?')[0]
    const body =
      pathname === AASA_PATH ? files.aasa : pathname === ASSETLINKS_PATH ? files.assetlinks : null
    if (body === null) {
      next()
      return
    }
    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json')
    res.end(body)
  }

  return {
    name: 'app-links',
    config(config, { mode }) {
      files = buildFiles(loadEnv(mode, config.root ?? process.cwd(), ''))
    },
    configResolved(resolved) {
      if (files.missing.length > 0) {
        resolved.logger.warn(
          `[app-links] ${files.missing.join(', ')} not set: emitting placeholder values in /.well-known files. Universal Links / App Links will not verify until they are set.`,
        )
      }
    },
    configureServer(server) {
      server.middlewares.use(middleware)
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware)
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: AASA_PATH.slice(1), source: files.aasa })
      this.emitFile({ type: 'asset', fileName: ASSETLINKS_PATH.slice(1), source: files.assetlinks })
    },
  }
}
