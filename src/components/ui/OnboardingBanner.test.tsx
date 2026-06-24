import { render, screen, fireEvent } from "@testing-library/react";
import { OnboardingBanner } from "./OnboardingBanner";
import { describe, it, expect, vi } from "vitest";

describe("OnboardingBanner", () => {
  it("renders title, description, and cta label", () => {
    render(
      <OnboardingBanner
        title="You're in the party!"
        description="Add your availability."
        ctaLabel="Add availability"
        onCta={() => {}}
      />
    );
    expect(screen.getByText("You're in the party!")).toBeInTheDocument();
    expect(screen.getByText("Add your availability.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add availability/i })).toBeInTheDocument();
  });

  it("calls onCta when the button is clicked", () => {
    const onCta = vi.fn();
    render(
      <OnboardingBanner
        title="t"
        description="d"
        ctaLabel="Add availability"
        onCta={onCta}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /add availability/i }));
    expect(onCta).toHaveBeenCalledTimes(1);
  });
});
