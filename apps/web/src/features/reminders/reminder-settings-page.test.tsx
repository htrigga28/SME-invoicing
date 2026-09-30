import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SettingsContent } from "./reminder-settings-page";

const { getReminderSettings, putReminderSettings } = vi.hoisted(() => ({
  getReminderSettings: vi.fn(),
  putReminderSettings: vi.fn()
}));
vi.mock("./reminders-api", () => ({ getReminderSettings, putReminderSettings }));

const suggestions = [-3, 1, 7].map((relativeDays) => ({
  relativeDays,
  subjectTemplate: `Reminder ${relativeDays}`,
  bodyTemplate: "Hello {{customerName}}",
  enabled: true
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("reminder settings", () => {
  it("saves suggested steps when a new organisation enables reminders", async () => {
    getReminderSettings.mockResolvedValue({ enabled: false, steps: [], suggestedSteps: suggestions });
    putReminderSettings.mockResolvedValue({ enabled: true, steps: suggestions });
    render(<SettingsContent accessToken="token" canManage />);
    expect(await screen.findByText("3 days before due")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Turn on" }));
    await waitFor(() => expect(putReminderSettings).toHaveBeenCalledWith("token", { enabled: true, steps: suggestions }));
  });

  it("opens the editor without saving when Add reminder is pressed", async () => {
    getReminderSettings.mockResolvedValue({ enabled: false, steps: [], suggestedSteps: [] });
    render(<SettingsContent accessToken="token" canManage />);
    fireEvent.click(await screen.findByRole("button", { name: "Add reminder" }));
    expect(screen.getByRole("heading", { name: "New reminder" })).toBeInTheDocument();
    expect(screen.getByText("Preview")).toBeInTheDocument();
    expect(putReminderSettings).not.toHaveBeenCalled();
  });

  it("does not show mutation controls to read-only roles", async () => {
    getReminderSettings.mockResolvedValue({ enabled: true, steps: suggestions });
    render(<SettingsContent accessToken="token" canManage={false} />);
    expect(await screen.findByText("3 days before due")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Turn off" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add reminder" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
  });

  it("keeps an unsaved reminder draft open when the save fails", async () => {
    getReminderSettings.mockResolvedValue({ enabled: false, steps: [], suggestedSteps: [] });
    putReminderSettings.mockRejectedValue(new Error("Network unavailable"));
    render(<SettingsContent accessToken="token" canManage />);
    fireEvent.click(await screen.findByRole("button", { name: "Add reminder" }));
    fireEvent.change(screen.getByLabelText("Subject"), { target: { value: "Keep this draft" } });
    fireEvent.click(screen.getByRole("button", { name: "Save reminder" }));
    expect(await screen.findByText("Could not save reminder settings.")).toBeInTheDocument();
    expect(screen.getByLabelText("Subject")).toHaveValue("Keep this draft");
    expect(screen.getByRole("button", { name: "Save reminder" })).toBeEnabled();
  });

  it("prevents duplicate timing without discarding the editor", async () => {
    getReminderSettings.mockResolvedValue({ enabled: false, steps: suggestions });
    render(<SettingsContent accessToken="token" canManage />);
    fireEvent.click(await screen.findByRole("button", { name: "Add reminder" }));
    fireEvent.click(screen.getByRole("button", { name: "Save reminder" }));
    expect(await screen.findByText("A reminder already uses this timing.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "New reminder" })).toBeInTheDocument();
    expect(putReminderSettings).not.toHaveBeenCalled();
  });

  it("requires an active step before enabling automatic reminders", async () => {
    getReminderSettings.mockResolvedValue({ enabled: false, steps: suggestions.map((step) => ({ ...step, enabled: false })) });
    render(<SettingsContent accessToken="token" canManage />);
    fireEvent.click(await screen.findByRole("button", { name: "Turn on" }));
    expect(await screen.findByText("Add an active reminder before enabling automatic reminders.")).toBeInTheDocument();
    expect(putReminderSettings).not.toHaveBeenCalled();
  });
});
