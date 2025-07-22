
"use client";

import type { User } from "firebase/auth";
import { onAuthStateChanged, signOut as firebaseSignOut } from "firebase/auth";
import { auth, isFirebaseConfigured } from "@/lib/firebase"; // Import isFirebaseConfigured
import type { ReactNode } from "react";
import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  logout: () => Promise<void>;
  isFirebaseConfigured: boolean; // Expose this for UI checks
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    // Only set up the listener if Firebase is configured
    if (isFirebaseConfigured && auth) {
      const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
        setUser(currentUser);
        setLoading(false);
      });
      return () => unsubscribe();
    } else {
      // If Firebase is not configured, stop loading and set user to null.
      setLoading(false);
      setUser(null);
    }
  }, []);

  const logout = useCallback(async () => {
    if (!auth) {
        console.error("Logout failed: Firebase auth is not configured.");
        return;
    }
    try {
      await firebaseSignOut(auth);
      // onAuthStateChanged will handle setting the user to null
      toast({ title: "تم تسجيل الخروج بنجاح." });
      router.push("/login"); 
    } catch (error) {
      console.error("Error signing out: ", error);
      toast({
        variant: "destructive",
        title: "خطأ في تسجيل الخروج",
        description: "حدث خطأ أثناء محاولة تسجيل الخروج. الرجاء المحاولة مرة أخرى.",
      });
    }
  }, [toast, router]);

  const value = useMemo(() => ({
    user,
    loading,
    logout,
    isFirebaseConfigured, // Pass the flag through context
  }), [user, loading, logout]);


  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

    