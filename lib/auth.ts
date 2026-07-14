import { betterAuth } from 'better-auth'
import { pool } from '@/lib/db'

type DeploymentEnvironment =
  | 'production'
  | 'preview'
  | 'development'
  | 'external-production'

// The VERCEL system environment variable is "1" on every Vercel deployment,
// so it deterministically tells us whether we are running on Vercel. On
// Vercel, VERCEL_ENV ("production" | "preview" | "development") identifies
// the environment. Off Vercel, runs are classified by NODE_ENV so that a
// self-hosted production process (`next start`) is never given the softened
// development config.
function getDeploymentEnvironment(): DeploymentEnvironment {
  if (process.env.VERCEL === '1') {
    const env = process.env.VERCEL_ENV
    if (env === 'production' || env === 'preview' || env === 'development') {
      return env
    }
    throw new Error(
      `Running on Vercel but VERCEL_ENV has unexpected value: ${JSON.stringify(env)}`,
    )
  }
  return process.env.NODE_ENV === 'production' ? 'external-production' : 'development'
}

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `Missing environment variable ${name}, required to configure Better Auth in the "${getDeploymentEnvironment()}" environment`,
    )
  }
  return value
}

interface EnvironmentAuthConfig {
  baseURL?: string
  trustedOrigins: string[]
  softenChecks: boolean
}

// Each Vercel environment has exactly one authoritative URL source:
// - production: VERCEL_PROJECT_PRODUCTION_URL (the project's production domain)
// - preview:    VERCEL_URL (the deployment's unique URL), plus the stable
//               VERCEL_BRANCH_URL alias the same deployment is served from
// - development: no fixed URL — Better Auth infers it from the request
//               (or from BETTER_AUTH_URL if set), and checks are softened
function getEnvironmentAuthConfig(): EnvironmentAuthConfig {
  switch (getDeploymentEnvironment()) {
    case 'production': {
      const url = `https://${requireEnv('VERCEL_PROJECT_PRODUCTION_URL')}`
      return { baseURL: url, trustedOrigins: [url], softenChecks: false }
    }
    case 'preview': {
      const deploymentUrl = `https://${requireEnv('VERCEL_URL')}`
      const branchUrl = process.env.VERCEL_BRANCH_URL
      return {
        baseURL: deploymentUrl,
        trustedOrigins: branchUrl
          ? [deploymentUrl, `https://${branchUrl}`]
          : [deploymentUrl],
        softenChecks: false,
      }
    }
    case 'external-production': {
      // Production traffic outside Vercel: no Vercel system variables exist,
      // so BETTER_AUTH_URL is the single URL source for this environment and
      // must be set explicitly — failing fast beats letting Better Auth
      // infer the base URL from the incoming request's host.
      const url = requireEnv('BETTER_AUTH_URL')
      return {
        baseURL: url,
        trustedOrigins: [new URL(url).origin],
        softenChecks: false,
      }
    }
    case 'development':
      return {
        trustedOrigins: ['http://localhost:3000', 'http://127.0.0.1:3000'],
        softenChecks: true,
      }
  }
}

const envConfig = getEnvironmentAuthConfig()

export const auth = betterAuth({
  database: pool,
  baseURL: envConfig.baseURL,
  secret: process.env.BETTER_AUTH_SECRET,
  emailAndPassword: { enabled: true, autoSignIn: true },
  trustedOrigins: envConfig.trustedOrigins,
  session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24 },
  ...(envConfig.softenChecks
    ? {
        advanced: {
          // Development runs on hosts we can't enumerate (v0 runtime, tunnels,
          // non-default ports) and inside preview iframes, so relax the origin
          // check and allow cross-site cookies here only.
          disableOriginCheck: true,
          defaultCookieAttributes: { sameSite: 'none' as const, secure: true },
        },
      }
    : {}),
})
