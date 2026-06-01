"use client"

import * as React from "react"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { 
    Bell, 
    CalendarCheck, 
    FileText, 
    Monitor, 
    AlertTriangle, 
    MoreHorizontal, 
    ChevronRight,
    Clock
} from "lucide-react"

// Layout Components
import { AppSidebar } from "@/components/app-sidebar"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import ProtectedPageWrapper from "@/components/protected-page-wrapper"
import { PageHeader } from "@/components/page-header"

// Firebase
import { db } from "@/lib/firebase"
import { collection, query, where, onSnapshot } from "firebase/firestore"
import { cn } from "@/lib/utils"

export default function NotificationsPage() {
    const router = useRouter()
    const [userId, setUserId] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [counts, setCounts] = useState({
        siteVisit: 0,
        jobRequest: 0,
        shopDrawing: 0,
        dialuxRequest: 0,
        otherRequest: 0,
        testingOverdue: 0
    })

    // Get User ID from localStorage (matching your standard)
    useEffect(() => {
        setUserId(localStorage.getItem("userId"))
    }, [])

    // Functional icon mapping for streetlights (consistent with your dashboard)
    const StreetLightIcon = ({ size = 24, className = "" }) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M7 22h3M9 22V7c0-2 1-3 3-3h5" /><path d="M15 4h5l1 2h-7l1-2z" /><path d="M17 9v1M14 8l-.5.5M20 8l.5.5" opacity="0.5" />
        </svg>
    )

    useEffect(() => {
        if (!db) return;

        // Real-time listeners for all pending categories
        const unsubSite = onSnapshot(query(collection(db, "appointments"), where("status", "==", "PENDING")), 
            (snap) => setCounts(prev => ({ ...prev, siteVisit: snap.size })));
        
        const unsubJob = onSnapshot(query(collection(db, "job_requests"), where("status", "==", "PENDING")), 
            (snap) => setCounts(prev => ({ ...prev, jobRequest: snap.size })));

        const unsubShop = onSnapshot(query(collection(db, "shop_drawing_requests"), where("department", "==", "ENGINEERING"), where("status", "==", "PENDING_REVIEW")), 
            (snap) => setCounts(prev => ({ ...prev, shopDrawing: snap.size })));

        const unsubDialux = onSnapshot(query(collection(db, "dialux_requests"), where("status", "==", "PENDING")), 
            (snap) => setCounts(prev => ({ ...prev, dialuxRequest: snap.size })));

        const unsubOther = onSnapshot(query(collection(db, "other_requests"), where("status", "==", "PENDING")), 
            (snap) => setCounts(prev => ({ ...prev, otherRequest: snap.size })));

        // FIX: Filter testing_tracker server-side to only unreleased items,
        // avoiding a full collection download just to count overdue items client-side.
        const unsubTesting = onSnapshot(
            query(collection(db, "testing_tracker"), where("releaseDate", "==", null)),
            (snap) => {
                const today = new Date();
                const overdue = snap.docs.filter(doc => {
                    const d = doc.data();
                    return d.targetDate?.toDate() && d.targetDate.toDate() < today;
                }).length;
                setCounts(prev => ({ ...prev, testingOverdue: overdue }));
                setLoading(false);
            }
        );

        return () => {
            unsubSite(); unsubJob(); unsubShop(); unsubDialux(); unsubOther(); unsubTesting();
        };
    }, []);

    const totalAlerts = Object.values(counts).reduce((a, b) => a + b, 0);

    const notificationItems = [
        { id: 'site', label: "Site Visit Appointments", count: counts.siteVisit, icon: CalendarCheck, path: "/appointments/site-visit", color: "bg-blue-50 text-blue-600" },
        { id: 'job', label: "Job Requests", count: counts.jobRequest, icon: FileText, path: "/request/job", color: "bg-orange-50 text-orange-600" },
        { id: 'shop', label: "Shop Drawing Requests", count: counts.shopDrawing, icon: StreetLightIcon, path: "/request/shop-drawing", color: "bg-emerald-50 text-emerald-600" },
        { id: 'dialux', label: "DIAlux Simulations", count: counts.dialuxRequest, icon: Monitor, path: "/request/dialux", color: "bg-indigo-50 text-indigo-600" },
        { id: 'testing', label: "Overdue Testing", count: counts.testingOverdue, icon: AlertTriangle, path: "/request/testing", color: "bg-red-50 text-red-600", critical: true },
        { id: 'other', label: "Misc Requests", count: counts.otherRequest, icon: MoreHorizontal, path: "/request/other", color: "bg-gray-50 text-gray-600" },
    ];

    return (
        <ProtectedPageWrapper>
            <SidebarProvider defaultOpen={false}>
                <AppSidebar userId={userId} />
                <SidebarInset className="relative bg-[#F4F7F7] min-h-screen font-sans">
                    
                    <PageHeader 
                        title="Activity Center" 
                        version="V2.6"
                        showBackButton={true}
                        trigger={<SidebarTrigger className="mr-2" />}
                    />

                    <main className="p-4 md:p-8 max-w-4xl mx-auto w-full space-y-6">
                        
                        {/* Summary Card */}
                        <div className="flex items-center gap-4 bg-white p-6 rounded-[24px] border border-zinc-200/60 shadow-sm">
                            <div className="size-14 bg-[#E33636] rounded-2xl flex items-center justify-center text-white shadow-lg shadow-red-100">
                                <Bell size={24} fill="currentColor" />
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.2em] leading-none mb-1.5">Action Required</p>
                                <h2 className="text-2xl font-black text-zinc-900 leading-none">{totalAlerts} Pending Tasks</h2>
                            </div>
                        </div>

                        {/* List Section */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between px-2">
                                <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.2em]">Categories</h3>
                                <div className="flex items-center gap-1.5 text-[9px] font-black text-emerald-500 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
                                    <div className="size-1 bg-emerald-500 rounded-full animate-pulse" />
                                    LIVE SYNC
                                </div>
                            </div>

                            <div className="grid gap-3">
                                {notificationItems.map((item) => (
                                    <button
                                        key={item.id}
                                        onClick={() => router.push(item.path)}
                                        className={cn(
                                            "w-full bg-white p-5 rounded-[24px] border flex items-center justify-between transition-all active:scale-[0.98] group",
                                            item.critical && item.count > 0 ? "border-red-200 shadow-sm bg-red-50/10" : "border-zinc-200/60 hover:border-zinc-300 shadow-sm"
                                        )}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={cn("size-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110", item.color)}>
                                                <item.icon size={22} />
                                            </div>
                                            <div className="text-left">
                                                <p className="text-sm font-bold text-zinc-900">{item.label}</p>
                                                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-tight">View Details</p>
                                            </div>
                                        </div>
                                        
                                        <div className="flex items-center gap-3">
                                            {item.count > 0 ? (
                                                <span className={cn(
                                                    "min-w-[28px] h-7 px-2 flex items-center justify-center rounded-xl text-xs font-black shadow-sm",
                                                    item.critical ? "bg-red-600 text-white" : "bg-zinc-900 text-white"
                                                )}>
                                                    {item.count}
                                                </span>
                                            ) : (
                                                <span className="text-[10px] font-bold text-zinc-300 uppercase italic">Clear</span>
                                            )}
                                            <ChevronRight size={18} className="text-zinc-300 group-hover:text-zinc-900 group-hover:translate-x-0.5 transition-all" />
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Empty State */}
                        {totalAlerts === 0 && !loading && (
                            <div className="py-20 flex flex-col items-center justify-center">
                                <div className="size-20 bg-white rounded-full flex items-center justify-center mb-4 shadow-sm border border-zinc-100">
                                    <Bell size={32} className="text-zinc-200" />
                                </div>
                                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest italic">System Optimized • No Pending Tasks</p>
                            </div>
                        )}

                        <div className="pt-8 text-center">
                            <p className="text-[9px] font-bold text-zinc-300 uppercase leading-relaxed tracking-widest max-w-[240px] mx-auto">
                                Notifications are updated live from the central engineering database.
                            </p>
                        </div>
                    </main>
                </SidebarInset>
            </SidebarProvider>
        </ProtectedPageWrapper>
    )
}