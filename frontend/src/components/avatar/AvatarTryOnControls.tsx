"use client";

import React from "react";
import { Loader2, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  AvatarSizeItem,
  FitPreferenceAvatarOption,
} from "@/lib/api/types";
import {
  FIT_PREFERENCE_OPTIONS,
  FABRIC_COLOR_OPTIONS,
  type AvatarGarmentSize,
  type GarmentViewMode,
} from "@/lib/garments";

export interface AvatarTryOnControlsProps {
  availableSizes: AvatarSizeItem[];
  selectedSize: AvatarGarmentSize;
  recommendedSize: AvatarGarmentSize | null;
  onSelectSize: (size: AvatarGarmentSize) => void;
  sizingLoading: boolean;
  fitPreference: FitPreferenceAvatarOption;
  onSelectFitPreference: (pref: FitPreferenceAvatarOption) => void;
  viewMode: GarmentViewMode;
  onSelectViewMode: (mode: GarmentViewMode) => void;
  colorHex: string;
  onSelectColorHex: (hex: string) => void;
  onDress: () => void;
  onRemoveGarment: () => void;
  dressingLoading: boolean;
  dressDisabled: boolean;
  hasDressedGarment: boolean;
  avatarServiceOffline: boolean;
  hasAvatar: boolean;
}

export function AvatarTryOnControls({
  availableSizes,
  selectedSize,
  recommendedSize,
  onSelectSize,
  sizingLoading,
  fitPreference,
  onSelectFitPreference,
  viewMode,
  onSelectViewMode,
  colorHex,
  onSelectColorHex,
  onDress,
  onRemoveGarment,
  dressingLoading,
  dressDisabled,
  hasDressedGarment,
  avatarServiceOffline,
  hasAvatar,
}: AvatarTryOnControlsProps) {
  return (
    <div className="space-y-4">
      {/* Size Buttons from Engine Sizing */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="block text-xs font-bold text-slate-800">
            Size
          </label>
          {sizingLoading && (
            <span className="flex items-center text-[11px] text-slate-500">
              <Loader2 className="mr-1 h-3 w-3 animate-spin text-[#6633EE]" />
              Evaluating fit...
            </span>
          )}
        </div>
        {availableSizes.length > 0 ? (
          <div
            className="flex flex-wrap gap-1.5"
            role="radiogroup"
            aria-label="Garment size"
          >
            {availableSizes.map((s) => {
              const isSelected = selectedSize === s.size;
              const isBest = recommendedSize === s.size;
              return (
                <button
                  key={s.size}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => onSelectSize(s.size)}
                  className={cn(
                    "cursor-pointer min-h-10 min-w-[52px] rounded-lg border px-2.5 py-1.5 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6633EE] flex items-center justify-center gap-1",
                    isSelected
                      ? "bg-[#6633EE] border-[#6633EE] text-white"
                      : isBest
                      ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                      : "border-slate-300 bg-white text-slate-900 hover:border-violet-400 hover:bg-violet-50"
                  )}
                >
                  <span>{s.size}</span>
                  <span
                    className={cn(
                      "text-[10px] font-normal",
                      isSelected
                        ? "text-violet-200"
                        : isBest
                        ? "text-emerald-700 font-semibold"
                        : "text-slate-500"
                    )}
                  >
                    ({s.fit_score})
                  </span>
                  {isBest && (
                    <span
                      className={cn(
                        "ml-0.5 rounded px-1 py-0.2 text-[9px] font-extrabold uppercase",
                        isSelected
                          ? "bg-white/20 text-white"
                          : "bg-emerald-200/70 text-emerald-800"
                      )}
                    >
                      BEST
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-2.5 text-center text-xs text-slate-500">
            {avatarServiceOffline
              ? "Avatar service offline"
              : !hasAvatar
              ? "Create your avatar first"
              : sizingLoading
              ? "Loading available sizes..."
              : "No sizes available for this garment"}
          </div>
        )}
        {recommendedSize && (
          <p className="text-[11px] text-emerald-700">
            <span className="font-semibold">Best fit:</span> Size{" "}
            {recommendedSize} recommended by avatar engine for {fitPreference}{" "}
            fit.
          </p>
        )}
      </div>

      {/* Fit Preference Selector */}
      <div className="space-y-1.5">
        <label className="block text-xs font-bold text-slate-800">
          Fit Preference
        </label>
        <div
          className="flex flex-wrap gap-2"
          role="radiogroup"
          aria-label="Fit preference"
        >
          {FIT_PREFERENCE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={fitPreference === opt.value}
              onClick={() => onSelectFitPreference(opt.value)}
              className={cn(
                "cursor-pointer rounded-lg border px-3 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6633EE]",
                fitPreference === opt.value
                  ? "bg-[#6633EE] border-[#6633EE] text-white"
                  : "border-slate-300 bg-white text-slate-900 hover:border-violet-400 hover:bg-violet-50"
              )}
            >
              {opt.label} (+{opt.easeCm} cm)
            </button>
          ))}
        </div>
      </div>

      {/* View Mode & Fabric Color Controls */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 pt-2 border-t border-slate-100">
        {/* View Mode Toggle */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-slate-800">
            View Mode
          </label>
          <div
            className="flex rounded-lg border border-slate-300 bg-slate-100 p-0.5"
            role="radiogroup"
            aria-label="View mode"
          >
            <button
              type="button"
              role="radio"
              aria-checked={viewMode === "fabric"}
              onClick={() => onSelectViewMode("fabric")}
              className={cn(
                "cursor-pointer flex-1 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors text-center",
                viewMode === "fabric"
                  ? "bg-[#6633EE] text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              Fabric View
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={viewMode === "heatmap"}
              onClick={() => onSelectViewMode("heatmap")}
              className={cn(
                "cursor-pointer flex-1 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors text-center",
                viewMode === "heatmap"
                  ? "bg-[#6633EE] text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              Fit Heatmap
            </button>
          </div>
        </div>

        {/* Fabric Color Swatches */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-slate-800">
            Fabric Color
          </label>
          <div
            className="flex items-center gap-2 pt-0.5"
            role="radiogroup"
            aria-label="Fabric color"
          >
            {FABRIC_COLOR_OPTIONS.map((swatch) => {
              const isSelected =
                colorHex.toLowerCase() === swatch.hex.toLowerCase();
              return (
                <button
                  key={swatch.hex}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  aria-label={swatch.name}
                  title={swatch.name}
                  onClick={() => onSelectColorHex(swatch.hex)}
                  className={cn(
                    "cursor-pointer h-7 w-7 rounded-full border-2 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6633EE]",
                    isSelected
                      ? "border-white ring-2 ring-[#6633EE] scale-110 shadow-xs"
                      : "border-slate-300 hover:scale-105"
                  )}
                  style={{ backgroundColor: swatch.hex }}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* Heatmap Legend */}
      {viewMode === "heatmap" && (
        <div className="flex flex-wrap items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] text-slate-600">
          <span className="font-semibold text-slate-700">Heatmap:</span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-[#ef4444]" /> Tight
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-[#f59e0b]" /> Snug
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-[#22c55e]" /> Ideal
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-[#38bdf8]" /> Relaxed / Loose
          </span>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
        <Button
          type="button"
          size="sm"
          onClick={onDress}
          disabled={dressDisabled}
          className="flex-1 min-w-[140px]"
        >
          {dressingLoading ? (
            <>
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              Dressing Avatar...
            </>
          ) : (
            <>
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              Dress Avatar
            </>
          )}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onRemoveGarment}
          disabled={!hasDressedGarment}
          className="flex-1 min-w-[140px]"
        >
          <Trash2 className="mr-1.5 h-3.5 w-3.5" />
          Remove Garment
        </Button>
      </div>
    </div>
  );
}
