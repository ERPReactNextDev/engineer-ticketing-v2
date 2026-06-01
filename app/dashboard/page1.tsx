"use client"

import * as React from "react"
import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { AppSidebar } from "@/components/app-sidebar"
import {
    SidebarInset,
    SidebarProvider,
    SidebarTrigger,
} from "@/components/ui/sidebar"
import ProtectedPageWrapper from "../../components/protected-page-wrapper";

import {
    CalendarCheck, FileText, Monitor, ThumbsUp,
    ClipboardCheck, MoreHorizontal, Bell,
    Plus, Activity, CloudSun, CloudRain, Sun, CloudLightning, Cloud, Moon, CloudMoon,
    ArrowUpRight, Clock, CheckCircle2, AlertTriangle, Layers, MessageSquare, ChevronRight
} from "lucide-react";

import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, limit, orderBy } from "firebase/firestore";
import { cn } from "@/lib/utils";
import { isAfter } from "date-fns";

export default function EngiconnectDashboard() {
    const router = useRouter()
    const [userId, setUserId] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState<boolean>(true)
    const [currentTime, setCurrentTime] = useState(new Date())
    const [weather, setWeather] = useState({ temp: "--", condition: "Syncing...", code: 0 });

    // Paging State for Services
    const [currentPage, setCurrentPage] = useState(0);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Activity Tabs State
    const [activeTab, setActiveTab] = useState("Monitoring");
    const tabs = ["Monitoring", "Projects", "Requests", "Admin"];

    const [userDetails, setUserDetails] = useState({
        Firstname: "",
        Position: "",
        profilePicture: ""
    })

    const [notifications, setNotifications] = useState({
        siteVisit: 0,
        jobRequest: 0,
        shopDrawing: 0,
        testingActive: 0,
        testingOverdue: 0,
        otherRequest: 0,
        dialuxRequest: 0,
        dialuxInProgress: 0,
        dialuxCompleted: 0,
        unreadMessages: 0,
        unreadByService: {
            dialux: 0,
            jobRequest: 0,
            siteVisit: 0,
            shopDrawing: 0,
            other: 0,
            recommendation: 0
        }
    })

    const [recentActivity, setRecentActivity] = useState<any[]>([]);

    const StreetLightIcon = ({ size = 24, className = "" }) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M7 22h3M9 22V7c0-2 1-3 3-3h5" /><path d="M15 4h5l1 2h-7l1-2z" /><path d="M17 9v1M14 8l-.5.5M20 8l.5.5" opacity="0.5" />
        </svg>
    );

    const services = [
        { label: "Site Visit Appointment", icon: CalendarCheck, count: notifications.siteVisit, msgCount: notifications.unreadByService.siteVisit, path: "/appointments/site-visit" },
        { label: "Job Request", icon: FileText, count: notifications.jobRequest, msgCount: notifications.unreadByService.jobRequest, path: "/request/job" },
        { label: "Dialux Simulation", icon: Monitor, count: notifications.dialuxRequest, msgCount: notifications.unreadByService.dialux, path: "/request/dialux" },
        { label: "Product Recommendation", icon: ThumbsUp, count: 0, msgCount: notifications.unreadByService.recommendation, path: "/requests/recommendation" },
        { label: "SPF Shop Drawing Request", icon: StreetLightIcon, count: notifications.shopDrawing, msgCount: notifications.unreadByService.shopDrawing, path: "/request/shop-drawing" },
        { label: "Testing Monitoring", icon: ClipboardCheck, count: notifications.testingActive + notifications.testingOverdue, msgCount: 0, path: "/request/testing" },
        { label: "Other Request", icon: MoreHorizontal, count: notifications.otherRequest, msgCount: notifications.unreadByService.other, path: "/request/other" },
    ];

    const itemsPerPage = 6; 
    const totalPages = Math.ceil(services.length / itemsPerPage);

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const scrollLeft = e.currentTarget.scrollLeft;
        const width = e.currentTarget.offsetWidth;
        const page = Math.round(scrollLeft / width);
        setCurrentPage(page);
    };

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000)
        return () => clearInterval(timer)
    }, [])

    useEffect(() => {
        const fetchWeather = async (lat: number, lon: number) => {
            try {
                const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
                const data = await response.json();
                const code = data.current_weather.weathercode;
                let status = "Clear";
                if (code > 0 && code < 4) status = "Cloudy";
                if (code >= 51 && code <= 67) status = "Rainy";
                if (code >= 95) status = "Stormy";
                setWeather({ temp: `${Math.round(data.current_weather.temperature)}°`, condition: status, code: code });
            } catch (error) { setWeather({ temp: "!!", condition: "Error", code: 0 }); }
        };
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition((pos) => fetchWeather(pos.coords.latitude, pos.coords.longitude));
        }
    }, []);

    const getWeatherIcon = (condition: string, size: number) => {
        const hour = currentTime.getHours();
        const isNight = hour >= 18 || hour < 6;
        switch (condition) {
            case "Rainy": return <CloudRain size={size} className="text-blue-500 animate-pulse" />;
            case "Stormy": return <CloudLightning size={size} className="text-purple-500 animate-pulse" />;
            case "Cloudy": return isNight ? <CloudMoon size={size} className="text-indigo-300" /> : <Cloud size={size} className="text-gray-400" />;
            case "Clear": return isNight ? <Moon size={size} className="text-yellow-200" /> : <Sun size={size} className="text-yellow-500" />;
            default: return isNight ? <CloudMoon size={size} className="text-indigo-200" /> : <CloudSun size={size} className="text-orange-500" />;
        }
    };

    const getGreeting = () => {
        const hour = currentTime.getHours()
        if (hour < 12) return "Good Morning"
        if (hour < 18) return "Good Afternoon"
        return "Good Evening"
    }

    const formattedTime = currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    const formattedDate = currentTime.toLocaleDateString([], { month: 'short', day: '2-digit', year: 'numeric' })

    useEffect(() => {
        const storedUserId = localStorage.getItem("userId")
        setUserId(storedUserId)
        const fetchPersonnelRecord = async () => {
            if (!storedUserId) { setIsLoading(false); return; }
            try {
                const res = await fetch(`/api/user?id=${encodeURIComponent(storedUserId)}`)
                const data = await res.json()
                setUserDetails({ Firstname: data.Firstname || "User", Position: data.Position || "Member", profilePicture: data.profilePicture || "" })
            } catch (error) { console.error(error) } finally { setIsLoading(false) }
        }
        fetchPersonnelRecord()
    }, [])

    useEffect(() => {
        if (!db || !userId) return;
        
        const unsubSite = onSnapshot(query(collection(db, "appointments"), where("status", "==", "PENDING")),
            (snap) => setNotifications(prev => ({ ...prev, siteVisit: snap.size })));
        
        const unsubShop = onSnapshot(query(collection(db, "shop_drawing_requests"), where("department", "==", "ENGINEERING"), where("status", "==", "PENDING_REVIEW")),
            (snap) => setNotifications(prev => ({ ...prev, shopDrawing: snap.size })));
        
        const unsubJob = onSnapshot(query(collection(db, "job_requests"), where("status", "==", "PENDING")),
            (snap) => setNotifications(prev => ({ ...prev, jobRequest: snap.size })));

        const unsubOther = onSnapshot(query(collection(db, "other_requests"), where("status", "==", "PENDING")),
            (snap) => setNotifications(prev => ({ ...prev, otherRequest: snap.size })));

        const unsubDialuxPending = onSnapshot(query(collection(db, "dialux_requests"), where("status", "==", "PENDING")),
            (snap) => setNotifications(prev => ({ ...prev, dialuxRequest: snap.size })));

        const unsubDialuxProgress = onSnapshot(query(collection(db, "dialux_requests"), where("status", "==", "IN_PROGRESS")),
            (snap) => setNotifications(prev => ({ ...prev, dialuxInProgress: snap.size })));

        const unsubDialuxDone = onSnapshot(query(collection(db, "dialux_requests"), where("status", "==", "COMPLETED")),
            (snap) => setNotifications(prev => ({ ...prev, dialuxCompleted: snap.size })));

        const unsubTesting = onSnapshot(query(collection(db, "testing_tracker"), where("arrivalDate", "!=", null), limit(200)), (snap) => {
            let active = 0; let overdue = 0;
            const today = new Date();
            snap.docs.forEach(doc => {
                const d = doc.data();
                if (!d.releaseDate) {
                    const target = d.targetDate?.toDate();
                    if (target && isAfter(today, target)) overdue++;
                    else if (d.arrivalDate) active++;
                }
            });
            setNotifications(prev => ({ ...prev, testingActive: active, testingOverdue: overdue }));
        });

        // Combined messaging listener logic
        // NOTE: Filtered to only the current user's own requests to avoid full collection reads.
        const targetCollections = [
            { key: 'jobRequest', col: 'job_requests' },
            { key: 'dialux', col: 'dialux_requests' },
            { key: 'shopDrawing', col: 'shop_drawing_requests' },
            { key: 'other', col: 'other_requests' },
            { key: 'recommendation', col: 'recommendation_requests' },
            { key: 'siteVisit', col: 'appointments' }
        ];

        const msgUnsubs = targetCollections.map(({ key, col }) => {
            // Filter to only documents submitted by this user to avoid full collection reads
            return onSnapshot(
                query(collection(db, col), where("submittedBy", "==", userId), limit(50)),
                (snap) => {
                    let unreadCount = 0;
                    snap.docs.forEach(doc => {
                        const data = doc.data();
                        if (data.messages && Array.isArray(data.messages)) {
                            unreadCount += data.messages.filter((m: any) => 
                                m.senderId !== userId && !m.seenBy?.includes(userId)
                            ).length;
                        }
                    });
                    
                    setNotifications(prev => {
                        const updatedUnreadByService = { ...prev.unreadByService, [key]: unreadCount };
                        const totalUnread = Object.values(updatedUnreadByService).reduce((a, b) => (typeof a === 'number' ? a : 0) + (typeof b === 'number' ? b : 0), 0);
                        return { 
                            ...prev, 
                            unreadByService: updatedUnreadByService as any,
                            unreadMessages: totalUnread
                        };
                    });
                }
            );
        });

        return () => { 
            unsubSite(); unsubShop(); unsubTesting(); unsubJob(); unsubOther(); 
            unsubDialuxPending(); unsubDialuxProgress(); unsubDialuxDone();
            msgUnsubs.forEach(unsub => unsub());
        };
    }, [userId]);

    useEffect(() => {
        if (!db) return;
        const qDialux = query(collection(db, "dialux_requests"), orderBy("createdAt", "desc"), limit(2));
        const qJob = query(collection(db, "job_requests"), orderBy("createdAt", "desc"), limit(2));
        const qShop = query(collection(db, "shop_drawing_requests"), orderBy("createdAt", "desc"), limit(2));

        const activitiesMap = new Map();
        function updateActivity(type: string, docs: any[]) {
            docs.forEach(doc => {
                const data = doc.data();
                activitiesMap.set(doc.id, { id: doc.id, type, ...data });
            });
            const sorted = Array.from(activitiesMap.values())
                .sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0))
                .slice(0, 5);
            setRecentActivity(sorted);
        }

        const unsubDialux = onSnapshot(qDialux, (snap) => updateActivity('DIAlux', snap.docs));
        const unsubJob = onSnapshot(qJob, (snap) => updateActivity('Job', snap.docs));
        const unsubShop = onSnapshot(qShop, (snap) => updateActivity('Shop', snap.docs));

        return () => { unsubDialux(); unsubJob(); unsubShop(); };
    }, []);

    const totalNotifications = notifications.siteVisit + notifications.shopDrawing + notifications.testingOverdue + notifications.jobRequest + notifications.otherRequest + notifications.dialuxRequest;

    return (
        <ProtectedPageWrapper>
            <SidebarProvider defaultOpen={false}>
                <AppSidebar userId={userId || ""} />
                <SidebarInset className="bg-[#F2F4F7] relative min-h-screen font-sans pb-safe">

                    <header className="hidden md:flex h-20 items-center justify-between px-8 bg-white border-b border-gray-100 sticky top-0 z-50">
                        <div className="flex items-center gap-6">
                            <div className="flex items-center gap-4">
                                <SidebarTrigger className="hover:bg-gray-100 transition-colors" />
                                <div className="h-4 w-px bg-gray-200" />
                                <div className="flex items-center gap-3">
                                    <div className="size-10 rounded-xl overflow-hidden bg-gray-900">
                                        {userDetails.profilePicture ? (
                                            <img src={userDetails.profilePicture} alt="Profile" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-white font-bold text-xs uppercase">
                                                {userDetails.Firstname.substring(0, 2)}
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-1">{getGreeting()}</p>
                                        <h2 className="text-xl font-bold text-gray-900 tracking-tight leading-none">Welcome, {userDetails.Firstname}</h2>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            <button onClick={() => router.push('/messages')} className="p-2.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all relative">
                                <MessageSquare size={20} />
                                {notifications.unreadMessages > 0 && <span className="absolute top-2.5 right-2.5 size-2 bg-blue-600 rounded-full border-2 border-white animate-pulse" />}
                            </button>
                            <button className="p-2.5 text-gray-400 hover:text-[#E33636] hover:bg-red-50 rounded-xl transition-all relative">
                                <Bell size={20} />
                                {totalNotifications > 0 && <span className="absolute top-2.5 right-2.5 size-2 bg-[#E33636] rounded-full border-2 border-white" />}
                            </button>
                            <div className="flex items-center gap-4 px-4 py-2 bg-gray-50 rounded-xl border border-gray-100">
                                <div className="flex items-center gap-2">
                                    <div className="size-2 bg-green-500 rounded-full animate-pulse" />
                                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-tight">System Live</span>
                                </div>
                                <div className="h-3 w-px bg-gray-300" />
                                <div className="flex items-center gap-2">
                                    {getWeatherIcon(weather.condition, 16)}
                                    <span className="text-xs font-black text-gray-900">{weather.temp}</span>
                                </div>
                            </div>
                        </div>
                    </header>

                    {/* Mobile Header */}
                    <header className="md:hidden bg-[#E33636] pt-14 pb-20 px-6 rounded-b-[40px] shadow-lg relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-24 -mt-24" />
                        <div className="max-w-7xl mx-auto relative z-10">
                            <div className="flex justify-between items-start mb-6">
                                <div className="flex items-center gap-3">
                                    <div className="size-11 rounded-full overflow-hidden border-2 border-white/30 bg-white/10">
                                        {userDetails.profilePicture ? (
                                            <img src={userDetails.profilePicture} alt="User" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-white font-bold text-xs uppercase">
                                                {userDetails.Firstname.substring(0, 2)}
                                            </div>
                                        )}
                                    </div>
                                    <div className="text-white">
                                        <p className="text-[10px] font-bold opacity-60 uppercase tracking-widest">{getGreeting()}</p>
                                        <h2 className="text-xl font-black tracking-tight leading-none">{userDetails.Firstname}</h2>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => router.push('/messages')} className="size-10 bg-white/10 rounded-xl flex items-center justify-center text-white backdrop-blur-md relative">
                                        <MessageSquare size={18} />
                                        {notifications.unreadMessages > 0 && <div className="absolute top-2.5 right-2.5 size-1.5 bg-blue-400 rounded-full" />}
                                    </button>
                                    <button className="size-10 bg-white/10 rounded-xl flex items-center justify-center text-white backdrop-blur-md relative">
                                        <Bell size={20} />
                                        {totalNotifications > 0 && <div className="absolute top-2.5 right-2.5 size-1.5 bg-white rounded-full" />}
                                    </button>
                                    <SidebarTrigger className="size-10 bg-white/10 rounded-xl flex items-center justify-center text-white backdrop-blur-md" />
                                </div>
                            </div>

                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-white/60 text-[10px] font-bold uppercase tracking-widest mb-1">{formattedDate}</p>
                                    <h3 className="text-4xl font-black text-white tracking-tighter">{formattedTime}</h3>
                                </div>
                                <div className="bg-white/10 p-4 rounded-2xl backdrop-blur-md border border-white/10 flex items-center gap-4">
                                    <div className="text-center">
                                        {getWeatherIcon(weather.condition, 24)}
                                    </div>
                                    <div className="text-right text-white">
                                        <p className="text-xl font-black leading-none">{weather.temp}</p>
                                        <p className="text-[8px] font-bold opacity-60 uppercase tracking-widest mt-1">{weather.condition}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </header>

                    <main className="px-4 md:px-8 -mt-12 md:mt-0 relative z-20 pb-12">
                        <div className="max-w-7xl mx-auto">
                            {/* Summary Cards */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                                <ActivityCard 
                                    label="Unread Messages" 
                                    value={notifications.unreadMessages} 
                                    icon={MessageSquare} 
                                    isAlert={notifications.unreadMessages > 0} 
                                />
                                <ActivityCard label="Active Testing" value={notifications.testingActive} icon={Layers} />
                                <ActivityCard label="Overdue Tests" value={notifications.testingOverdue} icon={AlertTriangle} isAlert={notifications.testingOverdue > 0} />
                                <ActivityCard label="Dialux Ongoing" value={notifications.dialuxInProgress} icon={Clock} />
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                {/* Services Section */}
                                <div className="lg:col-span-2 space-y-6">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-lg font-black text-gray-900 uppercase tracking-tight flex items-center gap-2">
                                            <Layers size={18} className="text-[#E33636]" /> Engineering Modules
                                        </h3>
                                        <div className="flex gap-1">
                                            {Array.from({ length: totalPages }).map((_, i) => (
                                                <button key={i} onClick={() => setCurrentPage(i)} className={cn("size-1.5 rounded-full transition-all", currentPage === i ? "w-4 bg-[#E33636]" : "bg-gray-300")} />
                                            ))}
                                        </div>
                                    </div>

                                    <div className="relative overflow-hidden group">
                                        <div className="flex transition-transform duration-500 ease-in-out" style={{ transform: `translateX(-${currentPage * 100}%)` }}>
                                            {Array.from({ length: totalPages }).map((_, pageIdx) => (
                                                <div key={pageIdx} className="w-full grid grid-cols-2 md:grid-cols-3 gap-4 flex-shrink-0">
                                                    {services.slice(pageIdx * itemsPerPage, (pageIdx + 1) * itemsPerPage).map((service, idx) => (
                                                        <div key={idx} onClick={() => router.push(service.path)} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl hover:border-blue-100 transition-all cursor-pointer group/card relative overflow-hidden">
                                                            <div className="size-12 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-400 group-hover/card:bg-blue-600 group-hover/card:text-white transition-all mb-4">
                                                                <service.icon size={24} />
                                                            </div>
                                                            <h4 className="font-bold text-gray-900 leading-tight pr-4 text-sm md:text-base">{service.label}</h4>
                                                            
                                                            {service.count > 0 && (
                                                                <div className="absolute top-4 right-4 h-6 px-2 min-w-[24px] bg-[#E33636] text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                                                                    {service.count}
                                                                </div>
                                                            )}

                                                            {service.msgCount > 0 && (
                                                                <div className="mt-4 flex items-center gap-1.5 text-blue-600">
                                                                    <div className="size-1.5 bg-blue-600 rounded-full animate-pulse" />
                                                                    <span className="text-[10px] font-black uppercase tracking-widest">{service.msgCount} Messages</span>
                                                                </div>
                                                            )}
                                                            <div className="absolute bottom-0 right-0 size-16 bg-blue-50/50 rounded-tl-[100%] translate-x-16 translate-y-16 group-hover/card:translate-x-4 group-hover/card:translate-y-4 transition-transform" />
                                                        </div>
                                                    ))}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Recent Activity */}
                                <div className="space-y-6">
                                    <h3 className="text-lg font-black text-gray-900 uppercase tracking-tight">Recent Activity</h3>
                                    <div className="bg-white rounded-[40px] p-6 border border-gray-100 shadow-sm">
                                        <div className="space-y-6">
                                            {recentActivity.length === 0 ? (
                                                <div className="py-12 text-center">
                                                    <div className="size-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-300">
                                                        <Activity size={20} />
                                                    </div>
                                                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">No recent data</p>
                                                </div>
                                            ) : (
                                                recentActivity.map((activity, i) => (
                                                    <div key={i} className="flex gap-4 group/item">
                                                        <div className="size-10 bg-gray-50 rounded-xl flex-shrink-0 flex items-center justify-center text-gray-400 group-hover/item:bg-[#E33636] group-hover/item:text-white transition-all">
                                                            {activity.type === 'DIAlux' ? <Monitor size={16} /> : activity.type === 'Job' ? <FileText size={16} /> : <StreetLightIcon size={16} />}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex justify-between items-start mb-0.5">
                                                                <h5 className="font-bold text-gray-900 text-sm truncate">{activity.projectName || activity.siteName || "Unnamed Project"}</h5>
                                                                <span className="text-[8px] font-black text-gray-300 uppercase shrink-0 mt-1">NEW</span>
                                                            </div>
                                                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tight">{activity.type} Request • {activity.status || 'Pending'}</p>
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                        <button className="w-full mt-8 py-4 bg-gray-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-[#E33636] transition-colors shadow-lg">
                                            Export Summary
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </main>

                    <button className="fixed bottom-8 right-8 size-14 bg-[#E33636] text-white rounded-full shadow-2xl flex items-center justify-center active:scale-90 transition-all z-50">
                        <Plus size={24} strokeWidth={3} />
                    </button>
                </SidebarInset>
            </SidebarProvider>
            <style jsx global>{`.no-scrollbar::-webkit-scrollbar { display: none; } .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }`}</style>
        </ProtectedPageWrapper>
    )
}

function ActivityCard({ label, value, icon: Icon, isAlert }: { label: string, value: number, icon?: any, isAlert?: boolean }) {
    return (
        <div className={cn("bg-white p-4 rounded-2xl shadow-sm border flex flex-col gap-1 min-h-[100px] relative overflow-hidden transition-all", isAlert ? "border-red-200 ring-1 ring-red-50" : "border-gray-100")}>
            <p className={cn("text-[10px] font-bold uppercase tracking-tight", isAlert ? "text-red-500" : "text-gray-400")}>{label}</p>
            <p className={cn("text-3xl font-black text-gray-900", isAlert && "text-red-600")}>{value}</p>
            <div className="absolute bottom-2 right-2 opacity-10">
                {Icon ? <Icon size={32} /> : null}
            </div>
        </div>
    )
}