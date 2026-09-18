import { AuthController } from "./auth.controller";

describe("AuthController", () => {
  it("delegates registration", async () => {
    const service = {
      register: jest.fn().mockResolvedValue({ onboardingStep: "business_profile" })
    };
    const controller = new AuthController(service as never);
    await expect(controller.register({} as never)).resolves.toEqual({
      onboardingStep: "business_profile"
    });
    expect(service.register).toHaveBeenCalledWith({});
  });
});
