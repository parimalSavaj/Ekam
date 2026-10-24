"use client";

import { useRef, useState } from "react";
import { useCreateSource, useUploadPdfSource } from "@/hooks/use-sources";
import { toast } from "@/components/ui/toast";
import { Source } from "@/lib/api";
import { sourceTypeLabels } from "@/lib/source-meta";
import { SourceTypeIcon } from "./source-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowLeft, Upload } from "lucide-react";

interface AddSourceDialogProps {
  notebookId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const sourceTypeOptions: { id: Source["type"]; description: string }[] = [
  { id: "text", description: "Paste plain text" },
  { id: "markdown", description: "Paste Markdown" },
  { id: "pdf", description: "Upload a PDF file" },
  { id: "url", description: "Scrape a web page" },
  { id: "youtube", description: "Import a transcript" },
];

export function AddSourceDialog({
  notebookId,
  open,
  onOpenChange,
}: AddSourceDialogProps) {
  const createMutation = useCreateSource(notebookId);
  const uploadPdfMutation = useUploadPdfSource(notebookId);

  const [selectedType, setSelectedType] = useState<Source["type"] | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [url, setUrl] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isPending = createMutation.isPending || uploadPdfMutation.isPending;

  const resetForm = () => {
    setSelectedType(null);
    setTitle("");
    setContent("");
    setUrl("");
    setYoutubeUrl("");
    setPdfFile(null);
  };

  const close = () => {
    onOpenChange(false);
    resetForm();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedType === "pdf") {
      if (!pdfFile) return;

      uploadPdfMutation.mutate(
        {
          file: pdfFile,
          title: title.trim() || pdfFile.name.replace(/\.pdf$/i, ""),
        },
        {
          onSuccess: () => {
            toast.add({ title: "PDF uploaded successfully", type: "success" });
            close();
          },
          onError: (err) => {
            toast.add({
              title: err instanceof Error ? err.message : "Failed to upload PDF",
              type: "error",
            });
          },
        }
      );
      return;
    }

    if (selectedType === "url") {
      if (!url.trim()) return;

      createMutation.mutate(
        {
          title: title.trim() || new URL(url.trim()).hostname,
          type: "url",
          metadata: { url: url.trim() },
        },
        {
          onSuccess: () => {
            toast.add({ title: "Source added successfully", type: "success" });
            close();
          },
          onError: (err) => {
            toast.add({
              title: err instanceof Error ? err.message : "Failed to add source",
              type: "error",
            });
          },
        }
      );
      return;
    }

    if (selectedType === "youtube") {
      if (!youtubeUrl.trim()) return;

      createMutation.mutate(
        {
          title: title.trim() || "YouTube Video",
          type: "youtube",
          metadata: { url: youtubeUrl.trim() },
        },
        {
          onSuccess: () => {
            toast.add({
              title: "YouTube transcript added successfully",
              type: "success",
            });
            close();
          },
          onError: (err) => {
            toast.add({
              title:
                err instanceof Error
                  ? err.message
                  : "Failed to fetch YouTube transcript",
              type: "error",
            });
          },
        }
      );
      return;
    }

    if (!title.trim() || !content.trim() || !selectedType) return;

    createMutation.mutate(
      {
        title: title.trim(),
        type: selectedType,
        content: content.trim(),
      },
      {
        onSuccess: () => {
          toast.add({ title: "Source added successfully", type: "success" });
          close();
        },
        onError: (err) => {
          toast.add({
            title: err instanceof Error ? err.message : "Failed to add source",
            type: "error",
          });
        },
      }
    );
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === "application/pdf") {
      setPdfFile(file);
      if (!title) {
        setTitle(file.name.replace(/\.pdf$/i, ""));
      }
    }
  };

  const isSubmitDisabled =
    isPending ||
    (selectedType === "pdf"
      ? !pdfFile
      : selectedType === "url"
        ? !url.trim()
        : selectedType === "youtube"
          ? !youtubeUrl.trim()
          : !title.trim() || !content.trim());

  const titleOptional =
    selectedType === "url" || selectedType === "pdf" || selectedType === "youtube";

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (!nextOpen) resetForm();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {selectedType
              ? `Add ${sourceTypeLabels[selectedType]} source`
              : "Add a source"}
          </DialogTitle>
          <DialogDescription>
            {selectedType
              ? "Once added, the source is processed and indexed so you can ask questions about it."
              : "Choose where this source is coming from."}
          </DialogDescription>
        </DialogHeader>

        {!selectedType ? (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {sourceTypeOptions.map((option) => (
              <button
                key={option.id}
                onClick={() => setSelectedType(option.id)}
                className="flex flex-col items-center gap-2 rounded-xl border p-4 text-center transition-colors outline-none hover:border-primary/40 hover:bg-primary/5 focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <span className="flex size-8 items-center justify-center rounded-md border bg-muted/50 text-muted-foreground">
                  <SourceTypeIcon type={option.id} className="size-4" />
                </span>
                <span className="text-sm font-medium">
                  {sourceTypeLabels[option.id]}
                </span>
                <span className="text-xs text-muted-foreground">
                  {option.description}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="grid gap-4">
            <Button
              type="button"
              variant="ghost"
              size="xs"
              className="-mt-1 w-fit text-muted-foreground"
              onClick={() => {
                setSelectedType(null);
                setUrl("");
                setYoutubeUrl("");
                setPdfFile(null);
              }}
            >
              <ArrowLeft />
              All source types
            </Button>

            <div className="grid gap-2">
              <Label htmlFor="source-title">
                Title
                {titleOptional && (
                  <span className="font-normal text-muted-foreground">optional</span>
                )}
              </Label>
              <Input
                id="source-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="h-9"
                placeholder={
                  selectedType === "url"
                    ? "Auto-detected from the page"
                    : selectedType === "pdf"
                      ? "Defaults to the file name"
                      : selectedType === "youtube"
                        ? "Auto-detected from the video"
                        : "e.g. Research notes"
                }
                autoFocus={!titleOptional}
                required={!titleOptional}
              />
            </div>

            {selectedType === "pdf" ? (
              <div className="grid gap-2">
                <Label htmlFor="source-pdf">PDF file</Label>
                <input
                  id="source-pdf"
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-7 text-sm transition-colors outline-none hover:border-primary/40 hover:bg-primary/5 focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <Upload className="size-5 text-muted-foreground" />
                  <span className={pdfFile ? "font-medium" : "text-muted-foreground"}>
                    {pdfFile ? pdfFile.name : "Click to select a PDF file"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {pdfFile
                      ? `${(pdfFile.size / 1024 / 1024).toFixed(2)} MB · Max 20MB`
                      : "Max 20MB"}
                  </span>
                </button>
              </div>
            ) : selectedType === "url" ? (
              <div className="grid gap-2">
                <Label htmlFor="source-url">URL</Label>
                <Input
                  id="source-url"
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com/article"
                  className="h-9"
                  autoFocus
                  required
                />
                <p className="text-xs text-muted-foreground">
                  The page will be scraped and its content indexed for search.
                </p>
              </div>
            ) : selectedType === "youtube" ? (
              <div className="grid gap-2">
                <Label htmlFor="source-youtube">YouTube URL</Label>
                <Input
                  id="source-youtube"
                  type="url"
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=…"
                  className="h-9"
                  autoFocus
                  required
                />
                <p className="text-xs text-muted-foreground">
                  The video transcript will be fetched and indexed for search.
                </p>
              </div>
            ) : (
              <div className="grid gap-2">
                <Label htmlFor="source-content">Content</Label>
                <Textarea
                  id="source-content"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder={
                    selectedType === "markdown"
                      ? "Paste your Markdown content here…"
                      : "Paste your text content here…"
                  }
                  rows={8}
                  className="max-h-72 min-h-40 resize-none font-mono text-xs"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  {content.length > 0
                    ? `${content.length.toLocaleString()} characters`
                    : "Max 500,000 characters"}
                </p>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" size="lg" onClick={close}>
                Cancel
              </Button>
              <Button type="submit" size="lg" disabled={isSubmitDisabled}>
                {isPending ? "Adding…" : "Add source"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
