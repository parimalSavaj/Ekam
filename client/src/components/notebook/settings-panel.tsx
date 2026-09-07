"use client";

import { useState } from "react";
import { Notebook } from "@/lib/api";
import { useUpdateNotebook } from "@/hooks/use-notebooks";
import { toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Save, Sparkles } from "lucide-react";

interface SettingsPanelProps {
  notebook: Notebook;
}

export function SettingsPanel({ notebook }: SettingsPanelProps) {
  const updateMutation = useUpdateNotebook();
  const [title, setTitle] = useState(notebook.title);
  const [description, setDescription] = useState(notebook.description || "");
  const [emoji, setEmoji] = useState(notebook.emoji || "");

  const hasChanges =
    title !== notebook.title ||
    description !== (notebook.description || "") ||
    emoji !== (notebook.emoji || "");

  const handleSave = () => {
    if (!title.trim()) return;

    updateMutation.mutate(
      {
        id: notebook.id,
        data: {
          title: title.trim(),
          description: description.trim() || null,
          emoji: emoji.trim() || null,
        },
      },
      {
        onSuccess: () => {
          toast.add({ title: "Settings saved", type: "success" });
        },
        onError: (err) => {
          toast.add({
            title: err instanceof Error ? err.message : "Failed to save",
            type: "error",
          });
        },
      }
    );
  };

  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="settings-title">Title</Label>
        <Input
          id="settings-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="h-9"
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="settings-description">
          Description
          <span className="font-normal text-muted-foreground">optional</span>
        </Label>
        <Textarea
          id="settings-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="settings-emoji">
          Emoji
          <span className="font-normal text-muted-foreground">optional</span>
        </Label>
        <Input
          id="settings-emoji"
          value={emoji}
          onChange={(e) => setEmoji(e.target.value)}
          maxLength={4}
          placeholder="📓"
          className="h-9 w-20 text-center text-base"
        />
      </div>

      <Button
        size="lg"
        className="w-fit"
        onClick={handleSave}
        disabled={!hasChanges || updateMutation.isPending || !title.trim()}
      >
        <Save />
        {updateMutation.isPending ? "Saving…" : "Save changes"}
      </Button>

      <Separator />

      <div className="grid gap-2">
        <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
          AI model
        </span>
        <div className="flex items-center gap-2.5 rounded-lg border bg-muted/30 px-3 py-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-background text-muted-foreground">
            <Sparkles className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{notebook.aiModel}</p>
            <p className="truncate text-xs text-muted-foreground">
              {notebook.aiProvider}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
