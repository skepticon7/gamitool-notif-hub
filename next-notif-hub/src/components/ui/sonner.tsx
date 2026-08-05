"use client"

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { Toaster as Sonner, type ToasterProps } from "sonner"

// GamiTool is light-mode only (see src/styles/tokens/colors.css) — no
// ThemeProvider exists to switch this, so it's hardcoded rather than pulled
// from next-themes.
//
// Per-type colors reuse the same semantic/light-pastel pairs used
// everywhere else in the design (status chips, badge tiers, etc. — see
// colors.css's --success/--destructive/--warning/--info + --light-* pairs)
// instead of sonner's own built-in defaults, so success/info/warning/error
// toasts are visually distinct and on-brand rather than four shades of the
// same neutral. Icons use the dedicated --toast-* tokens colors.css already
// sets aside for exactly this ("Toast icon colors").
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" style={{ color: "var(--toast-success)" }} />,
        info: <InfoIcon className="size-4" style={{ color: "var(--toast-info)" }} />,
        warning: <TriangleAlertIcon className="size-4" style={{ color: "var(--toast-warning)" }} />,
        error: <OctagonXIcon className="size-4" style={{ color: "var(--toast-error)" }} />,
        loading: <Loader2Icon className="size-4 animate-spin" style={{ color: "var(--toast-loading)" }} />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius-card)",

          "--success-bg": "var(--light-green)",
          "--success-border": "var(--success)",
          "--success-text": "var(--success)",

          "--info-bg": "var(--light-purple)",
          "--info-border": "var(--info)",
          "--info-text": "var(--info)",

          "--warning-bg": "var(--light-yellow)",
          "--warning-border": "var(--warning)",
          "--warning-text": "var(--warning)",

          "--error-bg": "var(--light-pink)",
          "--error-border": "var(--destructive)",
          "--error-text": "var(--destructive)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
