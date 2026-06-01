"use client"

import * as React from "react"
import { 
  Plus, 
  Settings2, 
  Search, 
  Terminal,
  Activity,
  Loader2,
  UserCheck 
} from "lucide-react"
import { cn } from "@/lib/utils"

// FIREBASE IMPORTS
import { db } from "@/lib/firebase";
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  orderBy,
  doc,
  updateDoc,
  deleteDoc 
} from "firebase/firestore";

// SHADCN COMPONENTS
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"

// CUSTOM COMPONENTS
import { PageHeader } from "@/components/page-header"

export default function ProtocolRegistryPage() {
  const [searchTerm, setSearchTerm] = React.useState("")
  const [isOpen, setIsOpen] = React.useState(false)
  const [protocols, setProtocols] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(true)
  const [selectedProtocol, setSelectedProtocol] = React.useState<any>(null)

  // REAL-TIME DATABASE SYNC
  React.useEffect(() => {
    const q = query(collection(db, "protocols"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const protocolList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setProtocols(protocolList);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const deleteProtocol = async (id: string) => {
    if (window.confirm("CRITICAL: Permanent deletion of protocol. Proceed?")) {
      try {
        await deleteDoc(doc(db, "protocols", id));
      } catch (e) { console.error(e); }
    }
  };

  const openEditModal = (protocol: any) => {
    setSelectedProtocol(protocol);
    setIsOpen(true);
  };

  const toggleProtocolStatus = async (id: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, "protocols", id), { isActive: !currentStatus });
    } catch (e) { console.error(e); }
  };

  const filteredProtocols = protocols.filter(p => 
    p.label?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.uid?.includes(searchTerm) ||
    p.pic?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="flex flex-col min-h-screen bg-[#F9FAFA] font-sans antialiased text-foreground pb-24 md:pb-0">
      
      {/* FIXED: Removed children from PageHeader to resolve TypeScript Error */}
      <PageHeader 
        title="Registry Control" 
        version="DSI-LOG-v2.4"
        actions={
            <Dialog 
                open={isOpen} 
                onOpenChange={(val) => {
                    setIsOpen(val);
                    if(!val) setSelectedProtocol(null); 
                }}
            >
                <DialogTrigger asChild>
                    <Button size="sm" className="hidden md:flex h-10 rounded-none bg-[#121212] text-white font-black uppercase italic text-[10px] tracking-widest px-6 shadow-md hover:bg-black transition-all">
                        <Plus className="size-4 mr-2" /> New_Entry
                    </Button>
                </DialogTrigger>
                <ProtocolModalContent 
                    setIsOpen={setIsOpen} 
                    initialData={selectedProtocol} 
                    onDelete={deleteProtocol} 
                />
            </Dialog>
        }
      />

      <main className="flex flex-1 flex-col gap-4 md:gap-6 p-4 md:p-6 max-w-6xl mx-auto w-full relative">
        
        {/* --- SYSTEM STATUS BAR --- */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-px bg-black/5 border border-black/5">
            {[
                { label: "Manifest", val: protocols.length, icon: Terminal },
                { label: "Active", val: protocols.filter(p => p.isActive).length, icon: Activity },
            ].map((stat, i) => (
                <div key={i} className="bg-white p-4 flex flex-col gap-1 border-r border-black/5 last:border-r-0 shadow-sm">
                    <div className="flex items-center gap-2 opacity-40">
                        <stat.icon className="size-3" />
                        <span className="text-[9px] font-black uppercase tracking-widest">{stat.label}</span>
                    </div>
                    <span className="text-xl md:text-2xl font-black italic tracking-tighter text-[#121212]">
                      {loading ? "--" : stat.val.toString().padStart(2, '0')}
                    </span>
                </div>
            ))}
        </section>

        {/* --- SEARCH --- */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-black/30" />
          <Input 
            placeholder="FILTER REGISTRY..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-12 h-12 bg-white border border-black/10 rounded-none font-mono text-xs tracking-widest uppercase shadow-sm focus-visible:ring-black"
          />
        </div>

        {/* --- TABLE / PROTOCOL LIST --- */}
        <div className="border border-black/10 bg-white overflow-hidden min-h-[400px] shadow-sm">
            <div className="bg-[#F9FAFA] border-b border-black/10 p-3 flex items-center justify-between">
                <span className="text-[9px] font-black uppercase tracking-[0.3em] px-2 opacity-50">Master_Index</span>
                {loading && <Loader2 className="size-3 animate-spin mr-2 opacity-50" />}
            </div>
            
            <div className="hidden md:block">
                <Table>
                <TableHeader>
                    <TableRow className="border-black/5 hover:bg-transparent">
                        <TableHead className="text-[10px] font-black uppercase tracking-widest py-4">UID</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest">Protocol / Lead Engineer</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest">Status</TableHead>
                        <TableHead className="text-right"></TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {filteredProtocols.map((p) => (
                    <TableRow key={p.id} className="group border-black/5 hover:bg-[#F9FAFA] transition-colors">
                        <TableCell className="font-mono text-[10px] text-black/60">[ {p.uid} ]</TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                              <span className="text-sm font-black uppercase italic tracking-tight text-[#121212]">{p.label}</span>
                              <span className="text-[10px] font-mono font-bold text-black/40 uppercase">
                                <UserCheck className="inline size-2.5 mr-1 mb-0.5" />
                                {Array.isArray(p.pic) 
                                    ? p.pic.join(", ") 
                                    : (p.pic || "UNASSIGNED")}
                              </span>
                          </div>
                        </TableCell>
                        <TableCell>
                        <button onClick={() => toggleProtocolStatus(p.id, p.isActive)}>
                          <Badge variant="outline" className={cn(
                              "rounded-none px-2 py-0 text-[9px] font-black uppercase border cursor-pointer transition-all",
                              p.isActive ? "border-emerald-500/20 text-emerald-600 bg-emerald-50 shadow-sm" : "border-black/10 text-black/30 bg-black/5"
                          )}>
                              {p.isActive ? "● ONLINE" : "○ OFFLINE"}
                          </Badge>
                        </button>
                        </TableCell>
                        <TableCell className="text-right">
                            <Button onClick={() => openEditModal(p)} variant="ghost" size="icon" className="size-8 rounded-none text-black/40 hover:text-black hover:bg-black/5">
                                <Settings2 className="size-4" />
                            </Button>
                        </TableCell>
                    </TableRow>
                    ))}
                </TableBody>
                </Table>
            </div>
        </div>
      </main>

      {/* MOBILE FLOATING ACTION BUTTON (FAB) */}
      <div className="md:hidden fixed bottom-8 right-6 z-50">
        <Button 
          onClick={() => { setSelectedProtocol(null); setIsOpen(true) }} 
          className="size-16 rounded-full bg-[#121212] text-white shadow-2xl hover:bg-black active:scale-95 transition-all flex flex-col items-center justify-center border border-white/10"
        >
          <Plus className="size-6 stroke-[3px]" />
          <span className="text-[8px] font-black uppercase tracking-tighter mt-0.5">Entry</span>
        </Button>
      </div>

    </div>
  )
}

function ProtocolModalContent({ setIsOpen, initialData, onDelete }: any) {
    const [label, setLabel] = React.useState("")
    const [desc, setDesc] = React.useState("")
    const [pics, setPics] = React.useState<string[]>([])
    const [isActive, setIsActive] = React.useState(true)
    const [isSubmitting, setIsSubmitting] = React.useState(false)
    const [engineers, setEngineers] = React.useState<any[]>([])

    // FETCH ENGINEERS ONLY — one-time getDocs with server-side dept filter
    React.useEffect(() => {
      const fetchEngineers = async () => {
        try {
          const { getDocs, where } = await import("firebase/firestore");
          const q = query(collection(db, "staff"), where("Department", "==", "engineering"), orderBy("Firstname", "asc"));
          const snapshot = await getDocs(q);
          const filtered = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setEngineers(filtered);
        } catch (e) { console.error("Engineers fetch error:", e); }
      };
      fetchEngineers();
    }, []);

    React.useEffect(() => {
      if (initialData) {
        setLabel(initialData.label || "");
        setDesc(initialData.desc || "");
        // Handle both single string PIC and array PIC
        const initialPics = initialData.pic 
          ? (Array.isArray(initialData.pic) ? initialData.pic : [initialData.pic])
          : [];
        setPics(initialPics);
        setIsActive(initialData.isActive);
      } else {
        setLabel(""); setDesc(""); setPics([]); setIsActive(true);
      }
    }, [initialData]);

    const handleCommit = async () => {
      if (!label || pics.length === 0) return;
      setIsSubmitting(true);
      try {
        const data = { label, desc, pic: pics, isActive, updatedAt: new Date() };
        if (initialData) {
          await updateDoc(doc(db, "protocols", initialData.id), data);
        } else {
          await addDoc(collection(db, "protocols"), {
            ...data,
            uid: `PRT-${Math.floor(1000 + Math.random() * 9000)}`,
            createdAt: new Date()
          });
        }
        setIsOpen(false);
      } catch (e) { console.error(e); } finally { setIsSubmitting(false); }
    }

    return (
        <DialogContent className="sm:max-w-[450px] p-0 gap-0 border border-black/10 bg-white rounded-none shadow-2xl font-sans">
            <div className="bg-[#F9FAFA] border-b border-black/10 p-6">
                <DialogHeader className="text-left">
                    <div className="flex items-center gap-2 mb-2">
                        <Terminal className="size-3 text-black/40" />
                        <span className="text-[9px] font-black uppercase tracking-[0.3em] text-black/40">Protocol_Config</span>
                    </div>
                    <DialogTitle className="text-2xl font-black uppercase italic tracking-tighter text-[#121212]">
                      {initialData ? `Edit: ${initialData.uid}` : "New Protocol"}
                    </DialogTitle>
                </DialogHeader>
            </div>
            
            <div className="p-6 space-y-5">
                <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase opacity-50 ml-1">Protocol Designation</Label>
                    <Input value={label} onChange={(e) => setLabel(e.target.value)} className="h-11 rounded-none border border-black/10 uppercase font-mono text-xs focus-visible:ring-black" />
                </div>
                
                <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase opacity-50 ml-1">Lead Engineers (PICs)</Label>
                    <div className="grid grid-cols-1 gap-2 max-h-[200px] overflow-y-auto pr-1 border border-black/10 p-3 bg-[#F9FAFA]">
                        {engineers.map((eng) => {
                            const engName = `${eng.Firstname} ${eng.Lastname}`.toUpperCase();
                            const isChecked = pics.includes(engName);
                            return (
                                <div key={eng.id} className="flex items-center gap-2">
                                    <Checkbox 
                                        id={eng.id} 
                                        checked={isChecked}
                                        onCheckedChange={(checked) => {
                                            if (checked) {
                                                setPics(prev => [...prev, engName]);
                                            } else {
                                                setPics(prev => prev.filter(p => p !== engName));
                                            }
                                        }}
                                    />
                                    <Label 
                                        htmlFor={eng.id}
                                        className="text-xs font-mono uppercase text-black/60 cursor-pointer"
                                    >
                                        {eng.Firstname} {eng.Lastname}
                                    </Label>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-[#F9FAFA] border border-black/5 shadow-inner">
                    <Label className="text-xs font-black uppercase text-[#121212]">Registry Status</Label>
                    <Switch checked={isActive} onCheckedChange={setIsActive} className="data-[state=checked]:bg-[#121212]" />
                </div>
            </div>

            <DialogFooter className="p-6 pt-0 flex flex-row gap-3">
                <Button variant="ghost" className="flex-1 rounded-none font-black text-[10px] uppercase border border-black/5" onClick={() => setIsOpen(false)}>Discard</Button>
                <Button disabled={isSubmitting} onClick={handleCommit} className="flex-1 bg-[#121212] text-white rounded-none font-black text-[10px] uppercase italic shadow-md hover:bg-black">
                  {isSubmitting ? "Syncing..." : "Commit_Protocol"}
                </Button>
            </DialogFooter>
        </DialogContent>
    )
}
