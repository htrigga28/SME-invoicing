import React from "react";
import { cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import RootLayout from "./layout";

const { MockAppToaster } = vi.hoisted(() => ({
  MockAppToaster: () => <div data-testid="app-toaster" />
}));

vi.mock("@/components/ui/toaster", () => ({
  AppToaster: MockAppToaster
}));

afterEach(() => {
  cleanup();
});

describe("RootLayout", () => {
  it("mounts the app toaster once at the root", () => {
    const layout = RootLayout({
      children: <div>Content</div>
    }) as React.ReactElement<{
      children: React.ReactElement<{ children: React.ReactNode }>;
    }>;
    const body = layout.props.children;
    const bodyChildren = React.Children.toArray(body.props.children).filter(
      React.isValidElement
    ) as React.ReactElement<{ children?: React.ReactNode }>[];

    const toasterInstances = bodyChildren.filter((child) => child.type === MockAppToaster);
    const content = bodyChildren[0];

    expect(toasterInstances).toHaveLength(1);
    expect(content).toBeDefined();
    expect(content?.props.children).toBe("Content");
  });
});
