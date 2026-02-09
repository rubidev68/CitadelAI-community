import { useAuth } from "@/contexts/AuthContext";
import { BlockEditorProvider } from "@/contexts/BlockEditorContext";
import { useLocation, Navigate } from "react-router-dom";
import Dashboard from "./Dashboard";
import BlockEditor from "@/components/editor/BlockEditor";
import { DeleteConfirmationDialog } from "@/components/editor/DeleteConfirmationDialog";

const AppContent = () => {
  const { user } = useAuth();
  const location = useLocation();
  
  // If not authenticated, redirect to login
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  // If authenticated, show appropriate content based on route
  if (location.pathname === '/builder' || location.pathname.startsWith('/chatbot/')) {
    return (
      <BlockEditorProvider>
        <BlockEditor />
        <DeleteConfirmationDialog />
      </BlockEditorProvider>
    );
  }
  
  // Default to dashboard for root route
  return <Dashboard />;
};

const Index = () => {
  return <AppContent />;
};

export default Index;
