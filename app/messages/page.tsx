"use client";

import * as React from "react";
import { useEffect, useState, Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { 
    Search, Loader2, MessageSquare, ChevronLeft, Hash, 
    LayoutGrid, Lightbulb, FileText, Hammer, Layers, 
    Sparkles, Bell, Clock, Filter, ExternalLink, Activity,
    Users, Settings2, Package
} from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import ChatMessageListItem from "@/components/chat-message-list-item";

// Components
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import ProtectedPageWrapper from "../../components/protected-page-wrapper";
import { PageHeader } from "@/components/page-header";
import ChatConversation from "@/components/chat-conversation";

const COLLECTIONS = [
    { id: "dialux_requests", label: "DIALux", icon: Lightbulb, color: "text-amber-500", bg: "bg-amber-50" },
    { id: "job_requests", label: "Job Requests", icon: Hammer, color: "text-blue-500", bg: "bg-blue-50" },
    { id: "shop_drawing_requests", label: "Shop Drawings", icon: Layers, color: "text-emerald-500", bg: "bg-emerald-50" },
    { id: "appointments", label: "Site Visits", icon: Users, color: "text-indigo-500", bg: "bg-indigo-50" },
    { id: "spf_creations", label: "SPF Products", icon: Package, color: "text-rose-500", bg: "bg-rose-50" },
    { id: "other_requests", label: "Others", icon: FileText, color: "text-slate-500", bg: "bg-slate-50" }
];

const formatRelativeTime = (timestamp: any) => {
    if (!timestamp) return "";
    const date = timestamp.seconds ? new Date(timestamp.seconds * 1000) : new Date(timestamp);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return "Just now";
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 84400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

function MessagesContent() {
    const searchParams = useSearchParams();
    const initialId = searchParams?.get('id');
    
    const [userId, setUserId] = useState<string | null>(null);
    const [userData, setUserData] = useState<any>(null);
    const [userRole, setUserRole] = useState<string>("");
    const [userDept, setUserDept] = useState<string>("");
    const [subordinateIds, setSubordinateIds] = useState<string[]>([]);
    const [allRequests, setAllRequests] = useState<any[]>([]);
    const [selectedRequest, setSelectedRequest] = useState<{id: string, coll: string} | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [filterCategory, setFilterCategory] = useState<string>("all");
    const [isSearching, setIsSearching] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    const getProjectLink = (coll: string, id: string) => {
        if (coll === 'appointments') return `/appointments/site-visit/${id}`;
        if (coll === 'spf_creations') return `/request/product/${id}`;
        const path = coll.replace('_requests', '').replace('_', '-');
        return `/request/${path}/${id}`;
    };

    // User Data Initialization
    useEffect(() => {
        const storedId = localStorage.getItem("userId");
        if (!storedId) return;
        setUserId(storedId);

        fetch(`/api/user?id=${encodeURIComponent(storedId)}`)
            .then(res => res.json())
            .then(async (mongoData) => {
                setUserData(mongoData);
                const dept = (mongoData.Department || mongoData.department || "").toUpperCase();
                const position = (mongoData.Position || "").toUpperCase();
                
                // Get Firestore role for strict detection
                const { doc, getDoc } = await import("firebase/firestore");
                const userDoc = await getDoc(doc(db, "users", storedId));
                const firestoreRole = (userDoc.exists() ? (userDoc.data().Role || userDoc.data().role || "MEMBER") : "MEMBER").toUpperCase();
                
                const isSalesDept = dept === "SALES";
                const isManager = firestoreRole === "MANAGER" || firestoreRole === "SALES HEAD" || (isSalesDept && (position === "MANAGER" || position === "SALES HEAD" || position.includes("GENERAL MANAGER")));
                const isTSM = firestoreRole === "TSM" || firestoreRole === "TERRITORY SALES MANAGER" || (isSalesDept && position.includes("TERRITORY SALES MANAGER"));
                const finalRole = isManager ? "MANAGER" : (isTSM ? "TSM" : firestoreRole);
                
                setUserRole(finalRole);
                setUserDept(dept);
                
                // Fetch subordinates if needed
                if (isTSM || isManager) {
                    const usersRes = await fetch('/api/user');
                    const allUsers: any[] = await usersRes.json();
                    
                    const clean = (n: string) => (n || "").replace(/,/g, "").replace(/\s+/g, " ").trim().toUpperCase();
                    const name = `${mongoData.Firstname || ""} ${mongoData.Lastname || ""}`.trim();
                    const referenceId = (mongoData.ReferenceID || "").toUpperCase();
                    const myCleanName = clean(name);
                    
                    let subs: any[] = [];
                    if (isTSM) {
                        subs = allUsers.filter(u => {
                            const uRole = (u.Role || u.role || "MEMBER").toUpperCase();
                            const uPosition = (u.Position || "").toUpperCase();
                            if (uRole === "TSM" || uPosition.includes("TERRITORY SALES MANAGER")) return false;
                            
                            const uTSM = clean(u.TSM);
                            const uTSMName = clean(u.TSMName);
                            const uTSM_low = clean(u.tsm);
                            const uTSMName_low = clean(u.tsmName);
                            
                            return (uTSM && uTSM === myCleanName) || 
                                   (uTSM && uTSM === referenceId) ||
                                   (uTSMName && uTSMName === myCleanName) || 
                                   (uTSM_low && uTSM_low === myCleanName) ||
                                   (uTSM_low && uTSM_low === referenceId) || 
                                   (uTSMName_low && uTSMName_low === myCleanName);
                        });
                    } else if (isManager) {
                        subs = allUsers.filter(u => {
                            const uMan = clean(u.Manager);
                            const uManName = clean(u.ManagerName);
                            const uMan_low = clean(u.manager);
                            const uManName_low = clean(u.managerName);
                            
                            return (uMan && uMan === myCleanName) || 
                                   (uMan && uMan === referenceId) ||
                                   (uManName && uManName === myCleanName) || 
                                   (uMan_low && uMan_low === myCleanName) ||
                                   (uMan_low && uMan_low === referenceId) || 
                                   (uManName_low && uManName_low === myCleanName);
                        });
                    }
                    setSubordinateIds(subs.map(u => u._id));
                }
            })
            .catch(console.error);
    }, []);

    // Remove the redundant subordinate fetching useEffect

    // Real-time Firestore Sync with Security Filtering
    // FIX: Removed `selectedRequest` from deps — it caused all 6 listeners to be torn down
    // and re-created on every conversation click, multiplying reads by the number of clicks.
    // FIX: Added server-side where filters for non-admin users to avoid full collection downloads.
    useEffect(() => {
        if (!db || !userId) return;

        const isManager = userRole === "MANAGER";
        const hasGlobalAccess = userDept === "IT" || userDept === "ENGINEERING" || isManager || userRole === "LEADER" || userRole === "SUPER ADMIN";
        const isTSM = userRole === "TSM";

        const unsubscribes = COLLECTIONS.map(coll => {
            // Build a filtered query for non-admin users to avoid downloading entire collections
            let q;
            if (hasGlobalAccess) {
                q = collection(db, coll.id);
            } else if (isTSM && subordinateIds.length > 0) {
                // Firestore "in" supports up to 30 values; slice to be safe
                q = query(collection(db, coll.id), where("submittedBy", "in", [userId, ...subordinateIds.slice(0, 9)])) as any;
            } else {
                q = query(collection(db, coll.id), where("submittedBy", "==", userId)) as any;
            }

            return onSnapshot(q, (snapshot) => {
                setAllRequests(prev => {
                    const others = prev.filter(p => p.sourceCollection !== coll.id);
                    let current = snapshot.docs.map(d => {
                        const data = d.data();
                        const unreadCount = (data.messages || []).filter((m: any) => 
                            m.senderId !== userId && !m.seenBy?.includes(userId)
                        ).length;

                        const lastMessageTime = data.messages?.length > 0 
                            ? data.messages[data.messages.length - 1].timestamp 
                            : null;
                        
                        const sortDate = lastMessageTime || data.updatedAt || 0;

                        return {
                            id: d.id,
                            shortId: d.id.slice(-6).toUpperCase(),
                            sourceCollection: coll.id,
                            unreadCount,
                            sortKey: sortDate?.seconds ? sortDate.seconds * 1000 : new Date(sortDate).getTime(),
                            lastUpdated: sortDate,
                            ...data
                        };
                    });

                    const merged = [...others, ...current].sort((a, b) => b.sortKey - a.sortKey);
                    return merged;
                });
            });
        });

        return () => unsubscribes.forEach(unsub => unsub());
    // NOTE: `selectedRequest` intentionally excluded — selecting a conversation must NOT
    // recreate all listeners. `initialId` is also excluded for the same reason.
    }, [userId, userRole, userDept, subordinateIds]);

    // Auto-select the request from URL param once data is loaded
    useEffect(() => {
        if (!initialId || selectedRequest || allRequests.length === 0) return;
        const target = allRequests.find(r => r.id === initialId);
        if (target) setSelectedRequest({ id: target.id, coll: target.sourceCollection });
    }, [initialId, allRequests, selectedRequest]);

    const getStatusInfo = (status: string) => {
        const s = (status || "").toUpperCase();
        if (s.includes("PENDING") || s.includes("REVIEW")) return { label: "PENDING", color: "bg-amber-500", bg: "bg-amber-50" };
        if (s.includes("APPROVED") || s.includes("CONFIRMED") || s.includes("CONFIRM")) return { label: "APPROVED", color: "bg-emerald-500", bg: "bg-emerald-50" };
        if (s.includes("COMPLETED") || s.includes("DONE") || s.includes("FINISHED")) return { label: "DONE", color: "bg-blue-500", bg: "bg-blue-50" };
        if (s.includes("CANCEL") || s.includes("REJECT")) return { label: "CANCELLED", color: "bg-rose-500", bg: "bg-rose-50" };
        if (s.includes("PROGRESS") || s.includes("PROCESS")) return { label: "IN PROGRESS", color: "bg-indigo-500", bg: "bg-indigo-50" };
        return { label: s || "ACTIVE", color: "bg-slate-400", bg: "bg-slate-50" };
    };

    const [pinnedIds, setPinnedIds] = useState<string[]>([]);
    
    // Feature: Load/Save Pinned Projects
    useEffect(() => {
        const stored = localStorage.getItem("pinned_clusters");
        if (stored) setPinnedIds(JSON.parse(stored));
    }, []);

    const togglePin = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        const next = pinnedIds.includes(id) 
            ? pinnedIds.filter(p => p !== id) 
            : [...pinnedIds, id];
        setPinnedIds(next);
        localStorage.setItem("pinned_clusters", JSON.stringify(next));
        toast.success(pinnedIds.includes(id) ? "Unpinned project" : "Pinned project to top");
    };

    const sortedRequests = useMemo(() => {
        return [...allRequests].sort((a, b) => {
            const aPinned = pinnedIds.includes(a.id);
            const bPinned = pinnedIds.includes(b.id);
            if (aPinned && !bPinned) return -1;
            if (!aPinned && bPinned) return 1;
            return b.sortKey - a.sortKey;
        });
    }, [allRequests, pinnedIds]);

    const filteredRequests = useMemo(() => {
        return sortedRequests.filter(req => {
            const nameToSearch = (req.projectName || req.client || req.company_name || "").toLowerCase();
            const matchesSearch = nameToSearch.includes(searchTerm.toLowerCase()) || 
                                 (req.shortId || "").toLowerCase().includes(searchTerm.toLowerCase());
            
            if (filterCategory === "unread") return matchesSearch && req.unreadCount > 0;
            if (filterCategory !== "all") return matchesSearch && req.sourceCollection === filterCategory;
            return matchesSearch;
        });
    }, [allRequests, searchTerm, filterCategory]);

    const activeData = useMemo(() => 
        allRequests.find(r => r.id === selectedRequest?.id),
    [allRequests, selectedRequest]);

    const activeCategory = COLLECTIONS.find(c => c.id === activeData?.sourceCollection);

    return (
        <div className="flex flex-1 w-full overflow-hidden bg-white h-[calc(100vh-4rem)] isolate">
            {/* Sidebar List - Independent scroll container */}
            <aside className={cn(
                "w-full md:w-[320px] lg:w-[360px] border-r border-slate-200 flex flex-col shrink-0 bg-[#F9FAFB] transition-all duration-300 h-full overflow-hidden",
                selectedRequest ? "hidden md:flex" : "flex"
            )}>
                {/* Fixed Header - not sticky, just shrink-0 */}
                <div className="p-4 pb-3 space-y-3 shrink-0 bg-[#F9FAFB] z-20 border-b border-slate-100/50">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Collaboration Clusters</h2>
                            <p className="text-[13px] font-bold text-slate-900 mt-1">Workspace Activity</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button className="p-2 hover:bg-slate-200 rounded-lg transition-colors relative">
                                <Bell size={16} className="text-slate-600" />
                                {allRequests.some(r => r.unreadCount > 0) && (
                                    <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-blue-600 border-2 border-[#F9FAFB]" />
                                )}
                            </button>
                        </div>
                    </div>
                    
                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                        <input 
                            placeholder="Find project or ID..." 
                            className="w-full pl-11 h-11 rounded-2xl border-none bg-white shadow-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-600 outline-none text-sm transition-all placeholder:text-slate-400"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                </div>

                {/* Scrollable Cluster Filters - Separate from project list */}
                <div className="shrink-0 bg-[#F9FAFB] border-b border-slate-100/50 px-4 py-2">
                    <div className="flex gap-2 overflow-x-auto scrollbar-thin pb-1">
                        <button
                            onClick={() => setFilterCategory("all")}
                            className={cn(
                                "flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all shrink-0 border",
                                filterCategory === "all" ? "bg-slate-900 text-white border-slate-900 shadow-md" : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                            )}
                        >
                            <LayoutGrid size={12}/> All
                        </button>
                        <button
                            onClick={() => setFilterCategory("unread")}
                            className={cn(
                                "flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all shrink-0 border",
                                filterCategory === "unread" ? "bg-blue-600 text-white border-blue-600 shadow-md" : "bg-white text-blue-600 border-blue-100 hover:bg-blue-50"
                            )}
                        >
                            <Sparkles size={12}/> Unread
                        </button>
                        <div className="w-px h-6 bg-slate-200 mx-1 self-center shrink-0" />
                        {COLLECTIONS.map((coll) => (
                            <button
                                key={coll.id}
                                onClick={() => setFilterCategory(coll.id)}
                                className={cn(
                                    "flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all shrink-0 border",
                                    filterCategory === coll.id ? "bg-white text-slate-900 border-slate-900 shadow-sm" : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                                )}
                            >
                                <coll.icon size={12} className={coll.color} /> 
                                {coll.label.split(' ')[0]}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Scrollable Project List - Separate from cluster filters */}
                <div className="flex-1 overflow-y-auto px-0 pb-0" style={{ maxHeight: 'calc(100vh - 280px)' }}>
                    {filteredRequests.length > 0 ? filteredRequests.map((req) => {
                        const isActive = selectedRequest?.id === req.id;
                        const category = COLLECTIONS.find(c => c.id === req.sourceCollection);
                        const lastMsg = req.messages?.[req.messages.length - 1];
                        const statusInfo = getStatusInfo(req.status);
                        const isPinned = pinnedIds.includes(req.id);
                        
                        return ( 
                            <ChatMessageListItem
                                key={req.id}
                                id={req.id}
                                shortId={req.shortId}
                                sourceCollection={req.sourceCollection}
                                unreadCount={req.unreadCount}
                                lastUpdated={req.lastUpdated}
                                projectName={req.projectName}
                                client={req.client}
                                company_name={req.company_name}
                                status={req.status}
                                messages={req.messages}
                                isActive={isActive}
                                isPinned={isPinned}
                                category={category}
                                onSelect={(id, coll) => setSelectedRequest({ id, coll })}
                                onTogglePin={togglePin}
                                userId={userId || ""}
                            />
                        );
                    }) : (
                        <div className="flex flex-col items-center justify-center py-20 opacity-30">
                            <Filter size={40} className="text-slate-400" />
                            <p className="text-[10px] font-black uppercase mt-4 tracking-widest">No projects found</p>
                        </div>
                    )}
                </div>
            </aside>

            {/* Main Chat Area - Takes remaining space */}
            <main className={cn(
                "flex-1 flex flex-col min-w-0 bg-white relative overflow-hidden h-full",
                !selectedRequest ? "hidden md:flex" : "flex"
            )}>
                {/* Sticky Chat Header */}
                <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b border-slate-200 shadow-sm">
                    {selectedRequest && activeData ? (
                        <div className="p-4">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-3">
                                    <div className="flex -space-x-2">
                                        {[activeData.client, activeData.company_name].filter(Boolean).slice(0, 3).map((name, i) => (
                                            <Avatar key={i} className="size-8 border-2 border-white">
                                                <AvatarFallback className="bg-blue-100 text-blue-600 text-[10px] font-bold">
                                                    {(name || "U").charAt(0).toUpperCase()}
                                                </AvatarFallback>
                                            </Avatar>
                                        ))}
                                        {activeData.messages?.length > 4 && (
                                            <div className="size-8 rounded-full border-2 border-white bg-slate-900 flex items-center justify-center text-[8px] font-black text-white">
                                                +{activeData.messages.length - 4}
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-slate-900 text-sm">
                                            {activeData.projectName || activeData.client || activeData.company_name || "dsiconnect"}
                                        </h3>
                                        <p className="text-[11px] text-slate-500">
                                            {activeCategory?.label} • {activeData.status}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setIsSearching(!isSearching)}
                                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                                    >
                                        <Search size={18} />
                                    </button>
                                    <Link 
                                        href={getProjectLink(activeData.sourceCollection, activeData.id)}
                                        className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase hover:bg-blue-600 transition-all shadow-lg shadow-slate-200"
                                    >
                                        <span className="hidden sm:inline">Project</span> Details
                                        <ExternalLink size={12} />
                                    </Link>
                                </div>
                            </div>
                            {isSearching && (
                                <input
                                    autoFocus
                                    className="w-full bg-slate-100 border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-700 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                    placeholder="Search messages..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            )}
                        </div>
                    ) : null}
                </div>

                {/* Chat Content - Scrollable area */}
                <div className="flex-1 flex flex-col bg-[#FDFEFF] min-h-0 overflow-hidden">
                    {selectedRequest && activeData ? (
                        <ChatConversation 
                            requestId={selectedRequest.id}
                            collectionName={selectedRequest.coll}
                            messages={activeData.messages || []}
                            currentUserId={userId || ""}
                            userName={`${userData?.Firstname || ''} ${userData?.Lastname || ''}`}
                            userRole={userData?.Position || "Staff"}
                            status={activeData.status || "PENDING"}
                            profilePicture={userData?.Image}
                            title={activeData.projectName || activeData.client || activeData.company_name || "dsiconnect"}
                            searchQuery={searchQuery}
                        />
                    ) : (
                        <div className="hidden md:flex flex-col items-center justify-center w-full h-full bg-[#FCFDFF] p-12 text-center">
                            <div className="max-w-md w-full text-center">
                                <div className="relative mb-8 inline-block">
                                    <div className="absolute inset-0 bg-blue-500/10 blur-3xl rounded-full" />
                                    <div className="relative w-24 h-24 bg-white rounded-[32px] shadow-2xl flex items-center justify-center mx-auto border border-slate-50">
                                        <MessageSquare size={40} className="text-blue-600" />
                                        <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-amber-400 rounded-xl flex items-center justify-center shadow-lg border-2 border-white animate-bounce">
                                            <Sparkles size={16} className="text-white" />
                                        </div>
                                    </div>
                                </div>
                                
                                <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight mb-3">
                                    DSIConnect Hub
                                </h2>
                                <p className="text-slate-500 text-sm font-medium mb-10 leading-relaxed px-6">
                                    Your centralized collaboration space. Select a project cluster from the sidebar to view detailed history and internal communication.
                                </p>

                                <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto">
                                    {COLLECTIONS.map(coll => (
                                        <div 
                                            key={coll.id}
                                            className="p-4 rounded-[24px] bg-white border border-slate-100 shadow-sm hover:shadow-md transition-all group cursor-pointer text-left"
                                        >
                                            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform", coll.bg, coll.color)}>
                                                <coll.icon size={20} strokeWidth={2.5} />
                                            </div>
                                            <div className="font-black text-[10px] text-slate-400 uppercase tracking-wider mb-1">
                                                Cluster
                                            </div>
                                            <div className="font-bold text-[13px] text-slate-900 uppercase tracking-tight">
                                                {coll.label}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="mt-12 flex items-center justify-center gap-6">
                                    <div className="text-center">
                                        <div className="text-xl font-black text-slate-900">{allRequests.length}</div>
                                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active Projects</div>
                                    </div>
                                    <div className="w-px h-8 bg-slate-100" />
                                    <div className="text-center">
                                        <div className="text-xl font-black text-blue-600">
                                            {allRequests.reduce((acc, r) => acc + (r.unreadCount || 0), 0)}
                                        </div>
                                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Unread Messages</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );

}

export default function InternalMessagesPage() {
    const [userId, setUserId] = useState<string | null>(null);
    useEffect(() => { setUserId(localStorage.getItem("userId")) }, []);

    return (
        <ProtectedPageWrapper>
            <SidebarProvider defaultOpen={false}>
                <AppSidebar userId={userId} />
                <SidebarInset className="bg-white flex-1 flex flex-col overflow-hidden">
                    <PageHeader 
                        title="Project Workspace" 
                        version="V4.0" 
                        showBackButton={true} 
                        trigger={<SidebarTrigger className="mr-2" />} 
                    />
                    <Suspense fallback={
                        <div className="h-screen flex flex-col items-center justify-center gap-4 bg-white">
                            <div className="relative">
                                <Loader2 className="animate-spin text-blue-600" size={40} />
                                <div className="absolute inset-0 blur-xl bg-blue-400/20 animate-pulse" />
                            </div>
                            <div className="flex flex-col items-center gap-1">
                                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-900">Syncing Database</span>
                                <span className="text-[8px] font-bold uppercase text-slate-400">Fetching cluster data...</span>
                            </div>
                        </div>
                    }>
                        <MessagesContent />
                    </Suspense>
                </SidebarInset>
            </SidebarProvider>
            <style jsx global>{`
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
                
                /* Nice slim scrollbar styling */
                ::-webkit-scrollbar { width: 6px; height: 6px; }
                ::-webkit-scrollbar-track { background: transparent; }
                ::-webkit-scrollbar-thumb { 
                    background: #cbd5e1; 
                    border-radius: 3px; 
                    transition: background 0.2s;
                }
                ::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
                ::-webkit-scrollbar-corner { background: transparent; }
                
                /* Firefox scrollbar */
                * { scrollbar-width: thin; scrollbar-color: #cbd5e1 transparent; }
            `}</style>
        </ProtectedPageWrapper>
    );
}