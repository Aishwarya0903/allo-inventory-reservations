import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-full text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "accent-button text-[var(--accent-ink)] hover:-translate-y-0.5",
        outline:
          "border border-app-soft bg-app-veil text-[var(--foreground)] hover:border-app-strong hover:bg-[var(--surface-strong)]",
        ghost:
          "bg-transparent text-[var(--foreground)] hover:bg-[var(--surface)]",
        inverse:
          "border border-transparent bg-[var(--surface-inverse)] text-[var(--accent-ink)] hover:brightness-95",
      },
      size: {
        default: "h-11 px-5 py-2.5",
        sm: "h-9 px-3.5",
        lg: "h-12 px-6 text-base",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { buttonVariants };
