import {
  clearRefreshCookie,
  readRefreshCookie,
  readRequestOrigin,
  REFRESH_COOKIE_NAME,
  setRefreshCookie
} from "./refresh-cookie";

function createResponse() {
  return { cookie: jest.fn(), clearCookie: jest.fn() };
}

describe("refresh-cookie", () => {
  it("sets an HttpOnly lax cookie and clears it with matching attributes", () => {
    const res = createResponse();

    setRefreshCookie(res, "raw-token", true);

    expect(res.cookie).toHaveBeenCalledWith(
      REFRESH_COOKIE_NAME,
      "raw-token",
      expect.objectContaining({
        httpOnly: true,
        path: "/",
        sameSite: "lax",
        secure: true,
        maxAge: 30 * 24 * 60 * 60 * 1000
      })
    );

    clearRefreshCookie(res, true);

    expect(res.clearCookie).toHaveBeenCalledWith(
      REFRESH_COOKIE_NAME,
      expect.objectContaining({ httpOnly: true, path: "/", sameSite: "lax", secure: true })
    );
  });

  it("reads the refresh cookie among other cookies", () => {
    expect(
      readRefreshCookie({ headers: { cookie: `a=1; ${REFRESH_COOKIE_NAME}=abc123; b=2` } })
    ).toBe("abc123");
    expect(readRefreshCookie({ headers: { cookie: "a=1; b=2" } })).toBeUndefined();
    expect(readRefreshCookie({ headers: {} })).toBeUndefined();
    expect(readRefreshCookie({ headers: { cookie: `${REFRESH_COOKIE_NAME}=` } })).toBeUndefined();
  });

  it("reads the first origin header value", () => {
    expect(readRequestOrigin({ headers: { origin: "https://app.test" } })).toBe(
      "https://app.test"
    );
    expect(readRequestOrigin({ headers: {} })).toBeUndefined();
  });
});
