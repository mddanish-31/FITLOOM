import { api, ApiError } from "@/lib/api";
import type {
  AvatarDressInput,
  AvatarDressResponse,
  AvatarSizeItem,
  AvatarSizingResponse,
  FitPreferenceAvatarOption,
  GarmentTypeOption,
} from "@/lib/api/types";
import {
  appendCacheBusterToGarmentUrl,
  FABRIC_COLOR_OPTIONS,
  mapCategoryToGarmentType,
  type GarmentViewMode,
} from "@/lib/garments";

export type ProductTryOnPanelStatus =
  | "unmapped"
  | "unauthenticated"
  | "offline"
  | "no_avatar"
  | "ready";

export interface ProductTryOnPanelState {
  status: ProductTryOnPanelStatus;
  garmentType: GarmentTypeOption | null;
  heading: string | null;
  message: string | null;
  actionHref: string | null;
  actionLabel: string | null;
  availableSizes: AvatarSizeItem[];
  recommendedSize: string | null;
  selectedSize: string;
  fitPreference: FitPreferenceAvatarOption;
  viewMode: GarmentViewMode;
  colorHex: string;
  dressedUrl: string | null;
}

export function resolveProductTryOnPanelStatus(params: {
  category: string | null | undefined;
  isAuthenticated: boolean;
  avatarId: string | null | undefined;
  avatarServiceOffline: boolean;
}): {
  status: ProductTryOnPanelStatus;
  garmentType: GarmentTypeOption | null;
} {
  const garmentType = mapCategoryToGarmentType(params.category);
  if (!garmentType) {
    return { status: "unmapped", garmentType: null };
  }
  if (!params.isAuthenticated) {
    return { status: "unauthenticated", garmentType };
  }
  if (params.avatarServiceOffline) {
    return { status: "offline", garmentType };
  }
  if (!params.avatarId) {
    return { status: "no_avatar", garmentType };
  }
  return { status: "ready", garmentType };
}

export function buildProductTryOnPanelState(params: {
  category: string | null | undefined;
  isAuthenticated: boolean;
  avatarId: string | null | undefined;
  avatarServiceOffline: boolean;
  availableSizes?: AvatarSizeItem[];
  recommendedSize?: string | null;
  selectedSize?: string;
  fitPreference?: FitPreferenceAvatarOption;
  viewMode?: GarmentViewMode;
  colorHex?: string;
  dressedUrl?: string | null;
}): ProductTryOnPanelState {
  const { status, garmentType } = resolveProductTryOnPanelStatus(params);
  const sizes = params.availableSizes ?? [];
  const rec = params.recommendedSize ?? null;
  const selected =
    params.selectedSize && sizes.some((s) => s.size === params.selectedSize)
      ? params.selectedSize
      : rec || sizes[0]?.size || "M";
  const fitPreference = params.fitPreference ?? "regular";
  const viewMode = params.viewMode ?? "fabric";
  const colorHex =
    params.colorHex && /^#[0-9a-fA-F]{6}$/.test(params.colorHex)
      ? params.colorHex
      : FABRIC_COLOR_OPTIONS[0].hex;

  if (status === "unmapped") {
    return {
      status,
      garmentType: null,
      heading: null,
      message: null,
      actionHref: null,
      actionLabel: null,
      availableSizes: [],
      recommendedSize: null,
      selectedSize: selected,
      fitPreference,
      viewMode,
      colorHex,
      dressedUrl: null,
    };
  }

  if (status === "unauthenticated") {
    return {
      status,
      garmentType,
      heading: "Sign in to try on your avatar",
      message:
        "Log in to your customer account to load your 3D avatar and see personalized engine size scores.",
      actionHref: "/auth/login",
      actionLabel: "Sign in",
      availableSizes: [],
      recommendedSize: null,
      selectedSize: selected,
      fitPreference,
      viewMode,
      colorHex,
      dressedUrl: null,
    };
  }

  if (status === "offline") {
    return {
      status,
      garmentType,
      heading: "Avatar service offline",
      message:
        "The 3D avatar engine is temporarily unavailable. Live 3D try-on and engine sizing cannot be loaded right now.",
      actionHref: null,
      actionLabel: null,
      availableSizes: [],
      recommendedSize: null,
      selectedSize: selected,
      fitPreference,
      viewMode,
      colorHex,
      dressedUrl: null,
    };
  }

  if (status === "no_avatar") {
    return {
      status,
      garmentType,
      heading: "Create your avatar first",
      message:
        "Generate your 3D avatar from your measurements or photos on your Body Profile before trying on garments.",
      actionHref: "/body-profile",
      actionLabel: "Create your avatar first",
      availableSizes: [],
      recommendedSize: null,
      selectedSize: selected,
      fitPreference,
      viewMode,
      colorHex,
      dressedUrl: null,
    };
  }

  return {
    status: "ready",
    garmentType,
    heading: "Try on my avatar",
    message: null,
    actionHref: null,
    actionLabel: null,
    availableSizes: sizes,
    recommendedSize: rec,
    selectedSize: selected,
    fitPreference,
    viewMode,
    colorHex,
    dressedUrl: params.dressedUrl ?? null,
  };
}

export async function fetchProductTryOnSizing(params: {
  avatarId: string;
  garmentType: GarmentTypeOption;
  fitPreference: FitPreferenceAvatarOption;
}): Promise<AvatarSizingResponse> {
  return api.getAvatarSizing({
    avatarId: params.avatarId,
    garmentType: params.garmentType,
    fitPreference: params.fitPreference,
  });
}

export async function dressProductOnAvatar(
  input: AvatarDressInput,
  version: number = Date.now()
): Promise<{ response: AvatarDressResponse; dressedUrl: string }> {
  const response = await api.dressAvatar(input);
  const dressedUrl = appendCacheBusterToGarmentUrl(
    response.garment.url,
    version
  );
  return { response, dressedUrl };
}

export async function loadAndDressProductTryOn(params: {
  category: string | null | undefined;
  isAuthenticated: boolean;
  avatarId: string | null | undefined;
  avatarServiceOffline?: boolean;
  fitPreference?: FitPreferenceAvatarOption;
  selectedSize?: string;
  colorHex?: string;
  viewMode?: GarmentViewMode;
  version?: number;
}): Promise<ProductTryOnPanelState> {
  const initial = buildProductTryOnPanelState({
    category: params.category,
    isAuthenticated: params.isAuthenticated,
    avatarId: params.avatarId,
    avatarServiceOffline: Boolean(params.avatarServiceOffline),
    fitPreference: params.fitPreference,
    colorHex: params.colorHex,
    viewMode: params.viewMode,
  });

  if (initial.status !== "ready" || !params.avatarId || !initial.garmentType) {
    return initial;
  }

  try {
    const sizing = await fetchProductTryOnSizing({
      avatarId: params.avatarId,
      garmentType: initial.garmentType,
      fitPreference: initial.fitPreference,
    });

    const targetSize =
      params.selectedSize &&
      sizing.sizes.some((s) => s.size === params.selectedSize)
        ? params.selectedSize
        : sizing.recommended_size || sizing.sizes[0]?.size || "M";

    const { dressedUrl } = await dressProductOnAvatar(
      {
        avatarId: params.avatarId,
        garmentType: initial.garmentType,
        size: targetSize,
        fitPreference: initial.fitPreference,
        colorHex: initial.colorHex,
        viewMode: initial.viewMode,
      },
      params.version
    );

    return buildProductTryOnPanelState({
      category: params.category,
      isAuthenticated: true,
      avatarId: params.avatarId,
      avatarServiceOffline: false,
      availableSizes: sizing.sizes,
      recommendedSize: sizing.recommended_size,
      selectedSize: targetSize,
      fitPreference: initial.fitPreference,
      colorHex: initial.colorHex,
      viewMode: initial.viewMode,
      dressedUrl,
    });
  } catch (err: unknown) {
    if (err instanceof ApiError && err.status === 404) {
      return buildProductTryOnPanelState({
        category: params.category,
        isAuthenticated: true,
        avatarId: null,
        avatarServiceOffline: false,
      });
    }
    return buildProductTryOnPanelState({
      category: params.category,
      isAuthenticated: true,
      avatarId: params.avatarId,
      avatarServiceOffline: true,
    });
  }
}
