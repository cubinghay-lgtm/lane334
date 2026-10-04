import { ArrowBigUpIcon, FlagIcon, LightbulbIcon, MapPinIcon, PlusIcon, TriangleAlertIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { moderatePost, POST_LIMITS } from "@shared/moderation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import type { CommunityPost } from "@/lib/types";
import { cn } from "@/lib/utils";

type Kind = "hazard" | "test_tip";
const REPORT_REASONS = [
  { id: "unsafe", label: "Encourages unsafe driving" },
  { id: "inaccurate", label: "Wrong or misleading" },
  { id: "personal_info", label: "Shares personal info" },
  { id: "offensive", label: "Offensive" },
  { id: "spam", label: "Spam" },
] as const;

const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
function timeAgo(date: Date) {
  const minutes = Math.round((date.getTime() - Date.now()) / 60000);
  if (Math.abs(minutes) < 60) return relative.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return relative.format(hours, "hour");
  return relative.format(Math.round(hours / 24), "day");
}

/** Community Road Hazard & Test Tip Board with upvotes and automated moderation. */
export function HazardBoard() {
  const [kind, setKind] = useState<Kind | undefined>(undefined);
  const [sort, setSort] = useState<"top" | "new">("top");
  const [composing, setComposing] = useState(false);
  const posts = trpc.community.list.useQuery({ kind, sort });

  return (
    <div className="flex flex-col gap-4 px-4 pt-4 pb-8">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Road Board</h1>
          <p className="text-sm text-muted-foreground">Local hazards and test tips from student drivers.</p>
        </div>
        <Button size="sm" onClick={() => setComposing(true)}>
          <PlusIcon /> Share
        </Button>
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-1.5">
          {[
            { id: undefined, label: "All" },
            { id: "hazard" as const, label: "Hazards" },
            { id: "test_tip" as const, label: "Test tips" },
          ].map((option) => (
            <button
              key={option.label}
              type="button"
              onClick={() => setKind(option.id)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-semibold",
                kind === option.id ? "border-primary bg-primary/15 text-accent" : "text-muted-foreground",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setSort(sort === "top" ? "new" : "top")}
          className="text-xs font-semibold text-muted-foreground"
        >
          {sort === "top" ? "Top" : "Newest"} ⇅
        </button>
      </div>

      {posts.isLoading && <p className="text-sm text-muted-foreground">Loading the board…</p>}
      {posts.isError && <p className="text-sm text-muted-foreground">The board needs a connection. Check back when you're online.</p>}
      {posts.data?.length === 0 && <p className="text-sm text-muted-foreground">Nothing here yet — share the first tip.</p>}

      <ul className="flex flex-col gap-3">
        {posts.data?.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </ul>

      <ComposeDialog open={composing} onOpenChange={setComposing} />
    </div>
  );
}

function PostCard({ post }: { post: CommunityPost }) {
  const utils = trpc.useUtils();
  const upvote = trpc.community.toggleUpvote.useMutation({
    onSuccess: () => void utils.community.list.invalidate(),
    onError: (error) => toast.error(error.message),
  });
  const report = trpc.community.report.useMutation({
    onSuccess: (result) => {
      toast(result.alreadyReported ? "You've already reported this" : "Thanks — our moderators will take a look");
      void utils.community.list.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });
  const isHazard = post.kind === "hazard";

  return (
    <li className="flex gap-3 rounded-2xl border bg-surface p-4">
      <button
        type="button"
        onClick={() => upvote.mutate({ postId: post.id })}
        aria-pressed={post.hasVoted}
        aria-label={`Upvote (${post.upvotes})`}
        className={cn(
          "flex h-fit flex-col items-center rounded-xl px-1.5 py-1 text-xs font-bold transition-colors",
          post.hasVoted ? "bg-primary/15 text-accent" : "text-muted-foreground hover:bg-surface-2",
        )}
      >
        <ArrowBigUpIcon className="size-6" fill={post.hasVoted ? "currentColor" : "none"} />
        {post.upvotes}
      </button>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <Badge variant={isHazard ? "hazard" : "lane"}>
            {isHazard ? <TriangleAlertIcon /> : <LightbulbIcon />} {isHazard ? "Hazard" : "Test tip"}
          </Badge>
          <span className="truncate text-xs text-muted-foreground">
            {post.authorLabel} · {timeAgo(post.createdAt)}
          </span>
        </div>
        <p className="font-display text-[15px] leading-snug font-semibold">{post.title}</p>
        <p className="text-sm leading-snug text-foreground/85">{post.body}</p>
        {post.location && (
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPinIcon className="size-3.5" /> {post.location}
          </p>
        )}
      </div>
      {!post.isMine && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" aria-label="Report post" className="h-fit rounded-full p-1.5 text-muted-foreground hover:bg-surface-2">
              <FlagIcon className="size-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Report this post</DropdownMenuLabel>
            {REPORT_REASONS.map((reason) => (
              <DropdownMenuItem key={reason.id} onSelect={() => report.mutate({ postId: post.id, reason: reason.id })}>
                {reason.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </li>
  );
}

function ComposeDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [kind, setKind] = useState<Kind>("hazard");
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const utils = trpc.useUtils();
  const create = trpc.community.create.useMutation({
    onSuccess: () => {
      toast.success("Posted to the board", { description: "Thanks for helping other new drivers." });
      setTitle("");
      setLocation("");
      setBody("");
      onOpenChange(false);
      void utils.community.list.invalidate();
    },
    onError: (err) => setError(err.message),
  });

  const submit = () => {
    const verdict = moderatePost({ title, body, location });
    if (!verdict.ok) {
      setError(verdict.reason);
      return;
    }
    setError(null);
    create.mutate({ kind, title, body, location: location || undefined });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share with other drivers</DialogTitle>
          <DialogDescription>Only post while parked. Posts are anonymous — no names, plates, or contact info.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2">
          {(["hazard", "test_tip"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setKind(option)}
              className={cn(
                "flex items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-semibold",
                kind === option ? (option === "hazard" ? "border-hazard bg-hazard/10 text-hazard" : "border-lane bg-lane/10 text-lane") : "text-muted-foreground",
              )}
            >
              {option === "hazard" ? <TriangleAlertIcon className="size-4" /> : <LightbulbIcon className="size-4" />}
              {option === "hazard" ? "Road hazard" : "Test tip"}
            </button>
          ))}
        </div>

        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Short title" maxLength={POST_LIMITS.title.max} />
        {kind === "hazard" && (
          <Input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Street or landmark (optional)"
            maxLength={POST_LIMITS.location.max}
          />
        )}
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={kind === "hazard" ? "What should drivers watch for, and how should they handle it?" : "What helped you on the test?"}
          maxLength={POST_LIMITS.body.max}
        />
        <p className="-mt-2 text-right text-xs text-muted-foreground">
          {body.length}/{POST_LIMITS.body.max}
        </p>

        {error && <p className="rounded-xl bg-lane/10 px-3 py-2 text-sm text-lane">{error}</p>}

        <Button onClick={submit} disabled={create.isPending}>
          {create.isPending ? "Posting…" : "Post"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
