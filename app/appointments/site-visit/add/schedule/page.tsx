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
  Paperclip, Send, ChevronLeft, Layers, Navigation, Loader2,
  RefreshCw, ShieldCheck, X, User, ChevronRight, 
  ShieldAlert, Fingerprint, ClipboardList, MapPin, 
  Activity, Info, CheckCircle2, Globe, CalendarSearch,
  User2, Sparkles, Search, Check, ChevronDown,
  HardHat, ClipboardCheck, FlaskConical
} from "lucide-react"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import { Skeleton } from "@/components/ui/skeleton"
import { useDebounce } from "@/hooks/use-debounce"

// FIREBASE IMPORTS
import { db } from "@/lib/firebase"
import { collection, addDoc, onSnapshot, query, where, serverTimestamp, Timestamp, getDocs } from "firebase/firestore"

import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { sendNotificationToHierarchy, NotificationTemplates } from "@/lib/notification-service"
import { getNextSiteVisitNumber, releaseReservedNumber } from "@/lib/site-visit-counter"
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
import "leaflet/dist/leaflet.css"

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
  
  const [assignedPics, setAssignedPics] = React.useState<any[]>([]);
  const [protocolMetadata, setProtocolMetadata] = React.useState<any[]>([]); 
  const [selectedPic, setSelectedPic] = React.useState<string>("UNASSIGNED"); 
  const [isLoadingSync, setIsLoadingSync] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isGeocoding, setIsGeocoding] = React.useState(false);
  const [coords, setCoords] = React.useState<[number, number] | null>(null);
  const [attachedFile, setAttachedFile] = React.useState<File | null>(null);
  const [allAppointments, setAllAppointments] = React.useState<any[]>([]);
  const [allBlockedSlots, setAllBlockedSlots] = React.useState<any[]>([]);

  // ADDRESS DROPDOWN STATES
  const [addressOptions, setAddressOptions] = React.useState<string[]>([]);
  const [openAddress, setOpenAddress] = React.useState(false);

  // PSGC DATA STATES
  const [regions, setRegions] = React.useState<any[]>([]);
  const [provinces, setProvinces] = React.useState<any[]>([]);
  const [cities, setCities] = React.useState<any[]>([]);
  const [barangays, setBarangays] = React.useState<any[]>([]);

  const [formData, setFormData] = React.useState({ 
    client: "", 
    contactPerson: "",
    email: "",
    contactNumber: "",
    address: "", 
    street: "",
    barangay: "",
    city: "",
    province: "",
    region: "",
    landmark: "",
    agenda: "",
    notes: "", 
    tsa: "NOT_SET", 
    tsm: "NOT_SET"  
  });

  // FETCH PSGC REGIONS ON MOUNT
  React.useEffect(() => {
    const fetchRegions = async () => {
      try {
        const res = await fetch("https://psgc.gitlab.io/api/regions/");
        const data = await res.json();
        setRegions(data.sort((a: any, b: any) => a.name.localeCompare(b.name)));
      } catch (err) { console.error("REGIONS_FETCH_ERROR", err); }
    };
    fetchRegions();
  }, []);

  // FETCH PROVINCES WHEN REGION CHANGES
  React.useEffect(() => {
    if (!formData.region) {
      setProvinces([]);
      return;
    }
    const fetchProvinces = async () => {
      try {
        const res = await fetch(`https://psgc.gitlab.io/api/regions/${formData.region}/provinces/`);
        const data = await res.json();
        setProvinces(data.sort((a: any, b: any) => a.name.localeCompare(b.name)));
      } catch (err) { console.error("PROVINCES_FETCH_ERROR", err); }
    };
    fetchProvinces();
  }, [formData.region]);

  // FETCH CITIES WHEN PROVINCE CHANGES (OR REGION IF NCR)
  React.useEffect(() => {
    if (!formData.province && !formData.region) {
      setCities([]);
      return;
    }
    
    const fetchCities = async () => {
      try {
        let url = "";
        if (formData.province) {
          url = `https://psgc.gitlab.io/api/provinces/${formData.province}/cities-municipalities/`;
        } else if (formData.region === "130000000") { // NCR logic
          url = `https://psgc.gitlab.io/api/regions/${formData.region}/cities-municipalities/`;
        } else {
          setCities([]);
          return;
        }

        const res = await fetch(url);
        const data = await res.json();
        setCities(data.sort((a: any, b: any) => a.name.localeCompare(b.name)));
      } catch (err) { console.error("CITIES_FETCH_ERROR", err); }
    };
    fetchCities();
  }, [formData.province, formData.region]);

  // FETCH BARANGAYS WHEN CITY CHANGES
  React.useEffect(() => {
    if (!formData.city) {
      setBarangays([]);
      return;
    }
    const fetchBarangays = async () => {
      try {
        const res = await fetch(`https://psgc.gitlab.io/api/cities-municipalities/${formData.city}/barangays/`);
        const data = await res.json();
        setBarangays(data.sort((a: any, b: any) => a.name.localeCompare(b.name)));
      } catch (err) { console.error("BARANGAYS_FETCH_ERROR", err); }
    };
    fetchBarangays();
  }, [formData.city]);

  // AUTO-POPULATE COMBINED ADDRESS
  React.useEffect(() => {
    const r = regions.find(x => x.code === formData.region)?.name || "";
    const p = provinces.find(x => x.code === formData.province)?.name || "";
    const c = cities.find(x => x.code === formData.city)?.name || "";
    const b = barangays.find(x => x.code === formData.barangay)?.name || "";
    const s = formData.street || "";

    const combined = [s, b, c, p, r].filter(Boolean).join(", ");
    setFormData(prev => ({ ...prev, address: combined }));
  }, [formData.region, formData.province, formData.city, formData.barangay, formData.street, regions, provinces, cities, barangays]);

  // FETCH HISTORICAL ADDRESSES — one-time read, limited to 100 docs
  React.useEffect(() => {
    const fetchAddresses = async () => {
      try {
        // FIX: Use limit() to avoid reading the entire appointments collection
        const { limit: fsLimit } = await import("firebase/firestore");
        const q = query(
          collection(db, "appointments"),
          where("department", "==", "ENGINEERING"),
          fsLimit(100)
        );
        const snap = await getDocs(q);
        const addresses = Array.from(
          new Set(snap.docs.map(doc => doc.data().address))
        ).filter(Boolean) as string[];
        setAddressOptions(addresses);
      } catch (err) { console.error(err); }
    };
    fetchAddresses();
  }, []);

  // 2. PROTOCOL & PIC SYNC
  React.useEffect(() => {
    if (!isHydrated) return;

    const activeProtocols = selectedAssistance || [];
    if (activeProtocols.length === 0) {
      setIsLoadingSync(false);
      return;
    }

    const q = query(collection(db, "protocols"), where("isActive", "==", true));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const dbProtocols = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
      const matched = dbProtocols.filter((proto: any) => activeProtocols.includes(proto.id));
      setProtocolMetadata(matched);
      
      // LOGIC: IF "INSTALLATION SERVICES" IS SELECTED, ONLY SHOW ITS PICS (Karl and Mark)
      const installationProtocol = matched.find(p => p.label?.toLowerCase().includes("installation"));
      
      let finalPics: any[] = [];
      if (installationProtocol) {
        finalPics = Array.from(new Set((installationProtocol.pic || []).map((name: string) => name.trim().toUpperCase())));
      } else {
        finalPics = Array.from(new Set(matched.flatMap(p => p.pic || []).map((name: string) => name.trim().toUpperCase())));
      }

      setAssignedPics(finalPics.length > 0 ? finalPics : ["ENGINEERING_STAFF"]);
      
      setIsLoadingSync(false);
    });
    return () => unsubscribe();
  }, [selectedAssistance, isHydrated]);

  // 3. CALENDAR DATA — only subscribe when we have PICs and a valid month
  React.useEffect(() => {
    if (!isHydrated || assignedPics.length === 0) {
      setAllAppointments([]);
      return;
    }

    const startOfMonth = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1, 0, 0, 0);
    const endOfMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0, 23, 59, 59);
    
    // FIX: Limit to max 10 PICs for the "in" query (Firestore limit is 30, but keep it tight)
    const picNames = assignedPics.slice(0, 10).map((p: any) => typeof p === 'string' ? p : p.name);
    const q = query(
      collection(db, "appointments"), 
      where("pic", "in", picNames), 
      where("appointmentDate", ">=", Timestamp.fromDate(startOfMonth)), 
      where("appointmentDate", "<=", Timestamp.fromDate(endOfMonth))
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const apps = snapshot.docs.map(doc => {
        const data = doc.data();
        const date = data.appointmentDate.toDate();
        return { 
          id: doc.id, 
          day: date.getDate(), 
          month: date.getMonth(), 
          year: date.getFullYear(),
          pic: data.pic,
          client: data.client, 
          agenda: data.agenda || "Standard Operational Deployment", 
          status: data.status
        };
      });
      setAllAppointments(apps);
    }, (error) => { 
      console.error("UPLINK_SYNC_ERROR", error);
    });

    return () => unsubscribe();
  }, [assignedPics, viewDate, isHydrated]);

  // 4. BLOCKED SLOTS — only subscribe when we have PICs
  React.useEffect(() => {
    if (!isHydrated || assignedPics.length === 0) {
      setAllBlockedSlots([]);
      return;
    }

    // FIX: Limit the "in" array to avoid over-fetching; cap at 10 PICs
    const picNames = assignedPics.slice(0, 10).map((p: any) => typeof p === 'string' ? p : p.name);
    const targetPics = [...picNames, "ALL_STAFF", "GLOBAL"].slice(0, 10);

    const q = query(
      collection(db, "blocked_slots"),
      where("userName", "in", targetPics)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const slots = snapshot.docs.map(doc => {
        const data = doc.data();
        const date = new Date(data.dateString);
        return {
          id: doc.id,
          userName: data.userName,
          day: date.getDate(),
          month: date.getMonth(),
          year: date.getFullYear(),
          shiftScope: data.shiftScope,
          justification: data.justification
        };
      });
      setAllBlockedSlots(slots);
    });

    return () => unsubscribe();
  }, [assignedPics, isHydrated]);

  // DERIVED DATA FOR CURRENT SELECTION
  const getDayAvailability = React.useMemo(() => {
    return (dayNum: number, month: number, year: number) => {
      if (assignedPics.length === 0) return { available: 0, total: 0, isGlobal: false, globalReason: "" };

      const picNames = assignedPics.map(p => typeof p === 'string' ? p : p.name);
      const total = picNames.length;
      
      // Global Blocking check
      const globalBlock = allBlockedSlots.find(s => 
        (!s.userName || s.userName === "ALL_STAFF" || s.userName === "GLOBAL" || s.userName === "ALL") && 
        s.day === dayNum && s.month === month && s.year === year
      );
      
      if (globalBlock && globalBlock.shiftScope === "FULL_DAY") {
        return { available: 0, total, isGlobal: true, globalReason: globalBlock.justification };
      }

      const busyPics = new Set();

      // Check appointments
      allAppointments.forEach(a => {
        if (a.day === dayNum && a.month === month && a.year === year && picNames.includes(a.pic)) {
          busyPics.add(a.pic);
        }
      });

      // Check personal blocks
      allBlockedSlots.forEach(s => {
        if (s.day === dayNum && s.month === month && s.year === year && picNames.includes(s.userName) && s.shiftScope === "FULL_DAY") {
          busyPics.add(s.userName);
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
    selectedDate !== null && 
    formData.region !== "" &&
    (formData.province !== "" || formData.region === "130000000") &&
    formData.city !== "" &&
    formData.barangay !== ""
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

  const handlePicChange = (name: string) => {
    setSelectedPic(name);
    setSelectedDate(null);
  };

  const handleVerifyMap = async () => {
    if (formData.address.trim().length < 5) return;
    setIsGeocoding(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(formData.address)}&addressdetails=1&limit=1`);
      const data = await res.json();
      if (data?.[0]) {
        setCoords([parseFloat(data[0].lat), parseFloat(data[0].lon)]);
        toast.success("Location verified and pinned.");
      } else {
        toast.error("Could not find the address. Please try a more specific location.");
      }
    } catch (err) { 
      console.error(err);
      toast.error("Map verification failed.");
    } 
    finally { setIsGeocoding(false); }
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
    setIsSubmitting(true);
    const toastId = toast.loading("SYNCHRONIZING OPERATIONAL DATA...");
    
    // FETCH SUBMITTING USER ID
    const currentUserId = localStorage.getItem("userId");

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
      
      await addDoc(collection(db, "appointments"), {
        ...formData, 
        siteVisitNo, // Unique sequential number: PS-2026-036
        pic: "UNASSIGNED", 
        appointmentDate: Timestamp.fromDate(appointmentDateObj),
        protocols: selectedAssistance || [], 
        personnel: personnel || [],
        ppe: ppe || [],
        permits: permits || [],
        region: regions.find(x => x.code === formData.region)?.name || "",
        province: provinces.find(x => x.code === formData.province)?.name || "",
        city: cities.find(x => x.code === formData.city)?.name || "",
        barangay: barangays.find(x => x.code === formData.barangay)?.name || "",
        fileUrl, 
        coordinates: coords, 
        status: "PENDING",
        createdAt: serverTimestamp(), 
        department: "ENGINEERING",
        submittedBy: currentUserId 
      });

      // Release the number reservation after successful save
      await releaseReservedNumber(siteVisitNo);

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
    } catch (error: any) {
      toast.error("DEPLOYMENT FAILURE", { id: toastId });
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
                            setFormData(prev => ({
                              ...prev,
                              client: "",
                              contactPerson: "",
                              email: "",
                              contactNumber: "",
                              address: "",
                              region: "",
                              province: "",
                              city: "",
                              barangay: "",
                              street: ""
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
                                    const email = Array.isArray(account.email_address) 
                                      ? account.email_address.join(", ") 
                                      : account.email_address;
                                    const contact = Array.isArray(account.contact_number) 
                                      ? account.contact_number.join(", ") 
                                      : account.contact_number;
                                    const person = Array.isArray(account.contact_person)
                                      ? account.contact_person.join(", ")
                                      : account.contact_person;
                                    
                                    setFormData(prev => ({
                                      ...prev,
                                      client: account.company_name,
                                      contactPerson: person || prev.contactPerson,
                                      email: email || prev.email,
                                      contactNumber: contact || prev.contactNumber,
                                      address: account.address || prev.address
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
                    <Input 
                      className="rounded-xl border-zinc-100 text-[11px] font-black uppercase h-9 bg-zinc-50/50 focus:bg-white focus:ring-2 focus:ring-zinc-900 px-3 shadow-inner pt-3.5 transition-all disabled:opacity-70 disabled:cursor-not-allowed" 
                      placeholder=" " 
                      value={formData.contactPerson} 
                      onChange={e => setFormData({...formData, contactPerson: e.target.value})}
                      disabled={isCustomerSelected}
                    />
                    <label className="absolute left-3 top-1 text-[7px] font-black uppercase text-zinc-400 tracking-widest transition-all group-focus-within:text-zinc-900">Contact Person</label>
                  </div>
                  <div className="relative group">
                    <Input className="rounded-xl border-zinc-100 text-[11px] font-black uppercase h-9 bg-zinc-50/50 focus:bg-white focus:ring-2 focus:ring-zinc-900 px-3 shadow-inner pt-3.5 transition-all" placeholder=" " value={formData.agenda} onChange={e => setFormData({...formData, agenda: e.target.value})} />
                    <label className="absolute left-3 top-1 text-[7px] font-black uppercase text-zinc-400 tracking-widest transition-all group-focus-within:text-zinc-900">Objective*</label>
                  </div>
                  <div className="relative group">
                    <Input 
                      className="rounded-xl border-zinc-100 text-[11px] font-black uppercase h-9 bg-zinc-50/50 focus:bg-white focus:ring-2 focus:ring-zinc-900 px-3 shadow-inner pt-3.5 transition-all disabled:opacity-70 disabled:cursor-not-allowed" 
                      placeholder=" " 
                      value={formData.email} 
                      onChange={e => setFormData({...formData, email: e.target.value})}
                      disabled={isCustomerSelected}
                    />
                    <label className="absolute left-3 top-1 text-[7px] font-black uppercase text-zinc-400 tracking-widest transition-all group-focus-within:text-zinc-900">Email Address</label>
                  </div>
                  <div className="relative group">
                    <Input 
                      className="rounded-xl border-zinc-100 text-[11px] font-black uppercase h-9 bg-zinc-50/50 focus:bg-white focus:ring-2 focus:ring-zinc-900 px-3 shadow-inner pt-3.5 transition-all disabled:opacity-70 disabled:cursor-not-allowed" 
                      placeholder=" " 
                      value={formData.contactNumber} 
                      onChange={e => setFormData({...formData, contactNumber: e.target.value})}
                      disabled={isCustomerSelected}
                    />
                    <label className="absolute left-3 top-1 text-[7px] font-black uppercase text-zinc-400 tracking-widest transition-all group-focus-within:text-zinc-900">Contact Number</label>
                  </div>
                </div>
                <div className="relative group">
                  <Textarea className="rounded-xl border-zinc-100 text-[11px] font-black uppercase min-h-[50px] lg:min-h-[60px] lg:max-h-[80px] bg-zinc-50/50 focus:bg-white focus:ring-2 focus:ring-zinc-900 p-3 pt-4.5 resize-none leading-relaxed shadow-inner transition-all" placeholder=" " value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} />
                  <label className="absolute left-3 top-1 text-[7px] font-black uppercase text-zinc-400 tracking-widest transition-all group-focus-within:text-zinc-900">Additional Visit Notes & Strategic Context</label>
                </div>
              </div>

              {/* LOCATION INFO SECTION */}
              <div className="p-3 md:p-4 space-y-2 flex-1 flex flex-col min-h-0 overflow-hidden">
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
                  <button onClick={handleVerifyMap} className="h-7 px-2.5 text-[8px] font-black uppercase flex items-center gap-1.5 hover:bg-zinc-100 transition-all bg-zinc-50 rounded-lg border border-zinc-100 text-zinc-600 shadow-sm active:scale-95">
                    {isGeocoding ? <Loader2 className="size-3 animate-spin" /> : <Navigation className="size-3" />} 
                    Verify Site
                  </button>
                </div>
                
                <div className="space-y-2.5 overflow-y-auto pr-0.5 scrollbar-hide flex-1">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                    <div className="relative group">
                      <select 
                        className="w-full h-9 px-3 rounded-xl bg-zinc-50/50 border border-zinc-100 text-[11px] font-black uppercase outline-none focus:ring-2 focus:ring-zinc-900 transition-all appearance-none shadow-inner pt-3.5 disabled:opacity-70 disabled:cursor-not-allowed"
                        value={formData.region}
                        onChange={(e) => setFormData({ ...formData, region: e.target.value, province: "", city: "", barangay: "" })}
                      >
                        <option value=""></option>
                        {regions.map(r => <option key={r.code} value={r.code}>{r.name}</option>)}
                      </select>
                      <label className="absolute left-3 top-1 text-[7px] font-black uppercase text-zinc-400 tracking-widest group-focus-within:text-zinc-900">Region</label>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 size-3 text-zinc-400 pointer-events-none mt-1" />
                    </div>
                    <div className="relative group">
                      <select 
                        className="w-full h-9 px-3 rounded-xl bg-zinc-50/50 border border-zinc-100 text-[11px] font-black uppercase outline-none focus:ring-2 focus:ring-zinc-900 transition-all appearance-none disabled:opacity-50 shadow-inner pt-3.5 disabled:opacity-70 disabled:cursor-not-allowed"
                        value={formData.province}
                        disabled={!formData.region || formData.region === "130000000"}
                        onChange={(e) => setFormData({ ...formData, province: e.target.value, city: "", barangay: "" })}
                      >
                        <option value="">{formData.region === "130000000" ? "NCR" : ""}</option>
                        {provinces.map(p => <option key={p.code} value={p.code}>{p.name}</option>)}
                      </select>
                      <label className="absolute left-3 top-1 text-[7px] font-black uppercase text-zinc-400 tracking-widest group-focus-within:text-zinc-900">Province</label>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 size-3 text-zinc-400 pointer-events-none mt-1" />
                    </div>
                    <div className="relative group">
                      <select 
                        className="w-full h-9 px-3 rounded-xl bg-zinc-50/50 border border-zinc-100 text-[11px] font-black uppercase outline-none focus:ring-2 focus:ring-zinc-900 transition-all appearance-none disabled:opacity-50 shadow-inner pt-3.5 disabled:opacity-70 disabled:cursor-not-allowed"
                        value={formData.city}
                        disabled={!formData.province && formData.region !== "130000000"}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value, barangay: "" })}
                      >
                        <option value=""></option>
                        {cities.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                      </select>
                      <label className="absolute left-3 top-1 text-[7px] font-black uppercase text-zinc-400 tracking-widest group-focus-within:text-zinc-900">City</label>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 size-3 text-zinc-400 pointer-events-none mt-1" />
                    </div>
                    <div className="relative group">
                      <select 
                        className="w-full h-9 px-3 rounded-xl bg-zinc-50/50 border border-zinc-100 text-[11px] font-black uppercase outline-none focus:ring-2 focus:ring-zinc-900 transition-all appearance-none disabled:opacity-50 shadow-inner pt-3.5 disabled:opacity-70 disabled:cursor-not-allowed"
                        value={formData.barangay}
                        disabled={!formData.city}
                        onChange={(e) => setFormData({ ...formData, barangay: e.target.value })}
                      >
                        <option value=""></option>
                        {barangays.map(b => <option key={b.code} value={b.code}>{b.name}</option>)}
                      </select>
                      <label className="absolute left-3 top-1 text-[7px] font-black uppercase text-zinc-400 tracking-widest group-focus-within:text-zinc-900">Barangay</label>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 size-3 text-zinc-400 pointer-events-none mt-1" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div className="relative group">
                      <Input 
                        className="rounded-xl border-zinc-100 text-[11px] font-black uppercase h-9 bg-zinc-50/50 focus:bg-white focus:ring-2 focus:ring-zinc-900 px-3 shadow-inner pt-3.5 transition-all disabled:opacity-70 disabled:cursor-not-allowed" 
                        placeholder=" " 
                        value={formData.street} 
                        onChange={e => setFormData({...formData, street: e.target.value})}
                      />
                      <label className="absolute left-3 top-1 text-[7px] font-black uppercase text-zinc-400 tracking-widest transition-all group-focus-within:text-zinc-900">Street / House No. / Unit</label>
                    </div>
                    <div className="relative group">
                      <Input 
                        className="rounded-xl border-zinc-100 text-[11px] font-black uppercase h-9 bg-zinc-50/50 focus:bg-white focus:ring-2 focus:ring-zinc-900 px-3 shadow-inner pt-3.5 transition-all disabled:opacity-70 disabled:cursor-not-allowed" 
                        placeholder=" " 
                        value={formData.landmark} 
                        onChange={e => setFormData({...formData, landmark: e.target.value})}
                      />
                      <label className="absolute left-3 top-1 text-[7px] font-black uppercase text-zinc-400 tracking-widest transition-all group-focus-within:text-zinc-900">Landmark / Building Name</label>
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-0.5 shrink-0">
                    <div className="flex items-center justify-between">
                      <span className="text-[8px] font-black uppercase text-zinc-400 tracking-widest ml-1 flex items-center gap-1.5">
                        <Globe size={10} /> Generated Address Output
                      </span>
                      <Popover open={openAddress} onOpenChange={setOpenAddress}>
                        <PopoverTrigger asChild>
                          <button className="text-[6px] font-black uppercase text-blue-600 hover:underline flex items-center gap-1 transition-all active:scale-95">
                            <RefreshCw size={8} /> Search History
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[280px] p-0 rounded-xl shadow-2xl border-none" align="end">
                          <Command className="rounded-xl">
                            <CommandInput placeholder="Search records..." className="h-9 text-[11px] font-black uppercase" />
                            <CommandList className="max-h-[140px] scrollbar-hide">
                              <CommandEmpty className="py-3 text-[9px] font-black text-zinc-400 uppercase text-center tracking-widest">No records found</CommandEmpty>
                              <CommandGroup heading="Historical Sites" className="p-1">
                                {addressOptions.map((addr) => (
                                  <CommandItem key={addr} value={addr} onSelect={() => { setFormData({ ...formData, address: addr }); setOpenAddress(false); }} className="rounded-lg text-[9px] font-black uppercase py-1.5 px-2.5 mb-1 hover:bg-zinc-50 cursor-pointer transition-all">
                                    <Check className={cn("mr-2 h-2.5 w-2.5 text-blue-600", formData.address === addr ? "opacity-100" : "opacity-0")} />
                                    <span className="truncate">{addr}</span>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="relative group">
                      <Input className="rounded-xl border-zinc-100 text-[11px] font-black uppercase h-10 bg-zinc-100/50 p-2.5 shadow-inner truncate pr-20 transition-all" value={formData.address || "ADDRESS WILL AUTO-GENERATE..."} readOnly />
                      <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                        {coords ? (
                          <div className="flex items-center gap-1 px-1.5 py-0.5 bg-emerald-500 text-white rounded-md text-[6px] font-black uppercase shadow-lg shadow-emerald-500/20">
                            <CheckCircle2 size={8} /> Site Pinned
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 px-1.5 py-0.5 bg-zinc-200 text-zinc-400 rounded-md text-[6px] font-black uppercase">
                            <MapPin size={8} /> Unverified
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
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
