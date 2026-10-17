"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import { Search, X, ChevronDown, PencilLine, MapPin, Loader2 } from "lucide-react";

// Type for the component
export type MapPickerComponent = React.FC<{
  onLocationSelect: (lat: number, lng: number, address: string) => void;
  initialPosition?: { lat: number; lng: number };
  onClose?: () => void;
}>;

interface SearchResult {
  display_name: string;
  lat: string;
  lon: string;
  place_id: number;
}

interface ManualAddress {
  unit: string;
  house: string;
  street: string;
  subdivision: string;
  barangay: string;
  city: string;
  province: string;
  zip: string;
}

type GeoStatus =
  | { type: "idle" }
  | { type: "searching" }
  | { type: "found"; level: "street" | "barangay" | "city" }
  | { type: "notfound" }
  | { type: "clicked" };

const EMPTY_MANUAL: ManualAddress = {
  unit: "",
  house: "",
  street: "",
  subdivision: "",
  barangay: "",
  city: "",
  province: "",
  zip: "",
};

const MANUAL_FIELDS: {
  key: keyof ManualAddress;
  label: string;
  placeholder: string;
  required?: boolean;
  span?: boolean;
}[] = [
  { key: "unit", label: "Rm./Flr./Unit No. & Bldg. Name", placeholder: "RM 4B 4TH FLR ALTA TOWER", span: true },
  { key: "house", label: "House/Lot & Blk. No.", placeholder: "BLK 12 LOT 14" },
  { key: "street", label: "Street Name", placeholder: "RIZAL ST" },
  { key: "subdivision", label: "Subdivision", placeholder: "GREENWOOD HEIGHTS SUBD" },
  { key: "barangay", label: "Barangay / District / Locality", placeholder: "SAN ANTONIO", required: true },
  { key: "city", label: "City / Municipality", placeholder: "PASIG CITY", required: true },
  { key: "province", label: "Province", placeholder: "METRO MANILA / RIZAL", required: true },
  { key: "zip", label: "Zip Code", placeholder: "1600" },
];

const LEVEL_LABEL: Record<"street" | "barangay" | "city", string> = {
  street: "street-level",
  barangay: "barangay-level",
  city: "city-level",
};

// Fix default marker icon issue
const icon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

interface MapPickerProps {
  onLocationSelect: (lat: number, lng: number, address: string) => void;
  initialPosition?: { lat: number; lng: number };
  onClose?: () => void;
}

function MapClickHandler({ onLocationSelect }: { onLocationSelect: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onLocationSelect(e.latlng.lat, e.latlng.lng);
    }
  });
  return null;
}

// Only moves the map when a search result / manual address is located (not on every map click)
function MapViewUpdater({ target }: { target: { center: [number, number]; zoom: number } | null }) {
  const map = useMap();

  useEffect(() => {
    if (target) {
      map.flyTo(target.center, target.zoom, {
        duration: 1.5
      });
    }
  }, [target, map]);

  return null;
}

export default function MapPicker({ onLocationSelect, initialPosition = { lat: 14.5995, lng: 120.9842 }, onClose }: MapPickerProps) {
  const [position, setPosition] = useState<[number, number]>([initialPosition.lat, initialPosition.lng]);
  const [address, setAddress] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [flyTarget, setFlyTarget] = useState<{ center: [number, number]; zoom: number } | null>(null);

  // MANUAL ADDRESS STATES
  const [manualOpen, setManualOpen] = useState(false);
  const [manual, setManual] = useState<ManualAddress>(EMPTY_MANUAL);
  const [geoStatus, setGeoStatus] = useState<GeoStatus>({ type: "idle" });
  const geoRequestId = useRef(0);

  // Combine all manual fields into ONE address string
  const manualAddress = useMemo(() => {
    const parts = [
      manual.unit,
      manual.house,
      manual.street,
      manual.subdivision,
      manual.barangay,
      manual.city,
      manual.province,
      manual.zip,
    ]
      .map((p) => p.trim().toUpperCase())
      .filter(Boolean);
    return parts.join(", ");
  }, [manual]);

  const manualValid =
    manual.barangay.trim() !== "" && manual.city.trim() !== "" && manual.province.trim() !== "";

  // The address that will actually be submitted
  const finalAddress = manualOpen ? manualAddress : address;
  const canConfirm = manualOpen ? manualValid : !!address && !loading;

  const updateManual = (key: keyof ManualAddress, value: string) => {
    if (key === "zip") {
      value = value.replace(/\D/g, "").slice(0, 4);
    }
    setManual((prev) => ({ ...prev, [key]: value }));
  };

  const handleMapClick = async (lat: number, lng: number) => {
    setPosition([lat, lng]);
    setLoading(true);

    if (manualOpen) {
      // In manual mode the typed address is kept, only the pin is adjusted
      setGeoStatus({ type: "clicked" });
    }

    try {
      // Reverse geocoding using Nominatim (OpenStreetMap)
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`
      );
      const data = await response.json();

      setAddress(data.display_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`);
    } catch (error) {
      console.error("Geocoding error:", error);
      setAddress(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    setSearchLoading(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`
      );
      const data = await response.json();
      setSearchResults(data);
      setShowSearchResults(true);
    } catch (error) {
      console.error("Search error:", error);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSelectSearchResult = (result: SearchResult) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    setPosition([lat, lng]);
    setFlyTarget({ center: [lat, lng], zoom: 16 }); // Zoom in closer when selecting a search result
    setAddress(result.display_name);
    setSearchQuery("");
    setSearchResults([]);
    setShowSearchResults(false);
  };

  const handleConfirm = () => {
    if (!canConfirm || !finalAddress) return;
    onLocationSelect(position[0], position[1], finalAddress);
  };

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery) {
        handleSearch(searchQuery);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Locate the manual address on the map (tries specific -> general)
  const locateManualAddress = async () => {
    const street = manual.street.trim();
    const barangay = manual.barangay.trim();
    const city = manual.city.trim();
    const province = manual.province.trim();

    if (!city) return;

    const attempts: { level: "street" | "barangay" | "city"; zoom: number; q: string }[] = [];

    if (street) {
      attempts.push({
        level: "street",
        zoom: 17,
        q: [street, barangay, city, province, "Philippines"].filter(Boolean).join(", "),
      });
    }
    if (barangay) {
      attempts.push({
        level: "barangay",
        zoom: 15,
        q: [barangay, city, province, "Philippines"].filter(Boolean).join(", "),
      });
    }
    attempts.push({
      level: "city",
      zoom: 13,
      q: [city, province, "Philippines"].filter(Boolean).join(", "),
    });

    const myId = ++geoRequestId.current;
    setGeoStatus({ type: "searching" });

    for (const attempt of attempts) {
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(attempt.q)}&limit=1&countrycodes=ph`
        );
        const data = await response.json();

        // A newer request started, drop this one
        if (myId !== geoRequestId.current) return;

        if (Array.isArray(data) && data.length > 0) {
          const lat = parseFloat(data[0].lat);
          const lng = parseFloat(data[0].lon);
          setPosition([lat, lng]);
          setFlyTarget({ center: [lat, lng], zoom: attempt.zoom });
          setGeoStatus({ type: "found", level: attempt.level });
          return;
        }
      } catch (error) {
        console.error("Manual geocode error:", error);
        if (myId !== geoRequestId.current) return;
      }

      // Be gentle with Nominatim (max ~1 request/second)
      await new Promise((resolve) => setTimeout(resolve, 1000));
      if (myId !== geoRequestId.current) return;
    }

    if (myId === geoRequestId.current) {
      setGeoStatus({ type: "notfound" });
    }
  };

  // Auto-pin while typing the manual address (debounced)
  useEffect(() => {
    if (!manualOpen) return;

    if (!manual.city.trim()) {
      geoRequestId.current++;
      setGeoStatus({ type: "idle" });
      return;
    }

    const timer = setTimeout(() => {
      locateManualAddress();
    }, 1000);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manualOpen, manual.street, manual.barangay, manual.city, manual.province]);

  return (
    <div className="w-full h-full flex flex-col overflow-y-auto pr-1">
      {/* Search Input */}
      <div className="relative mb-3 shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search for an address..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-10 pl-10 pr-10 rounded-xl border border-slate-200 text-[12px] font-bold focus:outline-none focus:ring-2 focus:ring-slate-900/10"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setSearchResults([]);
                setShowSearchResults(false);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Search Results Dropdown */}
        {showSearchResults && searchResults.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-10 max-h-60 overflow-y-auto">
            {searchResults.map((result) => (
              <button
                type="button"
                key={result.place_id}
                onClick={() => handleSelectSearchResult(result)}
                className="w-full px-3 py-2 text-left hover:bg-slate-50 border-b border-slate-100 last:border-b-0 transition-colors"
              >
                <p className="text-[11px] font-bold text-slate-700 line-clamp-2">{result.display_name}</p>
              </button>
            ))}
          </div>
        )}

        {searchLoading && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-10 px-3 py-2">
            <p className="text-[11px] font-bold text-slate-500">Searching...</p>
          </div>
        )}
      </div>

      <div className="flex-1 relative min-h-[220px]">
        <MapContainer
          center={position}
          zoom={13}
          style={{ height: "100%", width: "100%", borderRadius: "12px" }}
          className="z-0"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapViewUpdater target={flyTarget} />
          <MapClickHandler onLocationSelect={handleMapClick} />
          {position && (
            <Marker position={position} icon={icon} />
          )}
        </MapContainer>
      </div>

      {/* Manual Address Toggle */}
      <div className="mt-3 shrink-0">
        <button
          type="button"
          onClick={() => setManualOpen((prev) => !prev)}
          className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border border-dashed border-slate-300 hover:bg-slate-50 transition-colors"
        >
          <span className="flex items-center gap-2 text-[11px] font-bold text-slate-600">
            <PencilLine size={14} />
            Can&apos;t find exact address? <span className="underline text-slate-900">Manual input here</span>
          </span>
          <ChevronDown
            size={14}
            className={`text-slate-400 transition-transform ${manualOpen ? "rotate-180" : ""}`}
          />
        </button>

        {manualOpen && (
          <div className="mt-2 p-3 rounded-xl border border-slate-200 bg-white grid grid-cols-1 sm:grid-cols-2 gap-3">
            {MANUAL_FIELDS.map((field) => (
              <div key={field.key} className={`space-y-1 ${field.span ? "sm:col-span-2" : ""}`}>
                <label className="text-[9px] font-black uppercase text-slate-400 flex items-center gap-1">
                  {field.label}
                  {field.required && <span className="text-red-500">*</span>}
                </label>
                <input
                  type="text"
                  inputMode={field.key === "zip" ? "numeric" : "text"}
                  placeholder={field.placeholder}
                  value={manual[field.key]}
                  onChange={(e) => updateManual(field.key, e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-slate-200 text-[11px] font-bold uppercase focus:outline-none focus:ring-2 focus:ring-slate-900/10 placeholder:normal-case placeholder:font-medium placeholder:text-slate-300"
                />
              </div>
            ))}

            {/* Pin status */}
            <div className="sm:col-span-2 flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-50 border border-slate-100">
              <div className="flex items-center gap-2 min-w-0">
                {geoStatus.type === "searching" ? (
                  <Loader2 size={12} className="animate-spin text-slate-500 shrink-0" />
                ) : (
                  <MapPin
                    size={12}
                    className={`shrink-0 ${
                      geoStatus.type === "found" || geoStatus.type === "clicked"
                        ? "text-emerald-500"
                        : geoStatus.type === "notfound"
                        ? "text-red-500"
                        : "text-slate-400"
                    }`}
                  />
                )}
                <p className="text-[10px] font-bold text-slate-500">
                  {geoStatus.type === "idle" && "Fill in City (and Barangay, Province) to auto-pin on the map."}
                  {geoStatus.type === "searching" && "Locating address on the map..."}
                  {geoStatus.type === "found" &&
                    `Pinned using a ${LEVEL_LABEL[geoStatus.level]} match. Click the map to fine-tune the pin.`}
                  {geoStatus.type === "notfound" &&
                    "Couldn't locate that address. Click the map to place the pin manually."}
                  {geoStatus.type === "clicked" && "Pin adjusted manually. Your typed address is kept."}
                </p>
              </div>
              <button
                type="button"
                onClick={locateManualAddress}
                disabled={!manual.city.trim() || geoStatus.type === "searching"}
                className="shrink-0 h-7 px-2.5 rounded-lg bg-slate-900 text-white text-[9px] font-black uppercase tracking-wider disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-800 transition-all"
              >
                Locate
              </button>
            </div>

            <p className="sm:col-span-2 text-[9px] font-bold text-slate-400">
              Leave blank the fields that don&apos;t apply. Unit, house/lot and zip are not used for pinning, only the street, barangay, city and province.
            </p>
          </div>
        )}
      </div>

      {/* Selected Location */}
      <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-200 shrink-0">
        <p className="text-[10px] font-black uppercase text-slate-400 mb-1">
          Selected Location {manualOpen && <span className="text-amber-500">(Manual)</span>}
        </p>
        {!manualOpen && loading ? (
          <div className="flex items-center gap-2">
            <div className="size-3 border-2 border-slate-300 border-t-slate-900 rounded-full animate-spin" />
            <p className="text-[11px] font-bold text-slate-500">Fetching address...</p>
          </div>
        ) : (
          <p className="text-[12px] font-bold text-slate-700">
            {finalAddress ||
              (manualOpen
                ? "Fill in Barangay, City and Province at minimum"
                : "Click on the map to select location")}
          </p>
        )}
        <p className="text-[9px] font-mono text-slate-400 mt-1">
          {position[0].toFixed(6)}, {position[1].toFixed(6)}
        </p>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={!canConfirm}
          className="mt-3 w-full h-10 rounded-xl bg-slate-900 text-white text-[11px] font-black uppercase tracking-wider disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-800 transition-all"
        >
          Confirm Location
        </button>
      </div>
    </div>
  );
}