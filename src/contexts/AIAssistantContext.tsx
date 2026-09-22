import { createContext, useContext, useState, type ReactNode } from 'react';

interface AIAssistantContextValue {
  open: boolean;
  setOpen: (value: boolean) => void;
  toggle: () => void;
}

const AIAssistantContext = createContext<AIAssistantContextValue>({
  open: false,
  setOpen: () => {},
  toggle: () => {},
});

export function AIAssistantProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const toggle = () => setOpen((v) => !v);
  return (
    <AIAssistantContext.Provider value={{ open, setOpen, toggle }}>
      {children}
    </AIAssistantContext.Provider>
  );
}

export function useAIAssistant() {
  return useContext(AIAssistantContext);
}
