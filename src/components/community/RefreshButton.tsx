import { RefreshCw } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function RefreshButton({
  label,
  className,
  ...props
}: Omit<ButtonProps, "children" | "asChild" | "size" | "variant" | "loading"> & { label: string }) {
  return (
    <Button
      {...props}
      type="button"
      variant="outline"
      size="icon"
      className={cn("shrink-0", className)}
      aria-label={label}
      title={label}
    >
      <RefreshCw aria-hidden="true" />
    </Button>
  );
}
