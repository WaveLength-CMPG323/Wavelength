import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { fetchCosmeticsInventory } from '../lib/api';
import { getSocket } from '../lib/socket';
import { useAuth } from './AuthContext';

// Tracks which cosmetic aura (if any) the LOGGED-IN viewer currently has
// equipped, so their own avatar can show it (nav bar + profile page -
// see OceanNav.tsx / MyProfilePage.tsx). Modeled on ChatContext.tsx's
// shape: fetch on login, subscribe to the relevant socket event while
// logged in, clear on logout. Deliberately only the VIEWER'S OWN equipped
// cosmetic - showing someone else's equipped cosmetic on their profile
// isn't wired up yet (that data isn't available on HostProfilePage/
// UserProfilePage), so this context has nothing to do with that.

interface CosmeticsContextValue {
  equippedEffectCss: string | null;
}

const CosmeticsContext = createContext<CosmeticsContextValue | null>(null);

export function CosmeticsProvider({ children }: { children: ReactNode }) {
  const { isLoggedIn, profile } = useAuth();
  const [equippedEffectCss, setEquippedEffectCss] = useState<string | null>(null);

  // Load the real inventory on login and pick out whichever row (if any)
  // is equipped - same "fetch on login, clear on logout" pattern
  // ChatContext uses for friends/groups.
  useEffect(() => {
    if (!isLoggedIn) {
      setEquippedEffectCss(null);
      return;
    }

    let cancelled = false;
    fetchCosmeticsInventory()
      .then((items) => {
        if (cancelled) return;
        const equipped = items.find((item) => item.is_equipped);
        setEquippedEffectCss(equipped?.css_class ?? null);
      })
      .catch((err) => {
        console.error('Could not load cosmetics inventory:', err);
      });

    return () => {
      cancelled = true;
    };
  }, [isLoggedIn]);

  // Live updates: backend/routes/cosmetics.js's POST /equip broadcasts
  // this to everyone, so only act on it when it's about MY OWN account -
  // otherwise this would flip the viewer's own avatar aura based on some
  // other person equipping/unequipping a cosmetic. Updates state directly
  // from the event payload instead of refetching the whole inventory.
  useEffect(() => {
    const socket = getSocket();
    const myId = profile?.spotifyUserId;

    function onCosmeticChanged(payload: {
      spotifyUserId: string;
      rewardId: string;
      isEquipped: boolean;
      cssClass: string | null;
    }) {
      if (!myId || payload.spotifyUserId !== myId) return;
      setEquippedEffectCss(payload.isEquipped ? payload.cssClass : null);
    }

    socket.on('user_cosmetic_changed', onCosmeticChanged);
    return () => {
      socket.off('user_cosmetic_changed', onCosmeticChanged);
    };
  }, [profile?.spotifyUserId]);

  return (
    <CosmeticsContext.Provider value={{ equippedEffectCss }}>
      {children}
    </CosmeticsContext.Provider>
  );
}

export function useCosmetics(): CosmeticsContextValue {
  const ctx = useContext(CosmeticsContext);
  if (!ctx) throw new Error('useCosmetics must be used within a CosmeticsProvider');
  return ctx;
}
