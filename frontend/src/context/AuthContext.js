import { createContext, useContext, useEffect, useState } from "react";
import { api } from "@/lib/api";

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("pd_token");
    if (!token) { setLoading(false); return; }
    api.get("/auth/me").then((r) => setUser(r.data)).catch(() => localStorage.removeItem("pd_token")).finally(() => setLoading(false));
  }, []);

  const loginSuccess = (data) => {
    localStorage.setItem("pd_token", data.token);
    setUser(data.user);
  };
  const logout = () => {
    localStorage.removeItem("pd_token");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, loginSuccess, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
