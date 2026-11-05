"use client";

import { useState } from "react";
import { Check, ChevronDown, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type CustomerAccount = {
  id: string;
  company_name: string;
  contact_person?: string | string[] | null;
  email_address?: string | string[] | null;
  contact_number?: string | string[] | null;
};

type CustomerAccountPickerProps = {
  accounts: CustomerAccount[];
  totalAccounts: number;
  selectedAccount: string;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onSelect: (account: CustomerAccount) => void;
  onLoadMore: () => void;
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
};

export function CustomerAccountPicker({
  accounts,
  totalAccounts,
  selectedAccount,
  searchQuery,
  onSearchChange,
  onSelect,
  onLoadMore,
  loading,
  loadingMore,
  hasMore,
}: CustomerAccountPickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "h-11 w-full justify-between rounded-xl border-slate-200 bg-white text-left text-[12px] font-bold transition-all hover:bg-slate-50",
            !selectedAccount && "text-slate-400"
          )}
          disabled={loading && accounts.length === 0}
        >
          <span className="truncate">
            {loading && accounts.length === 0 ? (
              <span className="flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" />
                Syncing Database...
              </span>
            ) : (
              selectedAccount || "Select Customer..."
            )}
          </span>
          {!loading && <ChevronDown className="ml-2 size-4 shrink-0 opacity-50" />}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="start"
        sideOffset={6}
        collisionPadding={16}
        className="z-[100] w-[var(--radix-popover-trigger-width)] min-w-[300px] overflow-hidden rounded-xl border-slate-200 bg-white p-0 shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-3 py-2">
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">
            Customer Accounts
          </span>
          <span className="text-[9px] font-bold text-slate-400">
            {loading ? "Loading..." : `${totalAccounts} accounts`}
          </span>
        </div>
        <Command shouldFilter={false} className="bg-white">
          <CommandInput
            placeholder="Search customer..."
            className="h-10 text-[12px]"
            value={searchQuery}
            onValueChange={onSearchChange}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
          />
          <CommandList
            className="max-h-[min(300px,50vh)] overflow-y-auto"
            onScroll={(event) => {
              const target = event.currentTarget;
              if (
                hasMore &&
                !loadingMore &&
                target.scrollHeight - target.scrollTop <= target.clientHeight + 1
              ) {
                onLoadMore();
              }
            }}
          >
            <CommandEmpty className="py-3 text-center text-[11px]">
              {loading ? "Searching..." : "No customer found."}
            </CommandEmpty>
            <CommandGroup>
              {accounts.map((account) => (
                <CommandItem
                  key={account.id}
                  value={account.company_name}
                  onSelect={() => {
                    onSelect(account);
                    setOpen(false);
                  }}
                  className="text-[11px] font-bold uppercase"
                >
                  <Check
                    className={cn(
                      "mr-2 size-4 shrink-0",
                      selectedAccount === account.company_name ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="truncate">{account.company_name}</span>
                </CommandItem>
              ))}
              {loadingMore && (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="size-4 animate-spin text-slate-500" />
                </div>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
