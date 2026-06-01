"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Clock, ZoomIn, ZoomOut, RefreshCcw,
  CheckCircle2, History, Loader2, ShieldCheck,
  Cpu, ChevronLeft, User,
  Download, MessageSquare,
  Check, X, Timer, FileText, Image as ImageIcon, ExternalLink
} from "lucide-react";
import { db } from "@/lib/firebase";
import { doc, onSnapshot, updateDoc, serverTimestamp } from "firebase/firestore";
import { toast } from "sonner";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Separator } from "@/components/ui/separator";
import { CollaborationHub } from "@/components/collaboration-hub";

export default function OtherRequestReviewPage() {
  const params = useParams() as { id: string };
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [userContext, setUserContext] = useState({
    role: "", id: "", name: "", profilePicture: ""
  });

  const [notes, setNotes] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [elapsedTime, setElapsedTime] = useState("00:00:00");

  // TIMER LOGIC
  useEffect(() => {
    const timerInterval = setInterval(() => {
      if (data?.createdAt) {
        const start = new Date(data.createdAt.seconds * 1000).getTime();
        const now = new Date().getTime();
        const diff = now - start;
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        setElapsedTime(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
      }
    }, 1000);
    return () => clearInterval(timerInterval);
  }, [data]);

  // DATA SYNC
  useEffect(() => {
    let unsubscribe: () => void;
    const loadUserAndData = async () => {
      const storedId = localStorage.getItem("userId");
      if (!storedId) return toast.error("Please log in.");

      try {
        const res = await fetch(`/api/user?id=${encodeURIComponent(storedId)}`);
        const user = await res.json();
        setUserContext({
          role: (user.Department || "staff").toLowerCase(),
          id: storedId,
          name: user.Firstname + " " + user.Lastname,
          profilePicture: user.profilePicture || ""
        });

        // Use your "other_requests" collection
        const docRef = doc(db, "other_requests", params.id);
        unsubscribe = onSnapshot(docRef, (docSnap) => {
          if (docSnap.exists()) {
            const reqData = docSnap.data();
            setData(reqData);
            setNotes(reqData.adminNotes || "");
          } else {
            toast.error("Request not found.");
          }
          setLoading(false);
        });
      } catch (err) {
        toast.error("Connection failed.");
        setLoading(false);
      }
    };

    loadUserAndData();
    return () => unsubscribe?.();
  }, [params.id]);

  const handleUpdateStatus = async (status: string) => {
    setIsUpdating(true);
    const toastId = toast.loading(`Updating status to ${status}...`);

    try {
      const docRef = doc(db, "other_requests", params.id);
      await updateDoc(docRef, {
        status: status.toUpperCase(),
        adminNotes: notes,
        updatedAt: serverTimestamp(),
        processedBy: userContext.name
      });
      toast.success("Sync complete.", { id: toastId });
    } catch (error) {
      toast.error("Sync failed.");
    } finally {
      setIsUpdating(false);
    }
  };

  if (loading) return (
    <div className="h-screen w-full flex flex-col items-center justify-center gap-4 bg-[#F4F7F7]">
      <Loader2 className="animate-spin text-zinc-900" size={32} />
      <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Syncing Engiconnect...</p>
    </div>
  );

  const status = (data?.status || "PENDING").toUpperCase();
  const isAdmin = userContext.role === "it" || userContext.role === "admin" || userContext.role === "engineering";

  return (
    <SidebarProvider defaultOpen={false}>
      <AppSidebar userId={userContext.id} />
      <SidebarInset className="bg-[#F4F7F7]">
        <header className="flex h-16 items-center justify-between border-b bg-white px-6 sticky top-0 z-50">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="text-zinc-400" onClick={() => router.back()}>
              <ChevronLeft size={20} />
            </Button>
            <Separator orientation="vertical" className="h-4" />
            <div className="truncate">
              <h1 className="text-sm font-black text-zinc-900 uppercase tracking-tight">{data?.title || "General Request"}</h1>
              <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest">REF: {params.id.slice(-8).toUpperCase()}</p>
            </div>
          </div>
          <Badge className={cn(
            "font-black text-[10px] uppercase px-4 py-1 rounded-full border-none shadow-sm",
            status === "APPROVED" ? "bg-[#00C853] text-white" : "bg-zinc-900 text-white"
          )}>
            {status}
          </Badge>
        </header>

        <main className="p-4 md:p-8 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-8 pb-32">

          {/* LEFT CONTENT: File Viewer & Description */}
          <div className="lg:col-span-8 space-y-6">
            <div className="bg-white rounded-[24px] border border-zinc-200 shadow-sm overflow-hidden flex flex-col min-h-[500px]">
              <div className="p-4 border-b flex items-center justify-between bg-zinc-50/50">
                <span className="text-[10px] font-black uppercase text-zinc-400 tracking-widest flex items-center gap-2">
                  <ImageIcon size={14} /> Attachment Viewer
                </span>
                {data?.attachmentUrl && (
                  <a href={data.attachmentUrl} target="_blank" className="text-[9px] font-bold text-blue-600 uppercase flex items-center gap-1">
                    Open Original <ExternalLink size={12} />
                  </a>
                )}
              </div>

              <div className="flex-1 bg-zinc-100 flex items-center justify-center relative">
                {data?.attachmentUrl ? (
                  <TransformWrapper>
                    <TransformComponent wrapperClass="!w-full !h-full">
                      <img src={data.attachmentUrl} alt="Attachment" className="max-w-full max-h-[500px] object-contain" />
                    </TransformComponent>
                  </TransformWrapper>
                ) : (
                  <div className="text-center space-y-2">
                    <FileText size={40} className="mx-auto text-zinc-300" />
                    <p className="text-[10px] font-bold text-zinc-400 uppercase">No File Attached</p>
                  </div>
                )}
              </div>

              <div className="p-8 bg-white border-t">
                <h3 className="text-[10px] font-black uppercase text-zinc-400 mb-2 tracking-widest">Description</h3>
                <p className="text-sm font-medium text-zinc-600 leading-relaxed">
                  {data?.description || "No description provided."}
                </p>
              </div>
            </div>

            <CollaborationHub
              requestId={params.id}
              spfNumber={data?.title || params.id}
              collectionName="other_requests" // Explicitly tell it which collection to use
              messages={data?.messages || []}
              currentUserId={userContext.id}
              userName={userContext.name}
              profilePicture={userContext.profilePicture}
              userRole={userContext.role}
              status={status}
              title={data?.title || "dsiconnect"}
            />
          </div>

          {/* RIGHT SIDEBAR: Timeline & Actions */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white rounded-[24px] border border-zinc-200 p-8 shadow-sm">
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-[10px] font-black uppercase text-zinc-400 flex items-center gap-2 tracking-widest">
                  <History size={14} /> Journey
                </h3>
                <Badge variant="outline" className="text-[10px] font-mono border-zinc-100 text-zinc-500 bg-zinc-50 flex gap-1.5 items-center px-3 py-1 rounded-lg">
                  <Timer size={12} className="animate-pulse" /> {elapsedTime}
                </Badge>
              </div>

              <div className="space-y-8 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-zinc-100">
                <TimelineStep title="Submitted" date={data?.createdAt} status="completed" />
                <TimelineStep title="Processing" status={status === 'PENDING' ? 'active' : 'completed'} />
                <TimelineStep title="Resolution" status={status === 'APPROVED' ? 'completed' : (status === 'IN_PROGRESS' ? 'active' : 'pending')} />
              </div>
            </div>

            {/* ADMIN ACTIONS */}
            {isAdmin && status !== "APPROVED" && (
              <div className="bg-zinc-900 rounded-[24px] p-8 shadow-xl text-white space-y-6">
                <div className="flex items-center gap-2 text-zinc-400">
                  <ShieldCheck size={18} />
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-white">Admin Controls</h3>
                </div>

                <Textarea
                  placeholder="Internal notes or response..."
                  className="bg-white/10 border-none text-white min-h-[120px] rounded-xl placeholder:text-zinc-500 text-xs"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />

                <div className="grid grid-cols-1 gap-3">
                  <Button
                    className="w-full bg-[#00C853] hover:bg-[#00B24A] font-black uppercase text-[10px] tracking-widest h-12 rounded-xl"
                    onClick={() => handleUpdateStatus("APPROVED")}
                    disabled={isUpdating}
                  >
                    {isUpdating ? <Loader2 className="animate-spin size-4 mr-2" /> : <Check size={16} className="mr-2" />}
                    Approve & Close
                  </Button>

                  <Button
                    variant="ghost"
                    className="w-full text-zinc-400 hover:text-white hover:bg-white/5 font-black uppercase text-[10px] tracking-widest h-12"
                    onClick={() => handleUpdateStatus("REJECTED")}
                    disabled={isUpdating}
                  >
                    Reject Request
                  </Button>
                </div>
              </div>
            )}
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

function TimelineStep({ title, date, status }: { title: string; date?: any; status: 'completed' | 'active' | 'pending' }) {
  const iconColor = status === 'completed' ? 'bg-[#00C853]' : status === 'active' ? 'bg-blue-500 animate-pulse' : 'bg-zinc-200';
  return (
    <div className="flex gap-4 relative z-10">
      <div className={`size-[24px] flex-shrink-0 rounded-full ${iconColor} flex items-center justify-center ring-4 ring-white`}>
        {status === 'completed' ? <CheckCircle2 size={12} className="text-white" /> : <div className="size-1.5 bg-white rounded-full" />}
      </div>
      <div>
        <p className={`text-[11px] font-black ${status === 'pending' ? 'text-zinc-300' : 'text-zinc-900 uppercase'}`}>{title}</p>
        {date && (
          <p className="text-[9px] text-zinc-400 font-bold italic">
            {new Date(date.seconds * 1000).toLocaleDateString()}
          </p>
        )}
      </div>
    </div>
  );
}