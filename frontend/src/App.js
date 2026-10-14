import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import Landing from "@/pages/Landing";
import Auth from "@/pages/Auth";
import Dashboard from "@/pages/Dashboard";
import PublicMenu from "@/pages/PublicMenu";
import PaymentResult from "@/pages/PaymentResult";

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen grid place-items-center text-muted-foreground">Carregando...</div>;
  if (!user) return <Navigate to="/entrar" replace />;
  return children;
}

function App() {
  return (
    <AuthProvider>
      <Toaster position="top-center" richColors />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/entrar" element={<Auth mode="login" />} />
          <Route path="/cadastrar" element={<Auth mode="register" />} />
          <Route path="/painel/*" element={<Protected><Dashboard /></Protected>} />
          <Route path="/menu/:slug" element={<PublicMenu />} />
          <Route path="/payment/success" element={<Protected><PaymentResult status="success" /></Protected>} />
          <Route path="/payment/cancel" element={<Protected><PaymentResult status="cancel" /></Protected>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
