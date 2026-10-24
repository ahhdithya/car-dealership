import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "../App";

describe("application shell", () => {
  it("renders the inventory heading inside the main landmark", () => {
    render(<App />);

    const main = screen.getByRole("main");

    expect(
      within(main).getByRole("heading", {
        level: 1,
        name: "Vehicle Inventory",
      }),
    ).toBeInTheDocument();
  });
});
