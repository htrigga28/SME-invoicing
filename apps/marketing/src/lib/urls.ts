const DEFAULT_SITE_URL = "http://localhost:3002";
const DEFAULT_APP_URL = "http://localhost:3000";
const DEFAULT_API_URL = "http://localhost:4000";

export function getSiteUrl() {
  return getRequiredPublicUrl(
    "NEXT_PUBLIC_SITE_URL",
    process.env.NEXT_PUBLIC_SITE_URL,
    DEFAULT_SITE_URL
  );
}

export function getAppUrl() {
  return getRequiredPublicUrl(
    "NEXT_PUBLIC_APP_URL",
    process.env.NEXT_PUBLIC_APP_URL,
    DEFAULT_APP_URL
  );
}

export function getApiUrl() {
  return getRequiredPublicUrl(
    "NEXT_PUBLIC_API_URL",
    process.env.NEXT_PUBLIC_API_URL,
    DEFAULT_API_URL
  );
}

function getRequiredPublicUrl(
  name: string,
  value: string | undefined,
  developmentFallback: string
) {
  if (value) {
    return trimTrailingSlash(value);
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(`${name} is required in production.`);
  }

  return developmentFallback;
}

export function getAppLoginUrl() {
  return `${getAppUrl()}/login`;
}

export function getAbsoluteSiteUrl(path = "/") {
  return new URL(path, `${getSiteUrl()}/`).toString();
}

export function getMarketingAnchorHref(pathname: string, anchor: `#${string}`) {
  return pathname === "/" ? anchor : `/${anchor}`;
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}
