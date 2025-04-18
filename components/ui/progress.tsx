"use client"

import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"

import { cn } from "@/lib/utils"

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>
>(({ className, value, ...props }, ref) => (
  <ProgressPrimitive.Root
    ref={ref}
    className={cn(
      "relative h-4 w-full overflow-hidden rounded-full bg-secondary",
      className
    )}
    {...props}
  >
    <ProgressPrimitive.Indicator
      className="h-full w-full flex-1 bg-primary transition-all"
      style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
    />
  </ProgressPrimitive.Root>
))
Progress.displayName = ProgressPrimitive.Root.displayName

// Create a ZoneProgress component to track completed items in a zone
export const ZoneProgress = ({ 
  completed, 
  total, 
  className 
}: { 
  completed: number; 
  total: number;
  className?: string;
}) => {
  const value = total > 0 ? (completed / total) * 100 : 0;
  
  return (
    <Progress
      value={value}
      className={cn("h-2 w-full mb-4", className)}
    />
  );
};

export { Progress }
