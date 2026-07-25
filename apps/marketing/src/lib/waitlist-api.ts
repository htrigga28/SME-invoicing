import { getApiUrl } from "@/lib/urls";

export type WaitlistUtm = {
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_content?: string | null;
  utm_term?: string | null;
};

export type WaitlistPayload = {
  email: string;
  fullName?: string | null;
  companyName?: string | null;
  role?: string | null;
  source?: string | null;
  utm?: WaitlistUtm | null;
  referrer?: string | null;
  website?: string | null;
};

export type WaitlistResponse = {
  success: true;
  message: string;
};

export function getWaitlistEndpoint() {
  return new URL("/public/waitlist", `${getApiUrl()}/`).toString();
}

export async function submitWaitlistEntry(payload: WaitlistPayload): Promise<WaitlistResponse> {
  const response = await fetch(getWaitlistEndpoint(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(await getFriendlyWaitlistError(response));
  }

  return response.json() as Promise<WaitlistResponse>;
}

async function getFriendlyWaitlistError(response: Response) {
  try {
    const body = (await response.json()) as { message?: unknown };

    if (typeof body.message === "string" && body.message.trim()) {
      return body.message;
    }
  } catch {
    return "We could not join the waitlist right now. Please try again.";
  }

  if (response.status >= 500) {
    return "We could not join the waitlist right now. Please try again.";
  }

  return "Please check the form and try again.";
}
