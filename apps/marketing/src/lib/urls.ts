const DEFAULT_SITE_URL = "http://localhost:3002";
const DEFAULT_APP_URL = "http://localhost:3000";

export function getSiteUrl() {
  return trimTrailingSlash(process.env.NEXT_PUBLIC_SITE_URL ?? DEFAULT_SITE_URL);
}

export function getAppUrl() {
  return trimTrailingSlash(process.env.NEXT_PUBLIC_APP_URL ?? DEFAULT_APP_URL);
}

export function getAppLoginUrl() {
  return `${getAppUrl()}/login`;
}

export function getAppRegisterUrl() {
  return `${getAppUrl()}/register`;
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
