import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "../App";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("dealership application", () => {
  it("shows the inventory heading and sign-in form", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "Vehicle inventory" })).toBeInTheDocument();

    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
  });

  it("loads inventory after login and disables purchasing zero stock", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          accessToken: "test-token",
          user: {
            id: "user-1",
            email: "user@example.com",
            role: "USER",
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          vehicles: [
            {
              id: "vehicle-1",
              make: "Toyota",
              model: "Corolla",
              category: "Sedan",
              price: "25000.00",
              stock: 0,
            },
          ],
        }),
      });

    vi.stubGlobal("fetch", fetchMock);
    render(<App />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "Example password 123!" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("heading", { name: "Toyota Corolla" })).toBeInTheDocument();

    expect(screen.getByRole("button", { name: "Out of stock" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Add vehicle" })).not.toBeInTheDocument();

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/vehicles",
      expect.objectContaining({
        headers: { Authorization: "Bearer test-token" },
      }),
    );
  });
});
