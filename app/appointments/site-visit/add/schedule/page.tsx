"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useAppointmentData } from "../layout"
import { AppSidebar } from "@/components/app-sidebar"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { 
  Paperclip, Send, ChevronLeft, Layers, Loader2,
  ShieldCheck, X, User, ChevronRight,
  ShieldAlert, Fingerprint, ClipboardList, MapPin, 
  Activity, Info, Globe, CalendarSearch,
  User2, Sparkles, Search, Check, ChevronDown,
  HardHat, ClipboardCheck, FlaskConical
} from "lucide-react"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import { Skeleton } from "@/components/ui/skeleton"
import { useDebounce } from "@/hooks/use-debounce"

import {
  getAppointmentSupabaseClient,
  toSupabaseTimestamp,
  getSiteVisitProtocols,
  siteVisitPicMatches,
  type SiteVisitPicOption,
  type SiteVisitUser,
} from "@/lib/appointment-supabase"

import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { sendNotificationToHierarchy, NotificationTemplates } from "@/lib/notification-service"
import { getNextSiteVisitNumber } from "@/lib/site-visit-counter"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { PageHeader } from "@/components/page-header"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"

function normalizeAccountValue(value: unknown): string {
  const text = Array.isArray(value)
    ? value.map(item => typeof item === "string" ? item.trim() : "").filter(Boolean).join(", ")
    : typeof value === "string"
      ? value.trim()
      : "";

  return ["EMPTY_STRING", "NULL", "N/A", "NONE", "-"].includes(text.toUpperCase()) ? "" : text;
}

type SiteVisitAccountContact = {
  name: string;
  designation: string;
  email: string;
  number: string;
};

function accountContactValues(value: unknown): string[] {
  const values = Array.isArray(value)
    ? value.flatMap(item => typeof item === "string" ? item.split(",") : [])
    : typeof value === "string"
      ? value.split(",")
      : [];

  return values.map(item => normalizeAccountValue(item));
}

function getAccountContacts(account: Record<string, unknown>): SiteVisitAccountContact[] {
  const names = accountContactValues(account.contact_person ?? account.contactperson);
  const designations = accountContactValues(account.designation);
  const emails = accountContactValues(account.email_address ?? account.emailaddress);
  const numbers = accountContactValues(account.contact_number ?? account.contactnumber);
  const count = Math.max(names.length, designations.length, emails.length, numbers.length);

  return Array.from({ length: count }, (_, index) => ({
    name: names[index] || "",
    designation: designations[index] || "",
    email: emails[index] || "",
    number: numbers[index] || "",
  })).filter(contact => contact.name || contact.designation || contact.email || contact.number);
}

function selectedContactValues(
  contacts: SiteVisitAccountContact[],
  selectedIndexes: number[],
  key: keyof SiteVisitAccountContact
): string {
  return selectedIndexes
    .map(index => contacts[index]?.[key] || "")
    .join(", ");
}

export default function SchedulePage() {
  const router = useRouter();
  const [userId, setUserId] = React.useState<string>("");

  // CUSTOMER DATABASE STATES
  const [userDetails, setUserDetails] = React.useState<any>(null);
  const [accounts, setAccounts] = React.useState<any[]>([]);
  const [totalAccounts, setTotalAccounts] = React.useState(0);
  const [loadingAccounts, setLoadingAccounts] = React.useState(false);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [hasMore, setHasMore] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [loadingUser, setLoadingUser] = React.useState(true);
  const [openCustomer, setOpenCustomer] = React.useState(false);
  const [isCustomerSelected, setIsCustomerSelected] = React.useState(false);
  const [accountContacts, setAccountContacts] = React.useState<SiteVisitAccountContact[]>([]);
  const [selectedContactIndexes, setSelectedContactIndexes] = React.useState<number[]>([]);
  const [isTestMode, setIsTestMode] = React.useState(false);

  // Pre-calculate memoized accounts for better responsiveness
  const memoizedAccounts = React.useMemo(() => accounts, [accounts]);

  const isInitialLoading = loadingUser;

  // Use debounce for search to prevent too many API calls
  const debouncedSearch = useDebounce(searchQuery, 500);

  React.useEffect(() => {
    setUserId(localStorage.getItem("userId") || "");
    setIsTestMode(localStorage.getItem("testMode") === "true");
  }, []);

  // Keyboard shortcut: Ctrl+Shift+M to toggle test mode (M for "mode")
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "m") {
        e.preventDefault();
        toggleTestMode();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isTestMode]);

  const toggleTestMode = () => {
    const newMode = !isTestMode;
    setIsTestMode(newMode);
    localStorage.setItem("testMode", newMode.toString());
    toast.info(
      newMode 
        ? "🔧 Test mode enabled - Site visit number will have TEST- prefix" 
        : "✅ Test mode disabled - Using production site visit number",
      { duration: 3000 }
    );
  };

  // FETCH USER DETAILS
  React.useEffect(() => {
    if (!userId) return;

    const fetchUserData = async () => {
      setLoadingUser(true);
      try {
        const response = await fetch(`/api/user?id=${encodeURIComponent(userId)}`);
        if (!response.ok) throw new Error("Failed to fetch user data");
        const data = await response.json();
        
        setUserDetails({
          referenceid: data.ReferenceID || "",
          tsm: data.TSM || "",
          manager: data.Manager || "",
          department: data.Department || data.department || "",
          role: data.Role || data.role || "MEMBER",
          name: `${data.Firstname || ""} ${data.Lastname || ""}`.trim()
        });
      } catch (err) {
        console.error("USER_FETCH_ERROR", err);
      } finally {
        setLoadingUser(false);
      }
    };

    fetchUserData();
  }, [userId]);

  // FETCH ACCOUNTS WITH PAGINATION & SEARCH
  const fetchAccounts = React.useCallback(async (offset = 0, search = "") => {
    if (!userDetails?.referenceid && userDetails?.department !== "IT") return;
    
    if (offset === 0) setLoadingAccounts(true);
    else setLoadingMore(true);

    try {
      const params = new URLSearchParams({
        referenceid: userDetails.referenceid,
        role: userDetails.role,
        name: userDetails.name,
        department: userDetails.department,
        search: search,
        offset: offset.toString(),
        limit: "50"
      });
      
      const response = await fetch(`/api/com-fetch-cluster-account?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch accounts");
      const result = await response.json();
      
      if (offset === 0) {
        setAccounts(result.data || []);
      } else {
        setAccounts(prev => [...prev, ...(result.data || [])]);
      }
      
      setTotalAccounts(result.total || 0);
      setHasMore(result.hasMore);
    } catch (err) {
      console.error("ACCOUNTS_FETCH_ERROR", err);
    } finally {
      setLoadingAccounts(false);
      setLoadingMore(false);
    }
  }, [userDetails]);

  React.useEffect(() => {
    fetchAccounts(0, debouncedSearch);
  }, [fetchAccounts, debouncedSearch]);

  const loadMoreAccounts = () => {
    if (!loadingMore && hasMore) {
      fetchAccounts(accounts.length, debouncedSearch);
    }
  };
  
  // 1. EXTRACT HYDRATION & PERSISTED DATA
  const { 
    selectedAssistance, 
    personnel,
    ppe,
    permits,
    isHydrated,
    resetForm 
  } = useAppointmentData();
  
  const today = React.useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  
  const [viewDate, setViewDate] = React.useState(new Date(today.getFullYear(), today.getMonth(), 1)); 
  const [selectedDate, setSelectedDate] = React.useState<number | null>(null);
  const [viewingDetails, setViewingDetails] = React.useState<any | null>(null);
  
  const [assignedPics, setAssignedPics] = React.useState<SiteVisitPicOption[]>([]);
  const [protocolMetadata, setProtocolMetadata] = React.useState<any[]>([]); 
  const [selectedPic, setSelectedPic] = React.useState<string>("UNASSIGNED"); 
  const [isLoadingSync, setIsLoadingSync] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [attachedFile, setAttachedFile] = React.useState<File | null>(null);
  const [allAppointments, setAllAppointments] = React.useState<any[]>([]);
  const [allBlockedSlots, setAllBlockedSlots] = React.useState<any[]>([]);

  const [formData, setFormData] = React.useState({ 
    client: "", 
    contactPerson: "",
    email: "",
    contactNumber: "",
    address: "", 
    region: "",
    agenda: "",
    notes: "", 
    tsa: "NOT_SET", 
    tsm: "NOT_SET"  
  });

  // 2. PROTOCOL & PIC SYNC
  React.useEffect(() => {
    if (!isHydrated) return;

    const activeProtocols = selectedAssistance || [];
    if (activeProtocols.length === 0) {
      setIsLoadingSync(false);
      return;
    }

    const fetchProtocols = async () => {
      const [dbProtocols, usersResponse] = await Promise.all([
        getSiteVisitProtocols(true),
        fetch("/api/user"),
      ]);
      if (!usersResponse.ok) throw new Error(`Engineer lookup failed (${usersResponse.status})`);
      const users: SiteVisitUser[] = await usersResponse.json();
      if (!Array.isArray(users)) throw new Error("Engineer lookup returned an invalid response");

      const matched = dbProtocols.filter((proto: any) => activeProtocols.includes(proto.id));
      setProtocolMetadata(matched);
      
      const picOptions = users
        .filter((user) =>
          Boolean(user.engiconnect_role?.trim()) &&
          user.Department?.trim().toUpperCase() === "ENGINEERING" &&
          user.Status?.trim().toUpperCase() === "ACTIVE" &&
          Boolean(user.ReferenceID?.trim())
        )
        .map((user) => ({
          referenceId: user.ReferenceID?.trim() || "",
          name: `${user.Firstname || ""} ${user.Lastname || ""}`.trim(),
        }))
        .filter((pic) => pic.referenceId && pic.name);

      setAssignedPics(picOptions);
      
      setIsLoadingSync(false);
    };
    fetchProtocols().catch((error) => {
      console.error("PROTOCOL_SYNC_ERROR", error);
      setIsLoadingSync(false);
    });
  }, [selectedAssistance, isHydrated]);

  // 3. CALENDAR DATA — only subscribe when we have PICs and a valid month
  React.useEffect(() => {
    if (!isHydrated || assignedPics.length === 0) {
      setAllAppointments([]);
      return;
    }

    const startOfMonth = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1, 0, 0, 0);
    const endOfMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0, 23, 59, 59);
    
    // Limit to the visible PIC set for the Supabase query.
    const supabase = getAppointmentSupabaseClient();

    const fetchAppointments = async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("id,appointment_date,pic,client,agenda,status")
        .gte("appointment_date", startOfMonth.toISOString())
        .lte("appointment_date", endOfMonth.toISOString());

      if (error) {
        console.error("UPLINK_SYNC_ERROR", error);
        setAllAppointments([]);
        return;
      }

      setAllAppointments((data || [])
        .filter((row) => assignedPics.some((pic) => siteVisitPicMatches(row.pic, pic)))
        .map((row) => {
        const date = new Date(row.appointment_date);
        return {
          id: row.id,
          day: date.getDate(),
          month: date.getMonth(),
          year: date.getFullYear(),
          pic: row.pic,
          client: row.client,
          agenda: row.agenda || "Standard Operational Deployment",
          status: row.status,
        };
      }));
    };

    fetchAppointments();
    const channel = supabase
      .channel(`site-visit-calendar-${viewDate.getTime()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "appointments" }, fetchAppointments)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [assignedPics, viewDate, isHydrated]);

  // 4. BLOCKED SLOTS — only subscribe when we have PICs
  React.useEffect(() => {
    if (!isHydrated || assignedPics.length === 0) {
      setAllBlockedSlots([]);
      return;
    }
    // Blocked-slot records remain in the legacy Firebase collection.
    // Supabase appointment scheduling is authoritative; do not use a denied
    // Firestore listener as a hard dependency.
    setAllBlockedSlots([]);
  }, [assignedPics, isHydrated]);

  // DERIVED DATA FOR CURRENT SELECTION
  const getDayAvailability = React.useMemo(() => {
    return (dayNum: number, month: number, year: number) => {
      if (assignedPics.length === 0) return { available: 0, total: 0, isGlobal: false, globalReason: "" };

      const total = assignedPics.length;
      
      // Global Blocking check
      const globalBlock = allBlockedSlots.find(s => 
        (!s.userName || s.userName === "ALL_STAFF" || s.userName === "GLOBAL" || s.userName === "ALL") && 
        s.day === dayNum && s.month === month && s.year === year
      );
      
      if (globalBlock && globalBlock.shiftScope === "FULL_DAY") {
        return { available: 0, total, isGlobal: true, globalReason: globalBlock.justification };
      }

      const busyPics = new Set<string>();

      // Check appointments
      allAppointments.forEach(a => {
        if (a.day === dayNum && a.month === month && a.year === year) {
          assignedPics.forEach((pic) => {
            if (siteVisitPicMatches(a.pic, pic)) busyPics.add(pic.referenceId);
          });
        }
      });

      // Check personal blocks
      allBlockedSlots.forEach(s => {
        if (s.day === dayNum && s.month === month && s.year === year && s.shiftScope === "FULL_DAY") {
          assignedPics.forEach((pic) => {
            if (pic.name.trim().toLowerCase() === String(s.userName || "").trim().toLowerCase()) {
              busyPics.add(pic.referenceId);
            }
          });
        }
      });

      return { 
        available: Math.max(0, total - busyPics.size), 
        total, 
        isGlobal: !!globalBlock,
        globalReason: globalBlock?.justification || ""
      };
    };
  }, [allAppointments, allBlockedSlots, assignedPics]);

  // TSA/TSM metadata updates
  React.useEffect(() => {
    if (assignedPics.length === 0 || !isHydrated) {
       setFormData(prev => ({ ...prev, tsa: "NOT_SET", tsm: "NOT_SET" }));
       return;
    }
    // Since we don't have a single PIC anymore, we can take the TSA/TSM from the first matched protocol
    if (protocolMetadata.length > 0) {
      setFormData(prev => ({ 
        ...prev, 
        tsa: protocolMetadata[0].tsa || "NOT_SET", 
        tsm: protocolMetadata[0].tsm || "NOT_SET" 
      }));
    }
  }, [protocolMetadata, assignedPics, isHydrated]);

  if (!isHydrated || isInitialLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#F9FAFA] p-8 space-y-8">
        <div className="w-full max-w-6xl space-y-8 animate-pulse">
          {/* Header Skeleton */}
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-8 w-64 bg-zinc-200 rounded-lg" />
              <Skeleton className="h-4 w-48 bg-zinc-100 rounded-lg" />
            </div>
            <Skeleton className="h-10 w-32 bg-zinc-200 rounded-xl" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Sidebar Skeleton */}
            <div className="lg:col-span-3 space-y-4">
              <Skeleton className="h-[400px] w-full bg-zinc-100 rounded-[24px]" />
              <Skeleton className="h-20 w-full bg-zinc-100 rounded-[24px]" />
            </div>

            {/* Main Content Skeleton */}
            <div className="lg:col-span-9 space-y-6">
              <div className="bg-white border border-zinc-200/60 rounded-[24px] p-6 space-y-8">
                <div className="space-y-4">
                  <Skeleton className="h-6 w-48 bg-zinc-200 rounded-lg" />
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Skeleton className="h-12 w-full bg-zinc-50 rounded-xl" />
                    <Skeleton className="h-12 w-full bg-zinc-50 rounded-xl" />
                    <Skeleton className="h-12 w-full bg-zinc-50 rounded-xl" />
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-zinc-50">
                  <Skeleton className="h-6 w-48 bg-zinc-200 rounded-lg" />
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Skeleton className="h-12 w-full bg-zinc-50 rounded-xl" />
                    <Skeleton className="h-12 w-full bg-zinc-50 rounded-xl" />
                    <Skeleton className="h-12 w-full bg-zinc-50 rounded-xl" />
                    <Skeleton className="h-12 w-full bg-zinc-50 rounded-xl" />
                  </div>
                </div>

                <div className="pt-4 border-t border-zinc-50">
                  <Skeleton className="h-32 w-full bg-zinc-50 rounded-xl" />
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-center">
          <Loader2 className="size-6 animate-spin text-zinc-300 mb-2" />
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-zinc-400 italic">
            {isInitialLoading ? "Syncing_Database..." : "Initializing_Systems..."}
          </p>
        </div>
      </div>
    );
  }

  const isComplete = Boolean(
    formData.client.trim() &&
    formData.address.trim() &&
    selectedDate !== null
  );
  const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay();
  const monthLabel = viewDate.toLocaleString('default', { month: 'long', year: 'numeric' }).toUpperCase();

  const handleMonthChange = (offset: number) => {
    const newMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + offset, 1);
    if (newMonth < new Date(today.getFullYear(), today.getMonth(), 1)) return;
    setViewDate(newMonth);
    setSelectedDate(null);
  };

  const updateIncludedContacts = (indexes: number[]) => {
    setSelectedContactIndexes(indexes);
    setFormData(prev => ({
      ...prev,
      contactPerson: selectedContactValues(accountContacts, indexes, "name"),
      email: selectedContactValues(accountContacts, indexes, "email"),
      contactNumber: selectedContactValues(accountContacts, indexes, "number"),
    }));
  };

  const toggleAccountContact = (index: number) => {
    const nextIndexes = selectedContactIndexes.includes(index)
      ? selectedContactIndexes.filter(selectedIndex => selectedIndex !== index)
      : [...selectedContactIndexes, index].sort((first, second) => first - second);
    updateIncludedContacts(nextIndexes);
  };

  const toggleAllAccountContacts = () => {
    updateIncludedContacts(
      selectedContactIndexes.length === accountContacts.length
        ? []
        : accountContacts.map((_, index) => index)
    );
  };

  const handlePicChange = (name: string) => {
    setSelectedPic(name);
    setSelectedDate(null);
  };

  const handleDirectUpload = async (file: File) => {
    const data = new FormData();
    data.append("file", file);
    data.append("upload_preset", "Xchire"); 

    try {
      const res = await fetch("https://api.cloudinary.com/v1_1/dhczsyzcz/image/upload", {
        method: "POST",
        body: data,
      });
      const json = await res.json();
      return json.secure_url;
    } catch (error) {
      console.error(`Cloudinary Error: ${error}`);
      return null;
    }
  };

  const handleSubmitProtocol = async () => {
    if (isSubmitting) return;
    const currentUserId = localStorage.getItem("userId");
    const submittedBy = userDetails?.referenceid?.trim();
    if (!currentUserId) {
      toast.error("Could not identify your account. Please sign in again.");
      return;
    }
    if (!submittedBy) {
      toast.error("Your Supabase ReferenceID is missing. Please contact support.");
      return;
    }

    setIsSubmitting(true);
    const toastId = toast.loading("SYNCHRONIZING OPERATIONAL DATA...");
    
    try {
      let fileUrl = "";
      if (attachedFile) {
        fileUrl = await handleDirectUpload(attachedFile);
        if (!fileUrl) throw new Error("Upload failed");
      }
      
      // Generate unique site visit number
      const isTestMode = localStorage.getItem("testMode") === "true";
      const siteVisitNo = await getNextSiteVisitNumber(isTestMode);
      
      const appointmentDateObj = new Date(viewDate.getFullYear(), viewDate.getMonth(), selectedDate as number);
      
      const supabase = getAppointmentSupabaseClient();
      const appointmentId =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

      const { error: insertError } = await supabase.from("appointments").insert({
        id: appointmentId,
        site_visit_no: siteVisitNo,
        client: formData.client,
        contact_person: formData.contactPerson,
        designation: selectedContactValues(accountContacts, selectedContactIndexes, "designation"),
        email: formData.email,
        contact_number: formData.contactNumber,
        requestor_phone: formData.contactNumber,
        address: formData.address,
        street: "",
        landmark: "",
        region: formData.region,
        province: "",
        city: "",
        barangay: "",
        agenda: formData.agenda,
        notes: formData.notes,
        tsa: formData.tsa,
        tsm: formData.tsm,
        pic: "UNASSIGNED",
        protocols: selectedAssistance || [],
        personnel: personnel || [],
        ppe: ppe || [],
        permits: permits || [],
        appointment_date: toSupabaseTimestamp(appointmentDateObj),
        coordinates: null,
        file_url: fileUrl,
        status: "PENDING",
        department: "ENGINEERING",
        submitted_by: submittedBy,
        submitted_by_name: userDetails?.name || null,
        tsm_name: null,
        sales_head: userDetails?.manager || null,
        pending_at: new Date().toISOString(),
        pending_by: userDetails?.name || submittedBy,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      if (insertError) throw insertError;

      // Reset context state and clear local storage after successful submission
      resetForm();

      toast.success("DEPLOYMENT INITIALIZED", { id: toastId });

      // Send push notification to hierarchy
      const notifResult = await sendNotificationToHierarchy(
        NotificationTemplates.siteVisit.created(formData.client, selectedDate ? selectedDate.toString() : "scheduled date"),
        currentUserId || "",
        { triggeredBy: currentUserId || "" }
      );
      if (notifResult.success) {
        console.log(`Push notification: ${notifResult.message}`);
      }

      setTimeout(() => router.push("/appointments/site-visit"), 1500); 
    } catch (error) {
      console.error("SITE_VISIT_SUBMISSION_ERROR", error);
      const message = error instanceof Error
        ? error.message
        : "Could not schedule the site visit. Please try again.";
      toast.error(`DEPLOYMENT FAILURE: ${message}`, { id: toastId });
    } finally { setIsSubmitting(false); }
  };

  return (
    <>
      <AppSidebar userId={userId} />
      <SidebarInset className="bg-[#F9FAFA] min-h-screen lg:h-screen lg:overflow-hidden flex flex-col m-0 rounded-none border-none shadow-none">
        
        {/* CONFLICT MODAL */}
        {viewingDetails && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#121212]/80 backdrop-blur-sm">
            <div className="bg-white border border-black/10 w-full max-w-md rounded-2xl overflow-hidden shadow-2xl">
              <div className="bg-[#121212] p-5 flex justify-between items-center text-white">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2">
                  {viewingDetails.isGlobal ? <ShieldAlert className="size-4 text-red-500 animate-pulse" /> : <ShieldAlert className="size-4 text-amber-500" />}
                  {viewingDetails.isBlock ? (viewingDetails.isGlobal ? "Service-Wide Blocking" : "Personnel Unavailable") : "Conflict Detected"}
                </span>
                <button onClick={() => setViewingDetails(null)} className="p-1 hover:bg-white/10 rounded-full transition-colors"><X className="size-4" /></button>
              </div>
              <div className="p-6 space-y-5">
                <div className="flex items-center gap-4 p-4 bg-[#F9FAFA] border border-black/5 rounded-2xl">
                  {viewingDetails.isGlobal ? (
                    <Globe className="size-8 text-red-600" />
                  ) : (
                    <Fingerprint className="size-8 text-black/40" />
                  )}
                  <div>
                    <p className="text-[10px] font-black text-black/40 uppercase tracking-widest leading-none mb-1">
                      {viewingDetails.isGlobal ? "System Constraint" : "Capacity Alert"}
                    </p>
                    <p className="text-sm font-black uppercase tracking-tight">
                      {viewingDetails.isGlobal ? "Operational Lockdown" : "Full Capacity"}
                    </p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="p-4 border border-black/5 rounded-xl bg-zinc-50/50">
                    <span className="block text-[8px] font-black text-black/30 uppercase tracking-[0.2em] mb-1.5">{viewingDetails.isBlock ? "Constraint Type" : "Entity"}</span>
                    <p className="text-xs font-black uppercase tracking-tight">{viewingDetails.client}</p>
                  </div>
                  <div className="p-4 border border-black/5 rounded-xl bg-amber-50/30">
                    <span className="block text-[8px] font-black text-black/30 uppercase tracking-[0.2em] mb-1.5">{viewingDetails.isBlock ? "Reason / Justification" : "Scope"}</span>
                    <p className="text-xs font-bold italic text-zinc-600 leading-relaxed">"{viewingDetails.agenda}"</p>
                  </div>
                </div>
                <Button onClick={() => setViewingDetails(null)} className="w-full h-12 bg-[#121212] text-white font-black uppercase text-[10px] tracking-[0.2em] rounded-xl hover:bg-black transition-all shadow-xl shadow-zinc-200">
                  {viewingDetails.isGlobal ? "Acknowledge Service Block" : "Acknowledge Constraint"}
                </Button>
              </div>
            </div>
          </div>
        )}

        <PageHeader 
          title="DEPLOYMENT SCHEDULER" 
          version="V3.0" 
          showBackButton={true}
          trigger={<SidebarTrigger className="mr-2" />}
          actions={
            <div className="flex items-center gap-2">
              <Button
                variant={isTestMode ? "default" : "outline"}
                size="sm"
                onClick={toggleTestMode}
                className={cn(
                  "h-8 px-3 text-[10px] font-bold uppercase tracking-wider gap-1.5 transition-all",
                  isTestMode 
                    ? "bg-amber-500 hover:bg-amber-600 text-white border-amber-500" 
                    : "border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                )}
                title="Toggle test mode (Ctrl+Shift+M)"
              >
                <FlaskConical className="size-3.5" />
                <span className="hidden sm:inline">{isTestMode ? "Test Mode" : "Test"}</span>
                <span className="sm:hidden">{isTestMode ? "ON" : "OFF"}</span>
              </Button>
              <div className="hidden sm:flex items-center gap-1.5">
                {protocolMetadata?.slice(0, 1).map((item: any, idx: number) => (
                  <div key={idx} className="px-2.5 py-1 bg-zinc-900 text-white rounded-lg text-[7px] font-black uppercase tracking-[0.15em] border border-zinc-800 shadow-sm">
                    {item.label}
                  </div>
                ))}
                <div className="px-2.5 py-1 bg-white border border-zinc-200 rounded-lg text-[7px] font-black uppercase tracking-[0.15em] flex items-center gap-1.5 shadow-sm">
                  <div className="size-1 rounded-full bg-emerald-500 animate-pulse" /> Live Sync
                </div>
              </div>
              <div className="flex items-center bg-zinc-100 p-0.5 rounded-lg border border-zinc-200/50">
                <div className="px-2 py-0.5 bg-white rounded-md shadow-sm text-[7px] font-black text-zinc-900 uppercase tracking-tighter">Step 2</div>
                <div className="px-2 py-0.5 text-[7px] font-black text-zinc-400 uppercase tracking-tighter">of 3</div>
              </div>
            </div>
          }
        />

        <main className="p-2 md:p-3 max-w-[1600px] mx-auto w-full flex-1 flex flex-col lg:grid lg:grid-cols-12 gap-3 lg:overflow-hidden min-h-0">
          
          {/* STEP 1: CALENDAR SELECTION (1/4 WIDTH) */}
          <div className="lg:col-span-3 flex flex-col min-w-0 h-full overflow-hidden">
            <section className="bg-white border border-zinc-200/60 rounded-[24px] p-3 shadow-sm h-full flex flex-col bg-zinc-50/20">
              {isLoadingSync ? (
                <div className="flex flex-col items-center justify-center flex-1 space-y-4 text-center">
                  <Loader2 className="size-10 text-zinc-200 animate-spin" />
                  <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-900">Synchronizing...</h4>
                </div>
              ) : (
                <div className="animate-in fade-in slide-in-from-right-4 duration-500 flex flex-col h-full overflow-hidden">
                  <div className="flex items-center justify-between border-b border-zinc-50 pb-2 mb-2 shrink-0">
                    <div className="flex items-center gap-2">
                      <div className="size-7 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/10">
                        <CalendarSearch size={14} />
                      </div>
                      <div>
                        <h3 className="text-[10px] font-black text-zinc-900 uppercase tracking-tight flex items-center gap-2">
                          Pick Date
                        </h3>
                        <p className="text-[6px] font-bold text-zinc-400 uppercase tracking-[0.2em] leading-none mt-0.5">{monthLabel}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 bg-zinc-50 p-0.5 rounded-lg border border-zinc-100">
                      <Button variant="ghost" size="sm" onClick={() => handleMonthChange(-1)} disabled={viewDate.getMonth() === today.getMonth()} className="h-6 w-6 p-0 rounded-md hover:bg-white hover:shadow-xs transition-all"><ChevronLeft className="size-3" /></Button>
                      <div className="w-px h-2 bg-zinc-200" />
                      <Button variant="ghost" size="sm" onClick={() => handleMonthChange(1)} className="h-6 w-6 p-0 rounded-md hover:bg-white hover:shadow-xs transition-all"><ChevronRight className="size-3" /></Button>
                    </div>
                  </div>
                  
                  {/* CALENDAR GRID - PREVENT STRETCHING */}
                  <div className="flex-1 flex flex-col min-h-0">
                    <div className="grid grid-cols-7 gap-1 mb-1.5 shrink-0">
                      {['S','M','T','W','T','F','S'].map((d, idx) => (
                        <div key={idx} className="text-center text-[6px] font-black text-zinc-300 py-0.5 uppercase tracking-widest">{d}</div>
                      ))}
                    </div>
                    <div className="grid grid-cols-7 gap-1 content-start auto-rows-fr overflow-y-auto pr-0.5 scrollbar-hide lg:grid-rows-6">
                      {Array.from({ length: firstDayOfMonth }).map((_, i) => ( <div key={`pad-${i}`} className="w-full h-full lg:min-h-[40px]" /> ))}
                      {Array.from({length: daysInMonth}).map((_, i) => {
                        const dayNum = i + 1;
                        const dateObj = new Date(viewDate.getFullYear(), viewDate.getMonth(), dayNum);
                        const isPast = dateObj < today;
                        const isToday = dayNum === today.getDate() && viewDate.getMonth() === today.getMonth() && viewDate.getFullYear() === today.getFullYear();
                        const isPastOrToday = isPast || isToday;
                        
                        const availability = getDayAvailability(dayNum, viewDate.getMonth(), viewDate.getFullYear());
                        const isBusy = availability.available === 0 && !availability.isGlobal && !isPastOrToday;
                        const isPartial = availability.available > 0 && availability.available < availability.total && !isPastOrToday;
                        const isBlocked = availability.isGlobal;
                        const isGlobal = availability.isGlobal;

                        return (
                          <button 
                            key={i} 
                            onClick={() => {
                              if (isBusy || isBlocked) setViewingDetails({ 
                                client: isGlobal ? "SERVICE UNAVAILABLE" : "FULL CAPACITY", 
                                agenda: availability.globalReason || "All personnel slots are currently booked for this date.", 
                                isBlock: true,
                                isGlobal: isGlobal
                              });
                              else if (!isPastOrToday) setSelectedDate(dayNum);
                            }}
                            disabled={isPastOrToday || (isBlocked && availability.available === 0)} 
                            className={cn(
                              "w-full h-full lg:min-h-[48px] flex flex-col items-center justify-center transition-all relative rounded-xl border group overflow-hidden p-0.5", 
                              selectedDate === dayNum ? "bg-zinc-900 border-zinc-900 shadow-xl z-10 scale-[1.02]" : 
                              isPastOrToday ? "bg-zinc-50/30 border-transparent cursor-not-allowed opacity-30" : 
                              isBusy ? "bg-red-50 border-red-100 hover:bg-red-100/80" : 
                              isPartial ? "bg-amber-50 border-amber-100 hover:bg-amber-100/80" :
                              isGlobal ? "bg-zinc-900 border-zinc-900 opacity-90 shadow-lg" :
                              isToday ? "bg-blue-50 border-blue-200 hover:border-blue-300" :
                              "bg-white border-zinc-100 hover:border-zinc-300 hover:bg-zinc-50 shadow-sm"
                            )}
                          >
                            <span className={cn(
                              "text-xs font-black tracking-tight leading-none transition-transform group-hover:scale-110",
                              selectedDate === dayNum ? "text-white" : 
                              isPastOrToday ? "text-zinc-300" :
                              isBusy ? "text-red-600" :
                              isPartial ? "text-amber-600" :
                              isToday ? "text-blue-600" :
                              "text-zinc-900"
                            )}>
                              {dayNum}
                            </span>
                            
                            {!isPastOrToday && (
                              <div className={cn(
                                "mt-1 px-1.5 py-0.5 rounded-full text-[7px] font-black uppercase tracking-tighter flex items-center gap-0.5 transition-all shrink-0",
                                selectedDate === dayNum ? "bg-white text-zinc-900" : 
                                isBusy ? "bg-red-500 text-white shadow-md shadow-red-500/10" :
                                isPartial ? "bg-amber-500 text-white shadow-md shadow-amber-500/10" :
                                "bg-emerald-500 text-white shadow-md shadow-emerald-500/10"
                              )}>
                                <span>{availability.available}</span>
                                <span className="opacity-30">/</span>
                                <span>{availability.total}</span>
                              </div>
                            )}

                            {isToday && !selectedDate && (
                              <div className="absolute top-1 right-1 size-1 rounded-full bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.5)]" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mt-2 pt-2 border-t border-zinc-50 flex items-center justify-between shrink-0">
                    <div className="flex gap-2">
                      <div className="flex items-center gap-1">
                        <div className="size-1.5 rounded-full bg-red-500" />
                        <span className="text-[7px] font-black uppercase text-zinc-400 tracking-widest">Full</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="size-1.5 rounded-full bg-amber-500" />
                        <span className="text-[7px] font-black uppercase text-zinc-400 tracking-widest">Part</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="size-1.5 rounded-full bg-emerald-500" />
                        <span className="text-[7px] font-black uppercase text-zinc-400 tracking-widest">Free</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 px-2 py-1 bg-zinc-900 rounded-lg shadow-lg shadow-zinc-200">
                      <span className="text-[7px] font-black text-white/40 uppercase tracking-widest leading-none">KPI</span>
                      <span className="text-[8px] font-black uppercase text-white leading-none tracking-tight">{formData.tsa}/{formData.tsm}</span>
                    </div>
                  </div>
                </div>
              )}
            </section>
          </div>

          {/* STEP 2: VISIT DETAILS (3/4 WIDTH) */}
          <div className="lg:col-span-9 flex flex-col gap-3 min-w-0 h-full overflow-hidden">
            <div className="bg-white border border-zinc-200/60 rounded-[24px] shadow-sm overflow-hidden divide-y divide-zinc-50 flex-1 flex flex-col min-h-0">
              {/* VISIT PURPOSE SECTION */}
              <div className="p-3 md:p-4 space-y-2 shrink-0">
                  <div className="flex items-center justify-between border-b border-zinc-50 pb-1.5">
                    <div className="flex items-center gap-2">
                      <div className="size-5 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600 shadow-sm border border-blue-100">
                        <ClipboardList size={12} />
                      </div>
                      <div>
                        <h3 className="text-[11px] font-black uppercase tracking-tight text-zinc-900 leading-none">Deployment Details</h3>
                        <p className="text-[6px] font-bold text-zinc-400 uppercase tracking-widest mt-0.5 leading-none">Primary Engagement Information</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {isCustomerSelected && (
                        <button 
                          onClick={() => {
                            setAccountContacts([]);
                            setSelectedContactIndexes([]);
                            setFormData(prev => ({
                              ...prev,
                              client: "",
                              contactPerson: "",
                              email: "",
                              contactNumber: "",
                              address: "",
                              region: "",
                            }));
                            setIsCustomerSelected(false);
                          }}
                          className="h-6 px-2 text-[7px] font-black uppercase bg-red-50 text-red-600 border border-red-100 rounded-full hover:bg-red-100 transition-all active:scale-95 flex items-center gap-1"
                        >
                          <X size={8} />
                          Clear Selection
                        </button>
                      )}
                      <div className="flex items-center gap-1 px-2 py-0.5 bg-zinc-100 rounded-full border border-zinc-200">
                        <span className="text-[7px] font-black uppercase text-zinc-400 tracking-widest">Total Customers:</span>
                        {loadingAccounts ? (
                          <Loader2 className="size-2 animate-spin text-zinc-400 ml-1" />
                        ) : (
                          <span className="text-[8px] font-black text-zinc-900 ml-1">{totalAccounts}</span>
                        )}
                      </div>
                    </div>
                  </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  <div className="relative group">
                    <Popover open={openCustomer} onOpenChange={setOpenCustomer}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={openCustomer}
                          className={cn(
                            "w-full justify-between rounded-xl border-zinc-100 text-[11px] font-black uppercase h-9 bg-zinc-50/50 hover:bg-white focus:bg-white focus:ring-2 focus:ring-zinc-900 px-3 shadow-inner pt-3.5 transition-all",
                            !formData.client && "text-zinc-400"
                          )}
                          disabled={loadingAccounts && accounts.length === 0}
                        >
                          <span className="truncate">
                            {loadingAccounts && accounts.length === 0 ? (
                              <span className="flex items-center gap-2">
                                <Loader2 className="size-3 animate-spin" />
                                Syncing Database...
                              </span>
                            ) : (
                              formData.client || "Select Client..."
                            )}
                          </span>
                          {!loadingAccounts && <ChevronDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[300px] p-0" align="start">
                        <Command shouldFilter={false}>
                          <CommandInput 
                            placeholder="Search client..." 
                            className="h-8 text-[11px]" 
                            value={searchQuery}
                            onValueChange={setSearchQuery}
                          />
                          <CommandList className="max-h-[300px] overflow-y-auto" onScroll={(e) => {
                            const target = e.currentTarget;
                            if (target.scrollHeight - target.scrollTop <= target.clientHeight + 1) {
                              loadMoreAccounts();
                            }
                          }}>
                            <CommandEmpty className="py-2 text-[10px] text-center">
                              {loadingAccounts ? "Searching..." : "No client found."}
                            </CommandEmpty>
                            <CommandGroup>
                              {memoizedAccounts.map((account) => (
                                <CommandItem
                                  key={account.id}
                                  value={account.company_name}
                                  onSelect={() => {
                                    const contacts = getAccountContacts(account);
                                    const contactIndexes = contacts.map((_, index) => index);
                                    const address = normalizeAccountValue(account.address) ||
                                      normalizeAccountValue(account.delivery_address);
                                    const region = normalizeAccountValue(account.region);
                                    
                                    setAccountContacts(contacts);
                                    setSelectedContactIndexes(contactIndexes);
                                    setFormData(prev => ({
                                      ...prev,
                                      client: normalizeAccountValue(account.company_name),
                                      contactPerson: selectedContactValues(contacts, contactIndexes, "name"),
                                      email: selectedContactValues(contacts, contactIndexes, "email"),
                                      contactNumber: selectedContactValues(contacts, contactIndexes, "number"),
                                      address,
                                      region,
                                    }));
                                    setIsCustomerSelected(true);
                                    setOpenCustomer(false);
                                  }}
                                  className="text-[10px] font-bold uppercase"
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-3 w-3",
                                      formData.client === account.company_name ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  {account.company_name}
                                </CommandItem>
                              ))}
                              {loadingMore && (
                                <div className="flex items-center justify-center py-2">
                                  <Loader2 className="h-3 w-3 animate-spin text-zinc-500" />
                                </div>
                              )}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <label className="absolute left-3 top-1 text-[7px] font-black uppercase text-zinc-400 tracking-widest transition-all group-focus-within:text-zinc-900 z-10">Client Name*</label>
                  </div>
                  <div className="relative group">
                    <Input className="rounded-xl border-zinc-100 text-[11px] font-black uppercase h-9 bg-zinc-50/50 focus:bg-white focus:ring-2 focus:ring-zinc-900 px-3 shadow-inner pt-3.5 transition-all" placeholder=" " value={formData.agenda} onChange={e => setFormData({...formData, agenda: e.target.value})} />
                    <label className="absolute left-3 top-1 text-[7px] font-black uppercase text-zinc-400 tracking-widest transition-all group-focus-within:text-zinc-900">Objective*</label>
                  </div>
                </div>
                <div className="space-y-2 border-t border-zinc-50 pt-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[8px] font-black uppercase text-zinc-400 tracking-widest">Account Contact(s)</span>
                    <div className="flex items-center gap-2">
                      {accountContacts.length > 0 && (
                        <>
                          <span className="text-[8px] font-semibold text-zinc-500">
                            {selectedContactIndexes.length} of {accountContacts.length} included
                          </span>
                          <button
                            type="button"
                            onClick={toggleAllAccountContacts}
                            className="text-[8px] font-black uppercase text-blue-600 hover:underline"
                          >
                            {selectedContactIndexes.length === accountContacts.length ? "Clear all" : "Select all"}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  {accountContacts.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {accountContacts.map((contact, index) => {
                        const isIncluded = selectedContactIndexes.includes(index);
                        return (
                          <article
                            key={`${contact.name}-${contact.email}-${index}`}
                            className={cn(
                              "rounded-xl border p-2.5 transition-colors",
                              isIncluded ? "border-emerald-200 bg-emerald-50/30" : "border-zinc-100 bg-zinc-50/40"
                            )}
                          >
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <span className="text-[7px] font-black uppercase tracking-widest text-emerald-700">Account Contact</span>
                              <label className="flex items-center gap-1.5 text-[8px] font-semibold text-zinc-600 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={isIncluded}
                                  onChange={() => toggleAccountContact(index)}
                                  aria-label={`Include ${contact.name || `contact ${index + 1}`}`}
                                  className="accent-emerald-600"
                                />
                                {isIncluded ? "Included" : "Not included"}
                              </label>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              {[
                                { label: "Contact person", value: contact.name },
                                { label: "Designation", value: contact.designation },
                                { label: "Email address", value: contact.email },
                                { label: "Contact number", value: contact.number },
                              ].map((field) => (
                                <div key={field.label} className="min-w-0">
                                  <span className="block text-[7px] font-black uppercase text-zinc-400">{field.label}</span>
                                  <span className="block truncate text-[10px] font-semibold text-zinc-700" title={field.value}>
                                    {field.value || "Not provided"}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="rounded-lg border border-dashed border-zinc-200 p-2.5 text-[9px] text-zinc-400">
                      {isCustomerSelected ? "No saved contact details are available for this account." : "Select a client to load its contact details."}
                    </p>
                  )}
                </div>
                <div className="relative group">
                  <Textarea className="rounded-xl border-zinc-100 text-[11px] font-black uppercase min-h-[50px] lg:min-h-[60px] lg:max-h-[80px] bg-zinc-50/50 focus:bg-white focus:ring-2 focus:ring-zinc-900 p-3 pt-4.5 resize-none leading-relaxed shadow-inner transition-all" placeholder=" " value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} />
                  <label className="absolute left-3 top-1 text-[7px] font-black uppercase text-zinc-400 tracking-widest transition-all group-focus-within:text-zinc-900">Additional Visit Notes & Strategic Context</label>
                </div>
              </div>

              {/* LOCATION INFO SECTION */}
              <div className="p-3 md:p-4 space-y-2 flex flex-col min-h-0 overflow-hidden">
                <div className="flex items-center justify-between border-b border-zinc-50 pb-1.5 shrink-0">
                  <div className="flex items-center gap-2">
                    <div className="size-5 bg-amber-50 rounded-lg flex items-center justify-center text-amber-600 shadow-sm border border-amber-100">
                      <MapPin size={12} />
                    </div>
                    <div>
                      <span className="text-[11px] font-black uppercase tracking-tight text-zinc-900 leading-none block">Deployment Location</span>
                      <p className="text-[6px] font-bold text-zinc-400 uppercase tracking-widest mt-0.5 leading-none">Site Geographic Metadata</p>
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-col gap-2">
                  <label htmlFor="deployment-address" className="text-[8px] font-black uppercase text-zinc-400 tracking-widest ml-1">
                    Deployment Address
                  </label>
                  <Textarea
                    id="deployment-address"
                    className="w-full h-[72px] min-h-[72px] max-h-[96px] rounded-xl border-zinc-100 text-xs font-semibold bg-zinc-50/50 p-3 resize-none leading-relaxed shadow-inner read-only:bg-slate-50 read-only:text-slate-500"
                    placeholder="Select a client to automatically load its saved address."
                    value={formData.address}
                    readOnly
                  />
                  <p className="text-[8px] text-zinc-400">Automatically loaded from the selected client&apos;s address.</p>
                </div>
              </div>
            </div>

            {/* ACTION BAR (3/4 WIDTH ALIGNED) */}
            <div className="flex flex-col sm:flex-row items-center gap-3 bg-white border border-zinc-200/60 p-3 rounded-[24px] shadow-sm shrink-0">
               <div className="flex-1 flex items-center gap-4 w-full sm:w-auto">
                  <div className="flex items-center gap-2">
                    <div className="size-8 rounded-xl bg-zinc-900 flex items-center justify-center text-white shrink-0 shadow-lg shadow-zinc-900/10">
                      <User2 size={16} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[7px] font-black text-zinc-400 uppercase tracking-widest leading-none mb-1">Status</p>
                      <p className="text-[11px] font-black uppercase tracking-tight leading-none truncate text-zinc-900">TBD (Engi Assign)</p>
                    </div>
                  </div>
                  <div className="h-8 w-px bg-zinc-100 hidden sm:block" />
                  <div className="flex items-center gap-2">
                    <div className="size-8 rounded-xl bg-blue-500 flex items-center justify-center text-white shrink-0 shadow-lg shadow-blue-500/10">
                      <CalendarSearch size={16} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[7px] font-black text-blue-400 uppercase tracking-widest leading-none mb-1">Target Date</p>
                      <p className="text-[11px] font-black uppercase tracking-tight leading-none text-blue-600 truncate">
                        {selectedDate ? format(new Date(viewDate.getFullYear(), viewDate.getMonth(), selectedDate), "MMM dd, yyyy") : "NOT SELECTED"}
                      </p>
                    </div>
                  </div>
               </div>
               <Button 
                onClick={handleSubmitProtocol} 
                disabled={!isComplete || isSubmitting} 
                className={cn(
                  "h-11 w-full sm:w-auto px-8 rounded-xl font-black uppercase text-[11px] tracking-[0.15em] flex items-center justify-center gap-2 shadow-xl transition-all active:scale-[0.95] shrink-0", 
                  isComplete 
                    ? "bg-zinc-900 text-white hover:bg-zinc-800 shadow-zinc-200" 
                    : "bg-zinc-200 text-zinc-400 cursor-not-allowed shadow-none"
                )}
              >
                {isSubmitting ? "Syncing..." : "Schedule Deployment"}
                {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              </Button>
            </div>
          </div>
        </main>
      </SidebarInset>
    </>
  );
}
