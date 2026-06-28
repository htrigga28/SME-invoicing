import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Customer } from "./types";
import { CustomerListContent } from "./customer-list-page";
import { archiveCustomer, listCustomers } from "./customers-api";

vi.mock("./customers-api", () => ({
  archiveCustomer: vi.fn(),
  listCustomers: vi.fn()
}));

const demoCustomer = {
  id: "customer-1",
  name: "Lagos Bright Prints",
  email: "accounts@lagosbrightprints.test",
  phone: "+2348010000001",
  billingAddress: "14 Allen Avenue, Ikeja, Lagos",
  status: "active",
  archivedAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z"
} satisfies Customer;

const pagination = {
  page: 1,
  limit: 20,
  total: 1,
  totalPages: 1
};

function mockCustomerList(customers: Customer[] = [demoCustomer]) {
  vi.mocked(listCustomers).mockResolvedValue({
    customers,
    pagination: {
      ...pagination,
      total: customers.length
    }
  });
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, reject, resolve };
}

beforeEach(() => {
  mockCustomerList();
  vi.mocked(archiveCustomer).mockResolvedValue({
    customer: {
      ...demoCustomer,
      status: "archived",
      archivedAt: "2026-01-02T00:00:00.000Z"
    }
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("CustomerListContent archive actions", () => {
  it("opens a custom confirmation dialog for archive actions", async () => {
    render(<CustomerListContent accessToken="token" role="owner" />);

    fireEvent.click(await screen.findByRole("button", { name: "Archive" }));

    expect(screen.getByRole("dialog", { name: "Archive customer?" })).toBeInTheDocument();
    expect(
      screen.getByText(
        "Archived customers are read-only and hidden from the active customer list. Historical records remain available."
      )
    ).toBeInTheDocument();
  });

  it("cancels archive without calling the API", async () => {
    render(<CustomerListContent accessToken="token" role="admin" />);

    fireEvent.click(await screen.findByRole("button", { name: "Archive" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(archiveCustomer).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog", { name: "Archive customer?" })).not.toBeInTheDocument();
  });

  it("confirms archive, disables the confirm button while loading, and shows success", async () => {
    const archiveDeferred = createDeferred<{ customer: Customer }>();
    vi.mocked(archiveCustomer).mockReturnValueOnce(archiveDeferred.promise);
    render(<CustomerListContent accessToken="token" role="accountant" />);

    fireEvent.click(await screen.findByRole("button", { name: "Archive" }));
    const confirmButton = screen.getByRole("button", { name: "Archive customer" });
    fireEvent.click(confirmButton);

    expect(confirmButton).toBeDisabled();
    expect(screen.getByText("Archiving...")).toBeInTheDocument();
    expect(archiveCustomer).toHaveBeenCalledWith(
      "token",
      "customer-1",
      "Archived from customer list."
    );

    archiveDeferred.resolve({
      customer: {
        ...demoCustomer,
        status: "archived",
        archivedAt: "2026-01-02T00:00:00.000Z"
      }
    });

    await waitFor(() => expect(screen.getByText("Customer archived.")).toBeInTheDocument());
  });

  it("keeps viewer users read-only", async () => {
    render(<CustomerListContent accessToken="token" role="viewer" />);

    expect(await screen.findAllByText("Lagos Bright Prints")).not.toHaveLength(0);

    expect(screen.queryByRole("link", { name: "Edit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Archive" })).not.toBeInTheDocument();
  });

  it("does not use native browser prompts in customer archive flows", () => {
    const customerListSource = readFileSync(
      "src/features/customers/customer-list-page.tsx",
      "utf8"
    );
    const customerDetailSource = readFileSync(
      "src/features/customers/customer-detail-page.tsx",
      "utf8"
    );

    expect(`${customerListSource}\n${customerDetailSource}`).not.toMatch(
      /window\.(alert|confirm|prompt)|(alert|confirm|prompt)\(/
    );
  });
});
