import { PublicWaitlistController } from "./public-waitlist.controller";

describe("PublicWaitlistController", () => {
  it("exposes only public waitlist creation", () => {
    const methods = Object.getOwnPropertyNames(PublicWaitlistController.prototype).filter(
      (name) => name !== "constructor"
    );

    expect(methods).toEqual(["createEntry"]);
  });

  it("delegates waitlist creation to the service", async () => {
    const service = {
      createEntry: jest.fn().mockResolvedValue({
        success: true,
        message: "You're on the list. We'll let you know when early access opens."
      })
    };
    const controller = new PublicWaitlistController(service as never);
    const input = { email: "founder@example.test" };

    await expect(controller.createEntry(input)).resolves.toEqual({
      success: true,
      message: "You're on the list. We'll let you know when early access opens."
    });
    expect(service.createEntry).toHaveBeenCalledWith(input);
  });
});
