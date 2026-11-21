import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  mapCategoryToGarmentType,
  appendCacheBusterToGarmentUrl,
} from "@/lib/garments";
import {
  resolveProductTryOnPanelStatus,
  buildProductTryOnPanelState,
  fetchProductTryOnSizing,
  dressProductOnAvatar,
  loadAndDressProductTryOn,
} from "@/lib/product-tryon";
import { api, ApiError } from "@/lib/api";

describe("Phase 3a: Product Detail Try-On & Category Mapping", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // ===========================================================================
  // 1. CATEGORY MAPPING (MAPPED AND UNMAPPED)
  // ===========================================================================
  describe("mapCategoryToGarmentType", () => {
    it("maps supported product categories to exact engine garmentType", () => {
      expect(mapCategoryToGarmentType("Shirts")).toBe("shirt");
      expect(mapCategoryToGarmentType("shirts")).toBe("shirt");
      expect(mapCategoryToGarmentType("  Shirt  ")).toBe("shirt");

      expect(mapCategoryToGarmentType("T-Shirts")).toBe("tshirt");
      expect(mapCategoryToGarmentType("t-shirt")).toBe("tshirt");
      expect(mapCategoryToGarmentType("tshirt")).toBe("tshirt");

      expect(mapCategoryToGarmentType("Trousers")).toBe("trousers");
      expect(mapCategoryToGarmentType("trouser")).toBe("trousers");

      expect(mapCategoryToGarmentType("Kurtis")).toBe("kurti");
      expect(mapCategoryToGarmentType("kurti")).toBe("kurti");
    });

    it("returns null for unmapped categories (shoes, jackets, outerwear, accessories, hoodies) and never guesses", () => {
      expect(mapCategoryToGarmentType("Shoes")).toBeNull();
      expect(mapCategoryToGarmentType("Jackets")).toBeNull();
      expect(mapCategoryToGarmentType("Outerwear")).toBeNull();
      expect(mapCategoryToGarmentType("Accessories")).toBeNull();
      expect(mapCategoryToGarmentType("Hoodies")).toBeNull();
      expect(mapCategoryToGarmentType("Footwear")).toBeNull();
      expect(mapCategoryToGarmentType("")).toBeNull();
      expect(mapCategoryToGarmentType("   ")).toBeNull();
      expect(mapCategoryToGarmentType(null)).toBeNull();
      expect(mapCategoryToGarmentType(undefined)).toBeNull();
    });
  });

  // ===========================================================================
  // 2. PANEL STATES (UNMAPPED, UNAUTHENTICATED, NO AVATAR, OFFLINE, SUCCESS)
  // ===========================================================================
  describe("ProductAvatarTryOnPanel states", () => {
    it("resolves to unmapped (no panel) when product category has no mapping (e.g. Shoes, Jackets, Outerwear)", () => {
      const stateJackets = buildProductTryOnPanelState({
        category: "Jackets",
        isAuthenticated: true,
        avatarId: "deadbeef",
        avatarServiceOffline: false,
      });
      expect(stateJackets.status).toBe("unmapped");
      expect(stateJackets.garmentType).toBeNull();
      expect(stateJackets.heading).toBeNull();

      const stateShoes = buildProductTryOnPanelState({
        category: "Shoes",
        isAuthenticated: true,
        avatarId: "deadbeef",
        avatarServiceOffline: false,
      });
      expect(stateShoes.status).toBe("unmapped");
      expect(stateShoes.garmentType).toBeNull();
    });

    it("resolves to unauthenticated with sign-in prompt when customer is not logged in", () => {
      const state = buildProductTryOnPanelState({
        category: "Shirts",
        isAuthenticated: false,
        avatarId: null,
        avatarServiceOffline: false,
      });

      expect(state.status).toBe("unauthenticated");
      expect(state.garmentType).toBe("shirt");
      expect(state.heading).toContain("Sign in");
      expect(state.actionHref).toBe("/auth/login");
    });

    it("resolves to no_avatar ('Create your avatar first' linking to /body-profile) when user has no avatar", () => {
      const statusRes = resolveProductTryOnPanelStatus({
        category: "Shirts",
        isAuthenticated: true,
        avatarId: null,
        avatarServiceOffline: false,
      });
      expect(statusRes).toEqual({ status: "no_avatar", garmentType: "shirt" });

      const state = buildProductTryOnPanelState({
        category: "Shirts",
        isAuthenticated: true,
        avatarId: null,
        avatarServiceOffline: false,
      });

      expect(state.status).toBe("no_avatar");
      expect(state.heading).toBe("Create your avatar first");
      expect(state.actionLabel).toBe("Create your avatar first");
      expect(state.actionHref).toBe("/body-profile");
    });

    it("resolves to offline ('Avatar service offline') when avatar engine is offline", () => {
      const statusRes = resolveProductTryOnPanelStatus({
        category: "Trousers",
        isAuthenticated: true,
        avatarId: "deadbeef",
        avatarServiceOffline: true,
      });
      expect(statusRes).toEqual({ status: "offline", garmentType: "trousers" });

      const state = buildProductTryOnPanelState({
        category: "Trousers",
        isAuthenticated: true,
        avatarId: "deadbeef",
        avatarServiceOffline: true,
      });

      expect(state.status).toBe("offline");
      expect(state.heading).toBe("Avatar service offline");
      expect(state.dressedUrl).toBeNull();
    });

    it(" transitions to offline ('Avatar service offline') when engine returns 503 during sizing", async () => {
      vi.spyOn(api, "getAvatarSizing").mockRejectedValueOnce(
        new ApiError(503, "SERVICE_UNAVAILABLE", "Avatar service offline")
      );

      const state = await loadAndDressProductTryOn({
        category: "Shirts",
        isAuthenticated: true,
        avatarId: "deadbeef",
      });

      expect(state.status).toBe("offline");
      expect(state.heading).toBe("Avatar service offline");
    });

    it("fetches engine sizes, selects recommended BEST size, and dresses avatar with cache-busting ?v= on success", async () => {
      const mockSizes = [
        { size: "28", fit_score: 79, overall: "Snug" },
        { size: "30", fit_score: 91, overall: "Ideal" },
        { size: "32", fit_score: 96, overall: "Best Match" },
        { size: "34", fit_score: 85, overall: "Relaxed" },
      ];

      const sizingSpy = vi
        .spyOn(api, "getAvatarSizing")
        .mockResolvedValueOnce({
          garment_type: "trousers",
          gender: "male",
          fit_preference: "regular",
          recommended_size: "32",
          recommended_score: 96,
          sizes: mockSizes,
        });

      const dressSpy = vi
        .spyOn(api, "dressAvatar")
        .mockResolvedValueOnce({
          mode: "live_avatar_engine",
          garment: {
            type: "trousers",
            size: "32",
            fitPreference: "regular",
            colorHex: "#312E81",
            viewMode: "fabric",
            url: "/api/avatar/assets/deadbeef/garment_trousers.glb",
          },
        });

      const state = await loadAndDressProductTryOn({
        category: "Trousers",
        isAuthenticated: true,
        avatarId: "deadbeef",
        fitPreference: "regular",
        colorHex: "#312E81",
        viewMode: "fabric",
        version: 1700000000000,
      });

      expect(sizingSpy).toHaveBeenCalledWith({
        avatarId: "deadbeef",
        garmentType: "trousers",
        fitPreference: "regular",
      });
      expect(dressSpy).toHaveBeenCalledWith({
        avatarId: "deadbeef",
        garmentType: "trousers",
        size: "32",
        fitPreference: "regular",
        colorHex: "#312E81",
        viewMode: "fabric",
      });

      expect(state.status).toBe("ready");
      expect(state.garmentType).toBe("trousers");
      expect(state.availableSizes).toEqual(mockSizes);
      expect(state.recommendedSize).toBe("32");
      expect(state.selectedSize).toBe("32");
      expect(state.dressedUrl).toBe(
        "/api/avatar/assets/deadbeef/garment_trousers.glb?v=1700000000000"
      );
    });

    it("fetches sizing and dresses kurti via fetchProductTryOnSizing & dressProductOnAvatar with cache-busting ?v=", async () => {
      const mockSizingResponse = {
        garment_type: "kurti",
        gender: "female",
        fit_preference: "relaxed",
        recommended_size: "M",
        recommended_score: 94,
        sizes: [
          { size: "S", fit_score: 84, overall: "Snug" },
          { size: "M", fit_score: 94, overall: "Ideal" },
          { size: "L", fit_score: 88, overall: "Relaxed" },
        ],
      };

      vi.spyOn(api, "getAvatarSizing").mockResolvedValueOnce(
        mockSizingResponse
      );
      vi.spyOn(api, "dressAvatar").mockResolvedValueOnce({
        mode: "live_avatar_engine",
        garment: {
          type: "kurti",
          size: "M",
          fitPreference: "relaxed",
          colorHex: "#2563eb",
          viewMode: "fabric",
          url: "/api/avatar/assets/deadbeef/garment_kurti.glb",
        },
      });

      const sizingRes = await fetchProductTryOnSizing({
        avatarId: "deadbeef",
        garmentType: "kurti",
        fitPreference: "relaxed",
      });
      expect(sizingRes.recommended_size).toBe("M");

      const { response, dressedUrl } = await dressProductOnAvatar(
        {
          avatarId: "deadbeef",
          garmentType: "kurti",
          size: "M",
          fitPreference: "relaxed",
          colorHex: "#2563eb",
          viewMode: "fabric",
        },
        1732176000000
      );

      expect(response.mode).toBe("live_avatar_engine");
      expect(dressedUrl).toBe(
        appendCacheBusterToGarmentUrl(
          "/api/avatar/assets/deadbeef/garment_kurti.glb",
          1732176000000
        )
      );
    });
  });
});
