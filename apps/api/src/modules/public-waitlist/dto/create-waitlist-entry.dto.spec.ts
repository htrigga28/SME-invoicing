import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import { CreateWaitlistEntryDto } from "./create-waitlist-entry.dto";

describe("CreateWaitlistEntryDto", () => {
  it("trims a valid email before validation", async () => {
    const input = plainToInstance(CreateWaitlistEntryDto, {
      email: "  founder@example.test  "
    });

    await expect(validate(input)).resolves.toHaveLength(0);
    expect(input.email).toBe("founder@example.test");
  });
});
