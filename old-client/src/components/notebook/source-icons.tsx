import {
  AlertCircle,
  CheckCircle2,
  Clock,
  File,
  FileText,
  Film,
  Globe,
  Hash,
  Loader2,
} from "lucide-react";

import type { Source } from "@/lib/api";
import { cn } from "@/lib/utils";

/**
 * Icon renderers for source type and processing status.
 *
 * These deliberately switch and return JSX rather than resolving a component
 * from a lookup table. Assigning a component to a local during render (e.g.
 * `const Icon = icons[type]`) trips the react-hooks/static-components rule,
 * since the compiler can't prove the reference is stable.
 */

export function SourceTypeIcon({
  type,
  className,
}: {
  type: Source["type"];
  className?: string;
}) {
  switch (type) {
    case "markdown":
      return <Hash className={className} />;
    case "pdf":
      return <File className={className} />;
    case "url":
      return <Globe className={className} />;
    case "youtube":
      return <Film className={className} />;
    case "text":
    default:
      return <FileText className={className} />;
  }
}

export function SourceStatusIcon({
  status,
  className,
}: {
  status: Source["status"];
  className?: string;
}) {
  switch (status) {
    case "processing":
      return <Loader2 className={cn("animate-spin text-info", className)} />;
    case "completed":
      return <CheckCircle2 className={cn("text-success", className)} />;
    case "failed":
      return <AlertCircle className={cn("text-destructive", className)} />;
    case "pending":
    default:
      return <Clock className={cn("text-warning", className)} />;
  }
}
