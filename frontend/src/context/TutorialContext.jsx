import React, { createContext, useContext, useEffect, useState } from "react";
import { AuthContext } from "./AuthContext";

export const TutorialContext = createContext(null);

const seenKey = (role) => `tutorial_seen_${role}`;

export const TutorialProvider = ({ children }) => {
  const { token, role } = useContext(AuthContext);
  const normalizedRole = role ? role.toLowerCase() : null;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!token || !normalizedRole) return;
    const alreadySeen = localStorage.getItem(seenKey(normalizedRole)) === "true";
    if (!alreadySeen) {
      setVisible(true);
    }
  }, [token, normalizedRole]);

  const openTutorial = () => setVisible(true);

  const closeTutorial = () => {
    if (normalizedRole) {
      localStorage.setItem(seenKey(normalizedRole), "true");
    }
    setVisible(false);
  };

  return (
    <TutorialContext.Provider value={{ visible, role: normalizedRole, openTutorial, closeTutorial }}>
      {children}
    </TutorialContext.Provider>
  );
};
